import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, Pill } from '@/components/ui';
import { requireMember } from '@/lib/auth';
import { guestStatusLabels, referralStatusLabels } from '@/lib/content';
import { getMemberOptions, getMyStats, getTopInviters } from '@/lib/data/member';
import { formatShortDate, money } from '@/lib/dates';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { CopyLink } from './CopyLink';
import { SendReferralForm, UpdateReferralForm } from './ReferralForms';

export const metadata: Metadata = { title: 'Referral tracker' };

const guestTone = { requested: 'gray', visited: 'amber', applied: 'teal', joined: 'green' } as const;
const refTone = { sent: 'gray', contacted: 'teal', closed: 'green', not_a_fit: 'amber' } as const;

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ tab?: string; to?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === 'business' ? 'business' : 'people';
  const viewer = await requireMember('/referrals');
  const me = viewer.profile;
  const supabase = await createClient();
  const [stats, leaders, members, guestsRes, refsRes] = await Promise.all([
    getMyStats(),
    getTopInviters(),
    getMemberOptions(me.id),
    supabase
      .from('guest_requests')
      .select('id, first_name, last_name, business_name, status, created_at')
      .eq('referrer_id', me.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('referrals')
      .select(
        'id, from_id, to_id, contact_name, status, closed_amount, created_at, from:profiles!referrals_from_id_fkey(first_name, last_name), to:profiles!referrals_to_id_fkey(first_name, last_name)',
      )
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  if (guestsRes.error || refsRes.error) throw new Error('Could not load your referrals');

  const link = `${env.siteUrl}/visit?ref=${me.referral_code}`;
  const invite = encodeURIComponent(`I'd love for you to visit the San Carlos Business Networking Group as my guest: ${link}`);
  const funnel = [
    { l: 'Invited', v: stats.guests_invited },
    { l: 'Visited', v: stats.guests_visited },
    { l: 'Applied', v: stats.guests_applied },
    { l: 'Joined', v: stats.guests_joined },
  ];
  const maxF = Math.max(1, stats.guests_invited);
  const tabCls = (on: boolean) =>
    `flex min-h-11 items-center rounded-full px-5 font-display text-sm font-bold no-underline ${on ? 'bg-surface text-heading' : 'text-ink-muted'}`;
  const validTo = members.some((m) => m.id === sp.to) ? sp.to : undefined;

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <div>
          <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Referral tracker</h1>
          <p className="text-ink-muted m-0 mt-1">Track the people you bring to SCBNG and the business you pass to fellow members.</p>
        </div>

        <div className="flex flex-wrap gap-5">
          <section className="bg-band text-on-band flex min-w-0 flex-[3_1_520px] flex-col gap-3.5 rounded-[20px] p-6" aria-labelledby="link-h">
            <h2 id="link-h" className="font-display text-sky m-0 text-[13px] font-bold tracking-[0.12em] uppercase">
              Your personal invite link
            </h2>
            <CopyLink url={link} />
            <p className="text-on-band-muted m-0 text-[15px]">
              Anyone who requests a guest invite or applies through this link is credited to you, all the way to membership.
            </p>
            <div className="flex flex-wrap gap-2">
              <a className="btn btn-ghost-band btn-sm" href={`mailto:?subject=${encodeURIComponent('Join me at SCBNG')}&body=${invite}`}>
                Email an invite
              </a>
              <a className="btn btn-ghost-band btn-sm" href={`sms:?&body=${invite}`}>
                Text an invite
              </a>
              <a
                className="btn btn-ghost-band btn-sm"
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Share on LinkedIn
              </a>
            </div>
          </section>
          <section className="card min-w-0 flex-[2_1_320px] p-5" aria-labelledby="top-h">
            <h2 id="top-h" className="h3 mb-3">
              Top inviters · {new Date().getFullYear()}
            </h2>
            {leaders.length === 0 ? (
              <EmptyState title="No invites yet this year" />
            ) : (
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {leaders.map((l, i) => (
                  <li
                    key={l.profile_id}
                    className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[15px] ${l.profile_id === me.id ? 'bg-teal-tint' : ''}`}
                  >
                    <span className="text-teal w-6 font-extrabold">{i + 1}</span>
                    <span className="flex-1">
                      {l.first_name} {l.last_name}
                      {l.profile_id === me.id ? ' (you)' : ''}
                    </span>
                    <strong>{l.invited}</strong>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <nav aria-label="Referral type" className="bg-line-soft flex flex-wrap gap-1.5 self-start rounded-full p-1">
          <Link className={tabCls(tab === 'people')} aria-current={tab === 'people' ? 'page' : undefined} href="/referrals">
            People I invited
          </Link>
          <Link className={tabCls(tab === 'business')} aria-current={tab === 'business' ? 'page' : undefined} href="/referrals?tab=business">
            Business referrals
          </Link>
        </nav>

        {tab === 'people' ? (
          <section className="card flex flex-col gap-5 p-[22px]" aria-label="People I invited">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {funnel.map((f, i) => (
                <div key={f.l} className="flex flex-col gap-1.5">
                  <div className="bg-line-soft h-2.5 overflow-hidden rounded-full" aria-hidden="true">
                    <div className={`h-full ${i === 3 ? 'bg-green' : 'bg-teal'}`} style={{ width: `${Math.round((f.v / maxF) * 100)}%` }} />
                  </div>
                  <div className="font-display text-[26px] font-extrabold">{f.v}</div>
                  <div className="text-ink-muted text-sm">{f.l}</div>
                </div>
              ))}
            </div>
            {guestsRes.data.length === 0 ? (
              <EmptyState title="No guests yet">Share your invite link above. Guests who use it show up here.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">People you invited</caption>
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Business</th>
                      <th scope="col">Invited</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guestsRes.data.map((g) => (
                      <tr key={g.id}>
                        <td>
                          <strong>
                            {g.first_name} {g.last_name}
                          </strong>
                        </td>
                        <td>{g.business_name ?? '—'}</td>
                        <td>{formatShortDate(new Date(g.created_at))}</td>
                        <td>
                          <Pill tone={guestTone[g.status]}>{guestStatusLabels[g.status]}</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <div className="flex flex-wrap items-start gap-5">
            <section className="card flex min-w-0 flex-[3_1_520px] flex-col gap-3.5 p-[22px]" aria-label="Business referrals">
              <dl className="m-0 flex flex-wrap gap-6">
                {[
                  { k: 'Given (90 days)', v: String(stats.referrals_given) },
                  { k: 'Received', v: String(stats.referrals_received) },
                  { k: 'Closed business received', v: money(Number(stats.closed_amount)) },
                ].map((s) => (
                  <div key={s.k} className="flex flex-col-reverse">
                    <dt className="text-ink-muted text-sm">{s.k}</dt>
                    <dd className="font-display m-0 text-[26px] font-extrabold">{s.v}</dd>
                  </div>
                ))}
              </dl>
              {refsRes.data.length === 0 ? (
                <EmptyState title="No referrals yet">Log your first referral with the form.</EmptyState>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {refsRes.data.map((r) => {
                    const received = r.to_id === me.id;
                    const other = received ? r.from : r.to;
                    return (
                      <li key={r.id} className="border-line flex flex-col gap-2 rounded-xl border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <span className="text-ink-muted text-sm">{received ? '← From' : 'To →'}</span>{' '}
                            <strong>
                              {other?.first_name} {other?.last_name}
                            </strong>{' '}
                            · {r.contact_name}
                          </span>
                          <span className="text-ink-muted flex items-center gap-2 text-sm">
                            {formatShortDate(new Date(r.created_at))}
                            <Pill tone={refTone[r.status]}>
                              {referralStatusLabels[r.status]}
                              {r.status === 'closed' && r.closed_amount ? ` · ${money(Number(r.closed_amount))}` : ''}
                            </Pill>
                          </span>
                        </div>
                        {received ? <UpdateReferralForm id={r.id} status={r.status} amount={r.closed_amount} label={r.contact_name} /> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <SendReferralForm members={members.map((m) => ({ id: m.id, label: `${m.first_name} ${m.last_name} · ${m.business_name}` }))} defaultTo={validTo} />
          </div>
        )}
      </div>
    </div>
  );
}
