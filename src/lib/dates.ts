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
