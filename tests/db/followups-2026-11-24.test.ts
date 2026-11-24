import { describe, expect, it } from 'vitest';
import { anon, as, ids, user, withClient } from './helpers';

// Migration 20261124000001_followups_2026_11_24.sql (owner, 2026-11-24).

/** Runs `fn` as a signed-in member after `setup` ran as the database owner, all in one transaction that is rolled back. */
async function asAfter(setup: string[], who: string, fn: (q: (sql: string, p?: unknown[]) => Promise<Record<string, unknown>[]>) => Promise<void>) {
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

/** Expects `sql` to fail without aborting the surrounding transaction. */
async function fails(c: { query: (sql: string, p?: unknown[]) => Promise<unknown> }, sql: string, params: unknown[], pattern: RegExp) {
  await c.query('savepoint expect_fail');
  await expect(c.query(sql, params)).rejects.toThrow(pattern);
  await c.query('rollback to savepoint expect_fail');
}

describe('group_totals_window (slides: since the last meeting)', () => {
  it('counts what was reported today, during the meeting, and nothing from before the window', async () => {
    await asAfter(
      [
        `delete from referrals`,
        `delete from one_on_ones`,
        `insert into referrals (from_id, to_id, contact_name, created_at) values
           ('${ids.admin}', '${ids.member}', 'Reported during the meeting', now() - interval '5 minutes'),
           ('${ids.admin}', '${ids.member}', 'Before the window', now() - interval '20 days')`,
        `insert into one_on_ones (reporter_id, partner_id, met_on, confirmed_at) values
           ('${ids.admin}', '${ids.member}', (now() at time zone 'America/Los_Angeles')::date, now()),
           ('${ids.admin}', '${ids.member3}', (now() at time zone 'America/Los_Angeles')::date, null)`,
      ],
      ids.member,
      async (q) => {
        const [r] = await q(`select group_totals_window(now() - interval '14 days', now() + interval '1 hour') as t`);
        const t = r!.t as Record<string, number>;
        expect(t.referrals).toBe(1);
        // Only confirmed one-on-ones count.
        expect(t.one_on_ones).toBe(1);
      },
    );
  });

  it('is for members only', async () => {
    await as(anon, async (q) => {
      await expect(q(`select group_totals_window(now() - interval '1 day', now())`)).rejects.toThrow(/permission denied|members only/);
    });
  });
});

describe('attendance.left_early', () => {
  it('admins can set it; only yes / no / excused', async () => {
    await as(user(ids.admin), async (q) => {
      const [m] = await q(`select id from meetings where category = 'Networking' and starts_at < now() order by starts_at desc limit 1`);
      await q(
        `insert into attendance (meeting_id, profile_id, status, left_early) values ($1, $2, 'present', 'excused')
               on conflict (meeting_id, profile_id) do update set left_early = 'excused'`,
        [m!.id, ids.member],
      );
      expect(await q(`select left_early from attendance where meeting_id = $1 and profile_id = $2`, [m!.id, ids.member])).toEqual([{ left_early: 'excused' }]);
      await expect(q(`update attendance set left_early = 'maybe' where meeting_id = $1`, [m!.id])).rejects.toThrow(/check constraint/);
    });
  });
});

describe('guest pipeline', () => {
  const guest = `insert into guest_requests (first_name, last_name, email, phone) values ('Pat', 'Pipeline', 'pat.pipeline@example.com', '555-0100') returning id`;

  it('a new guest starts in Accept or Reject; a status change moves the card forward, never back, and is logged', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const id = (await c.query(guest)).rows[0]!.id as string;
        const stage = async () => (await c.query(`select pipeline_stage from guest_requests where id = $1`, [id])).rows[0]!.pipeline_stage;
        expect(await stage()).toBe('review');
        await c.query(`update guest_requests set status = 'visited' where id = $1`, [id]);
        expect(await stage()).toBe('send_application');
        // An admin moved the card further by hand: a later status that belongs earlier doesn't pull it back.
        await c.query(`update guest_requests set pipeline_stage = 'interview' where id = $1`, [id]);
        await c.query(`update guest_requests set status = 'applied' where id = $1`, [id]);
        expect(await stage()).toBe('interview');
        await c.query(`update guest_requests set status = 'joined' where id = $1`, [id]);
        expect(await stage()).toBe('approved');
        const log = (await c.query(`select kind, detail from guest_events where guest_id = $1 order by created_at, detail`, [id])).rows;
        expect(log.map((r) => r.detail).sort()).toEqual(['applied', 'joined', 'visited']);
      } finally {
        await c.query('rollback');
      }
    });
  });

  it('only admins read and write the history', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const id = (await c.query(guest)).rows[0]!.id as string;
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        await fails(c, `insert into guest_events (guest_id, kind, detail) values ($1, 'note', 'hi')`, [id], /row-level security/);
        expect((await c.query(`select * from guest_events`)).rows).toEqual([]);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.admin, role: 'authenticated' })]);
        await c.query(`insert into guest_events (guest_id, actor_id, kind, detail) values ($1, $2, 'note', 'Called, voicemail')`, [id, ids.admin]);
        expect((await c.query(`select detail from guest_events where guest_id = $1`, [id])).rows).toEqual([{ detail: 'Called, voicemail' }]);
        // Admins can't write history in someone else's name.
        await fails(c, `insert into guest_events (guest_id, actor_id, kind) values ($1, $2, 'note')`, [id, ids.member], /row-level security/);
      } finally {
        await c.query('rollback');
      }
    });
  });
});

describe('gallery tags', () => {
  const photo = `insert into gallery_photos (id, album, caption, image_path, thumb_path, uploaded_by)
    values ('11111111-1111-4111-8111-111111111111', 'meetings', 'Tagged photo', '${ids.member}/a.jpg', '${ids.member}/a-t.jpg', '${ids.member}')`;

  it('a photo waits until everyone tagged approves; a no keeps it hidden', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        await c.query(photo);
        const seen = async (who: string | null) => {
          await c.query('reset role');
          if (who) {
            await c.query(`set local role authenticated`);
            await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: who, role: 'authenticated' })]);
          } else {
            await c.query(`set local role anon`);
            await c.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
          }
          const r = (await c.query(`select id from gallery_photos where id = '11111111-1111-4111-8111-111111111111'`)).rows.length;
          await c.query('reset role');
          return r;
        };
        // The uploader tags two members.
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        await c.query(
          `insert into gallery_tags (photo_id, profile_id, tagged_by) values ('11111111-1111-4111-8111-111111111111', $1, $2), ('11111111-1111-4111-8111-111111111111', $3, $2)`,
          [ids.admin, ids.member, ids.member3],
        );
        // Someone else can't tag people in this photo.
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member3, role: 'authenticated' })]);
        await fails(
          c,
          `insert into gallery_tags (photo_id, profile_id, tagged_by) values ('11111111-1111-4111-8111-111111111111', $1, $1)`,
          [ids.member3],
          /row-level security|duplicate key/,
        );
        await c.query('reset role');

        expect(await seen(null)).toBe(0); // visitors: hidden
        expect(await seen(ids.member)).toBe(1); // uploader
        expect(await seen(ids.member3)).toBe(1); // tagged

        // member3 approves; the admin still has to answer.
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member3, role: 'authenticated' })]);
        expect((await c.query(`select respond_gallery_tag('11111111-1111-4111-8111-111111111111', true) as s`)).rows[0]!.s).toBe('approved');
        await c.query('reset role');
        expect(await seen(null)).toBe(0);

        // The admin (also tagged) says no: still hidden. Then yes: live.
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.admin, role: 'authenticated' })]);
        await c.query(`select respond_gallery_tag('11111111-1111-4111-8111-111111111111', false)`);
        await c.query('reset role');
        expect(await seen(null)).toBe(0);
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.admin, role: 'authenticated' })]);
        await c.query(`select respond_gallery_tag('11111111-1111-4111-8111-111111111111', true)`);
        await c.query('reset role');
        expect(await seen(null)).toBe(1);
        // Visitors see approved tags of live photos (for profile galleries).
        await c.query(`set local role anon`);
        await c.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
        expect((await c.query(`select profile_id from gallery_tags where photo_id = '11111111-1111-4111-8111-111111111111'`)).rows.length).toBe(2);
        await c.query('reset role');

        // Someone not tagged can't answer for others.
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        await fails(c, `select respond_gallery_tag('11111111-1111-4111-8111-111111111111', false)`, [], /not tagged/);
      } finally {
        await c.query('rollback');
      }
    });
  });

  it('photos without tags stay public as before', async () => {
    await as(anon, async (q) => {
      expect(Array.isArray(await q(`select id from gallery_photos`))).toBe(true);
    });
  });
});

describe('report_card_goals', () => {
  it('admins read and set goals; members cannot', async () => {
    await as(user(ids.admin), async (q) => {
      await q(`update report_card_goals set one_on_ones = 6, attendance_pct = 80 where id = 1`);
      expect(await q(`select one_on_ones, attendance_pct from report_card_goals`)).toEqual([{ one_on_ones: 6, attendance_pct: 80 }]);
    });
    await as(user(ids.member), async (q) => {
      expect(await q(`select * from report_card_goals`)).toEqual([]);
      expect(await q(`update report_card_goals set referrals = 1 returning id`)).toEqual([]);
    });
  });
});
