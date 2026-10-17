import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { anon, as, ids, user, withClient } from './helpers';

// Owner change requests of 2026-10-17 (migration 20261017000003_owner_changes.sql).

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

describe('referral dollar value', () => {
  it('the giver can file a slip with a value; negative values are refused', async () => {
    await as(user(ids.member), async (q) => {
      const r = await q(`insert into referrals (from_id, to_id, contact_name, amount) values ($1, $2, 'Jo Prospect', 2500.50) returning amount`, [
        ids.member,
        ids.member3,
      ]);
      expect(Number(r[0]?.amount)).toBe(2500.5);
    });
    await expect(
      as(user(ids.member), (q) => q(`insert into referrals (from_id, to_id, contact_name, amount) values ($1, $2, 'Jo', -1)`, [ids.member, ids.member3])),
    ).rejects.toThrow(/check constraint/);
  });

  it('group totals add up the value of closed deals in the period; per-member dollars are admins only', async () => {
    await tx(async (c) => {
      const { rows } = await c.query(`insert into referrals (from_id, to_id, contact_name, amount) values ($1, $2, 'Big deal', 12000) returning id`, [
        ids.member,
        ids.member3,
      ]);
      await actAs(c, ids.member3);
      const before = (await c.query(`select (group_totals(null, null)->>'closed_amount')::numeric as v`)).rows[0]?.v;
      await c.query(`update referrals set status = 'closed_deal' where id = $1`, [rows[0]?.id]);
      const after = (await c.query(`select (group_totals(null, null)->>'closed_amount')::numeric as v`)).rows[0]?.v;
      expect(Number(after) - Number(before)).toBe(12000);
      await expect(c.query(`select * from admin_member_amounts(null, null)`)).rejects.toThrow(/admins only/);
    });
    await as(user(ids.admin), async (q) => {
      const rows = await q(`select profile_id, closed_amount_given, closed_amount_received from admin_member_amounts(null, null)`);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => Number(r.closed_amount_given) >= 0)).toBe(true);
    });
    await expect(as(anon, (q) => q(`select * from admin_member_amounts(null, null)`))).rejects.toThrow(/permission denied/);
  });
});

describe('cancelled meetings', () => {
  it('stay on the schedule with a reason, and members cannot claim a speaker slot on them', async () => {
    await tx(async (c) => {
      const m = (
        await c.query(`select id from meetings where category = 'Networking' and starts_at > now() and id not in (select meeting_id from meeting_speakers) order by starts_at limit 1`)
      ).rows[0]?.id;
      expect(m).toBeTruthy();
      await actAs(c, ids.admin);
      await c.query(`update meetings set cancelled_reason = 'Thanksgiving holiday' where id = $1`, [m]);
      await actAs(c, ids.member);
      expect((await c.query(`select cancelled_reason from meetings where id = $1`, [m])).rows[0]?.cancelled_reason).toBe('Thanksgiving holiday');
      await c.query('savepoint s');
      await expect(
        c.query(`insert into meeting_speakers (meeting_id, slot, profile_id, display_name, topic) values ($1, 'education', $2, 'Morgan Member', 'A topic')`, [
          m,
          ids.member,
        ]),
      ).rejects.toThrow(/cancelled/);
      await c.query('rollback to savepoint s');
      // members cannot cancel meetings
      const changed = await c.query(`update meetings set cancelled_reason = null where id = $1 returning id`, [m]);
      expect(changed.rows).toEqual([]);
    });
  });
});

describe('one-on-one requests', () => {
  it('a member asks another; only the two of them (and admins) see it; the invitee accepts', async () => {
    await tx(async (c) => {
      await actAs(c, ids.member);
      const { rows } = await c.query(
        `insert into one_on_one_requests (requester_id, invitee_id, proposed_on, message) values ($1, $2, current_date + 3, 'Coffee?') returning id, status`,
        [ids.member, ids.member3],
      );
      expect(rows[0]?.status).toBe('pending');
      const id = rows[0]?.id;
      // a second open request to the same member is refused
      await c.query('savepoint a');
      await expect(c.query(`insert into one_on_one_requests (requester_id, invitee_id) values ($1, $2)`, [ids.member, ids.member3])).rejects.toThrow(
        /already have an open request/,
      );
      await c.query('rollback to savepoint a');
      // the requester cannot accept their own request, and nobody edits rows directly
      await c.query('savepoint b');
      await expect(c.query(`select respond_one_on_one_request($1, 'accepted')`, [id])).rejects.toThrow(/not allowed/);
      await c.query('rollback to savepoint b');
      expect((await c.query(`update one_on_one_requests set status = 'accepted' where id = $1 returning id`, [id])).rows).toEqual([]);

      await actAs(c, ids.pending);
      expect((await c.query(`select id from one_on_one_requests where id = $1`, [id])).rows).toEqual([]);

      await actAs(c, ids.member3);
      expect((await c.query(`select message from one_on_one_requests where id = $1`, [id])).rows[0]?.message).toBe('Coffee?');
      await c.query(`select respond_one_on_one_request($1, 'accepted')`, [id]);
      const after = (await c.query(`select status, responded_at from one_on_one_requests where id = $1`, [id])).rows[0];
      expect(after?.status).toBe('accepted');
      expect(after?.responded_at).not.toBeNull();
      // answered requests can't change again
      await c.query('savepoint c');
      await expect(c.query(`select respond_one_on_one_request($1, 'declined')`, [id])).rejects.toThrow(/already answered/);
      await c.query('rollback to savepoint c');
    });
  });

  it('the requester can cancel a pending request; pending applicants and visitors cannot send requests', async () => {
    await tx(async (c) => {
      await actAs(c, ids.member);
      const id = (await c.query(`insert into one_on_one_requests (requester_id, invitee_id) values ($1, $2) returning id`, [ids.member, ids.member3])).rows[0]?.id;
      await c.query(`select respond_one_on_one_request($1, 'cancelled')`, [id]);
      expect((await c.query(`select status from one_on_one_requests where id = $1`, [id])).rows[0]?.status).toBe('cancelled');
    });
    await expect(
      as(user(ids.pending), (q) => q(`insert into one_on_one_requests (requester_id, invitee_id) values ($1, $2)`, [ids.pending, ids.member])),
    ).rejects.toThrow(/row-level security/);
    await expect(as(anon, (q) => q(`insert into one_on_one_requests (requester_id, invitee_id) values ($1, $2)`, [ids.member, ids.member3]))).rejects.toThrow(
      /permission denied|row-level security/,
    );
  });
});

describe('slide settings', () => {
  it('accept the new agenda slides and extra text per slide', async () => {
    await tx(async (c) => {
      const m = (await c.query(`select id from meetings order by starts_at desc limit 1`)).rows[0]?.id;
      await actAs(c, ids.admin);
      await c.query(`delete from meeting_slide_settings where meeting_id = $1`, [m]);
      await c.query(`insert into meeting_slide_settings (meeting_id, slides, notes) values ($1, '{welcome,networking,introductions,roundtable,closing}', $2)`, [
        m,
        JSON.stringify({ welcome: 'Happy Thanksgiving!' }),
      ]);
      const row = (await c.query(`select slides, notes from meeting_slide_settings where meeting_id = $1`, [m])).rows[0];
      expect(row?.slides).toEqual(['welcome', 'networking', 'introductions', 'roundtable', 'closing']);
      expect(row?.notes).toEqual({ welcome: 'Happy Thanksgiving!' });
      await c.query('savepoint s');
      await expect(c.query(`update meeting_slide_settings set notes = '[]' where meeting_id = $1`, [m])).rejects.toThrow(/check constraint/);
      await c.query('rollback to savepoint s');
    });
  });
});
