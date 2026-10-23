// Pure helpers for Zoom attendance (Phase D): reading the meeting ID from a join link, merging a participant's
// several joins, matching people to members and guests, late/early flags and the absence count.

/** Zoom meeting ID from a join link such as https://us02web.zoom.us/j/83818742413?pwd=…, or null. */
export function parseZoomMeetingId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/zoom\.us\/(?:j|w|s|wc\/join|my)\/(\d{9,12})(?:[/?#]|$)/i) ?? url.match(/[?&]confno=(\d{9,12})/i);
  return m?.[1] ?? null;
}

/** Lower case, no accents, no punctuation; drops anything after a separator ("Viv Kelvin | Vabrato" → "viv kelvin"). */
export function normalizeName(name: string): string {
  const head = name.split(/\s[|\-–—:/]\s|\s?[|(\[,;]/)[0] ?? name;
  return head
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(dr|mr|mrs|ms|miss) /, '');
}

export const emailKey = (email: string) => `email:${email.trim().toLowerCase()}`;
export const nameKey = (name: string) => `name:${normalizeName(name)}`;

export type RawParticipant = {
  name?: string | null;
  user_email?: string | null;
  join_time?: string | null;
  leave_time?: string | null;
  duration?: number | null;
};
export type Participant = { key: string; name: string; email: string | null; joinedAt: string | null; leftAt: string | null; minutes: number };

/** One entry per person: Zoom lists a new row every time someone rejoins. Keyed by email when Zoom gives one, else by name. */
export function mergeParticipants(rows: RawParticipant[]): Participant[] {
  const out = new Map<string, Participant & { seconds: number }>();
  for (const r of rows) {
    const name = (r.name ?? '').trim() || 'Unknown';
    const email = r.user_email?.trim() ? r.user_email.trim().toLowerCase() : null;
    const key = email ? emailKey(email) : nameKey(name);
    if (key === 'name:') continue;
    const prev = out.get(key);
    const joined = r.join_time ?? null;
    const left = r.leave_time ?? null;
    const seconds = Math.max(0, Number(r.duration ?? 0));
    if (!prev) {
      out.set(key, { key, name, email, joinedAt: joined, leftAt: left, minutes: 0, seconds });
      continue;
    }
    if (joined && (!prev.joinedAt || joined < prev.joinedAt)) prev.joinedAt = joined;
    if (left && (!prev.leftAt || left > prev.leftAt)) prev.leftAt = left;
    prev.seconds += seconds;
  }
  return [...out.values()].map(({ seconds, ...p }) => ({ ...p, minutes: Math.min(1440, Math.round(seconds / 60)) }));
}

export type MemberRef = { id: string; firstName: string; lastName: string; email: string | null };
export type GuestRef = { id: string; firstName: string; lastName: string; email: string };
export type Match =
  { kind: 'member'; profileId: string; by: 'email' | 'name' | 'alias' } | { kind: 'guest'; guestId: string; by: 'email' | 'name' } | { kind: 'pending' };

/**
 * Matches one participant: a remembered alias first, then member email, member full name, guest email, guest name.
 * Names must match the whole first + last name (after normalising), and only when exactly one person has that name.
 */
export function matchParticipant(p: Participant, members: MemberRef[], guests: GuestRef[], aliases: Map<string, string>): Match {
  const nk = nameKey(p.name);
  const byAlias = (p.email && aliases.get(emailKey(p.email))) || aliases.get(nk);
  if (byAlias) return { kind: 'member', profileId: byAlias, by: 'alias' };
  if (p.email) {
    const m = members.find((x) => x.email && x.email.toLowerCase() === p.email);
    if (m) return { kind: 'member', profileId: m.id, by: 'email' };
  }
  const n = normalizeName(p.name);
  const startsWithName = (full: string) => n === full || n.startsWith(`${full} `);
  const named = members.filter((x) => startsWithName(normalizeName(`${x.firstName} ${x.lastName}`)));
  if (named.length === 1) return { kind: 'member', profileId: named[0]!.id, by: 'name' };
  if (p.email) {
    const g = guests.find((x) => x.email.toLowerCase() === p.email);
    if (g) return { kind: 'guest', guestId: g.id, by: 'email' };
  }
  const gNamed = guests.filter((x) => startsWithName(normalizeName(`${x.firstName} ${x.lastName}`)));
  if (gNamed.length === 1) return { kind: 'guest', guestId: gNamed[0]!.id, by: 'name' };
  return { kind: 'pending' };
}

/** Bylaws: arriving after 8:30 AM (15 minutes after the 8:15 start) or leaving before the 9:30 finish. One minute's grace. */
export function lateEarly(meeting: { starts_at: string; ends_at: string }, joinedAt: string | null, leftAt: string | null) {
  const grace = 60_000;
  const calledToOrder = new Date(meeting.starts_at).getTime() + 15 * 60_000;
  const end = new Date(meeting.ends_at).getTime();
  return {
    late: !!joinedAt && new Date(joinedAt).getTime() > calledToOrder + grace,
    leftEarly: !!leftAt && new Date(leftAt).getTime() < end - grace,
  };
}

export const ABSENCE_LIMIT = 2;
export const ABSENCE_WINDOW_MONTHS = 6;

/**
 * Meetings missed in the last six months, counting only meetings whose attendance was taken (Zoom or by hand)
 * and that happened after the member joined. Present and substitute count as attended; excused counts as missed
 * (Bylaws: no more than 2 missed meetings in 6 months).
 */
export function absenceSummary(
  taken: { meeting_id: string; starts_at: string }[],
  rows: { meeting_id: string; status: string; substitute?: boolean | null }[],
  opts: { now: Date; memberSince?: string | null },
) {
  const from = new Date(opts.now);
  from.setMonth(from.getMonth() - ABSENCE_WINDOW_MONTHS);
  const since = opts.memberSince ? new Date(opts.memberSince).getTime() : 0;
  const attended = new Set(rows.filter((r) => r.status === 'present' || r.substitute).map((r) => r.meeting_id));
  const counted = taken.filter((t) => {
    const at = new Date(t.starts_at).getTime();
    return at >= from.getTime() && at <= opts.now.getTime() && at >= since;
  });
  const missed = counted.filter((t) => !attended.has(t.meeting_id));
  return {
    counted: counted.length,
    missed: missed.length,
    missedMeetings: missed.map((m) => m.meeting_id),
    atLimit: missed.length >= ABSENCE_LIMIT,
    overLimit: missed.length > ABSENCE_LIMIT,
  };
}

/** Explains a missing session, listing the most recent days Zoom does have for this meeting ID. */
export function noSessionMessage(zoomId: string, instances: { start_time: string }[]) {
  const days = [
    ...new Set(
      instances
        .map((i) => i.start_time)
        .sort()
        .reverse()
        .map((t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })),
    ),
  ].slice(0, 5);
  const id = zoomId.replace(/^(\d{3})(\d{4})(\d+)$/, '$1 $2 $3');
  return days.length
    ? `Zoom has no session of meeting ${id} on that day. Its most recent sessions were on ${days.join(', ')}.`
    : `Zoom has no past sessions of meeting ${id} at all. Was this meeting held with a different Zoom link, or hosted from another Zoom account?`;
}
