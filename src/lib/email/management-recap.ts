// The Management recap's content (owner, 2026-10-30), built from the database. Shared by the send job (cron.ts) and the
// admin preview (/admin/management-recap), so the preview shows exactly what the Management Team is sent.
import 'server-only';

import { absencesFor, memberSince } from '../data/attendance';
import { formatMeetingDate, formatMeetingTime } from '../dates';
import { lateEarly } from '../zoom';
import type { Db } from './recap';
import type { ManagementRecap } from './templates';

const DAY = 86_400_000;

export type MgmtMeeting = { id: string; title: string; starts_at: string; ends_at: string };

const full = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`.trim();

/** The most recent regular meeting that has ended, for the preview. */
export async function latestEndedMeetingForMgmt(db: Db, now: Date): Promise<MgmtMeeting | null> {
  const { data } = await db
    .from('meetings')
    .select('id, title, starts_at, ends_at')
    .eq('category', 'Networking')
    .is('cancelled_reason', null)
    .lte('ends_at', now.toISOString())
    .order('ends_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function managementRecapFor(db: Db, m: MgmtMeeting, now: Date): Promise<ManagementRecap> {
  const nowIso = now.toISOString();
  const [impRes, attRes, membersRes, guestsRes, zoomRes, pendingRes, waitingRes, nextRes] = await Promise.all([
    db.from('attendance_imports').select('source, status').eq('meeting_id', m.id).maybeSingle(),
    db.from('attendance').select('profile_id, status, substitute, zoom, joined_at, left_at').eq('meeting_id', m.id),
    db
      .from('profiles')
      .select('id, first_name, last_name, approved_at, member_since, created_at')
      .eq('status', 'approved')
      .order('first_name')
      .order('last_name'),
    db
      .from('guest_requests')
      .select('first_name, last_name, business_name, email, phone, referrer_id, invited_by_text, source, created_at')
      .eq('meeting_id', m.id)
      .in('status', ['visited', 'applied', 'joined'])
      .order('created_at'),
    db.from('zoom_participants').select('id', { count: 'exact', head: true }).eq('meeting_id', m.id).eq('resolution', 'pending'),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db
      .from('guest_requests')
      .select('first_name, last_name')
      .in('status', ['visited', 'applied'])
      .is('one_on_ones_done_at', null)
      .gte('created_at', new Date(now.getTime() - 90 * DAY).toISOString())
      .order('created_at'),
    db
      .from('meetings')
      .select('starts_at, meeting_speakers(slot)')
      .eq('category', 'Networking')
      .is('cancelled_reason', null)
      .eq('hidden', false)
      .gt('starts_at', nowIso)
      .order('starts_at')
      .limit(1)
      .maybeSingle(),
  ]);

  // Members who joined after this meeting don't count for it.
  const members = (membersRes.data ?? []).filter((p) => new Date(memberSince(p)).getTime() <= new Date(m.ends_at).getTime());
  const taken = impRes.data?.status === 'done' ? { source: impRes.data.source } : null;
  const att = new Map((attRes.data ?? []).map((a) => [a.profile_id, a]));
  const present: string[] = [];
  const substitutes: string[] = [];
  const excused: string[] = [];
  const absent: string[] = [];
  const late: string[] = [];
  const leftEarly: string[] = [];
  for (const p of members) {
    const a = att.get(p.id);
    const name = full(p);
    if (a?.status === 'present' && a.substitute) substitutes.push(name);
    else if (a?.status === 'present') {
      present.push(name);
      if (a.zoom) {
        const f = lateEarly(m, a.joined_at, a.left_at);
        if (f.late) late.push(name);
        if (f.leftEarly) leftEarly.push(name);
      }
    } else if (a?.status === 'excused') excused.push(name);
    else absent.push(name);
  }

  // Visitors, and who invited them (the member's full name, or what the visitor typed).
  const guests = guestsRes.data ?? [];
  const refIds = [...new Set(guests.map((g) => g.referrer_id).filter((x): x is string => !!x))];
  const { data: refs } = refIds.length
    ? await db.from('profiles').select('id, first_name, last_name').in('id', refIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] };
  const refName = new Map((refs ?? []).map((r) => [r.id, full(r)]));
  const visitors = guests.map((g) => ({
    name: `${g.first_name} ${g.last_name}`,
    business: g.business_name,
    invitedBy: (g.referrer_id ? refName.get(g.referrer_id) : null) ?? g.invited_by_text?.replace(/\s*\(via referral link\)\s*$/i, '').trim() ?? null,
    email: g.email,
    phone: g.phone,
    signedIn: g.source === 'meeting_sign_in',
  }));

  const absences = await absencesFor(
    db,
    members.map((p) => ({ id: p.id, since: memberSince(p) })),
    now,
  );
  const atLimit = members
    .map((p) => ({ name: full(p), missed: absences.get(p.id)?.missed ?? 0, at: !!absences.get(p.id)?.atLimit }))
    .filter((x) => x.at)
    .map(({ name, missed }) => ({ name, missed }));

  const next = nextRes.data;
  const booked = new Set(((next?.meeting_speakers ?? []) as { slot: string }[]).map((s) => s.slot));
  const start = new Date(m.starts_at);
  return {
    meetingTitle: m.title,
    meetingWhen: formatMeetingDate(start),
    taken,
    totalMembers: members.length,
    present,
    substitutes,
    excused,
    absent,
    late,
    leftEarly,
    visitors,
    atLimit,
    unmatchedZoom: zoomRes.count ?? 0,
    pendingApplications: pendingRes.count ?? 0,
    guestsAwaitingOneOnOnes: (waitingRes.data ?? []).map((g) => `${g.first_name} ${g.last_name}`),
    next: next
      ? {
          when: `${formatMeetingDate(new Date(next.starts_at))} at ${formatMeetingTime(new Date(next.starts_at))}`,
          openSlots: [!booked.has('education') ? '5-minute' : null, !booked.has('presentation') ? '10-minute' : null].filter((x): x is string => !!x),
        }
      : null,
  };
}
