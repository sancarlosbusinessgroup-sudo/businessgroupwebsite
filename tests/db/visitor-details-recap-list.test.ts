import { describe, expect, it } from 'vitest';
import { ids, withClient } from './helpers';

// Migration 20261110000003_visitor_details_recap_list.sql (owner, 2026-11-10).

describe('Zoom visitor details and the saved recap list', () => {
  it('admins fill in a Zoom-only visitor’s company, email and phone and keep a list of extra recap addresses; members can do neither', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const m = (await c.query(`select id from meetings where starts_at < now() order by starts_at desc limit 1`)).rows[0].id as string;
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.admin, role: 'authenticated' })]);
        const row = await c.query(
          `insert into zoom_participants (meeting_id, key, name, minutes, resolution, matched_by, visitor_business, visitor_email, visitor_phone)
           values ($1, 'name:geoff', 'Geoff', 60, 'visitor', 'admin', 'Weakley Co', 'geoff@example.org', '650-555-0199') returning visitor_email`,
          [m],
        );
        expect(row.rows[0].visitor_email).toBe('geoff@example.org');
        expect(
          (await c.query(`update email_settings set recap_extra_emails = array['a@example.org','b@example.org'] where id = 1 returning recap_extra_emails`))
            .rows[0].recap_extra_emails,
        ).toEqual(['a@example.org', 'b@example.org']);
        await c.query('savepoint long');
        await expect(c.query(`update zoom_participants set visitor_phone = repeat('1', 41) where key = 'name:geoff'`)).rejects.toThrow(/check/);
        await c.query('rollback to savepoint long');

        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        expect((await c.query(`select * from email_settings`)).rows).toHaveLength(0);
        expect((await c.query(`update email_settings set recap_extra_emails = '{}' where id = 1 returning id`)).rows).toHaveLength(0);
        expect((await c.query(`select visitor_email from zoom_participants`)).rows).toHaveLength(0);
      } finally {
        await c.query('rollback');
      }
    });
  });
});
