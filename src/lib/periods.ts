import { localDateKey } from './dates';

// Stats periods as Pacific calendar dates. `to` is exclusive; null means open-ended.
// These are passed straight to the admin_member_stats / leaderboard / group_totals database functions.

export const PERIODS = ['cycle', 'week', 'month', 'quarter', 'year', 'all', 'custom'] as const;
export type Period = (typeof PERIODS)[number];
export type DateRange = { from: string | null; to: string | null };

const labels: Record<Period, string> = {
  cycle: 'This meeting cycle',
  week: 'This week',
  month: 'This month',
  quarter: 'This quarter',
  year: 'This year',
  all: 'All time',
  custom: 'Custom range',
};
export const periodLabel = (p: Period) => labels[p];
export const isPeriod = (v: unknown): v is Period => typeof v === 'string' && (PERIODS as readonly string[]).includes(v);

type Input = { period: Period; lastMeeting?: string | null; from?: string; to?: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parts(key: string) {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return { y, m, d };
}
function key(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
}
function addDays(k: string, n: number): string {
  const { y, m, d } = parts(k);
  return key(y, m, d + n);
}
function validDay(v: string | undefined): v is string {
  if (!v || !DAY.test(v)) return false;
  const { y, m, d } = parts(v);
  return key(y, m, d) === v;
}

export function periodRange(input: Input, now: Date = new Date()): DateRange {
  const today = localDateKey(now);
  const { y, m, d } = parts(today);
  const weekStart = () => {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
    const start = addDays(today, -((dow + 6) % 7));
    return { from: start, to: addDays(start, 7) };
  };
  const month = { from: key(y, m, 1), to: key(y, m + 1, 1) };

  switch (input.period) {
    case 'week':
      return weekStart();
    case 'cycle':
      return validDay(input.lastMeeting ?? undefined) && (input.lastMeeting as string) <= today
        ? { from: input.lastMeeting as string, to: addDays(today, 1) }
        : weekStart();
    case 'month':
      return month;
    case 'quarter': {
      const q = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: key(y, q, 1), to: key(y, q + 3, 1) };
    }
    case 'year':
      return { from: key(y, 1, 1), to: key(y + 1, 1, 1) };
    case 'all':
      return { from: null, to: null };
    case 'custom':
      if (validDay(input.from) && validDay(input.to) && input.from <= input.to) return { from: input.from, to: addDays(input.to, 1) };
      return month;
    default:
      return month;
  }
}

/** Human description of a range, e.g. "Oct 1 – Oct 31, 2026" (end shown inclusive). */
export function describeRange(r: DateRange): string {
  if (!r.from && !r.to) return 'All time';
  const f = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  if (r.from && r.to) return `${f(r.from)} – ${f(addDays(r.to, -1))}`;
  return r.from ? `Since ${f(r.from)}` : `Before ${f(r.to as string)}`;
}
