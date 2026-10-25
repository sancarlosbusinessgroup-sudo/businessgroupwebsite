import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { ids, withClient } from './helpers';

// Migration 20261025000001_closed_business.sql: a member who forgot to file a referral that has already
// become business files it afterwards as a referral that is already "closed business" (owner, 2026-10-25).

async function actAs(c: pg.Client, id: string) {
  await c.query(`set local role authenticated`);
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]);
}
async function tx<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  return withClient(async (c) => {
    await c.query('begin');
    try {
      return await fn(c);
    } finally {
      await c.query('rollback');
    }
  });
}

describe('file a closed business', () => {
  it('saves a referral from the caller that is already closed, with closed_at and the value', async () => {
    await tx(async (c) => {
      await actAs(c, ids.member);
      const id = (
        await c.query(`select public.file_closed_business($1, 'Kitchen remodel client', '650-555-0101', 'k@example.org', 12500, 'Signed last week') as id`, [
          ids.member3,
        ])
      ).rows[0].id;
      await c.query('reset role');
      const row = (await c.query(`select from_id, to_id, contact_name, prospect_phone, prospect_email, amount, notes, status, closed_at from referrals where id = $1`, [id])).rows[0];
      expect(row).toMatchObject({
        from_id: ids.member,
        to_id: ids.member3,
        contact_name: 'Kitchen remodel client',
        prospect_phone: '650-555-0101',
        prospect_email: 'k@example.org',
        notes: 'Signed last week',
        status: 'closed_deal',
      });
      expect(Number(row.amount)).toBe(12500);
      expect(row.closed_at).not.toBeNull();
    });
  });

  it('optional details may be left out', async () => {
    await tx(async (c) => {
      await actAs(c, ids.member);
      const id = (await c.query(`select public.file_closed_business($1, 'Walk-in', null, null, null, null) as id`, [ids.member3])).rows[0].id;
      await c.query('reset role');
      const row = (await c.query(`select status, amount, prospect_phone from referrals where id = $1`, [id])).rows[0];
      expect(row).toEqual({ status: 'closed_deal', amount: null, prospect_phone: null });
    });
  });

  it('refuses yourself, a pending applicant, a missing name and a negative value', async () => {
    await tx(async (c) => {
      await actAs(c, ids.member);
      for (const [args, msg] of [
        [[ids.member, 'Myself'], /another member/],
        [[ids.pending, 'Someone'], /approved member/],
        [[ids.member3, ' a '], /name/],
      ] as const) {
        await c.query('savepoint s');
        await expect(c.query(`select public.file_closed_business($1, $2, null, null, null, null)`, [...args])).rejects.toThrow(msg);
        await c.query('rollback to savepoint s');
      }
      await c.query('savepoint v');
      await expect(c.query(`select public.file_closed_business($1, 'Client', null, null, -5, null)`, [ids.member3])).rejects.toThrow(/value/);
      await c.query('rollback to savepoint v');
    });
  });

  it('pending applicants and visitors cannot call it; direct inserts still cannot start closed', async () => {
    await tx(async (c) => {
      await actAs(c, ids.pending);
      await c.query('savepoint p');
      await expect(c.query(`select public.file_closed_business($1, 'Client', null, null, null, null)`, [ids.member3])).rejects.toThrow(/approved members/);
      await c.query('rollback to savepoint p');

      await actAs(c, ids.member);
      await c.query('savepoint d');
      await expect(
        c.query(`insert into referrals (from_id, to_id, contact_name, status) values ($1, $2, 'Sneaky', 'closed_deal')`, [ids.member, ids.member3]),
      ).rejects.toThrow(/row-level security/);
      await c.query('rollback to savepoint d');

      await c.query('reset role');
      await c.query(`set local role anon`);
      await expect(c.query(`select public.file_closed_business($1, 'Client', null, null, null, null)`, [ids.member3])).rejects.toThrow(/permission denied/);
    });
  });
});
