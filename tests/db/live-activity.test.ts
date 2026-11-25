import { describe, expect, it } from 'vitest';
import { anon, as, ids, user, withClient, type Query } from './helpers';

// Migration 20261125000002_live_activity.sql (owner, 2026-11-25): activity counters that open pages watch to update
// live, plus duplicate guards for one-on-ones and referral slips.

type Versions = Record<'referrals' | 'one_on_ones' | 'visitors' | 'attendance' | 'champion', number>;
const versions = async (q: Query): Promise<Versions> =>
  Object.fromEntries((await q(`select kind, version::int as v from public.activity_versions`)).map((r) => [r.kind as string, Number(r.v)])) as Versions;

const err = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e as { code?: string; message?: string };
  }
};

describe('activity_versions: who can see it', () => {
  it('approved members read the five counters', async () => {
    const rows = await as(user(ids.member), (q) => q(`select kind from public.activity_versions order by kind`));
    expect(rows.map((r) => r.kind)).toEqual(['attendance', 'champion', 'one_on_ones', 'referrals', 'visitors']);
  });
  it('visitors and pending applicants see nothing', async () => {
    expect(await err(as(anon, (q) => q(`select * from public.activity_versions`)))).toMatchObject({ code: '42501' });
    expect(await as(user(ids.pending), (q) => q(`select * from public.activity_versions`))).toHaveLength(0);
  });
  it('nobody can change the counters directly', async () => {
    expect(await err(as(user(ids.admin), (q) => q(`update public.activity_versions set version = 0`)))).toMatchObject({ code: '42501' });
    expect(await err(as(user(ids.admin), (q) => q(`insert into public.activity_versions (kind) values ('x')`)))).toMatchObject({ code: '42501' });
  });
  it('is in the Realtime publication when the database has one (the local stack has none)', async () => {
    await withClient(async (c) => {
      const pub = (await c.query(`select 1 from pg_publication where pubname = 'supabase_realtime'`)).rowCount;
      const listed = (await c.query(`select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'activity_versions'`)).rowCount;
      expect(listed).toBe(pub ? 1 : 0);
    });
  });
});

describe('activity_versions: bumped on every report, edit and delete', () => {
  it('referrals: file, edit (status, value), delete', async () => {
    await as(user(ids.member), async (q) => {
      const v0 = await versions(q);
      const [r] = (await q(`insert into public.referrals (from_id, to_id, contact_name) values ($1, $2, 'Live test prospect') returning id`, [
        ids.member,
        ids.member3,
      ])) as [{ id: string }];
      const v1 = await versions(q);
      expect(v1.referrals).toBe(v0.referrals + 1);
      expect(v1.one_on_ones).toBe(v0.one_on_ones);
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member3, role: 'authenticated' })]);
      await q(`update public.referrals set status = 'closed_deal', amount = 900 where id = $1`, [r.id]);
      expect((await versions(q)).referrals).toBe(v0.referrals + 2);
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
      await q(`delete from public.referrals where id = $1`, [r.id]);
      expect((await versions(q)).referrals).toBe(v0.referrals + 3);
    });
  });

  it('one-on-ones: report, confirm, delete', async () => {
    await as(user(ids.member), async (q) => {
      const v0 = await versions(q);
      const [o] = (await q(`insert into public.one_on_ones (reporter_id, partner_id, met_on) values ($1, $2, current_date - 40) returning id`, [
        ids.member,
        ids.member3,
      ])) as [{ id: string }];
      expect((await versions(q)).one_on_ones).toBe(v0.one_on_ones + 1);
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member3, role: 'authenticated' })]);
      await q(`select public.confirm_one_on_one($1)`, [o.id]);
      expect((await versions(q)).one_on_ones).toBe(v0.one_on_ones + 2);
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
      await q(`delete from public.one_on_ones where id = $1`, [o.id]);
      expect((await versions(q)).one_on_ones).toBe(v0.one_on_ones + 3);
    });
  });

  it('visitors brought, attendance and champions have their own counters; a bulk change bumps once', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const q: Query = async (sql, params = []) => (await c.query(sql, params)).rows;
        const v0 = await versions(q);
        await q(
          `insert into public.guest_requests (first_name, last_name, email) values ('Live', 'Guest', 'live-guest-1@example.org'), ('Live', 'Guest2', 'live-guest-2@example.org')`,
        );
        const v1 = await versions(q);
        expect(v1.visitors).toBe(v0.visitors + 1);
        await q(`update public.guest_requests set status = 'visited', referrer_id = $1 where email like 'live-guest-%'`, [ids.member]);
        expect((await versions(q)).visitors).toBe(v0.visitors + 2);
        const [m] = (await q(`select id from public.meetings order by starts_at limit 1`)) as [{ id: string }];
        await q(`insert into public.attendance (meeting_id, profile_id, status) values ($1, $2, 'present') on conflict do nothing`, [m.id, ids.member]);
        expect((await versions(q)).attendance).toBe(v0.attendance + 1);
        expect((await versions(q)).referrals).toBe(v0.referrals);
      } finally {
        await c.query('rollback');
      }
    });
  });

  it('the leaderboard reads the same rows at once: a new referral counts exactly once', async () => {
    await as(user(ids.member), async (q) => {
      const count = async () =>
        Number(
          (
            await q(
              `select value from public.leaderboard_window(now() - interval '1 hour', now() + interval '1 hour', 20) where metric = 'referrals' and profile_id = $1`,
              [ids.member],
            )
          )[0]?.value ?? 0,
        );
      const before = await count();
      await q(`insert into public.referrals (from_id, to_id, contact_name) values ($1, $2, 'Leaderboard live prospect')`, [ids.member, ids.member3]);
      expect(await count()).toBe(before + 1);
    });
  });
});

describe('duplicate guards', () => {
  it('the same two members on the same day is one one-on-one, whoever reports it', async () => {
    await as(user(ids.member), async (q) => {
      await q(`insert into public.one_on_ones (reporter_id, partner_id, met_on) values ($1, $2, current_date - 50)`, [ids.member, ids.member3]);
      expect(
        await err(q(`insert into public.one_on_ones (reporter_id, partner_id, met_on) values ($1, $2, current_date - 50)`, [ids.member, ids.member3])),
      ).toMatchObject({
        code: '23505',
      });
    });
    await withClient(async (c) => {
      await c.query('begin');
      try {
        await c.query(`insert into public.one_on_ones (reporter_id, partner_id, met_on) values ($1, $2, current_date - 51)`, [ids.member, ids.member3]);
        // The other member reporting the same day is refused too (the site confirms theirs instead).
        await expect(
          c.query(`insert into public.one_on_ones (reporter_id, partner_id, met_on) values ($2, $1, current_date - 51)`, [ids.member, ids.member3]),
        ).rejects.toMatchObject({
          code: '23505',
        });
      } finally {
        await c.query('rollback');
      }
    });
  });

  it('another day is a different one-on-one', async () => {
    await as(user(ids.member), async (q) => {
      await q(`insert into public.one_on_ones (reporter_id, partner_id, met_on) values ($1, $2, current_date - 60)`, [ids.member, ids.member3]);
      await q(`insert into public.one_on_ones (reporter_id, partner_id, met_on) values ($1, $2, current_date - 61)`, [ids.member, ids.member3]);
    });
  });

  it('the same referral slip within 24 hours is refused, even with other capitals or spaces', async () => {
    await as(user(ids.member), async (q) => {
      await q(`insert into public.referrals (from_id, to_id, contact_name) values ($1, $2, 'Jordan Lee')`, [ids.member, ids.member3]);
      expect(
        await err(q(`insert into public.referrals (from_id, to_id, contact_name) values ($1, $2, ' jordan lee ')`, [ids.member, ids.member3])),
      ).toMatchObject({
        code: '23505',
      });
    });
  });

  it('a different prospect, receiver or day is fine', async () => {
    await as(user(ids.member), async (q) => {
      await q(`insert into public.referrals (from_id, to_id, contact_name) values ($1, $2, 'Sam Rivera')`, [ids.member, ids.member3]);
      await q(`insert into public.referrals (from_id, to_id, contact_name) values ($1, $2, 'Alex Kim')`, [ids.member, ids.member3]);
      await q(`insert into public.referrals (from_id, to_id, contact_name) values ($1, $2, 'Sam Rivera')`, [ids.member, ids.admin]);
      await q(`insert into public.referrals (from_id, to_id, contact_name, created_at) values ($1, $2, 'Sam Rivera', now() - interval '3 days')`, [
        ids.member,
        ids.member3,
      ]);
    });
  });

  it('filing a closed business twice is refused too', async () => {
    await as(user(ids.member), async (q) => {
      await q(`select public.file_closed_business($1, 'Twice Filed', null, null, 500, null)`, [ids.member3]);
      expect(await err(q(`select public.file_closed_business($1, 'Twice Filed', null, null, 500, null)`, [ids.member3]))).toMatchObject({ code: '23505' });
    });
  });
});
