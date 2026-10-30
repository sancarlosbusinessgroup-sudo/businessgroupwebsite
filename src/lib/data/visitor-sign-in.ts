import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { localDateKey } from '../dates';

type Db = SupabaseClient<Database>;
const HOUR = 3_600_000;

/**
 * The regular meeting happening today (Pacific date), for the visitor sign-in link: visitors who sign in on a meeting
 * day are recorded as visiting that meeting. Null on other days.
 */
export async function todaysMeeting(db: Db, now = new Date()) {
  const { data } = await db
    .from('meetings')
    .select('id, slug, title, starts_at, ends_at')
    .eq('category', 'Networking')
    .is('cancelled_reason', null)
    .gte('starts_at', new Date(now.getTime() - 24 * HOUR).toISOString())
    .lte('starts_at', new Date(now.getTime() + 24 * HOUR).toISOString())
    .order('starts_at');
  const today = localDateKey(now);
  return (data ?? []).find((m) => localDateKey(new Date(m.starts_at)) === today) ?? null;
}

/** Approved members, for "Which member invited you?". Public directory names only. */
export async function signInMembers(db: Db) {
  const { data } = await db
    .from('profiles')
    .select('id, first_name, last_name, business_name')
    .eq('status', 'approved')
    .eq('show_in_directory', true)
    .order('first_name')
    .order('last_name');
  return (data ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, business: p.business_name }));
}
