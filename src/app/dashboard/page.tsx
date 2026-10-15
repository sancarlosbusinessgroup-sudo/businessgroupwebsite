import type { Metadata } from 'next';
import Link from 'next/link';
import { NextMeetingCard } from '@/components/meetings';
import { EmptyState, StatTile } from '@/components/ui';
import { requireMember } from '@/lib/auth';
import { getNextMeeting } from '@/lib/data/public';
import { getGroupMonth, getMonthlyActivity, getMyStats, getOneOnOnes, getPendingConfirmations } from '@/lib/data/member';
import { formatLongToday, formatShortDate, money } from '@/lib/dates';
import { env } from '@/lib/env';
import { attendancePct, barHeights } from '@/lib/stats';
import { confirmOneOnOne } from '../actions/member';

export const metadata: Metadata = { title: 'Dashboard' };

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function DashboardPage() {
  const viewer = await requireMember('/dashboard');
  const me = viewer.profile;
  const [stats, next, group, monthly, pending, recent] = await Promise.all([
    getMyStats(),
    getNextMeeting(),
    getGroupMonth(),
    getMonthlyActivity(),
    getPendingConfirmations(me.id),
    getOneOnOnes({ days: 30, limit: 3 }),
  ]);
  const heights = barHeights(monthly.map((r) => ({ a: r.referrals, b: r.one_on_ones })));
  const delta = stats.referrals_given - stats.referrals_given_prior;
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Los_Angeles' }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-ink-muted m-0 text-[15px]">{formatLongToday()}</p>
            <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">
              {greeting}, {me.first_name}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-outline btn-sm" href="/profile">
              Edit my profile
            </Link>
            <Link className="btn btn-primary btn-sm" href="/one-on-ones">
              + Report activity
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-5">
          <div className="min-w-0 flex-[3_1_520px]">
            <NextMeetingCard meeting={next} member />
          </div>
          <section className="card min-w-0 flex-[2_1_320px] p-5" aria-labelledby="pending-h">
            <h2 id="pending-h" className="h3">
              Pending confirmations
            </h2>
            <p className="text-ink-muted m-0 mb-2.5 text-sm">Confirm one-on-ones someone else reported with you.</p>
            {pending.length === 0 ? (
              <EmptyState title="You're all caught up" />
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {pending.map((p) => (
                  <li key={p.id} className="border-line flex items-center justify-between gap-2.5 rounded-xl border p-3">
                    <div className="text-[15px]">
                      <strong>
                        {p.reporter?.first_name} {p.reporter?.last_name} had a one-on-one with you
                      </strong>
                      <div className="text-ink-muted text-[13px]">{formatShortDate(new Date(p.met_on + 'T12:00:00Z'))}</div>
                    </div>
                    <form action={confirmOneOnOne}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="btn btn-outline btn-sm">
                        Confirm
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section aria-labelledby="numbers-h" className="flex flex-col gap-3">
          <h2 id="numbers-h" className="h3">
            My numbers · last 90 days
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
            <StatTile label="Referrals given" value={String(stats.referrals_given)} sub={`${delta >= 0 ? '+' : ''}${delta} vs prior 90 days`} />
            <StatTile label="Referrals received" value={String(stats.referrals_received)} sub={`${stats.referrals_received_closed} turned into work`} />
            <StatTile label="One-on-ones" value={String(stats.one_on_ones)} sub={`Group average: ${stats.group_avg_one_on_ones}`} />
            <StatTile label="Closed business" value={money(Number(stats.closed_amount))} sub="From referrals you received" />
            <StatTile
              label="Attendance"
              value={attendancePct(stats.meetings_present, stats.meetings_held)}
              sub={`${stats.meetings_present} of ${stats.meetings_held} meetings`}
            />
            <StatTile label="Guests invited" value={String(stats.guests_invited)} sub={`${stats.guests_joined} became members`} />
          </div>
        </section>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-5">
            <section className="card flex flex-col gap-3.5 p-5" aria-labelledby="report-h">
              <h2 id="report-h" className="h3">
                Report activity
              </h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
                {[
                  { href: '/one-on-ones', t: 'One-on-one', d: 'Log a meeting with another member' },
                  { href: '/referrals?tab=business', t: 'Referral', d: 'Pass a lead to another member' },
                  { href: '/referrals?tab=business', t: 'Closed business', d: 'Mark a referral you received as closed' },
                  { href: '/meetings', t: 'Sign up to speak', d: '5-min education or 10-min presentation' },
                ].map((a) => (
                  <Link
                    key={a.t}
                    href={a.href}
                    className="border-line bg-surface text-ink hover:border-teal hover:text-ink flex flex-col gap-1.5 rounded-[14px] border p-4 no-underline"
                  >
                    <strong className="text-heading">{a.t}</strong>
                    <span className="text-ink-muted text-sm">{a.d}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="card flex flex-col gap-3.5 p-5" aria-labelledby="chart-h">
              <div className="flex flex-wrap justify-between gap-3">
                <h2 id="chart-h" className="h3">
                  My activity by month
                </h2>
                <div className="text-ink-muted flex gap-3.5 text-[13px]">
                  <span className="flex items-center gap-1.5">
                    <span className="bg-teal h-2.5 w-2.5 rounded-sm" aria-hidden="true" />
                    Referrals given
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="bg-star h-2.5 w-2.5 rounded-sm" aria-hidden="true" />
                    One-on-ones
                  </span>
                </div>
              </div>
              <div className="border-line-strong grid h-[180px] grid-cols-6 items-end gap-3.5 border-b" aria-hidden="true">
                {heights.map((h, i) => (
                  <div key={monthly[i]?.month} className="flex h-full items-end justify-center gap-1">
                    <div className="bg-teal w-2/5 max-w-[22px] rounded-t" style={{ height: h.a }} />
                    <div className="bg-star w-2/5 max-w-[22px] rounded-t" style={{ height: h.b }} />
                  </div>
                ))}
              </div>
              <div className="text-ink-muted grid grid-cols-6 gap-3.5 text-center text-[13px]" aria-hidden="true">
                {monthly.map((r) => (
                  <span key={r.month}>{MON[Number(r.month.slice(5, 7)) - 1]}</span>
                ))}
              </div>
              <table className="sr-only">
                <caption>Referrals given and one-on-ones per month</caption>
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col">Referrals given</th>
                    <th scope="col">One-on-ones</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((r) => (
                    <tr key={r.month}>
                      <th scope="row">{MON[Number(r.month.slice(5, 7)) - 1]}</th>
                      <td>{r.referrals}</td>
                      <td>{r.one_on_ones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-5">
            <Link href="/referrals" className="card text-ink flex flex-col gap-3 p-5 no-underline">
              <span className="flex justify-between gap-2">
                <span className="h3">Referral tracker</span>
                <span className="text-teal text-sm font-bold">Open →</span>
              </span>
              <span className="grid grid-cols-3 gap-2 text-center">
                {[
                  { v: stats.guests_invited, l: 'Invited' },
                  { v: stats.guests_visited, l: 'Visited' },
                  { v: stats.guests_joined, l: 'Joined' },
                ].map((s) => (
                  <span key={s.l} className={`rounded-xl px-1 py-3 ${s.l === 'Joined' ? 'bg-green-tint' : 'bg-teal-tint'}`}>
                    <span className="font-display text-heading block text-[26px] font-extrabold">{s.v}</span>
                    <span className="text-ink-muted text-[13px]">{s.l}</span>
                  </span>
                ))}
              </span>
              <span className="text-ink-muted text-sm break-all">
                Your link: {env.siteUrl.replace(/^https?:\/\//, '')}/visit?ref={me.referral_code}
              </span>
            </Link>
            <section className="card flex flex-col gap-1.5 p-5" aria-labelledby="group-h">
              <h2 id="group-h" className="h3">
                Group this month
              </h2>
              <div className="mt-1.5 grid grid-cols-2 gap-2.5">
                <div className="border-teal-tint rounded-xl border p-3">
                  <div className="text-ink-muted text-xs font-bold tracking-[0.08em]">CLOSED BUSINESS</div>
                  <div className="font-display text-2xl font-extrabold">{money(Number(group.closed_amount))}</div>
                </div>
                <div className="border-teal-tint rounded-xl border p-3">
                  <div className="text-ink-muted text-xs font-bold tracking-[0.08em]">ONE-ON-ONES</div>
                  <div className="font-display text-2xl font-extrabold">{group.one_on_ones} sessions</div>
                </div>
              </div>
              {recent.length === 0 ? (
                <p className="text-ink-muted m-0 mt-2 text-[15px]">No one-on-ones reported in the last 30 days.</p>
              ) : (
                <ul className="m-0 mt-2 list-none p-0">
                  {recent.map((o) => (
                    <li key={o.id} className="border-line-soft flex justify-between gap-3 border-t py-3 text-[15px]">
                      <span>
                        <strong>
                          {o.reporter?.first_name} {o.reporter?.last_name}
                        </strong>{' '}
                        had a one-on-one with {o.partner?.first_name} {o.partner?.last_name}
                      </span>
                      <span className="text-ink-muted flex-none">{formatShortDate(new Date(o.met_on + 'T12:00:00Z')).replace(/, \d{4}$/, '')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
