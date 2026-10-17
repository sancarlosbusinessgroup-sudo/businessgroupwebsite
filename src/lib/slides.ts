// Meeting slide deck: which slides exist, their default order (the agreed agenda) and labels.

// Standard order follows the meeting format: open networking, introductions, roundtable check-in,
// activity numbers, the 5- and 10-minute presentations, then events & announcements.
export const SLIDE_KEYS = [
  'welcome',
  'networking',
  'phones',
  'introductions',
  'visitors',
  'newcomers',
  'roundtable',
  'asks',
  'summary',
  'leaderboards',
  'five_minute',
  'ten_minute',
  'events',
  'closing',
] as const;
export type SlideKey = (typeof SLIDE_KEYS)[number];

export const DEFAULT_SLIDES: SlideKey[] = [...SLIDE_KEYS];

const labels: Record<SlideKey, string> = {
  welcome: 'Welcome',
  networking: 'Open networking (8:15 – 8:30 AM)',
  phones: 'Please silence your phones',
  introductions: 'Introductions & leadership team',
  visitors: 'For visitors: how to visit and join',
  newcomers: 'New members & today’s visitors',
  roundtable: 'Roundtable check-in (30-second spiel & Win of the Week)',
  asks: 'Weekly specific asks',
  summary: 'Activity numbers',
  leaderboards: 'Leaderboards',
  five_minute: '5-Minute Member Education',
  ten_minute: '10-Minute Presentation',
  events: 'Events & announcements',
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

export type SlideNotes = Partial<Record<SlideKey, string>>;

/** Saved extra text per slide, keeping only known slides and non-empty text. */
export function resolveNotes(saved: unknown): SlideNotes {
  const out: SlideNotes = {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
  for (const [k, v] of Object.entries(saved as Record<string, unknown>)) if (isSlideKey(k) && typeof v === 'string' && v.trim()) out[k] = v.trim();
  return out;
}
