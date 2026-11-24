import { describe, expect, it } from 'vitest';
import { anon, as, ids, withClient } from './helpers';

// Migration 20261125000001_guest_steps_panel.sql (owner, 2026-11-25).

type Q = (sql: string, p?: unknown[]) => Promise<Record<string, unknown>[]>;

/** Expects `sql` to fail without aborting the surrounding transaction. */
async function fails(q: Q, sql: string, params: unknown[], pattern: RegExp) {
  await q('savepoint expect_fail');
  await expect(q(sql, params)).rejects.toThrow(pattern);
  await q('rollback to savepoint expect_fail');
}

/** Runs `fn` as `who` after `setup` ran as the database owner, in one transaction that is rolled back. */
async function asAfter(setup: string[], who: string, fn: (q: Q) => Promise<void>) {
  await withClient(async (c) => {
    await c.query('begin');
    try {
      for (const sql of setup) await c.query(sql);
      await c.query(`set local role authenticated`);
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: who, role: 'authenticated' })]);
      await fn(async (sql, p = []) => (await c.query(sql, p)).rows);
    } finally {
      await c.query('rollback');
    }
  });
}

const guestId = '00000000-0000-4000-8000-0000000000a1';
const ivId = '00000000-0000-4000-8000-0000000000a2';
const slotId = '00000000-0000-4000-8000-0000000000a3';
const setupPanel = [
  `insert into guest_requests (id, first_name, last_name, email) values ('${guestId}', 'Pia', 'Panel', 'pia.panel@example.com')`,
  `insert into panel_interviews (id, guest_id, panelist_ids) values ('${ivId}', '${guestId}', array['${ids.admin}']::uuid[])`,
  `insert into panel_interview_slots (id, interview_id, starts_at) values ('${slotId}', '${ivId}', now() + interval '2 days')`,
];

describe('leaderboard_window (Leaderboards slide: since the last meeting)', () => {
  it('counts referrals in the window by time, including during the meeting, and never closed business', async () => {
    await asAfter(
      [
        `delete from referrals`,
        `insert into referrals (from_id, to_id, contact_name, created_at) values
           ('${ids.admin}', '${ids.member}', 'During the meeting', now() - interval '5 minutes'),
           ('${ids.admin}', '${ids.member}', 'Before the window', now() - interval '20 days')`,
      ],
      ids.member,
      async (q) => {
        const rows = await q(`select metric, value, profile_id from leaderboard_window(now() - interval '14 days', now() + interval '1 hour')`);
        expect(rows.filter((r) => r.metric === 'referrals')).toEqual([{ metric: 'referrals', value: '1', profile_id: ids.admin }]);
        expect(rows.some((r) => r.metric === 'closed_deals')).toBe(false);
      },
    );
  });

  it('is for members only', async () => {
    await as(anon, async (q) => {
      await expect(q(`select * from leaderboard_window(now() - interval '1 day', now())`)).rejects.toThrow(/permission denied|members only/);
    });
  });
});

describe('guest steps columns', () => {
  it('admins set the reminder and call columns', async () => {
    await asAfter(
      [`insert into guest_requests (id, first_name, last_name, email) values ('${guestId}', 'Pia', 'Panel', 'pia.panel@example.com')`],
      ids.admin,
      async (q) => {
        await q(
          `update guest_requests set zoom_email_dismissed_at = now(), decline_called_at = now(), membership_declined_at = now(), added_by = $2 where id = $1`,
          [guestId, ids.admin],
        );
        const [g] = await q(`select added_by, zoom_email_dismissed_at is not null as z from guest_requests where id = $1`, [guestId]);
        expect(g).toEqual({ added_by: ids.admin, z: true });
      },
    );
  });
});

describe('panel interviews', () => {
  it('admins see and manage them; members and visitors do not', async () => {
    await asAfter(setupPanel, ids.member, async (q) => {
      expect(await q(`select id from panel_interviews`)).toEqual([]);
      expect(await q(`select id from panel_interview_slots`)).toEqual([]);
      await fails(q, `insert into panel_interviews (guest_id, panelist_ids) values ($1, array[$2]::uuid[])`, [guestId, ids.member], /row-level security/);
    });
    await asAfter(setupPanel, ids.admin, async (q) => {
      expect(await q(`select id from panel_interviews`)).toEqual([{ id: ivId }]);
      await q(`update panel_interviews set status = 'scheduled', scheduled_at = now() + interval '2 days' where id = $1`, [ivId]);
      await fails(q, `update panel_interviews set status = 'scheduled', scheduled_at = null where id = $1`, [ivId], /check constraint/);
    });
    await as(anon, async (q) => {
      await expect(q(`select id from panel_interviews`)).rejects.toThrow(/permission denied/);
    });
  });

  it('three panelists at most, one interview per guest', async () => {
    await asAfter(setupPanel, ids.admin, async (q) => {
      await fails(
        q,
        `update panel_interviews set panelist_ids = array[$1, $2, $3, $4]::uuid[] where id = $5`,
        [ids.admin, ids.member, ids.member3, ids.pending, ivId],
        /check constraint/,
      );
      await fails(q, `insert into panel_interviews (guest_id, panelist_ids) values ($1, array[$2]::uuid[])`, [guestId, ids.admin], /duplicate key/);
    });
  });

  it('each panelist answers only for themselves', async () => {
    await asAfter(setupPanel, ids.admin, async (q) => {
      await q(`insert into panel_interview_answers (slot_id, profile_id, answer) values ($1, $2, 'yes')`, [slotId, ids.admin]);
      await fails(q, `insert into panel_interview_answers (slot_id, profile_id, answer) values ($1, $2, 'yes')`, [slotId, ids.member], /row-level security/);
      await fails(q, `update panel_interview_answers set answer = 'perhaps' where slot_id = $1`, [slotId], /check constraint/);
    });
  });

  it('removing a guest removes their panel interview', async () => {
    await asAfter(setupPanel, ids.admin, async (q) => {
      await q(`delete from guest_requests where id = $1`, [guestId]);
      expect(await q(`select id from panel_interviews where id = $1`, [ivId])).toEqual([]);
    });
  });
});
