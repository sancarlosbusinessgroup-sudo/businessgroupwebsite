import Link from 'next/link';
import { leaderboardMetrics } from '@/lib/content';
import type { LeaderRow } from '@/lib/data/member';
import { periodLabel, type Period } from '@/lib/periods';

const choices: Period[] = ['month', 'quarter', 'year', 'all'];

/** Top members per metric: names and counts only (decision 3). */
export function Leaderboard({ rows, period, meId, hrefFor }: { rows: LeaderRow[]; period: Period; meId?: string; hrefFor: (p: Period) => string }) {
  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="lb-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="lb-h" className="h3">
          Leaderboard
        </h2>
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
                      className={`flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[15px] ${r.profile_id === meId ? 'bg-teal-tint' : ''}`}
                    >
                      <span className="text-teal-text w-5 font-extrabold">{r.rank}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {r.first_name} {r.last_name}
                        {r.profile_id === meId ? ' (you)' : ''}
                      </span>
                      <strong className="tabular-nums">{r.value}</strong>
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
