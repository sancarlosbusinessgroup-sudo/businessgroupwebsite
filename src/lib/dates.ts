import { site } from './content';

const tz = site.timezone;

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

export function countdownParts(target: Date, now: Date = new Date()): CountdownParts {
  let s = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const done = s === 0;
  const days = Math.floor(s / 86400);
  s -= days * 86400;
  const hours = Math.floor(s / 3600);
  s -= hours * 3600;
  const minutes = Math.floor(s / 60);
  const seconds = s - minutes * 60;
  return { days, hours, minutes, seconds, done };
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts });

export const formatMeetingTime = (d: Date) => fmt({ hour: 'numeric', minute: '2-digit' }).format(d);
export const formatMeetingDate = (d: Date) => fmt({ weekday: 'long', month: 'short', day: 'numeric' }).format(d);
export const formatShortDate = (d: Date) => fmt({ month: 'short', day: 'numeric', year: 'numeric' }).format(d);
export const formatDayMonth = (d: Date) => ({
  day: fmt({ day: '2-digit' }).format(d),
  month: fmt({ month: 'short' }).format(d).toUpperCase(),
  weekday: fmt({ weekday: 'long' }).format(d),
});
export const formatLongToday = (d: Date = new Date()) => fmt({ weekday: 'long', month: 'long', day: 'numeric' }).format(d);

/** Calendar date (YYYY-MM-DD) of a moment in the group's timezone. */
export function localDateKey(d: Date): string {
  const parts = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Same rule as the join_meeting() database function. */
export function inCheckInWindow(start: Date, end: Date, now: Date = new Date()): boolean {
  return now.getTime() >= start.getTime() - 15 * 60 * 1000 && now.getTime() <= end.getTime();
}

export type GridCell = { year: number; month: number; day: number } | null;

/** Month grid (Sunday-first) with leading nulls; month is 0-based. */
export function monthGrid(year: number, month: number): GridCell[] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: GridCell[] = Array.from({ length: first }, () => null);
  for (let day = 1; day <= days; day++) cells.push({ year, month, day });
  return cells;
}

export function isoDateDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now.getTime() - days * 86400000);
  return localDateKey(d);
}

/** Current time in ms (kept out of render bodies so server components stay lint-clean). */
export const nowMs = () => Date.now();

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Offset (minutes) of Pacific time from UTC at a given instant, e.g. -420 in summer. */
function pacificOffsetMinutes(at: Date): number {
  const parts = fmt({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** "2026-10-20T18:00" (Pacific wall clock, as typed in a datetime-local field) → ISO UTC string. */
export function pacificLocalToIso(local: string): string | null {
  const m = LOCAL.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let guess = naive - pacificOffsetMinutes(new Date(naive)) * 60000;
  guess = naive - pacificOffsetMinutes(new Date(guess)) * 60000;
  const check = new Date(guess);
  if (isoToPacificLocal(check.toISOString()) !== local) return null;
  return check.toISOString();
}

/** ISO UTC string → "YYYY-MM-DDTHH:mm" in Pacific time (for datetime-local inputs). */
export function isoToPacificLocal(iso: string): string {
  const d = new Date(iso);
  const parts = fmt({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
