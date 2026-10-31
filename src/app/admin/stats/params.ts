import { formatMoney } from '@/lib/dates';
import { isPeriod, periodRange, type Period } from '@/lib/periods';

export type StatsSearch = { period?: string; from?: string; to?: string; sort?: string; dir?: string; q?: string; closed?: string };

export const statColumns = [
  { key: 'one_on_ones', label: 'One-on-ones' },
  { key: 'referrals_given', label: 'Referrals given' },
  { key: 'referrals_received', label: 'Referrals received' },
  { key: 'closed_deals', label: 'Closed business', closed: true },
  { key: 'closed_deals_received', label: 'Closed business received', closed: true },
  { key: 'closed_amount_given', label: 'Business given ($)', money: true, closed: true },
  { key: 'closed_amount_received', label: 'Business received ($)', money: true, closed: true },
  { key: 'visitors_brought', label: 'Visitors brought' },
] as const;

/** Shows a stat cell: dollar columns as money, the rest as counts. */
export const statValue = (c: (typeof statColumns)[number], n: number) => ('money' in c && c.money ? formatMoney(n) : String(n));
export type StatKey = (typeof statColumns)[number]['key'] | 'name';

export function parseStatsSearch(sp: StatsSearch, lastMeeting: string | null) {
  const period: Period = isPeriod(sp.period) ? sp.period : 'month';
  const range = periodRange({ period, lastMeeting, from: sp.from, to: sp.to });
  const sort: StatKey = sp.sort === 'name' || statColumns.some((c) => c.key === sp.sort) ? (sp.sort as StatKey) : 'name';
  const dir: 'asc' | 'desc' = sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : sort === 'name' ? 'asc' : 'desc';
  return { period, range, sort, dir };
}

/** Query string that keeps the chosen period (and optionally sort) when linking around. */
export function statsQuery(sp: StatsSearch, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  for (const k of ['period', 'from', 'to', 'sort', 'dir', 'q', 'closed'] as const) if (sp[k]) q.set(k, sp[k] as string);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/**
 * Owner meeting 2026-10-30: closed business is confidential, so its columns stay hidden on screen (e.g. for the group
 * coach) until an admin ticks "Show closed business". The CSV download keeps every column.
 */
export const visibleStatColumns = (showClosed: boolean) => statColumns.filter((c) => showClosed || !('closed' in c && c.closed));

/** Member name / business search on Member stats (owner meeting 2026-10-30). */
export function matchesMember(r: { first_name: string; last_name: string; business_name: string | null }, q: string | undefined): boolean {
  const needle = (q ?? '').trim().toLowerCase().slice(0, 100);
  if (!needle) return true;
  return `${r.first_name} ${r.last_name} ${r.business_name ?? ''}`.toLowerCase().includes(needle);
}
