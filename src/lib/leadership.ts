// Groups the Management list the way the Bylaws show it: leadership roles, the Membership Committee
// and the Attendance Managers. A person's role can hold several parts separated by "·"
// (e.g. "Time Manager · Membership Committee"), so they can appear in more than one group.

export type LeaderLike = { id: string; name: string; role: string };

const COMMITTEE = /^membership committee$/i;
const ATTENDANCE = /^attendance managers?$/i;

export const roleParts = (role: string) =>
  role
    .split('·')
    .map((r) => r.trim())
    .filter(Boolean);

export function groupLeadership<T extends LeaderLike>(team: T[]) {
  const leaders: (T & { title: string })[] = [];
  const committee: T[] = [];
  const attendance: T[] = [];
  for (const t of team) {
    const parts = roleParts(t.role);
    const own = parts.filter((p) => !COMMITTEE.test(p) && !ATTENDANCE.test(p));
    if (own.length) leaders.push({ ...t, title: own.join(' · ') });
    if (parts.some((p) => COMMITTEE.test(p))) committee.push(t);
    if (parts.some((p) => ATTENDANCE.test(p))) attendance.push(t);
  }
  return { leaders, committee, attendance };
}
