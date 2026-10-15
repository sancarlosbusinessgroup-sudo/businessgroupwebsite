import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { requireMember } from '@/lib/auth';
import { getGroupMonth, getMemberOptions, getOneOnOnes, getPendingConfirmations } from '@/lib/data/member';
import { formatShortDate, isoDateDaysAgo, localDateKey, money } from '@/lib/dates';
import { flagDuplicates } from '@/lib/stats';
import { confirmOneOnOne } from '../actions/member';
import { ReportForm } from './ReportForm';

export const metadata: Metadata = { title: 'One-on-ones' };

const day = (d: string) => formatShortDate(new Date(d + 'T12:00:00Z'));

export default async function OneOnOnesPage({ searchParams }: { searchParams: Promise<{ partner?: string; all?: string }> }) {
  const sp = await searchParams;
  const viewer = await requireMember('/one-on-ones');
  const me = viewer.profile;
  const showAll = sp.all === '1';
  const [members, pending, mine, group, groupMonth] = await Promise.all([
    getMemberOptions(me.id),
    getPendingConfirmations(me.id),
    getOneOnOnes({ meId: me.id, days: 30, limit: 20 }),
    getOneOnOnes({ days: showAll ? 365 : 30, limit: showAll ? 200 : 10 }),
    getGroupMonth(),
  ]);
  const dupes = flagDuplicates([...group].reverse());
  const defaultPartner = members.some((m) => m.id === sp.partner) ? sp.partner : undefined;

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <div>
          <Link href="/dashboard" className="text-sm font-bold">
            ← Back to dashboard
          </Link>
          <p className="eyebrow m-0 mt-3">Networking activity</p>
          <h1 className="font-display m-0 mt-1 text-[clamp(28px,3.4vw,40px)] font-extrabold">One-on-one reporting</h1>
          <p className="text-ink-muted m-0 mt-1">Log a meaningful conversation and keep your relationship-building activity current.</p>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-5">
            <section className="card flex flex-col gap-2.5 p-5" aria-labelledby="pc-h">
              <h2 id="pc-h" className="font-display m-0 text-[15px] tracking-[0.06em] uppercase">
                Pending confirmations
              </h2>
              <p className="text-ink-muted m-0 text-sm">Confirm activity someone else reported with you.</p>
              {pending.length === 0 ? (
                <p className="border-line-soft text-ink-muted m-0 border-t pt-2.5 text-[15px]">Nothing to confirm right now.</p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {pending.map((p) => (
                    <li key={p.id} className="border-line-soft flex items-center justify-between gap-2.5 border-t py-2.5">
                      <div>
                        <strong>
                          {p.reporter?.first_name} {p.reporter?.last_name} had a one-on-one with {me.first_name} {me.last_name}.
                        </strong>
                        <div className="text-ink-muted text-[13px]">{day(p.met_on)}</div>
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
            <ReportForm
              members={members.map((m) => ({ id: m.id, label: `${m.first_name} ${m.last_name} · ${m.business_name}` }))}
              today={localDateKey(new Date())}
              minDate={isoDateDaysAgo(14)}
              defaultPartner={defaultPartner}
            />
          </div>

          <aside className="flex min-w-0 flex-[2_1_320px] flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <div className="text-ink-muted text-xs font-bold tracking-[0.08em]">CLOSED BUSINESS</div>
                <div className="font-display text-[26px] font-extrabold">{money(Number(groupMonth.closed_amount))}</div>
                <div className="text-ink-muted text-[13px]">Group, this month</div>
              </div>
              <div className="card p-4">
                <div className="text-ink-muted text-xs font-bold tracking-[0.08em]">GROUP ACTIVITY</div>
                <div className="font-display text-[26px] font-extrabold">{groupMonth.one_on_ones} sessions</div>
                <div className="text-ink-muted text-[13px]">Logged this month</div>
              </div>
            </div>
            <section className="card flex flex-col gap-2.5 p-[18px]" aria-labelledby="mine-h">
              <h2 id="mine-h" className="h3">
                My one-on-ones
              </h2>
              <p className="text-ink-muted m-0 text-sm">Past 30 days</p>
              {mine.length === 0 ? (
                <EmptyState title="None yet this month" />
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {mine.map((o) => (
                    <li key={o.id} className="border-line flex flex-col gap-0.5 rounded-xl border px-3.5 py-3 text-[15px]">
                      <span className="text-teal-text text-xs font-bold">
                        {day(o.met_on).toUpperCase()} · {o.confirmed_at ? 'CONFIRMED' : 'AWAITING CONFIRMATION'}
                      </span>
                      <strong>
                        {o.reporter?.first_name} {o.reporter?.last_name} had a one-on-one with {o.partner?.first_name} {o.partner?.last_name}.
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card flex flex-col gap-2.5 p-[18px]" aria-labelledby="grp-h">
              <h2 id="grp-h" className="h3">
                Recent group activity
              </h2>
              <p className="text-ink-muted m-0 text-sm">{showAll ? 'Past 12 months' : 'Past 30 days'}</p>
              {group.length === 0 ? (
                <EmptyState title="No group activity yet" />
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {group.map((o) => (
                    <li key={o.id} className="border-line flex flex-col gap-0.5 rounded-xl border px-3.5 py-3 text-[15px]">
                      <span className="text-teal-text text-xs font-bold">{day(o.met_on).toUpperCase()}</span>
                      <strong>
                        {o.reporter?.first_name} {o.reporter?.last_name} had a one-on-one with {o.partner?.first_name} {o.partner?.last_name}.
                      </strong>
                      {dupes.has(o.id) ? <span className="text-amber text-[13px]">Potential duplicate</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              {!showAll ? (
                <Link href="/one-on-ones?all=1" className="text-center text-[15px] font-bold">
                  View all records →
                </Link>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
