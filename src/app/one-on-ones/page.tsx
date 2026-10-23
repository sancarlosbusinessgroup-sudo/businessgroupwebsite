import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { requireMember } from '@/lib/auth';
import {
  getGroupTotals,
  getMemberOptions,
  getMyOneOnOneHistory,
  getOneOnOneRequests,
  getOneOnOnes,
  getPendingConfirmations,
  type OneOnOneRequest,
} from '@/lib/data/member';
import { formatShortDate, isoDateDaysAgo, localDateKey } from '@/lib/dates';
import { periodRange } from '@/lib/periods';
import { flagDuplicates } from '@/lib/stats';
import { confirmOneOnOne, respondOneOnOneRequest } from '../actions/member';
import { ReportForm } from './ReportForm';
import { RequestForm } from './RequestForm';

export const metadata: Metadata = { title: 'One-on-ones' };

const day = (d: string) => formatShortDate(new Date(d + 'T12:00:00Z'));

const requestStatus: Record<OneOnOneRequest['status'], { label: string; tone: string }> = {
  pending: { label: 'Waiting for an answer', tone: 'text-amber' },
  accepted: { label: 'Accepted: set up a time, then report it once you have met', tone: 'text-green-ink' },
  declined: { label: 'Declined', tone: 'text-ink-muted' },
  cancelled: { label: 'Cancelled', tone: 'text-ink-muted' },
};

function RespondButton({ id, status, label, tone }: { id: string; status: string; label: string; tone: string }) {
  return (
    <form action={respondOneOnOneRequest}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`btn btn-sm ${tone}`}>
        {label}
      </button>
    </form>
  );
}

export default async function OneOnOnesPage({ searchParams }: { searchParams: Promise<{ partner?: string; all?: string }> }) {
  const sp = await searchParams;
  const viewer = await requireMember('/one-on-ones');
  const me = viewer.profile;
  const showAll = sp.all === '1';
  const [members, pending, mine, group, groupMonth, requests, history] = await Promise.all([
    getMemberOptions(me.id),
    getPendingConfirmations(me.id),
    getOneOnOnes({ meId: me.id, days: 30, limit: 20 }),
    getOneOnOnes({ days: showAll ? 365 : 30, limit: showAll ? 200 : 10 }),
    getGroupTotals(periodRange({ period: 'month' })),
    getOneOnOneRequests(me.id),
    getMyOneOnOneHistory(me.id),
  ]);
  const people = new Set(history.map((o) => (o.reporter_id === me.id ? o.partner_id : o.reporter_id)));
  const memberOptions = members.map((m) => ({ id: m.id, label: `${m.first_name} ${m.last_name} · ${m.business_name}` }));
  const incoming = requests.incoming.filter((r) => r.status === 'pending');
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
          <p className="text-ink-muted m-0 mt-1">Report a one-on-one that already happened, or request one with a member you&apos;d like to get to know.</p>
          <nav aria-label="On this page" className="mt-3 flex flex-wrap gap-2">
            <a className="chip no-underline" href="#report-h">
              Report a one-on-one
            </a>
            <a className="chip no-underline" href="#request-h">
              Request a one-on-one
            </a>
            <a className="chip no-underline" href="#hist-h">
              My one-on-one history
            </a>
          </nav>
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
            {incoming.length ? (
              <section className="card border-teal flex flex-col gap-2.5 border-2 p-5" aria-labelledby="inc-h">
                <h2 id="inc-h" className="font-display m-0 text-[15px] tracking-[0.06em] uppercase">
                  One-on-one requests for you
                </h2>
                <ul className="m-0 list-none p-0">
                  {incoming.map((r) => (
                    <li key={r.id} className="border-line-soft flex flex-wrap items-center justify-between gap-2.5 border-t py-2.5">
                      <div className="min-w-0">
                        <strong>
                          {r.requester?.first_name} {r.requester?.last_name}
                        </strong>
                        <span className="text-ink-muted"> · {r.requester?.business_name}</span>
                        <div className="text-ink-muted text-[13px]">{r.proposed_on ? `Suggested date: ${day(r.proposed_on)}` : 'No date suggested yet'}</div>
                        {r.message ? <p className="text-ink-soft m-0 mt-1 text-[15px]">“{r.message}”</p> : null}
                      </div>
                      <div className="flex gap-2">
                        <RespondButton id={r.id} status="accepted" label="Accept" tone="btn-primary" />
                        <RespondButton id={r.id} status="declined" label="Decline" tone="btn-outline" />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <ReportForm members={memberOptions} today={localDateKey(new Date())} minDate={isoDateDaysAgo(14)} defaultPartner={defaultPartner} />
            <RequestForm members={memberOptions} today={localDateKey(new Date())} />
          </div>

          <aside className="flex min-w-0 flex-[2_1_320px] flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <div className="text-ink-muted text-xs font-bold tracking-[0.08em]">CLOSED BUSINESS</div>
                <div className="font-display text-[26px] font-extrabold">{groupMonth.closed_deals}</div>
                <div className="text-ink-muted text-[13px]">Group, this month</div>
              </div>
              <div className="card p-4">
                <div className="text-ink-muted text-xs font-bold tracking-[0.08em]">GROUP ACTIVITY</div>
                <div className="font-display text-[26px] font-extrabold">{groupMonth.one_on_ones} sessions</div>
                <div className="text-ink-muted text-[13px]">Logged this month</div>
              </div>
            </div>
            {requests.outgoing.length || requests.incoming.some((r) => r.status !== 'pending') ? (
              <section className="card flex flex-col gap-2.5 p-[18px]" aria-labelledby="myreq-h">
                <h2 id="myreq-h" className="h3">
                  My requests
                </h2>
                <p className="text-ink-muted m-0 text-sm">Past 60 days</p>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {[...requests.outgoing, ...requests.incoming.filter((r) => r.status !== 'pending')].map((r) => {
                    const sent = r.requester_id === me.id;
                    const other = sent ? r.invitee : r.requester;
                    const st = requestStatus[r.status];
                    return (
                      <li key={r.id} className="border-line flex flex-col gap-1 rounded-xl border px-3.5 py-3 text-[15px]">
                        <span className={`text-xs font-bold ${st.tone}`}>{st.label.toUpperCase()}</span>
                        <strong>
                          {sent ? 'You asked' : 'Asked by'} {other?.first_name} {other?.last_name}
                          {r.proposed_on ? ` · ${day(r.proposed_on)}` : ''}
                        </strong>
                        {sent && r.status === 'pending' ? (
                          <div>
                            <RespondButton id={r.id} status="cancelled" label="Cancel request" tone="btn-outline" />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
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

        <section className="card flex flex-col gap-3 p-5" aria-labelledby="hist-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="hist-h" className="font-display m-0 text-[22px] font-extrabold">
              My one-on-one history
            </h2>
            <span className="text-ink-muted text-sm">
              {history.length} {history.length === 1 ? 'one-on-one' : 'one-on-ones'} with {people.size} {people.size === 1 ? 'member' : 'different members'}
            </span>
          </div>
          {history.length === 0 ? (
            <EmptyState title="No one-on-ones yet">Report your first one-on-one above and it will show here.</EmptyState>
          ) : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="One-on-one history table">
              <table className="data-table">
                <caption className="sr-only">All my one-on-ones, newest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">With</th>
                    <th scope="col">Reported by</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((o) => {
                    const other = o.reporter_id === me.id ? o.partner : o.reporter;
                    return (
                      <tr key={o.id}>
                        <td className="whitespace-nowrap">{day(o.met_on)}</td>
                        <td>
                          {other?.slug ? (
                            <Link href={`/members/${other.slug}`}>
                              {other.first_name} {other.last_name}
                            </Link>
                          ) : (
                            `${other?.first_name ?? ''} ${other?.last_name ?? ''}`
                          )}
                          {other?.business_name ? <span className="text-ink-muted"> · {other.business_name}</span> : null}
                        </td>
                        <td>{o.reporter_id === me.id ? 'You' : `${o.reporter?.first_name} ${o.reporter?.last_name}`}</td>
                        <td>{o.confirmed_at ? 'Confirmed' : 'Awaiting confirmation'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
