import 'server-only';
import { createClient } from '../supabase/server';

export type MemberStats = {
  referrals_given: number;
  referrals_given_prior: number;
  referrals_received: number;
  referrals_received_closed: number;
  closed_amount: number;
  one_on_ones: number;
  group_avg_one_on_ones: number;
  meetings_held: number;
  meetings_present: number;
  guests_invited: number;
  guests_visited: number;
  guests_applied: number;
  guests_joined: number;
};

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}${error ? `: ${error.message}` : ''}`);
}

export async function getMyStats(): Promise<MemberStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('member_stats');
  if (error) fail('your stats', error);
  return data as MemberStats;
}

export async function getGroupMonth(): Promise<{ closed_amount: number; one_on_ones: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('group_month_stats');
  if (error) fail('group stats', error);
  return data as { closed_amount: number; one_on_ones: number };
}

export async function getMonthlyActivity() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('monthly_activity');
  if (error) fail('your activity', error);
  return data;
}

export async function getTopInviters() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('top_inviters', { p_limit: 5 });
  if (error) fail('the leaderboard', error);
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
