// Meeting slide deck: which slides exist, their default order and labels.
// The standard order follows the official agenda in the Procedures (effective October 19, 2026).

export const SLIDE_KEYS = [
  'welcome',
  'agenda',
  'networking',
  'call_to_order',
  'leadership',
  'guests',
  'infomercials',
  'asks',
  'statistics',
  'leaderboards',
  'five_minute',
  'five_qa',
  'ten_minute',
  'ten_qa',
  'announcements',
  'visitors_thanks',
  'adjourn',
] as const;
export type SlideKey = (typeof SLIDE_KEYS)[number];

/** Standard deck (owner's order, 2026-10-21). "Today's agenda", "This week we're looking for…" and
 *  "Thank you, visitors" stay available: tick them on the Customize slides page to add them to a meeting. */
export const DEFAULT_SLIDES: SlideKey[] = [
  'welcome',
  'networking',
  'call_to_order',
  'leadership',
  'guests',
  'infomercials',
  'statistics',
  'leaderboards',
  'five_minute',
  'five_qa',
  'ten_minute',
  'ten_qa',
  'announcements',
  'adjourn',
];

type SlideInfo = { label: string; time?: string };
const info: Record<SlideKey, SlideInfo> = {
  welcome: { label: 'Logo' },
  agenda: { label: 'Today’s agenda' },
  networking: { label: 'Welcome (open networking)', time: '8:15' },
  call_to_order: { label: 'Let’s begin (meeting called to order)', time: '8:30' },
  leadership: { label: 'Meet the Management Team', time: '8:31' },
  guests: { label: 'Introduction of guests', time: '8:32' },
  infomercials: { label: '60-second infomercials', time: '8:33' },
  asks: { label: 'This week we’re looking for…', time: '8:33' },
  statistics: { label: 'Statistics', time: '9:00' },
  leaderboards: { label: 'Leaderboards', time: '9:00' },
  five_minute: { label: '5-minute educational presentation', time: '9:05' },
  five_qa: { label: 'Questions for the 5-minute presentation', time: '9:10' },
  ten_minute: { label: '10-minute presentation', time: '9:11' },
  ten_qa: { label: 'Questions for the 10-minute presentation', time: '9:21' },
  announcements: { label: 'Announcements', time: '9:26' },
  visitors_thanks: { label: 'Thank you, visitors', time: '9:29' },
  adjourn: { label: 'Adjourn', time: '9:30' },
};
export const slideLabel = (k: SlideKey) => info[k].label;
export const slideTime = (k: SlideKey) => info[k].time ?? null;
export const isSlideKey = (v: unknown): v is SlideKey => typeof v === 'string' && (SLIDE_KEYS as readonly string[]).includes(v);

/** Slide names used before the October 2026 agenda, so saved settings keep working. */
const LEGACY: Record<string, SlideKey> = {
  phones: 'call_to_order',
  introductions: 'leadership',
  newcomers: 'guests',
  roundtable: 'infomercials',
  visitors: 'visitors_thanks',
  summary: 'statistics',
  events: 'announcements',
  closing: 'adjourn',
};
export const toSlideKey = (v: unknown): SlideKey | null => (isSlideKey(v) ? v : typeof v === 'string' && LEGACY[v] ? LEGACY[v] : null);

/** Saved per-meeting order, cleaned up; falls back to the standard agenda. */
export function resolveSlides(saved: readonly string[] | null | undefined): SlideKey[] {
  const out: SlideKey[] = [];
  for (const raw of saved ?? []) {
    const k = toSlideKey(raw);
    if (k && !out.includes(k)) out.push(k);
  }
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
  for (const [raw, v] of Object.entries(saved as Record<string, unknown>)) {
    const k = toSlideKey(raw);
    if (k && typeof v === 'string' && v.trim() && !out[k]) out[k] = v.trim();
  }
  return out;
}

// --- Added slides: uploaded images / PDFs and YouTube videos --------------------------------------

export const MEDIA_MAX_BYTES = 20 * 1024 * 1024;
export const PDF_MAX_PAGES = 40;
export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] as const;

/** YouTube video id (and start time) from the usual link shapes, or null. */
export function parseYouTube(input: string): { id: string; start: number } | null {
  let url: URL;
  try {
    url = new URL(input.trim().match(/^https?:\/\//i) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      id = m?.[1] ?? null;
    }
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  const t = url.searchParams.get('t') ?? url.searchParams.get('start');
  let start = 0;
  if (t) {
    const hms = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (hms) start = Number(hms[1] ?? 0) * 3600 + Number(hms[2] ?? 0) * 60 + Number(hms[3] ?? 0);
  }
  return { id, start: Number.isFinite(start) && start > 0 ? Math.min(start, 86_400) : 0 };
}

/** A website link that can be shown inside a slide: https only, no spaces, at most 2000 characters. */
export function parseWebsite(input: string): string | null {
  const v = input.trim();
  if (!v || v.length > 2000 || /\s/.test(v)) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password) return null;
  return url.toString();
}
