// Imports one meeting's Zoom participant report into attendance (Phase D).
// Called by the after-meeting job (service-role client) and by admins from /admin/attendance (their own client, RLS: admins only).
// Safe to run again: participants are upserted per person, and decisions an admin made in the review list are kept.
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { pastInstances, reportParticipants, zoomConfigured, ZoomError } from './zoom-api';
import { matchParticipant, mergeParticipants, parseZoomMeetingId, type GuestRef, type MemberRef, type Participant } from './zoom';

type Db = SupabaseClient<Database>;
export type ImportResult = { ok: true; participants: number; matched: number; pending: number; guests: number } | { ok: false; error: string };

const HOUR = 3_600_000;

/** The Zoom session that belongs to this meeting: the one that started closest to it, within 6 hours. */
export function pickInstance(instances: { uuid: string; start_time: string }[], startsAt: string) {
  const at = new Date(startsAt).getTime();
  return (
    instances
      .map((i) => ({ ...i, gap: Math.abs(new Date(i.start_time).getTime() - at) }))
      .filter((i) => i.gap <= 6 * HOUR)
      .sort((a, b) => a.gap - b.gap)[0] ?? null
  );
}

async function recordError(db: Db, meetingId: string, error: string, by: string | null) {
  const { data: prev } = await db.from('attendance_imports').select('status').eq('meeting_id', meetingId).maybeSingle();
  // Never undo attendance that was already taken; just keep the latest error for the admin page.
  if (prev?.status === 'done') await db.from('attendance_imports').update({ error }).eq('meeting_id', meetingId);
  else
    await db
      .from('attendance_imports')
      .upsert({ meeting_id: meetingId, source: 'zoom', status: 'error', error, imported_by: by, imported_at: new Date().toISOString() });
}

export async function importZoomAttendance(db: Db, meetingId: string, by: string | null = null): Promise<ImportResult> {
  if (!zoomConfigured()) return { ok: false, error: 'Zoom is not connected yet. Add the three ZOOM_ values in Vercel (see the setup steps).' };
  const [{ data: meeting }, { data: link }] = await Promise.all([
    db.from('meetings').select('id, starts_at, ends_at').eq('id', meetingId).maybeSingle(),
    db.from('meeting_links').select('join_url').eq('meeting_id', meetingId).maybeSingle(),
  ]);
  if (!meeting) return { ok: false, error: 'Meeting not found.' };
  const zoomId = parseZoomMeetingId(link?.join_url);
  if (!zoomId) {
    const error = 'No Zoom link is saved for this meeting, so the site can’t tell which Zoom meeting to read.';
    await recordError(db, meetingId, error, by);
    return { ok: false, error };
  }

  let parts: Participant[];
  let uuid: string;
  try {
    const inst = pickInstance(await pastInstances(zoomId), meeting.starts_at);
    if (!inst) throw new ZoomError('Zoom has no session of this meeting on that day yet.');
    uuid = inst.uuid;
    parts = mergeParticipants(await reportParticipants(uuid));
  } catch (e) {
    const error = e instanceof ZoomError ? e.message : 'Could not reach Zoom. Please try again later.';
    if (!(e instanceof ZoomError)) console.error('[zoom] import failed', e instanceof Error ? e.message : e);
    await recordError(db, meetingId, error, by);
    return { ok: false, error };
  }

  const since = new Date(new Date(meeting.starts_at).getTime() - 120 * 24 * HOUR).toISOString();
  const [membersRes, guestsRes, aliasRes, existingRes, attRes] = await Promise.all([
    db.from('profiles').select('id, first_name, last_name, member_contacts(email)').eq('status', 'approved'),
    db.from('guest_requests').select('id, first_name, last_name, email, status').in('status', ['requested', 'visited']).gte('created_at', since),
    db.from('zoom_aliases').select('key, profile_id'),
    db.from('zoom_participants').select('key, resolution, matched_by, profile_id, guest_id').eq('meeting_id', meetingId),
    db.from('attendance').select('profile_id, status, checked_in_at, method').eq('meeting_id', meetingId),
  ]);
  if (membersRes.error || guestsRes.error || aliasRes.error || existingRes.error || attRes.error) {
    const error = 'Could not read members from the database.';
    await recordError(db, meetingId, error, by);
    return { ok: false, error };
  }
  const members: MemberRef[] = (membersRes.data ?? []).map((p) => {
    const c = p.member_contacts as unknown as { email: string } | { email: string }[] | null;
    return { id: p.id, firstName: p.first_name, lastName: p.last_name, email: (Array.isArray(c) ? c[0]?.email : c?.email) ?? null };
  });
  const guests: GuestRef[] = (guestsRes.data ?? []).map((g) => ({ id: g.id, firstName: g.first_name, lastName: g.last_name, email: g.email }));
  const aliases = new Map((aliasRes.data ?? []).map((a) => [a.key, a.profile_id]));
  const decided = new Map(
    (existingRes.data ?? [])
      .filter((r) => r.resolution !== 'pending' && (r.matched_by === 'admin' || r.resolution === 'visitor' || r.resolution === 'ignored'))
      .map((r) => [r.key, r]),
  );

  const rows: Database['public']['Tables']['zoom_participants']['Insert'][] = [];
  const present = new Map<string, { joinedAt: string | null; leftAt: string | null; minutes: number }>();
  const guestIds = new Set<string>();
  for (const p of parts) {
    const base = {
      meeting_id: meetingId,
      key: p.key,
      name: p.name.slice(0, 200),
      email: p.email,
      joined_at: p.joinedAt,
      left_at: p.leftAt,
      minutes: p.minutes,
    };
    const keep = decided.get(p.key);
    let row: (typeof rows)[number];
    if (keep) row = { ...base, resolution: keep.resolution, matched_by: keep.matched_by, profile_id: keep.profile_id, guest_id: keep.guest_id };
    else {
      const m = matchParticipant(p, members, guests, aliases);
      row =
        m.kind === 'member'
          ? { ...base, resolution: 'member', matched_by: m.by, profile_id: m.profileId, guest_id: null }
          : m.kind === 'guest'
            ? { ...base, resolution: 'guest', matched_by: m.by, profile_id: null, guest_id: m.guestId }
            : { ...base, resolution: 'pending', matched_by: null, profile_id: null, guest_id: null };
    }
    rows.push(row);
    if (row.resolution === 'member' && row.profile_id) {
      const prev = present.get(row.profile_id);
      present.set(row.profile_id, {
        joinedAt: [prev?.joinedAt, p.joinedAt].filter(Boolean).sort()[0] ?? null,
        leftAt: [prev?.leftAt, p.leftAt].filter(Boolean).sort().at(-1) ?? null,
        minutes: Math.min(1440, (prev?.minutes ?? 0) + p.minutes),
      });
    }
    if (row.resolution === 'guest' && row.guest_id) guestIds.add(row.guest_id);
  }

  if (rows.length) {
    const { error } = await db.from('zoom_participants').upsert(rows, { onConflict: 'meeting_id,key' });
    if (error) {
      await recordError(db, meetingId, 'Could not save the participant list.', by);
      return { ok: false, error: 'Could not save the participant list.' };
    }
  }
  const before = new Map((attRes.data ?? []).map((a) => [a.profile_id, a]));
  const att = [...present].map(([profileId, t]) => ({
    meeting_id: meetingId,
    profile_id: profileId,
    status: 'present' as const,
    zoom: true,
    joined_at: t.joinedAt,
    left_at: t.leftAt,
    minutes: t.minutes,
    checked_in_at: before.get(profileId)?.checked_in_at ?? t.joinedAt,
    method: before.get(profileId)?.method ?? 'admin',
  }));
  if (att.length) {
    const { error } = await db.from('attendance').upsert(att, { onConflict: 'meeting_id,profile_id' });
    if (error) {
      await recordError(db, meetingId, 'Could not save attendance.', by);
      return { ok: false, error: 'Could not save attendance.' };
    }
  }
  // Guests who came: mark them Visited (this also starts the visitor follow-up emails).
  for (const id of guestIds) {
    await db.from('guest_requests').update({ status: 'visited' }).eq('id', id).eq('status', 'requested');
    await db.from('guest_requests').update({ meeting_id: meetingId }).eq('id', id).is('meeting_id', null);
  }
  const pending = rows.filter((r) => r.resolution === 'pending').length;
  await db.from('attendance_imports').upsert({
    meeting_id: meetingId,
    source: 'zoom',
    zoom_uuid: uuid,
    participants: rows.length,
    matched: present.size,
    status: 'done',
    error: null,
    imported_at: new Date().toISOString(),
    imported_by: by,
  });
  return { ok: true, participants: rows.length, matched: present.size, pending, guests: guestIds.size };
}

/** After-meeting job: import regular meetings that ended 30 minutes to 3 days ago and have no attendance yet. */
export async function importRecentMeetings(db: Db, now: Date = new Date()) {
  if (!zoomConfigured()) return { imported: 0, failed: 0 };
  const { data: meetings } = await db
    .from('meetings')
    .select('id, ends_at, attendance_imports(status)')
    .eq('category', 'Networking')
    .is('cancelled_reason', null)
    .gte('ends_at', new Date(now.getTime() - 72 * HOUR).toISOString())
    .lte('ends_at', new Date(now.getTime() - 0.5 * HOUR).toISOString());
  let imported = 0;
  let failed = 0;
  for (const m of meetings ?? []) {
    const imp = m.attendance_imports as unknown as { status: string } | { status: string }[] | null;
    const status = Array.isArray(imp) ? imp[0]?.status : imp?.status;
    if (status === 'done') continue;
    const r = await importZoomAttendance(db, m.id);
    if (r.ok) imported++;
    else failed++;
  }
  return { imported, failed };
}
