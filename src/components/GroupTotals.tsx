import type { GroupTotals } from '@/lib/data/member';
import { formatMoney } from '@/lib/dates';

/**
 * Group totals tiles (dashboard and Leaderboard page). Closed business is a group total only: no member's own closed
 * business is ever shown here (owner meeting 2026-10-30).
 */
export function GroupTotalsTiles({ totals, label }: { totals: GroupTotals; label: string }) {
  const tiles = [
    { k: 'One-on-ones', v: totals.one_on_ones },
    { k: 'Referrals', v: totals.referrals },
    { k: 'Closed business', v: totals.closed_deals },
    { k: 'Visitors', v: totals.visitors },
    { k: 'Closed business ($)', v: formatMoney(totals.closed_amount), wide: true },
  ];
  return (
    <dl className="mt-1.5 grid grid-cols-2 gap-2.5" aria-label={`Group totals, ${label}`}>
      {tiles.map((t) => (
        <div key={t.k} className={`border-teal-tint flex flex-col-reverse rounded-xl border p-3 ${t.wide ? 'col-span-2' : ''}`}>
          <dt className="text-ink-muted text-xs font-bold tracking-[0.08em] uppercase">{t.k}</dt>
          <dd className="font-display m-0 text-2xl font-extrabold tabular-nums">{t.v}</dd>
        </div>
      ))}
    </dl>
  );
}
