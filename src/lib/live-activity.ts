// Live activity sync (owner, 2026-11-25): shared, framework-free rules used by the browser hook (useLiveActivity) and the
// server (getActivityVersion). Every kind of member activity has a counter in public.activity_versions that database
// triggers bump on each insert, edit or delete. A page remembers the total it was rendered with; when the total for the
// kinds it shows goes up, it reloads its data from the server (the same functions as a normal page load), so every
// section always shows what the database says and nothing is counted on the client.
import type { ActivityKind } from './database.types';

export type { ActivityKind };

export const ACTIVITY_KINDS: readonly ActivityKind[] = ['referrals', 'one_on_ones', 'visitors', 'attendance', 'champion'];

/** Kinds that change the member activity reports, leaderboards and group totals. */
export const REPORT_KINDS: readonly ActivityKind[] = ['referrals', 'one_on_ones', 'visitors'];

/** Kinds that change something on the meeting slides (stats, leaderboards, BARP Champion, attendance-based points). */
export const SLIDE_KINDS: readonly ActivityKind[] = ACTIVITY_KINDS;

/**
 * One number for the kinds a page shows. Each counter only goes up, so the sum goes up on any change. Missing kinds
 * count as 0; unknown kinds are ignored.
 */
export function activitySignature(rows: readonly { kind: string; version: number | string }[], kinds: readonly ActivityKind[] = ACTIVITY_KINDS): number {
  let sum = 0;
  for (const r of rows) if ((kinds as readonly string[]).includes(r.kind)) sum += Number(r.version) || 0;
  return sum;
}

/**
 * Whether a newly seen total means the page must reload. `requested` is the highest total a reload was already asked
 * for (so one change never triggers two reloads, and a page whose server read failed does not reload in a loop).
 */
export function needsRefresh(seen: number, rendered: number | null, requested: number): boolean {
  return seen > Math.max(rendered ?? 0, requested);
}

/** Polling is the safety net: often while Realtime is not connected, rarely while it is. */
export const POLL_FAST_MS = 5_000;
export const POLL_SLOW_MS = 30_000;
export const pollDelayMs = (realtimeConnected: boolean) => (realtimeConnected ? POLL_SLOW_MS : POLL_FAST_MS);

/** Several changes close together (e.g. a Zoom attendance import) cause one reload. */
export const DEBOUNCE_MS = 300;

const TEXT_INPUT = 'input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=reset]):not([type=hidden]), textarea';

/**
 * True while the member is typing in a form field: a reload then waits until they leave the field, so a live update never
 * gets in the way of what they are filling in. Menus (select) don't count: a choice made in one survives a reload, and
 * the period filter keeps focus on its menu, which must not hold back live updates.
 */
export function isEditing(el: Element | null | undefined): boolean {
  if (!el || typeof el.matches !== 'function') return false;
  if ((el as HTMLElement).isContentEditable) return true;
  return el.matches(TEXT_INPUT);
}

// --- Live highlight (owner, 2026-11-26) -------------------------------------------------------------------------------

/** How long a changed number glows (BARP teal) and how long it takes to count up to its new value. */
export const LIVE_FLASH_MS = 4_000;
export const LIVE_COUNT_MS = 700;

/** The change shown next to a highlighted number ("+1", "+$2,500"); cents kept, float noise dropped. */
export const liveDelta = (from: number, to: number) => Math.round((to - from) * 100) / 100;

/** A whole number part-way from `from` to `to` (p from 0 to 1), easing out so it settles gently on the new value. */
export function tweenValue(from: number, to: number, p: number): number {
  const t = Math.min(1, Math.max(0, p));
  const eased = 1 - (1 - t) ** 3;
  return t >= 1 ? to : Math.round(from + (to - from) * eased);
}
