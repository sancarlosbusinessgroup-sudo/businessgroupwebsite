import { describe, expect, it } from 'vitest';
import { ids, withClient } from './helpers';

// Migration 20261023000002_delete_own_and_indexes.sql.

describe('deleting referral slips (2026-10-23)', () => {
  it('the member who filed a slip deletes it at any status; the receiver cannot; admins can', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const ins = async (status: string) =>
          (
            await c.query(`insert into referrals (from_id, to_id, contact_name, status) values ($1, $2, 'Del Test', $3) returning id`, [
              ids.member,
              ids.admin,
              status,
            ])
          ).rows[0].id as string;
        const closed = await ins('closed_deal');
        const other = await ins('contacted');
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        expect((await c.query(`delete from referrals where id = $1 returning id`, [closed])).rows).toHaveLength(1);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.admin, role: 'authenticated' })]);
        expect((await c.query(`delete from referrals where id = $1 returning id`, [other])).rows).toHaveLength(1);
      } finally {
        await c.query('rollback');
      }
    });
  });

  it('a member cannot delete a slip someone else filed', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const id = (await c.query(`insert into referrals (from_id, to_id, contact_name) values ($1, $2, 'Not Mine') returning id`, [ids.admin, ids.member]))
          .rows[0].id as string;
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        expect((await c.query(`delete from referrals where id = $1 returning id`, [id])).rows).toHaveLength(0);
      } finally {
        await c.query('rollback');
      }
    });
  });
});
