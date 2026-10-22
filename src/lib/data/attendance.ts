import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { absenceSummary, ABSENCE_WINDOW_MONTHS } from '../zoom';

type Db = SupabaseClient<Database>;
export type AbsenceSummary = ReturnType<typeof absenceSummary>;

/** Meetings in the last six months whose attendance has been taken (from Zoom or by hand). */
export async function takenMeetings(db: Db, now: Date) {
  const from = new Date(now);
  from.setMonth(from.getMonth() - ABSENCE_WINDOW_MONTHS);
  const { data, error } = await db
    .from('attendance_imports')
    .select('meeting_id, meetings!inner(starts_at, cancelled_reason)')
    .eq('status', 'done')
    .gte('meetings.starts_at', from.toISOString())
    .lte('meetings.starts_at', now.toISOString());
  if (error) throw new Error('Could not load attendance');
  return (data ?? [])
    .map((r) => {
      const m = r.meetings as unknown as { starts_at: string; cancelled_reason: string | null };
      return { meeting_id: r.meeting_id, starts_at: m.starts_at, cancelled: !!m.cancelled_reason };
    })
    .filter((m) => !m.cancelled);
}

/** Missed meetings in the last six months for the given members (Bylaws: no more than 2). */
export async function absencesFor(db: Db, members: { id: string; since: string | null }[], now = new Date()) {
  const out = new Map<string, AbsenceSummary>();
  if (!members.length) return out;
  const taken = await takenMeetings(db, now);
  const ids = taken.map((t) => t.meeting_id);
  const { data: rows, error } = ids.length
    ? await db
        .from('attendance')
        .select('meeting_id, profile_id, status, substitute')
        .in('meeting_id', ids)
        .in(
          'profile_id',
          members.map((m) => m.id),
        )
    : { data: [], error: null };
  if (error) throw new Error('Could not load attendance');
  for (const m of members)
    out.set(
      m.id,
      absenceSummary(
        taken,
        (rows ?? []).filter((r) => r.profile_id === m.id),
        { now, memberSince: m.since },
      ),
    );
  return out;
}

/** When a member's absences start counting: the day they were approved (or joined, for older records). */
export const memberSince = (p: { approved_at: string | null; member_since: string | null; created_at: string }) =>
  p.approved_at ?? p.member_since ?? p.created_at;
