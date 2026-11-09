import { describe, expect, it } from 'vitest';
import { ids, withClient } from './helpers';

// Migration 20261110000001_zoom_visitor_inviter.sql (owner, 2026-11-10): the member who invited a Zoom-only visitor.

describe('zoom_participants.invited_by', () => {
  it('admins set who invited a Zoom-only visitor; it must be a real profile; members cannot see or change it', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const m = (await c.query(`select id from meetings where starts_at < now() order by starts_at desc limit 1`)).rows[0].id as string;
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.admin, role: 'authenticated' })]);
        const row = await c.query(
          `insert into zoom_participants (meeting_id, key, name, minutes, resolution, matched_by, invited_by)
           values ($1, 'name:geoff weakley', 'Geoff Weakley', 70, 'visitor', 'admin', $2) returning id, invited_by`,
          [m, ids.member],
        );
        expect(row.rows[0].invited_by).toBe(ids.member);
        expect((await c.query(`update zoom_participants set invited_by = null where id = $1 returning id`, [row.rows[0].id])).rows).toHaveLength(1);
        await c.query('savepoint fk');
        await expect(
          c.query(`update zoom_participants set invited_by = $2 where id = $1`, [row.rows[0].id, '00000000-0000-0000-0000-00000000dead']),
        ).rejects.toThrow(/foreign key/);
        await c.query('rollback to savepoint fk');

        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        expect((await c.query(`select invited_by from zoom_participants`)).rows).toHaveLength(0);
        expect((await c.query(`update zoom_participants set invited_by = $1 returning id`, [ids.member])).rows).toHaveLength(0);
      } finally {
        await c.query('rollback');
      }
    });
  });
});
