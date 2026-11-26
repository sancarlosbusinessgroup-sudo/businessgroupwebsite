import Link from 'next/link';
import { leaderboardMetrics } from '@/lib/content';
import type { LeaderRow } from '@/lib/data/member';
import { periodLabel, type Period } from '@/lib/periods';
import { LiveNumber } from './LiveNumber';

const choices: Period[] = ['month', 'quarter', 'year', 'all'];

/**
 * Top members per metric: names and counts only (decision 3). With `hrefFor` (dashboard) it has period tabs; the
 * Leaderboard page picks the period with its own filter and passes a `title` instead.
 */
export function Leaderboard({
  rows,
  period = 'month',
  meId,
  hrefFor,
  title = 'Leaderboard',
}: {
  rows: LeaderRow[];
  period?: Period;
  meId?: string;
  hrefFor?: (p: Period) => string;
  title?: string;
}) {
  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="lb-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="lb-h" className="h3">
          {title}
        </h2>
        {hrefFor ? (
          <nav aria-label="Leaderboard period" className="bg-line-soft flex flex-wrap gap-1 rounded-full p-1">
            {choices.map((p) => (
              <Link
                key={p}
                href={hrefFor(p)}
                scroll={false}
                aria-current={p === period ? 'true' : undefined}
                className={`font-display flex min-h-9 items-center rounded-full px-3 text-[13px] font-bold no-underline ${
                  p === period ? 'bg-surface text-heading' : 'text-ink-muted'
                }`}
              >
                {periodLabel(p)
                  .replace(/^This /, '')
                  .replace(/^\w/, (c) => c.toUpperCase())}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {leaderboardMetrics.map((m) => {
          const list = rows.filter((r) => r.metric === m.key);
          return (
            <div key={m.key} className="flex flex-col gap-2">
              <h3 className="text-ink-muted m-0 text-[13px] font-bold tracking-[0.08em] uppercase">{m.label}</h3>
              {list.length === 0 ? (
                <p className="text-ink-muted m-0 text-[15px]">Nothing reported yet.</p>
              ) : (
                <ol className="m-0 flex list-none flex-col gap-1 p-0" aria-label={`${m.label} leaders`}>
                  {list.map((r) => (
                    <li
                      key={r.profile_id}
                      className={`live-tile flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[15px] ${r.profile_id === meId ? 'bg-teal-tint' : ''}`}
                    >
                      <span className="text-teal-text w-5 font-extrabold">{r.rank}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {r.first_name} {r.last_name}
                        {r.profile_id === meId ? ' (you)' : ''}
                      </span>
                      <strong className="tabular-nums">
                        {/* Highlighted when live activity changes it, or when the member has just joined the list. */}
                        <LiveNumber value={r.value} isNew />
                      </strong>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
