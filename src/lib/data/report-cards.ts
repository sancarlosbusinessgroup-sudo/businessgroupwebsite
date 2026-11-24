import 'server-only';

import { localDateKey } from '../dates';
import { attendanceFlags } from '../zoom';
import type { Goals, QuarterRange, ReportCardInput } from '../report-card';
import { createClient } from '../supabase/server';
import { memberSince } from './attendance';
import { getAdminStats } from './member';

export type ReportCardMember = { id: string; name: string; business: string | null; card: ReportCardInput };

/**
 * Everything on the report cards for one quarter (owner, 2026-11-24). Admins only: per-member stats and other members'
 * attendance are refused to anyone else by the database. Meetings count only once their attendance was taken, and only
 * those after the member joined.
 */
export async function loadReportCards(
  range: QuarterRange,
  now: Date = new Date(),
): Promise<{ members: ReportCardMember[]; goals: Goals; meetingsHeld: number }> {
  const db = await createClient();
  // A day either side, then exact Pacific dates below.
  const wideFrom = new Date(Date.parse(`${range.from}T00:00:00Z`) - 86400000).toISOString();
  const wideTo = new Date(Math.min(Date.parse(`${range.to}T00:00:00Z`) + 86400000, now.getTime())).toISOString();
  const [stats, membersRes, meetingsRes, goalsRes] = await Promise.all([
    getAdminStats({ from: range.from, to: range.to }),
    db
      .from('profiles')
      .select('id, first_name, last_name, business_name, approved_at, member_since, created_at, show_in_directory')
      .eq('status', 'approved')
      .order('first_name')
      .order('last_name'),
    db
      .from('meetings')
      .select('id, starts_at, ends_at, attendance_imports(status, ended_at)')
      .eq('category', 'Networking')
      .is('cancelled_reason', null)
      .gte('starts_at', wideFrom)
      .lte('starts_at', wideTo)
      .order('starts_at'),
    db.from('report_card_goals').select('one_on_ones, referrals, visitors, attendance_pct').eq('id', 1).maybeSingle(),
  ]);
  if (membersRes.error || meetingsRes.error) throw new Error('Could not load report cards');

  const meetings = (meetingsRes.data ?? [])
    .filter((m) => {
      const day = localDateKey(new Date(m.starts_at));
      return day >= range.from && day < range.to && Date.parse(m.ends_at) <= now.getTime();
    })
    .map((m) => {
      const imp = (Array.isArray(m.attendance_imports) ? m.attendance_imports[0] : m.attendance_imports) as { status: string; ended_at: string | null } | null;
      return { ...m, taken: imp?.status === 'done', endedAt: imp?.ended_at ?? null };
    })
    .filter((m) => m.taken);
  const ids = meetings.map((m) => m.id);
  const [attRes, spRes] = await Promise.all([
    ids.length
      ? db.from('attendance').select('meeting_id, profile_id, status, substitute, zoom, joined_at, left_at, left_early').in('meeting_id', ids)
      : Promise.resolve({ data: [], error: null }),
    db
      .from('meeting_speakers')
      .select('profile_id, meetings!inner(starts_at, cancelled_reason)')
      .not('profile_id', 'is', null)
      .gte('meetings.starts_at', wideFrom)
      .lte('meetings.starts_at', wideTo),
  ]);
  const att = new Map((attRes.data ?? []).map((a) => [`${a.meeting_id}:${a.profile_id}`, a]));
  const presentations = new Map<string, number>();
  for (const s of spRes.data ?? []) {
    const m = (Array.isArray(s.meetings) ? s.meetings[0] : s.meetings) as { starts_at: string; cancelled_reason: string | null } | null;
    if (!m || m.cancelled_reason || !s.profile_id) continue;
    const day = localDateKey(new Date(m.starts_at));
    if (day < range.from || day >= range.to || Date.parse(m.starts_at) > now.getTime()) continue;
    presentations.set(s.profile_id, (presentations.get(s.profile_id) ?? 0) + 1);
  }
  const byId = new Map(stats.map((r) => [r.profile_id, r]));

  const members: ReportCardMember[] = (membersRes.data ?? [])
    // Support staff accounts are hidden from the directory and aren't members of the group.
    .filter((p) => p.show_in_directory !== false)
    .map((p) => {
      const since = Date.parse(memberSince(p));
      const theirs = meetings.filter((m) => Date.parse(m.ends_at) >= since);
      let attended = 0;
      let substitutes = 0;
      let late = 0;
      let leftEarly = 0;
      for (const m of theirs) {
        const a = att.get(`${m.id}:${p.id}`);
        if (a?.status !== 'present') continue;
        attended++;
        if (a.substitute) {
          substitutes++;
          continue;
        }
        const f = attendanceFlags(m, a, m.endedAt);
        if (f.late) late++;
        if (f.leftEarly === 'yes') leftEarly++;
      }
      const s = byId.get(p.id);
      return {
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        business: p.business_name,
        card: {
          meetingsHeld: theirs.length,
          attended,
          substitutes,
          missed: theirs.length - attended,
          late,
          leftEarly,
          oneOnOnes: Number(s?.one_on_ones ?? 0),
          referralsGiven: Number(s?.referrals_given ?? 0),
          referralsReceived: Number(s?.referrals_received ?? 0),
          closedGiven: Number(s?.closed_deals ?? 0),
          closedReceived: Number(s?.closed_deals_received ?? 0),
          visitors: Number(s?.visitors_brought ?? 0),
          presentations: presentations.get(p.id) ?? 0,
        },
      };
    });

  const g = goalsRes.data;
  return {
    members,
    goals: { one_on_ones: g?.one_on_ones ?? null, referrals: g?.referrals ?? null, visitors: g?.visitors ?? null, attendance_pct: g?.attendance_pct ?? null },
    meetingsHeld: meetings.length,
  };
}
