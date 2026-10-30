import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { anon, as, ids, user, withClient } from './helpers';

// Phase A (docs/phase-2-spec.md): no ratings, referral slips without amounts, admin-only per-member stats,
// leaderboard, Management list, directory download log, weekly ask, open categories.

/** Switch the current transaction to a signed-in user (like PostgREST does). */
async function actAs(c: pg.Client, id: string) {
  await c.query(`set local role authenticated`);
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]);
}
async function actAsOwner(c: pg.Client) {
  await c.query(`reset role`);
}
/** Runs fn in a transaction as the table owner and always rolls back. */
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
const today = `(now() at time zone 'America/Los_Angeles')::date`;

describe('removed in phase A', () => {
  it('ratings, closed amounts, the public-stats setting and the old stats functions are gone', async () => {
    await withClient(async (c) => {
      const cols = (
        await c.query(
          `select table_name || '.' || column_name as col from information_schema.columns
           where table_schema = 'public' and (table_name, column_name) in
             (('one_on_one_feedback','rating'), ('referrals','closed_amount'), ('profiles','show_stats'))`,
        )
      ).rows;
      expect(cols).toEqual([]);
      const fns = (
        await c.query(
          `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('member_stats','monthly_activity','group_month_stats','top_inviters','public_member_stats')`,
        )
      ).rows;
      expect(fns).toEqual([]);
      const confirm = (await c.query(`select pg_get_function_identity_arguments('public.confirm_one_on_one'::regproc) as args`)).rows[0];
      expect(confirm?.args).toBe('p_id uuid');
    });
  });

  it('referral statuses and temperatures use the new names', async () => {
    await withClient(async (c) => {
      const values = async (t: string) =>
        (await c.query(`select array_agg(e.enumlabel::text order by e.enumsortorder) as v from pg_enum e where e.enumtypid = $1::regtype`, [t])).rows[0]?.v;
      expect(await values('public.referral_status')).toEqual(['new', 'contacted', 'meeting_set', 'closed_deal', 'not_a_fit']);
      expect(await values('public.referral_warmth')).toEqual(['hot', 'warm', 'cold']);
    });
  });
});

describe('one-on-one confirmation', () => {
  it('the partner confirms without a rating', async () => {
    await tx(async (c) => {
      const { rows } = await c.query(`insert into one_on_ones (reporter_id, partner_id, met_on) values ($1,$2,current_date) returning id`, [
        ids.member,
        ids.member3,
      ]);
      await actAs(c, ids.member3);
      await c.query(`select confirm_one_on_one($1)`, [rows[0]?.id]);
      await actAsOwner(c);
      const o = (await c.query(`select confirmed_at from one_on_ones where id=$1`, [rows[0]?.id])).rows[0];
      expect(o?.confirmed_at).not.toBeNull();
    });
  });
});

describe('referral slips', () => {
  it('the giver files a slip with prospect details and consent; it starts as new', async () => {
    await as(user(ids.member), async (q) => {
      const r = await q(
        `insert into referrals (from_id, to_id, contact_name, warmth, prospect_phone, prospect_email, prospect_consent)
         values ($1, $2, 'Jo Prospect', 'cold', '(650) 555-0100', 'jo@example.org', true) returning status, warmth, closed_at`,
        [ids.member, ids.member3],
      );
      expect(r[0]).toEqual({ status: 'new', warmth: 'cold', closed_at: null });
    });
  });

  it('a slip cannot be filed already closed', async () => {
    await expect(
      as(user(ids.member), (q) =>
        q(`insert into referrals (from_id, to_id, contact_name, status) values ($1,$2,'Jo','closed_deal')`, [ids.member, ids.member3]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('marking a closed deal stamps closed_at; moving it back clears it; nobody can set closed_at by hand', async () => {
    await tx(async (c) => {
      const { rows } = await c.query(`insert into referrals (from_id,to_id,contact_name) values ($1,$2,'Lead') returning id`, [ids.member, ids.member3]);
      const id = rows[0]?.id as string;
      await actAs(c, ids.member3);
      const forged = (await c.query(`update referrals set status='contacted', closed_at=now() - interval '30 days' where id=$1 returning closed_at`, [id]))
        .rows[0];
      expect(forged?.closed_at).toBeNull();
      const closed = (await c.query(`update referrals set status='closed_deal' where id=$1 returning closed_at`, [id])).rows[0];
      expect(closed?.closed_at).not.toBeNull();
      const reopened = (await c.query(`update referrals set status='meeting_set' where id=$1 returning closed_at`, [id])).rows[0];
      expect(reopened?.closed_at).toBeNull();
    });
  });

  it('the giver can edit notes but not the status or the receiving member', async () => {
    await tx(async (c) => {
      const { rows } = await c.query(`insert into referrals (from_id,to_id,contact_name) values ($1,$2,'Lead') returning id`, [ids.member, ids.member3]);
      const id = rows[0]?.id as string;
      await actAs(c, ids.member);
      const n = (await c.query(`update referrals set notes='Call after 5pm' where id=$1 returning notes`, [id])).rows[0];
      expect(n?.notes).toBe('Call after 5pm');
      await expect(c.query(`update referrals set to_id=$2 where id=$1`, [id, ids.admin])).rejects.toThrow(/cannot change/);
    });
  });
});

describe('stats', () => {
  type Row = Record<string, number | string>;
  const statsFor = async (c: pg.Client, from: string | null = null) => {
    await actAs(c, ids.admin);
    const rows = (await c.query(`select * from admin_member_stats($1::date, null)`, [from])).rows as Row[];
    await actAsOwner(c);
    const pick = (id: string) => rows.find((r) => r.profile_id === id) ?? {};
    return { member: pick(ids.member), member3: pick(ids.member3), all: rows };
  };

  it('admin stats count one-on-ones (confirmed, for both), referrals and closed deals (giver), received deals and visitors', async () => {
    await tx(async (c) => {
      const from = (await c.query(`select ${today}::text as d`)).rows[0]?.d as string;
      const before = await statsFor(c, from);
      // confirmed one-on-one today, plus an unconfirmed one with someone else (the same pair counts once per day
      // since the 2026-10-28 audit index), which must not count for either side
      await c.query(`insert into one_on_ones (reporter_id, partner_id, met_on, confirmed_at) values ($1,$2,${today},now())`, [ids.member, ids.member3]);
      await c.query(`insert into one_on_ones (reporter_id, partner_id, met_on) values ($1,$2,${today})`, [ids.member, ids.admin]);
      // two referrals member -> member3, one becomes a closed deal
      const r = await c.query(`insert into referrals (from_id,to_id,contact_name) values ($1,$2,'Lead A'),($1,$2,'Lead B') returning id`, [
        ids.member,
        ids.member3,
      ]);
      await c.query(`update referrals set status='closed_deal' where id=$1`, [r.rows[0]?.id]);
      // a visitor credited to member who actually came, and one who did not
      await c.query(
        `insert into guest_requests (first_name,last_name,email,referral_code) values ('V','One','v1@example.org',(select referral_code from profiles where id=$1)),
                                                                                  ('V','Two','v2@example.org',(select referral_code from profiles where id=$1))`,
        [ids.member],
      );
      await c.query(`update guest_requests set status='visited' where email='v1@example.org'`);
      const after = await statsFor(c, from);
      const d = (who: 'member' | 'member3', k: string) => Number(after[who][k]) - Number(before[who][k]);
      expect(d('member', 'one_on_ones')).toBe(1);
      expect(d('member3', 'one_on_ones')).toBe(1);
      expect(d('member', 'referrals_given')).toBe(2);
      expect(d('member3', 'referrals_given')).toBe(0);
      expect(d('member3', 'referrals_received')).toBe(2);
      expect(d('member', 'closed_deals')).toBe(1);
      expect(d('member3', 'closed_deals')).toBe(0);
      expect(d('member3', 'closed_deals_received')).toBe(1);
      expect(d('member', 'visitors_brought')).toBe(1);
    });
  });

  it('admin stats respect the date range and list only approved members', async () => {
    await tx(async (c) => {
      const future = await statsFor(c, '2999-01-01');
      expect(future.all.every((r) => Number(r.one_on_ones) + Number(r.referrals_given) + Number(r.closed_deals) === 0)).toBe(true);
      expect(future.all.find((r) => r.profile_id === ids.pending)).toBeUndefined();
      const allTime = await statsFor(c, null);
      expect(allTime.all.reduce((n, r) => n + Number(r.referrals_given), 0)).toBeGreaterThan(0);
    });
  });

  it('members see the leaderboard: names and counts only, top 5 per metric, no zeros', async () => {
    await as(user(ids.member), async (q) => {
      const rows = await q(`select * from leaderboard(null, null, 5)`);
      expect(rows.length).toBeGreaterThan(0);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual(['first_name', 'last_name', 'metric', 'profile_id', 'rank', 'value']);
      for (const metric of ['one_on_ones', 'referrals', 'closed_deals']) {
        const m = rows.filter((r) => r.metric === metric);
        expect(m.length, metric).toBeGreaterThan(0);
        expect(m.length, metric).toBeLessThanOrEqual(5);
        const values = m.map((r) => Number(r.value));
        expect(values, metric).toEqual([...values].sort((a, b) => b - a));
        expect(values.every((v) => v > 0)).toBe(true);
        expect(m.map((r) => r.rank)).toEqual(m.map((_, i) => i + 1));
      }
    });
  });

  it('pending applicants cannot see the leaderboard or group totals', async () => {
    await expect(as(user(ids.pending), (q) => q(`select * from leaderboard()`))).rejects.toThrow(/members only/);
    await expect(as(user(ids.pending), (q) => q(`select group_totals()`))).rejects.toThrow(/members only/);
  });

  it('group totals count each confirmed one-on-one once', async () => {
    await tx(async (c) => {
      const from = (await c.query(`select ${today}::text as d`)).rows[0]?.d as string;
      const get = async () => {
        await actAs(c, ids.member);
        const t = (await c.query(`select group_totals($1::date, null) as t`, [from])).rows[0]?.t as {
          one_on_ones: number;
          referrals: number;
          closed_deals: number;
          visitors: number;
        };
        await actAsOwner(c);
        return t;
      };
      const before = await get();
      expect(Object.keys(before).sort()).toEqual(['closed_amount', 'closed_deals', 'one_on_ones', 'referrals', 'visitors']);
      await c.query(`insert into one_on_ones (reporter_id, partner_id, met_on, confirmed_at) values ($1,$2,${today},now())`, [ids.member, ids.member3]);
      await c.query(`insert into referrals (from_id,to_id,contact_name,status) values ($1,$2,'Lead X','new')`, [ids.member, ids.member3]);
      const after = await get();
      expect(after.one_on_ones - before.one_on_ones).toBe(1);
      expect(after.referrals - before.referrals).toBe(1);
    });
  });
});

describe('leadership (Management on About)', () => {
  it('visitors can read it; members cannot change it; admins can', async () => {
    await as(anon, async (q) => {
      expect((await q(`select name, role from leadership`)).length).toBeGreaterThan(0);
    });
    await expect(as(user(ids.member), (q) => q(`insert into leadership (name, role) values ('Me','President')`))).rejects.toThrow(/row-level security/);
    await as(user(ids.member), async (q) => {
      expect(await q(`update leadership set role='Boss' returning id`)).toEqual([]);
      expect(await q(`delete from leadership returning id`)).toEqual([]);
    });
    await as(user(ids.admin), async (q) => {
      const r = await q(`insert into leadership (name, role, sort_order, profile_id) values ('New Person','Treasurer',9,$1) returning id`, [ids.member3]);
      expect(r.length).toBe(1);
      expect((await q(`update leadership set role='Secretary' where id=$1 returning role`, [r[0]?.id]))[0]?.role).toBe('Secretary');
      expect((await q(`delete from leadership where id=$1 returning id`, [r[0]?.id])).length).toBe(1);
    });
  });
});

describe('directory downloads', () => {
  it('members log their own downloads; only admins read the log; visitors and pending cannot log', async () => {
    await as(user(ids.member), async (q) => {
      const r = await q(`insert into directory_downloads (format) values ('csv') returning profile_id`);
      expect(r[0]?.profile_id).toBe(ids.member);
      expect((await q(`select profile_id from directory_downloads`)).every((x) => x.profile_id === ids.member)).toBe(true);
    });
    await expect(as(user(ids.member), (q) => q(`insert into directory_downloads (profile_id, format) values ($1,'csv')`, [ids.admin]))).rejects.toThrow(
      /row-level security/,
    );
    await expect(as(user(ids.member), (q) => q(`insert into directory_downloads (format) values ('pdf')`))).rejects.toThrow(/check constraint/);
    await expect(as(user(ids.pending), (q) => q(`insert into directory_downloads (format) values ('csv')`))).rejects.toThrow(/row-level security/);
    await expect(as(anon, (q) => q(`insert into directory_downloads (format) values ('csv')`))).rejects.toThrow(/permission denied|row-level security/);
    await tx(async (c) => {
      await c.query(`insert into directory_downloads (profile_id, format) values ($1,'vcf')`, [ids.member3]);
      await actAs(c, ids.admin);
      expect((await c.query(`select profile_id from directory_downloads where profile_id=$1`, [ids.member3])).rows.length).toBe(1);
    });
  });
});

describe('weekly specific ask', () => {
  it('members set their own ask (160 chars max) and the update time is stamped', async () => {
    await as(user(ids.member), async (q) => {
      const r = await q(`update profiles set weekly_ask='An intro to a property manager' where id=$1 returning weekly_ask, weekly_ask_updated_at`, [
        ids.member,
      ]);
      expect(r[0]?.weekly_ask).toBe('An intro to a property manager');
      expect(r[0]?.weekly_ask_updated_at).not.toBeNull();
    });
    await expect(as(user(ids.member), (q) => q(`update profiles set weekly_ask=repeat('x',161) where id=$1`, [ids.member]))).rejects.toThrow(
      /check constraint/,
    );
  });
});

describe('open categories (seat limits)', () => {
  it('categories default to one seat, and anyone can see which are open', async () => {
    await as(anon, async (q) => {
      const rows = await q(`select * from open_categories()`);
      expect(rows.length).toBeGreaterThan(5);
      const re = rows.find((r) => r.name === 'Real Estate');
      expect(re).toMatchObject({ seat_limit: 1, taken: '1' });
      expect(rows.some((r) => Number(r.taken) < Number(r.seat_limit))).toBe(true);
    });
  });

  it('a full category blocks approval and profile changes, but not a pending application; raising the limit opens a seat', async () => {
    await tx(async (c) => {
      const cat = (await c.query(`select category_id from profiles where id=$1`, [ids.admin])).rows[0]?.category_id as number;
      // a pending applicant may sit in a full category
      await c.query(`update profiles set category_id=$1 where id=$2`, [cat, ids.pending]);
      await actAs(c, ids.admin);
      await c.query('savepoint s1');
      await expect(c.query(`update profiles set status='approved' where id=$1`, [ids.pending])).rejects.toThrow(/category is full/);
      await c.query('rollback to savepoint s1');
      // a member cannot move into a full category
      await actAs(c, ids.member);
      await c.query('savepoint s2');
      await expect(c.query(`update profiles set category_id=$1 where id=$2`, [cat, ids.member])).rejects.toThrow(/category is full/);
      await c.query('rollback to savepoint s2');
      // admin raises the limit, then approval works
      await actAs(c, ids.admin);
      await c.query(`update categories set seat_limit=2 where id=$1`, [cat]);
      const r = await c.query(`update profiles set status='approved' where id=$1 returning status`, [ids.pending]);
      expect(r.rows[0]?.status).toBe('approved');
    });
  });

  it('members cannot change seat limits', async () => {
    await as(user(ids.member), async (q) => {
      expect(await q(`update categories set seat_limit=5 returning id`)).toEqual([]);
    });
  });
});
