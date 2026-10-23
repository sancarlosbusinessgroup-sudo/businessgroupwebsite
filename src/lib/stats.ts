export function attendancePct(present: number, held: number): string {
  if (!held) return '—';
  return `${Math.round((100 * present) / held)}%`;
}

export function barHeights(rows: { a: number; b: number }[]): { a: string; b: string }[] {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  return rows.map((r) => ({ a: `${Math.round((r.a / max) * 100)}%`, b: `${Math.round((r.b / max) * 100)}%` }));
}

type Pairable = { id: string; reporter_id: string | null; partner_id: string | null; met_on: string };

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

type Named = { first_name: string; last_name: string };

/** Sort admin stats rows by a numeric column (or 'name'); ties fall back to name A–Z. Returns a new array. */
export function sortStatRows<T extends Named>(rows: T[], key: keyof T | 'name', dir: 'asc' | 'desc'): T[] {
  const byName = (a: T, b: T) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'name') return sign * byName(a, b);
    const diff = Number(a[key]) - Number(b[key]);
    return diff !== 0 ? sign * diff : byName(a, b);
  });
}
