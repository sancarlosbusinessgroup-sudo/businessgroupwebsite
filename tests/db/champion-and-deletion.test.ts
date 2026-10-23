import { describe, expect, it } from 'vitest';
import { anon, as, ids, user, withClient } from './helpers';

// Migrations 20261023000003_champion.sql and 20261023000004_account_deletion.sql.

describe('BARP Champion awards', () => {
  it('admins save a champion with a reason; anyone can read it; members cannot write', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.admin, role: 'authenticated' })]);
        await c.query(
          `insert into champion_awards (month, profile_id, auto_profile_id, reason, points, chosen_by) values ('2026-09-01', $1, $2, 'Ran the mixer', '{"points": 12}', $3)`,
          [ids.member, ids.member3, ids.admin],
        );
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        expect((await c.query(`select reason from champion_awards where month = '2026-09-01'`)).rows[0]).toEqual({ reason: 'Ran the mixer' });
        await expect(c.query(`update champion_awards set reason = 'me!' where month = '2026-09-01' returning month`)).resolves.toMatchObject({ rowCount: 0 });
        await c.query(`set local role anon`);
        expect((await c.query(`select month from champion_awards`)).rows.length).toBeGreaterThan(0);
      } finally {
        await c.query('rollback');
      }
    });
    await expect(as(user(ids.member), (q) => q(`insert into champion_awards (month, profile_id) values ('2026-08-01', $1)`, [ids.member]))).rejects.toThrow(
      /row-level security/,
    );
    await expect(as(user(ids.admin), (q) => q(`insert into champion_awards (month, profile_id) values ('2026-08-15', $1)`, [ids.member]))).rejects.toThrow(
      /check constraint/,
    );
    await expect(as(anon, (q) => q(`select month from champion_awards`))).resolves.toBeDefined();
  });
});

describe('deleting a member account keeps shared history', () => {
  it('referral slips and one-on-ones stay, with the deleted person shown as empty', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const { rows } = await c.query(
          `insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'leaving.member@example.test', '{"first_name":"Lee","last_name":"Leaving","business_name":"Leaving Co"}') returning id`,
        );
        const gone = rows[0].id as string;
        await c.query(`update profiles set status = 'approved' where id = $1`, [gone]);
        const r = (await c.query(`insert into referrals (from_id, to_id, contact_name) values ($1, $2, 'Shared Prospect') returning id`, [gone, ids.member]))
          .rows[0].id;
        const o = (await c.query(`insert into one_on_ones (reporter_id, partner_id, met_on) values ($1, $2, current_date) returning id`, [ids.member, gone]))
          .rows[0].id;
        await c.query(`delete from auth.users where id = $1`, [gone]);
        expect((await c.query(`select from_id, to_id from referrals where id = $1`, [r])).rows[0]).toEqual({ from_id: null, to_id: ids.member });
        expect((await c.query(`select reporter_id, partner_id from one_on_ones where id = $1`, [o])).rows[0]).toEqual({
          reporter_id: ids.member,
          partner_id: null,
        });
        expect((await c.query(`select id from profiles where id = $1`, [gone])).rows).toHaveLength(0);
      } finally {
        await c.query('rollback');
      }
    });
  });
});

describe('members cannot empty who is on a slip themselves', () => {
  it('the receiver cannot remove the giver from a slip', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const r = (await c.query(`insert into referrals (from_id, to_id, contact_name) values ($1, $2, 'Keep Giver') returning id`, [ids.member3, ids.member]))
          .rows[0].id;
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        await expect(c.query(`update referrals set from_id = null where id = $1`, [r])).rejects.toThrow(/cannot change who is on a referral/);
      } finally {
        await c.query('rollback');
      }
    });
  });
});
