export function attendancePct(present: number, held: number): string {
  if (!held) return '—';
  return `${Math.round((100 * present) / held)}%`;
}

export function barHeights(rows: { a: number; b: number }[]): { a: string; b: string }[] {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  return rows.map((r) => ({ a: `${Math.round((r.a / max) * 100)}%`, b: `${Math.round((r.b / max) * 100)}%` }));
}

type Pairable = { id: string; reporter_id: string; partner_id: string; met_on: string };

/** Ids of later-listed rows that repeat the same pair within 3 days (likely reported by both people). */
export function flagDuplicates(rows: Pairable[]): Set<string> {
  const seen: { key: string; day: number }[] = [];
  const dupes = new Set<string>();
  for (const r of rows) {
    const key = [r.reporter_id, r.partner_id].sort().join('|');
    const day = Date.parse(r.met_on) / 86400000;
    if (seen.some((s) => s.key === key && Math.abs(s.day - day) <= 3)) dupes.add(r.id);
    seen.push({ key, day });
  }
  return dupes;
}
