import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { getAdminStats, getLastMeetingDate } from '@/lib/data/member';
import { PERIODS, describeRange, periodLabel } from '@/lib/periods';
import { sortStatRows } from '@/lib/stats';
import { parseStatsSearch, statColumns, statsQuery, type StatKey, type StatsSearch } from './params';

export const metadata: Metadata = { title: 'Member stats' };

export default async function AdminStatsPage({ searchParams }: { searchParams: Promise<StatsSearch> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { period, range, sort, dir } = parseStatsSearch(sp, await getLastMeetingDate());
  const rows = sortStatRows(await getAdminStats(range), sort, dir);
  const totals = Object.fromEntries(statColumns.map((c) => [c.key, rows.reduce((n, r) => n + Number(r[c.key]), 0)]));

  const sortHref = (key: StatKey) => {
    const nextDir = sort === key ? (dir === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc';
    return `/admin/stats${statsQuery(sp, { sort: key, dir: nextDir })}`;
  };
  const ariaSort = (key: StatKey) => (sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : undefined);
  const arrow = (key: StatKey) => (sort === key ? (dir === 'asc' ? ' ↑' : ' ↓') : '');

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Member stats</h1>
        <AdminNav current="/admin/stats" />
        <p className="text-ink-muted m-0 max-w-[760px]">
          Per-member counts are visible to admins only. Members see the leaderboard and group totals. One-on-ones count for both members once confirmed;
          referrals and closed deals count for the member who gave the referral.
        </p>

        <form action="/admin/stats" className="card flex flex-wrap items-end gap-4 p-5" aria-label="Choose a period">
          <div className="min-w-0 flex-[1_1_200px]">
            <label className="label" htmlFor="period">
              Period
            </label>
            <select id="period" name="period" className="field" defaultValue={period}>
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {periodLabel(p)}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-[1_1_160px]">
            <label className="label" htmlFor="from">
              From
            </label>
            <input id="from" name="from" type="date" className="field" defaultValue={sp.from ?? ''} aria-describedby="range-help" />
          </div>
          <div className="min-w-0 flex-[1_1_160px]">
            <label className="label" htmlFor="to">
              To
            </label>
            <input id="to" name="to" type="date" className="field" defaultValue={sp.to ?? ''} aria-describedby="range-help" />
          </div>
          {sp.sort ? <input type="hidden" name="sort" value={sp.sort} /> : null}
          {sp.dir ? <input type="hidden" name="dir" value={sp.dir} /> : null}
          <button type="submit" className="btn btn-primary btn-sm">
            Show
          </button>
          <p id="range-help" className="help m-0 w-full">
            From and To are used with “Custom range” (both dates included). Dates are Pacific time.
          </p>
        </form>

        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="table-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="table-h" className="h3">
              {periodLabel(period)} · {describeRange(range)}
            </h2>
            <a className="btn btn-outline btn-sm" href={`/admin/stats/export${statsQuery(sp)}`} download>
              Download CSV
            </a>
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No approved members yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <caption className="sr-only">Member stats, {describeRange(range)}. Column headers sort the table.</caption>
                <thead>
                  <tr>
                    <th scope="col" aria-sort={ariaSort('name')}>
                      <Link href={sortHref('name')}>Member{arrow('name')}</Link>
                    </th>
                    {statColumns.map((c) => (
                      <th key={c.key} scope="col" aria-sort={ariaSort(c.key)} className="text-right">
                        <Link href={sortHref(c.key)}>
                          {c.label}
                          {arrow(c.key)}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.profile_id}>
                      <th scope="row" className="text-left font-normal">
                        <strong>
                          {r.first_name} {r.last_name}
                        </strong>
                        <div className="text-ink-muted text-sm">{r.business_name}</div>
                      </th>
                      {statColumns.map((c) => (
                        <td key={c.key} className="text-right tabular-nums">
                          {Number(r[c.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="text-left">
                      Totals
                    </th>
                    {statColumns.map((c) => (
                      <td key={c.key} className="text-right font-bold tabular-nums">
                        {totals[c.key]}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="text-ink-muted m-0 text-sm">
            Column totals add up each member’s count, so a confirmed one-on-one appears twice (once for each member). Referrals received and closed deals
            received are the same referrals seen from the receiving side.
          </p>
        </section>
      </div>
    </div>
  );
}
