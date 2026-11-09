// Live attendance for one meeting (owner, 2026-11-10), for Admin → Attendance and its polling route.
// Read with the admin's own client: zoom_live_events, member_contacts and zoom_aliases are admin-only (RLS).
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import type { GuestRef, MemberRef } from '../zoom';
import { liveSummary, type LiveSummary } from '../zoom-live';

export async function loadLiveAttendance(db: SupabaseClient<Database>, meetingId: string): Promise<LiveSummary | null> {
  const { data: meeting } = await db.from('meetings').select('id, starts_at, ends_at').eq('id', meetingId).maybeSingle();
  if (!meeting) return null;
  const since = new Date(new Date(meeting.starts_at).getTime() - 120 * 24 * 3_600_000).toISOString();
  const [eventsRes, membersRes, guestsRes, aliasRes] = await Promise.all([
    db.from('zoom_live_events').select('event, key, name, email, at').eq('meeting_id', meetingId).order('at').limit(5000),
    db.from('profiles').select('id, first_name, last_name, member_contacts(email)').eq('status', 'approved'),
    db.from('guest_requests').select('id, first_name, last_name, email').in('status', ['requested', 'visited']).gte('created_at', since),
    db.from('zoom_aliases').select('key, profile_id'),
  ]);
  if (eventsRes.error || membersRes.error || guestsRes.error || aliasRes.error) return null;
  const members: MemberRef[] = (membersRes.data ?? []).map((p) => {
    const c = p.member_contacts as unknown as { email: string } | { email: string }[] | null;
    return { id: p.id, firstName: p.first_name, lastName: p.last_name, email: (Array.isArray(c) ? c[0]?.email : c?.email) ?? null };
  });
  const guests: GuestRef[] = (guestsRes.data ?? []).map((g) => ({ id: g.id, firstName: g.first_name, lastName: g.last_name, email: g.email }));
  const aliases = new Map((aliasRes.data ?? []).map((a) => [a.key, a.profile_id]));
  return liveSummary(eventsRes.data ?? [], meeting, members, guests, aliases);
}
