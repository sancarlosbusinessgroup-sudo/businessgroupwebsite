import type { Metadata } from 'next';
import Link from 'next/link';
import { GroupTotalsTiles } from '@/components/GroupTotals';
import { Leaderboard } from '@/components/Leaderboard';
import { LiveStatus } from '@/components/LiveNumber';
import { LiveRefresh } from '@/components/LiveRefresh';
import { PeriodPicker } from '@/components/PeriodPicker';
import { requireMember } from '@/lib/auth';
import { getActivityVersion } from '@/lib/data/live';
import { getGroupTotals, getLeaderboard } from '@/lib/data/member';
import { REPORT_KINDS } from '@/lib/live-activity';
import { describeRange, periodChoices, pickPeriod } from '@/lib/periods';

export const metadata: Metadata = { title: 'Leaderboard' };

/**
 * Report Activity → Leaderboard (owner, 2026-11-25): the group's totals and the top members for one-on-ones, referrals
 * and visitors brought, for this month or any month, this quarter, this year or all time. Updates by itself as members
 * report (live activity sync). Closed business is a group total only (owner meeting 2026-10-30).
 */
export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const viewer = await requireMember('/leaderboard');
  // Read before the data, so a report filed meanwhile makes the page reload rather than be missed.
  const liveVersion = await getActivityVersion(REPORT_KINDS);
  const period = pickPeriod(p);
  const [totals, leaders] = await Promise.all([getGroupTotals(period.range), getLeaderboard(period.range, 10)]);

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        {/* Live: data reloads by itself; changed numbers glow teal (owner, 2026-11-25/26). */}
        <LiveRefresh version={liveVersion} kinds={REPORT_KINDS}>
          <div>
            <Link href="/dashboard" className="text-sm font-bold">
              ← Back to dashboard
            </Link>
            <p className="eyebrow m-0 mt-3">Networking activity</p>
            <h1 className="font-display m-0 mt-1 text-[clamp(28px,3.4vw,40px)] font-extrabold">Leaderboard</h1>
            <p className="text-ink-muted m-0 mt-1">The group’s numbers and its most active members. They update by themselves as members report activity.</p>
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <PeriodPicker name="p" value={period.value} defaultValue={pickPeriod(undefined).value} choices={periodChoices()} />
            <p className="text-ink-muted m-0 flex flex-wrap items-center gap-x-3 text-sm">
              <span>{describeRange(period.range)} · Pacific time</span>
              <LiveStatus />
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-5">
            <section className="card flex min-w-0 flex-[2_1_320px] flex-col gap-1.5 p-5" aria-labelledby="totals-h">
              <h2 id="totals-h" className="h3">
                Group totals: {period.label}
              </h2>
              <GroupTotalsTiles totals={totals} label={period.label} />
              <p className="text-ink-muted m-0 mt-2 text-sm">
                Closed business counts in the month it closed and is shown as a group total only. One-on-ones count once confirmed.
              </p>
            </section>
            <div className="min-w-0 flex-[3_1_520px]">
              <Leaderboard rows={leaders} meId={viewer.profile.id} title={`Top members: ${period.label}`} />
            </div>
          </div>
        </LiveRefresh>
      </div>
    </div>
  );
}
