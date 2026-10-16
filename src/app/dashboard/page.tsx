import type { Metadata } from 'next';
import Link from 'next/link';
import { InviteCard } from '@/components/InviteCard';
import { Leaderboard } from '@/components/Leaderboard';
import { NextMeetingCard } from '@/components/meetings';
import { EmptyState } from '@/components/ui';
import { WeeklyAskForm } from '@/components/WeeklyAskForm';
import { requireMember } from '@/lib/auth';
import { getNextMeeting } from '@/lib/data/public';
import { getGroupTotals, getLeaderboard, getMyGuests, getOneOnOnes, getPendingConfirmations } from '@/lib/data/member';
import { formatLongToday, formatShortDate } from '@/lib/dates';
import { env } from '@/lib/env';
import { isPeriod, periodRange, type Period } from '@/lib/periods';
import { confirmOneOnOne } from '../actions/member';

export const metadata: Metadata = { title: 'Dashboard' };

const LB_PERIODS: Period[] = ['month', 'quarter', 'year', 'all'];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ lb?: string }> }) {
  const { lb } = await searchParams;
  const viewer = await requireMember('/dashboard');
  const me = viewer.profile;
  const lbPeriod: Period = isPeriod(lb) && LB_PERIODS.includes(lb) ? lb : 'month';
  const [next, totals, leaders, pending, recent, guests] = await Promise.all([
    getNextMeeting(),
    getGroupTotals(periodRange({ period: 'month' })),
    getLeaderboard(periodRange({ period: lbPeriod })),
    getPendingConfirmations(me.id),
    getOneOnOnes({ days: 30, limit: 3 }),
    getMyGuests(me.id, 4),
  ]);
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

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-5">
            <Leaderboard rows={leaders} period={lbPeriod} meId={me.id} hrefFor={(p) => (p === 'month' ? '/dashboard' : `/dashboard?lb=${p}`)} />

            <section className="card flex flex-col gap-3.5 p-5" aria-labelledby="report-h">
              <h2 id="report-h" className="h3">
                Report activity
              </h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
                {[
                  { href: '/one-on-ones', t: 'One-on-one', d: 'Log a meeting with another member' },
                  { href: '/referrals', t: 'Referral slip', d: 'Pass business to another member' },
                  { href: '/referrals', t: 'Closed deal', d: 'Mark a referral you received as a closed deal' },
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

            <WeeklyAskForm current={me.weekly_ask} updated={me.weekly_ask_updated_at ? formatShortDate(new Date(me.weekly_ask_updated_at)) : null} />
          </div>

          <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-5">
            <section className="card flex flex-col gap-1.5 p-5" aria-labelledby="group-h">
              <h2 id="group-h" className="h3">
                Group this month
              </h2>
              <dl className="mt-1.5 grid grid-cols-2 gap-2.5">
                {[
                  { k: 'One-on-ones', v: totals.one_on_ones },
                  { k: 'Referrals', v: totals.referrals },
                  { k: 'Closed deals', v: totals.closed_deals },
                  { k: 'Visitors', v: totals.visitors },
                ].map((t) => (
                  <div key={t.k} className="border-teal-tint flex flex-col-reverse rounded-xl border p-3">
                    <dt className="text-ink-muted text-xs font-bold tracking-[0.08em] uppercase">{t.k}</dt>
                    <dd className="font-display m-0 text-2xl font-extrabold tabular-nums">{t.v}</dd>
                  </div>
                ))}
              </dl>
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
            <InviteCard link={`${env.siteUrl}/visit?ref=${me.referral_code}`} guests={guests} />
          </div>
        </div>
      </div>
    </div>
  );
}
