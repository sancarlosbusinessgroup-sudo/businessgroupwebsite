import 'server-only';
import { createClient } from '../supabase/server';
import type { MemberPeriodStats } from '../database.types';
import { localDateKey } from '../dates';
import type { DateRange } from '../periods';

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}${error ? `: ${error.message}` : ''}`);
}

export type GroupTotals = { one_on_ones: number; referrals: number; closed_deals: number; closed_amount: number; visitors: number };
export type LeaderRow = { metric: string; rank: number; profile_id: string; first_name: string; last_name: string; value: number };

/** Group totals for a Pacific date range (approved members only). */
export async function getGroupTotals(range: DateRange): Promise<GroupTotals> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('group_totals', { p_from: range.from, p_to: range.to });
  if (error) fail('group totals', error);
  const t = data as Partial<GroupTotals>;
  return { one_on_ones: 0, referrals: 0, closed_deals: 0, visitors: 0, ...t, closed_amount: Number(t.closed_amount ?? 0) };
}

/** Top members per metric (names + counts only). */
export async function getLeaderboard(range: DateRange, limit = 5): Promise<LeaderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('leaderboard', { p_from: range.from, p_to: range.to, p_limit: limit });
  if (error) fail('the leaderboard', error);
  return data;
}

export type AdminStatRow = MemberPeriodStats & { closed_amount_given: number; closed_amount_received: number };

/** Per-member counts and closed-deal dollars. The database refuses this for anyone but admins. */
export async function getAdminStats(range: DateRange): Promise<AdminStatRow[]> {
  const supabase = await createClient();
  const [counts, amounts] = await Promise.all([
    supabase.rpc('admin_member_stats', { p_from: range.from, p_to: range.to }),
    supabase.rpc('admin_member_amounts', { p_from: range.from, p_to: range.to }),
  ]);
  if (counts.error || amounts.error) fail('member stats', counts.error ?? amounts.error);
  const byId = new Map(amounts.data.map((a) => [a.profile_id, a]));
  return counts.data.map((r) => ({
    ...r,
    closed_amount_given: Number(byId.get(r.profile_id)?.closed_amount_given ?? 0),
    closed_amount_received: Number(byId.get(r.profile_id)?.closed_amount_received ?? 0),
  }));
}

/** Calendar date (Pacific) of the most recent group meeting that has started, for "this meeting cycle". */
export async function getLastMeetingDate(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('meetings')
    .select('starts_at')
    .eq('category', 'Networking')
    .lte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail('meetings', error);
  return data ? localDateKey(new Date(data.starts_at)) : null;
}

/** Guests credited to me (my own invitation records). */
export async function getMyGuests(meId: string, limit = 5) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guest_requests')
    .select('id, first_name, last_name, status, created_at')
    .eq('referrer_id', meId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) fail('your guests', error);
  return data;
}

/** Approved members other than me, for pickers. */
export async function getMemberOptions(meId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, business_name')
    .eq('status', 'approved')
    .neq('id', meId)
    .order('first_name');
  if (error) fail('members', error);
  return data;
}

export async function getPendingConfirmations(meId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('one_on_ones')
    .select('id, met_on, reporter:profiles!one_on_ones_reporter_id_fkey(first_name, last_name)')
    .eq('partner_id', meId)
    .is('confirmed_at', null)
    .order('met_on', { ascending: false });
  if (error) fail('confirmations', error);
  return data;
}

export async function getOneOnOnes(opts: { meId?: string; days: number; limit: number }) {
  const supabase = await createClient();
  const since = new Date(Date.now() - opts.days * 86400000).toISOString().slice(0, 10);
  let q = supabase
    .from('one_on_ones')
    .select(
      'id, met_on, confirmed_at, reporter_id, partner_id, reporter:profiles!one_on_ones_reporter_id_fkey(first_name, last_name), partner:profiles!one_on_ones_partner_id_fkey(first_name, last_name)',
    )
    .gte('met_on', since)
    .order('met_on', { ascending: false })
    .limit(opts.limit);
  if (opts.meId) q = q.or(`reporter_id.eq.${opts.meId},partner_id.eq.${opts.meId}`);
  const { data, error } = await q;
  if (error) fail('one-on-ones', error);
  return data;
}

/** Every one-on-one I took part in, newest first (owner, 2026-10-23: one-on-one history). */
export async function getMyOneOnOneHistory(meId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('one_on_ones')
    .select(
      'id, met_on, confirmed_at, reporter_id, partner_id, reporter:profiles!one_on_ones_reporter_id_fkey(first_name, last_name, business_name, slug), partner:profiles!one_on_ones_partner_id_fkey(first_name, last_name, business_name, slug), one_on_one_feedback(note, author_id)',
    )
    .or(`reporter_id.eq.${meId},partner_id.eq.${meId}`)
    .order('met_on', { ascending: false })
    .limit(1000);
  if (error) fail('one-on-one history', error);
  return data;
}

export type OneOnOneRequest = {
  id: string;
  requester_id: string;
  invitee_id: string;
  proposed_on: string | null;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  responded_at: string | null;
  reply: string | null;
  replied_at: string | null;
  requester: { first_name: string; last_name: string; business_name: string; slug: string } | null;
  invitee: { first_name: string; last_name: string; business_name: string; slug: string } | null;
};

/** One-on-one requests I sent or received in the last 60 days (RLS: only the two members and admins). */
export async function getOneOnOneRequests(meId: string): Promise<{ incoming: OneOnOneRequest[]; outgoing: OneOnOneRequest[] }> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data, error } = await supabase
    .from('one_on_one_requests')
    .select(
      '*, requester:profiles!one_on_one_requests_requester_id_fkey(first_name, last_name, business_name, slug), invitee:profiles!one_on_one_requests_invitee_id_fkey(first_name, last_name, business_name, slug)',
    )
    .or(`requester_id.eq.${meId},invitee_id.eq.${meId}`)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) fail('one-on-one requests', error);
  const rows = data as OneOnOneRequest[];
  return { incoming: rows.filter((r) => r.invitee_id === meId), outgoing: rows.filter((r) => r.requester_id === meId) };
}
