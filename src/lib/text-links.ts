// Owner request 2026-11-09: web addresses typed into event descriptions become clickable, and in-person venue
// addresses link to Google Maps. Pure helpers; the React pieces live in `src/components/TextLinks.tsx`.

/** A web address in free text: https://…, http://…, or a bare www.… host. Trailing punctuation is left out of the link. */
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING = /[.,;:!?)\]}'"»]+$/;

export type TextPart = { type: 'text'; value: string } | { type: 'link'; value: string; href: string };

/** Split text into plain runs and links, keeping the typed text for display. */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let raw = m[0];
    const start = m.index ?? 0;
    // Keep a closing bracket only when the link itself opened one, e.g. a Wikipedia title "(film)".
    const trail = TRAILING.exec(raw)?.[0] ?? '';
    let keep = raw.length - trail.length;
    for (const ch of trail) {
      if (ch === ')' && (raw.slice(0, keep).match(/\(/g)?.length ?? 0) > (raw.slice(0, keep).match(/\)/g)?.length ?? 0)) keep += 1;
      else break;
    }
    raw = raw.slice(0, keep);
    if (raw.length <= (raw.toLowerCase().startsWith('www.') ? 4 : 8)) continue; // "https://" or "www." alone
    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) });
    parts.push({ type: 'link', value: raw, href: /^https?:\/\//i.test(raw) ? raw : `https://${raw}` });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

/**
 * Google Maps search link for a typed address (Google's documented Maps URL scheme, no API key). Opens the Maps app on
 * phones and maps.google.com elsewhere, with the address searched and pinned.
 */
export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim().replace(/\s+/g, ' '))}`;
}
