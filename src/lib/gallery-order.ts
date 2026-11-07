// Gallery order (owner, 2026-11-07): admins move one photo at a time; the whole order is then saved.
// Pure so it can be unit-tested; the action in admin-edit.ts loads the current order and saves the result.

export type MoveTo = 'top' | 'up' | 'down' | 'bottom' | number;

/** Move `id` within `ids` (first to last). A number is the new 1-based position (clamped). Unknown id: unchanged. */
export function moveInOrder(ids: readonly string[], id: string, to: MoveTo): string[] {
  const from = ids.indexOf(id);
  if (from === -1) return [...ids];
  const last = ids.length - 1;
  const target = to === 'top' ? 0 : to === 'bottom' ? last : to === 'up' ? from - 1 : to === 'down' ? from + 1 : Math.round(to) - 1;
  const at = Math.min(Math.max(target, 0), last);
  const out = ids.filter((x) => x !== id);
  out.splice(at, 0, id);
  return out;
}
