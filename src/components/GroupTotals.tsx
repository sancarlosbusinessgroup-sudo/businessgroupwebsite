import type { GroupTotals } from '@/lib/data/member';
import { LiveNumber } from './LiveNumber';

/**
 * Group totals tiles (dashboard and Leaderboard page). Closed business is a group total only: no member's own closed
 * business is ever shown here (owner meeting 2026-10-30). Inside LiveRefresh, changed numbers are highlighted.
 */
export function GroupTotalsTiles({ totals, label }: { totals: GroupTotals; label: string }) {
  const tiles = [
    { k: 'One-on-ones', v: totals.one_on_ones },
    { k: 'Referrals', v: totals.referrals },
    { k: 'Closed business', v: totals.closed_deals },
    { k: 'Visitors', v: totals.visitors },
    { k: 'Closed business ($)', v: totals.closed_amount, money: true, wide: true },
  ];
  return (
    <dl className="mt-1.5 grid grid-cols-2 gap-2.5" aria-label={`Group totals, ${label}`}>
      {tiles.map((t) => (
        <div key={t.k} className={`live-tile border-teal-tint flex flex-col-reverse rounded-xl border p-3 ${t.wide ? 'col-span-2' : ''}`}>
          <dt className="text-ink-muted text-xs font-bold tracking-[0.08em] uppercase">{t.k}</dt>
          <dd className="font-display m-0 text-2xl font-extrabold tabular-nums">
            {/* Counts up and glows teal when live activity changes it (owner, 2026-11-26). */}
            <LiveNumber value={t.v} format={t.money ? 'money' : 'count'} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
