import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import {
  MEETING_CHAMPION_FROM,
  autoChampion,
  championPeriods,
  meetingDateLabel,
  monthOf,
  monthRange,
  oneOnOneDays,
  scoreChampion,
  type ChampionPeriod,
  type ChampionRow,
} from '../champion';
import type { Database } from '../database.types';
import { createAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';

type Db = SupabaseClient<Database>;

/** A scoring window. `ooGte`/`ooLt`: the one-on-one dates counted ([gte, lt)); `month` turns on the 2027 rules. */
type Window = { from: string | null; to: string; ooGte: string | null; ooLt: string; month?: string; perfectAttendanceBonus?: boolean };

/**
 * Everyone's points in a window. Reads everyone's activity, so it runs with the service-role client on the server
 * (only names and point totals leave this function), falling back to the signed-in admin's own access.
 */
async function rankWindow(w: Window, db?: Db): Promise<{ rows: ChampionRow[]; auto: ChampionRow | null; meetingsTaken: number }> {
  const client = db ?? createAdminClient() ?? (await createClient());
  const since = w.from ?? '2000-01-01T00:00:00Z';

  let oooQ = client.from('one_on_ones').select('reporter_id, partner_id').not('confirmed_at', 'is', null).lt('met_on', w.ooLt);
  if (w.ooGte) oooQ = oooQ.gte('met_on', w.ooGte);
  const [membersRes, refRes, closedRes, oooRes, guestRes, joinedRes, meetingsRes] = await Promise.all([
    client.from('profiles').select('id, first_name, last_name').eq('status', 'approved'),
    client.from('referrals').select('from_id').gte('created_at', since).lt('created_at', w.to),
    client.from('referrals').select('from_id, amount').eq('status', 'closed_deal').gte('closed_at', since).lt('closed_at', w.to),
    oooQ,
    client
      .from('guest_requests')
      .select('referrer_id, created_at, meeting:meetings(starts_at)')
      .in('status', ['visited', 'applied', 'joined'])
      .not('referrer_id', 'is', null),
    client.from('profiles').select('referred_by').not('referred_by', 'is', null).gte('approved_at', since).lt('approved_at', w.to),
    client
      .from('meetings')
      .select('id, starts_at, attendance_imports(status), meeting_speakers(profile_id, slot)')
      .eq('category', 'Networking')
      .is('cancelled_reason', null)
      .gte('starts_at', since)
      .lt('starts_at', w.to),
  ]);
  const err = membersRes.error ?? refRes.error ?? closedRes.error ?? oooRes.error ?? guestRes.error ?? joinedRes.error ?? meetingsRes.error;
  if (err) throw new Error(`Could not load the champion ranking: ${err.message}`);

  const meetings = meetingsRes.data ?? [];
  const taken = meetings.filter((m) => {
    const imp = m.attendance_imports as unknown as { status: string } | { status: string }[] | null;
    return (Array.isArray(imp) ? imp[0]?.status : imp?.status) === 'done';
  });
  const { data: att, error: attErr } = taken.length
    ? await client
        .from('attendance')
        .select('profile_id, status, substitute')
        .in(
          'meeting_id',
          taken.map((m) => m.id),
        )
    : { data: [], error: null };
  if (attErr) throw new Error('Could not load attendance for the champion ranking');

  const visitors = (guestRes.data ?? []).filter((g) => {
    const m = g.meeting as unknown as { starts_at: string } | null;
    const at = new Date(m?.starts_at ?? g.created_at).getTime();
    return at >= Date.parse(since) && at < Date.parse(w.to);
  });

  const rows = scoreChampion({
    members: (membersRes.data ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` })),
    referrals: refRes.data ?? [],
    closed: closedRes.data ?? [],
    oneOnOnes: oooRes.data ?? [],
    visitors: visitors.map((v) => ({ referrer_id: v.referrer_id })),
    joined: joinedRes.data ?? [],
    meetingsTaken: taken.length,
    attendance: att ?? [],
    presentations: meetings.flatMap((m) =>
      ((m.meeting_speakers ?? []) as { profile_id: string | null; slot: string | null }[]).map((s) => ({ ...s, month: monthOf(new Date(m.starts_at)) })),
    ),
    month: w.month,
    perfectAttendanceBonus: w.perfectAttendanceBonus,
  });
  return { rows, auto: autoChampion(rows), meetingsTaken: taken.length };
}

/** A calendar month's ranking (the monthly champion, used until November 2026). */
export async function getChampionRanking(month: string, db?: Db) {
  const { from, to } = monthRange(month);
  return rankWindow({ from, to, ooGte: from.slice(0, 10), ooLt: to.slice(0, 10), month }, db);
}

/** Lifetime points: everything ever earned, up to now (owner, 2026-11-23). */
export async function getLifetimeRanking(db?: Db) {
  const now = new Date().toISOString();
  return rankWindow(
    { from: null, to: now, ooGte: null, ooLt: oneOnOneDays({ from: null, to: now }).lt, month: monthOf(new Date()), perfectAttendanceBonus: false },
    db,
  );
}

/** Regular meetings that were held or are coming (not cancelled), with each one's scoring period. */
export async function getChampionPeriods(db?: Db): Promise<ChampionPeriod[]> {
  const client = db ?? createAdminClient() ?? (await createClient());
  const { data, error } = await client
    .from('meetings')
    .select('id, starts_at, ends_at')
    .eq('category', 'Networking')
    .is('cancelled_reason', null)
    .order('starts_at');
  if (error) throw new Error('Could not load meetings for the champion');
  return championPeriods(data ?? []);
}

/** The period in progress: the next meeting that has not ended yet (null when none is on the calendar). */
export function currentPeriod(periods: ChampionPeriod[], now = new Date()): ChampionPeriod | null {
  return periods.find((p) => p.to > now.toISOString()) ?? null;
}

/**
 * A meeting's ranking: points since the previous held meeting ended, up to the end of this meeting or now, whichever
 * comes first. To qualify, a member attended this meeting (when its attendance has been taken; a substitute counts).
 */
export async function getMeetingChampionRanking(period: ChampionPeriod, db?: Db) {
  const now = new Date().toISOString();
  const to = period.to < now ? period.to : now;
  const oo = oneOnOneDays(period);
  return rankWindow({ from: period.from, to, ooGte: oo.gte, ooLt: oo.lt, month: monthOf(new Date(period.startsAt)), perfectAttendanceBonus: false }, db);
}

/**
 * Record the automatic champion of meetings that have ended (from MEETING_CHAMPION_FROM), once their attendance has been
 * taken or a day after they ended. Admin choices are never overwritten. Runs with the service role (after-meeting job,
 * the Champion page and the slides); does nothing without it.
 */
export async function finalizeMeetingChampions(now = new Date()): Promise<number> {
  const db = createAdminClient();
  if (!db) return 0;
  const periods = (await getChampionPeriods(db)).filter((p) => p.to >= MEETING_CHAMPION_FROM && p.to <= now.toISOString());
  if (!periods.length) return 0;
  const ids = periods.map((p) => p.meetingId);
  const [{ data: done }, { data: imports }] = await Promise.all([
    db.from('meeting_champions').select('meeting_id').in('meeting_id', ids),
    db.from('attendance_imports').select('meeting_id, status').in('meeting_id', ids),
  ]);
  const recorded = new Set((done ?? []).map((d) => d.meeting_id));
  // Periods are in UTC ISO (championPeriods), so these comparisons are plain string comparisons.
  const taken = new Set((imports ?? []).filter((i) => i.status === 'done').map((i) => i.meeting_id));
  const dayAgo = new Date(now.getTime() - 24 * 3600_000).toISOString();
  let count = 0;
  for (const p of periods) {
    if (recorded.has(p.meetingId)) continue;
    if (!taken.has(p.meetingId) && p.to > dayAgo) continue;
    const { auto } = await getMeetingChampionRanking(p, db);
    if (!auto) continue;
    const { error } = await db
      .from('meeting_champions')
      .upsert(
        { meeting_id: p.meetingId, profile_id: auto.id, auto_profile_id: auto.id, points: { ...auto }, period_from: p.from, period_to: p.to },
        { onConflict: 'meeting_id', ignoreDuplicates: true },
      );
    if (!error) count++;
  }
  return count;
}

export type ChampionAward = {
  /** "2026-10-01" for a monthly award, the meeting id for a meeting's champion. */
  key: string;
  kind: 'month' | 'meeting';
  /** When the award's period ended, for ordering. */
  endsAt: string;
  /** Back-compat: the YYYY-MM-01 key of monthly awards ('' for meeting awards). */
  month: string;
  /** "October 2026" or "Dec 7, 2026 meeting". */
  label: string;
  profileId: string;
  name: string;
  business: string | null;
  slug: string | null;
  avatar: string | null;
  reason: string | null;
  points: Partial<ChampionRow>;
  overridden: boolean;
};

type ProfileBits = { first_name: string; last_name: string; business_name: string; slug: string; avatar_path: string | null } | null;
const who = (p: ProfileBits) => ({
  name: p ? `${p.first_name} ${p.last_name}` : 'Former member',
  business: p?.business_name ?? null,
  slug: p?.slug ?? null,
  avatar: p?.avatar_path ?? null,
});

/** Stored champions (monthly ones, then one per meeting), newest first. Public: the badge shows on profiles. */
export async function getChampionAwards(limit = 24, profileId?: string): Promise<ChampionAward[]> {
  const supabase = await createClient();
  let mq = supabase
    .from('champion_awards')
    .select(
      'month, profile_id, auto_profile_id, reason, points, profile:profiles!champion_awards_profile_id_fkey(first_name, last_name, business_name, slug, avatar_path)',
    )
    .order('month', { ascending: false })
    .limit(limit);
  let gq = supabase
    .from('meeting_champions')
    .select(
      'meeting_id, profile_id, auto_profile_id, reason, points, period_to, profile:profiles!meeting_champions_profile_id_fkey(first_name, last_name, business_name, slug, avatar_path), meeting:meetings(starts_at)',
    )
    .order('period_to', { ascending: false })
    .limit(limit);
  if (profileId) {
    mq = mq.eq('profile_id', profileId);
    gq = gq.eq('profile_id', profileId);
  }
  const [mRes, gRes] = await Promise.all([mq, gq]);
  const monthly: ChampionAward[] = (mRes.error ? [] : (mRes.data ?? [])).map((a) => ({
    key: a.month,
    kind: 'month',
    endsAt: new Date(monthRange(a.month.slice(0, 7)).to).toISOString(),
    month: a.month,
    label: monthRange(a.month.slice(0, 7)).label,
    profileId: a.profile_id,
    ...who(a.profile as unknown as ProfileBits),
    reason: a.reason,
    points: (a.points ?? {}) as Partial<ChampionRow>,
    overridden: !!a.auto_profile_id && a.auto_profile_id !== a.profile_id,
  }));
  const perMeeting: ChampionAward[] = (gRes.error ? [] : (gRes.data ?? [])).map((a) => {
    const m = a.meeting as unknown as { starts_at: string } | null;
    return {
      key: a.meeting_id,
      kind: 'meeting',
      endsAt: new Date(a.period_to).toISOString(),
      month: '',
      label: `${meetingDateLabel(m?.starts_at ?? a.period_to)} meeting`,
      profileId: a.profile_id,
      ...who(a.profile as unknown as ProfileBits),
      reason: a.reason,
      points: (a.points ?? {}) as Partial<ChampionRow>,
      overridden: !!a.auto_profile_id && a.auto_profile_id !== a.profile_id,
    };
  });
  return [...perMeeting, ...monthly].sort((a, b) => b.endsAt.localeCompare(a.endsAt)).slice(0, limit);
}

/** The current champion: the most recent award. The badge belongs to them until the next meeting's champion is recorded. */
export async function getCurrentChampion(): Promise<ChampionAward | null> {
  return (await getChampionAwards(1))[0] ?? null;
}

/**
 * Points in the period in progress (since the last meeting) per member, for ordering the directory (owner meeting
 * 2026-10-30: "anyone who's not doing anything is down the bottom"). Only the order leaves this function's callers, never
 * the numbers. Cached 5 minutes; empty when the service-role key is missing.
 */
export const getActivityPoints = unstable_cache(
  async (): Promise<[string, number][]> => {
    const db = createAdminClient();
    if (!db) return [];
    const period = currentPeriod(await getChampionPeriods(db));
    const { rows } = period ? await getMeetingChampionRanking(period, db) : await getChampionRanking(monthOf(new Date()), db);
    return rows.map((r) => [r.id, r.points]);
  },
  ['directory-activity-points'],
  { revalidate: 300, tags: ['directory'] },
);
