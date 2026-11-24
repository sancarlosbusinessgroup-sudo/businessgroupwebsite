import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { attendanceFlags } from '../zoom';

type Db = SupabaseClient<Database>;

export type NoInfomercialPerson = { id: string; name: string; business: string | null; leftAt: string | null; how: 'zoom' | 'admin' };
export type NoInfomercialList = {
  /** The meeting the list is for (the next one, or the one asked for). */
  meeting: { id: string; starts_at: string; title: string } | null;
  /** The last held meeting before it, whose early leavers can't do their infomercial. */
  previous: { id: string; starts_at: string } | null;
  /** Attendance for the previous meeting has been taken (from Zoom or by hand). */
  taken: boolean;
  people: NoInfomercialPerson[];
};

/**
 * Bylaws: "If you leave before the 9:45 AM finish, you will not be permitted to do your 60-second infomercial at the
 * next meeting." Who that applies to at `meetingId` (default: the next regular meeting): members marked as having
 * left the previous held meeting early, after any admin correction ("Excused – left early" and "Did not leave early"
 * are not on the list). Admins only: other members' attendance is protected by RLS (owner, 2026-11-24).
 */
export async function loadNoInfomercialList(db: Db, meetingId?: string | null, now: Date = new Date()): Promise<NoInfomercialList> {
  const base = db.from('meetings').select('id, starts_at, ends_at, title').eq('category', 'Networking').is('cancelled_reason', null);
  const { data: meeting } = meetingId
    ? await base.eq('id', meetingId).maybeSingle()
    : await base.gt('ends_at', now.toISOString()).order('starts_at').limit(1).maybeSingle();
  if (!meeting) return { meeting: null, previous: null, taken: false, people: [] };

  const { data: previous } = await db
    .from('meetings')
    .select('id, starts_at, ends_at')
    .eq('category', 'Networking')
    .is('cancelled_reason', null)
    .lt('starts_at', meeting.starts_at)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const forMeeting = { id: meeting.id, starts_at: meeting.starts_at, title: meeting.title };
  if (!previous) return { meeting: forMeeting, previous: null, taken: false, people: [] };

  const [impRes, attRes] = await Promise.all([
    db.from('attendance_imports').select('status, ended_at').eq('meeting_id', previous.id).maybeSingle(),
    db
      .from('attendance')
      .select('profile_id, status, substitute, zoom, joined_at, left_at, left_early, profiles(first_name, last_name, business_name)')
      .eq('meeting_id', previous.id)
      .eq('status', 'present')
      .eq('substitute', false),
  ]);
  const taken = impRes.data?.status === 'done';
  const people: NoInfomercialPerson[] = [];
  for (const a of attRes.data ?? []) {
    const f = attendanceFlags(previous, a, impRes.data?.ended_at);
    if (f.leftEarly !== 'yes') continue;
    const p = (Array.isArray(a.profiles) ? a.profiles[0] : a.profiles) as { first_name: string; last_name: string; business_name: string | null } | null;
    if (!p) continue;
    people.push({
      id: a.profile_id,
      name: `${p.first_name} ${p.last_name}`,
      business: p.business_name,
      leftAt: a.left_at,
      how: a.left_early === 'yes' ? 'admin' : 'zoom',
    });
  }
  people.sort((x, y) => x.name.localeCompare(y.name));
  return { meeting: forMeeting, previous: { id: previous.id, starts_at: previous.starts_at }, taken, people };
}
