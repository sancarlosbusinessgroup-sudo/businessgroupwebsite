import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { autoChampion, monthRange, scoreChampion, type ChampionRow } from '../champion';
import type { Database } from '../database.types';
import { createAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';

type Db = SupabaseClient<Database>;

/**
 * The month's automatic ranking. Reads everyone's activity, so it runs with the service-role client on the server
 * (only names and point totals leave this function), falling back to the signed-in admin's own access.
 */
export async function getChampionRanking(month: string, db?: Db): Promise<{ rows: ChampionRow[]; auto: ChampionRow | null; meetingsTaken: number }> {
  const client = db ?? createAdminClient() ?? (await createClient());
  const { from, to } = monthRange(month);
  const fromDate = from.slice(0, 10);
  const toDate = to.slice(0, 10);

  const [membersRes, refRes, closedRes, oooRes, guestRes, joinedRes, meetingsRes] = await Promise.all([
    client.from('profiles').select('id, first_name, last_name').eq('status', 'approved'),
    client.from('referrals').select('from_id').gte('created_at', from).lt('created_at', to),
    client.from('referrals').select('from_id, amount').eq('status', 'closed_deal').gte('closed_at', from).lt('closed_at', to),
    client.from('one_on_ones').select('reporter_id, partner_id').not('confirmed_at', 'is', null).gte('met_on', fromDate).lt('met_on', toDate),
    client
      .from('guest_requests')
      .select('referrer_id, created_at, meeting:meetings(starts_at)')
      .in('status', ['visited', 'applied', 'joined'])
      .not('referrer_id', 'is', null),
    client.from('profiles').select('referred_by').not('referred_by', 'is', null).gte('approved_at', from).lt('approved_at', to),
    client
      .from('meetings')
      .select('id, attendance_imports(status), meeting_speakers(profile_id)')
      .eq('category', 'Networking')
      .is('cancelled_reason', null)
      .gte('starts_at', from)
      .lt('starts_at', to),
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
    const at = m?.starts_at ?? g.created_at;
    return at >= from && at < to;
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
    presentations: meetings.flatMap((m) => (m.meeting_speakers ?? []) as { profile_id: string | null }[]),
  });
  return { rows, auto: autoChampion(rows), meetingsTaken: taken.length };
}

export type ChampionAward = {
  month: string;
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

/** Stored champions, newest first (public: the badge shows on profiles). */
export async function getChampionAwards(limit = 24, profileId?: string): Promise<ChampionAward[]> {
  const supabase = await createClient();
  let q = supabase
    .from('champion_awards')
    .select(
      'month, profile_id, auto_profile_id, reason, points, profile:profiles!champion_awards_profile_id_fkey(first_name, last_name, business_name, slug, avatar_path)',
    )
    .order('month', { ascending: false })
    .limit(limit);
  if (profileId) q = q.eq('profile_id', profileId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).map((a) => {
    const p = a.profile as unknown as { first_name: string; last_name: string; business_name: string; slug: string; avatar_path: string | null } | null;
    return {
      month: a.month,
      label: monthRange(a.month.slice(0, 7)).label,
      profileId: a.profile_id,
      name: p ? `${p.first_name} ${p.last_name}` : 'Former member',
      business: p?.business_name ?? null,
      slug: p?.slug ?? null,
      avatar: p?.avatar_path ?? null,
      reason: a.reason,
      points: (a.points ?? {}) as Partial<ChampionRow>,
      overridden: !!a.auto_profile_id && a.auto_profile_id !== a.profile_id,
    };
  });
}

/** The current champion: the most recent award. The badge belongs to them until the next one is chosen. */
export async function getCurrentChampion(): Promise<ChampionAward | null> {
  return (await getChampionAwards(1))[0] ?? null;
}
