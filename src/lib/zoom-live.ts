// Live attendance during the meeting (owner, 2026-11-10): pure helpers for the Zoom webhook and the live view.
// Zoom sends "participant joined / left" events as they happen; the site stores them (zoom_live_events) and the
// Management Team sees who is on time, late, not here yet, or an unknown Zoom name. The after-meeting report import
// stays the official record.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { emailKey, lateEarly, matchParticipant, nameKey, parseZoomMeetingId, type GuestRef, type MemberRef } from './zoom';

/** Zoom's signature: "v0=" + HMAC-SHA256(secret token, "v0:{timestamp}:{raw body}") in hex. */
export function zoomSignature(secret: string, timestamp: string, body: string) {
  return `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
}

/** True when the request really comes from Zoom: the signature matches and the timestamp is within 5 minutes. */
export function verifyZoomRequest(secret: string, signature: string | null, timestamp: string | null, body: string, now = Date.now()) {
  if (!secret || !signature || !timestamp || !/^\d{1,13}$/.test(timestamp)) return false;
  const ts = Number(timestamp);
  // Zoom sends seconds; accept milliseconds too.
  const ms = ts < 1e12 ? ts * 1000 : ts;
  if (Math.abs(now - ms) > 5 * 60_000) return false;
  const want = Buffer.from(zoomSignature(secret, timestamp, body));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Answer to Zoom's "is this your endpoint?" check when the webhook address is saved in the Zoom app. */
export function urlValidationResponse(secret: string, plainToken: string) {
  return { plainToken, encryptedToken: createHmac('sha256', secret).update(plainToken).digest('hex') };
}

export type LiveEvent = { zoomId: string; event: 'joined' | 'left'; key: string; name: string; email: string | null; at: string };

type ZoomWebhook = {
  event?: string;
  event_ts?: number;
  payload?: {
    object?: {
      id?: string | number;
      participant?: { user_name?: string; email?: string; join_time?: string; leave_time?: string };
    };
  };
};

/** A participant joined/left event in the site's own shape, or null for any other event. */
export function parseParticipantEvent(body: unknown): LiveEvent | null {
  const b = body as ZoomWebhook;
  const event = b?.event === 'meeting.participant_joined' ? 'joined' : b?.event === 'meeting.participant_left' ? 'left' : null;
  if (!event) return null;
  const obj = b.payload?.object;
  const zoomId = String(obj?.id ?? '').replace(/\D/g, '');
  const p = obj?.participant;
  if (!zoomId || !p) return null;
  const name = (p.user_name ?? '').trim().slice(0, 200) || 'Unknown';
  const email = p.email?.trim() ? p.email.trim().toLowerCase().slice(0, 254) : null;
  const when = (event === 'joined' ? p.join_time : p.leave_time) ?? (b.event_ts ? new Date(b.event_ts).toISOString() : null);
  if (!when || Number.isNaN(Date.parse(when))) return null;
  const key = email ? emailKey(email) : nameKey(name);
  if (key === 'name:') return null;
  return { zoomId, event, key: key.slice(0, 300), name, email, at: new Date(when).toISOString() };
}

/**
 * The site meeting a Zoom event belongs to: same Zoom meeting ID (every meeting uses the group's one link, so the time
 * decides), and the event falls between an hour before the start and an hour after the end. Closest start wins.
 */
export function pickLiveMeeting(
  meetings: { id: string; starts_at: string; ends_at: string; join_url: string | null }[],
  zoomId: string,
  at: string,
): string | null {
  const t = new Date(at).getTime();
  const hour = 3_600_000;
  return (
    meetings
      .filter((m) => parseZoomMeetingId(m.join_url) === zoomId)
      .filter((m) => t >= new Date(m.starts_at).getTime() - hour && t <= new Date(m.ends_at).getTime() + hour)
      .sort((a, b) => Math.abs(new Date(a.starts_at).getTime() - t) - Math.abs(new Date(b.starts_at).getTime() - t))[0]?.id ?? null
  );
}

export type LivePerson = {
  key: string;
  /** Member or guest name when matched, else the Zoom name. */
  name: string;
  zoomName: string;
  joinedAt: string;
  /** Still in the meeting (last event was a join). */
  inNow: boolean;
  leftAt: string | null;
  minutesLate: number;
};
export type LiveSummary = {
  events: number;
  onTime: LivePerson[];
  late: LivePerson[];
  notYet: { id: string; name: string }[];
  unknown: LivePerson[];
  visitors: LivePerson[];
};

type Row = { event: 'joined' | 'left'; key: string; name: string; email: string | null; at: string };

/**
 * Groups the live events: members on time / late (after 8:30, same rule and grace as the report), members not here
 * yet, Zoom names the site can't match, and invited guests. Several Zoom entries of one member are merged.
 */
export function liveSummary(
  rows: Row[],
  meeting: { starts_at: string; ends_at: string },
  members: MemberRef[],
  guests: GuestRef[],
  aliases: Map<string, string>,
): LiveSummary {
  type P = { key: string; name: string; email: string | null; joinedAt: string | null; leftAt: string | null; inNow: boolean };
  const people = new Map<string, P>();
  for (const r of [...rows].sort((a, b) => a.at.localeCompare(b.at) || (a.event === 'left' ? 1 : -1))) {
    const p = people.get(r.key) ?? { key: r.key, name: r.name, email: r.email, joinedAt: null, leftAt: null, inNow: false };
    if (r.event === 'joined') {
      if (!p.joinedAt || r.at < p.joinedAt) p.joinedAt = r.at;
      p.inNow = true;
      p.name = r.name;
    } else {
      p.leftAt = r.at;
      p.inNow = false;
    }
    people.set(r.key, p);
  }

  const start = new Date(meeting.starts_at).getTime() + 15 * 60_000;
  const minutesLate = (joinedAt: string) => Math.max(0, Math.round((new Date(joinedAt).getTime() - start) / 60_000));
  const byMember = new Map<string, LivePerson>();
  const unknown: LivePerson[] = [];
  const visitors: LivePerson[] = [];
  const memberName = new Map(members.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));
  const guestName = new Map(guests.map((g) => [g.id, `${g.firstName} ${g.lastName}`]));

  for (const p of people.values()) {
    // Only a leave event seen (joined before the site started listening): treat the leave as all we know.
    const joinedAt = p.joinedAt ?? p.leftAt!;
    const base = { key: p.key, zoomName: p.name, joinedAt, inNow: p.inNow, leftAt: p.inNow ? null : p.leftAt, minutesLate: minutesLate(joinedAt) };
    const m = matchParticipant({ key: p.key, name: p.name, email: p.email, joinedAt, leftAt: p.leftAt, minutes: 0 }, members, guests, aliases);
    if (m.kind === 'member') {
      const prev = byMember.get(m.profileId);
      const name = memberName.get(m.profileId) ?? p.name;
      if (!prev) byMember.set(m.profileId, { ...base, name });
      else {
        const first = prev.joinedAt <= joinedAt ? prev : base;
        const inNow = prev.inNow || base.inNow;
        const leftAt = inNow ? null : [prev.leftAt, base.leftAt].filter(Boolean).sort().at(-1)!;
        byMember.set(m.profileId, { ...first, name, inNow, leftAt });
      }
    } else if (m.kind === 'guest') visitors.push({ ...base, name: guestName.get(m.guestId) ?? p.name });
    else unknown.push({ ...base, name: p.name });
  }

  const sortByJoin = (a: LivePerson, b: LivePerson) => a.joinedAt.localeCompare(b.joinedAt);
  const seen = [...byMember.values()].sort(sortByJoin);
  const isLate = (p: LivePerson) => lateEarly(meeting, p.joinedAt, null).late;
  return {
    events: rows.length,
    onTime: seen.filter((p) => !isLate(p)),
    late: seen.filter(isLate),
    notYet: members
      .filter((m) => !byMember.has(m.id))
      .map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}` }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    unknown: unknown.sort(sortByJoin),
    visitors: visitors.sort(sortByJoin),
  };
}

/** The live view shows from an hour before the start until an hour after the end. */
export function isLiveWindow(meeting: { starts_at: string; ends_at: string }, now: Date) {
  const t = now.getTime();
  return t >= new Date(meeting.starts_at).getTime() - 3_600_000 && t <= new Date(meeting.ends_at).getTime() + 3_600_000;
}
