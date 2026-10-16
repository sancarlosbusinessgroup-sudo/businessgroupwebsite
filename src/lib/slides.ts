// Meeting slide deck: which slides exist, their default order (the agreed agenda) and labels.

export const SLIDE_KEYS = [
  'welcome',
  'phones',
  'visitors',
  'newcomers',
  'asks',
  'five_minute',
  'ten_minute',
  'summary',
  'leaderboards',
  'events',
  'closing',
] as const;
export type SlideKey = (typeof SLIDE_KEYS)[number];

export const DEFAULT_SLIDES: SlideKey[] = [...SLIDE_KEYS];

const labels: Record<SlideKey, string> = {
  welcome: 'Welcome',
  phones: 'Please silence your phones',
  visitors: 'For visitors: how to visit and join',
  newcomers: 'New members & today’s visitors',
  asks: 'Weekly specific asks',
  five_minute: '5-minute presentation',
  ten_minute: '10-minute presentation',
  summary: 'Summary of one-on-ones, referrals and closed deals',
  leaderboards: 'Leaderboards',
  events: 'Upcoming events',
  closing: 'Thank you & next meeting',
};
export const slideLabel = (k: SlideKey) => labels[k];
export const isSlideKey = (v: unknown): v is SlideKey => typeof v === 'string' && (SLIDE_KEYS as readonly string[]).includes(v);

/** Saved per-meeting order, cleaned up; falls back to the standard agenda. */
export function resolveSlides(saved: readonly string[] | null | undefined): SlideKey[] {
  const out: SlideKey[] = [];
  for (const k of saved ?? []) if (isSlideKey(k) && !out.includes(k)) out.push(k);
  return out.length ? out : [...DEFAULT_SLIDES];
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
