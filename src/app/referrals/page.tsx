import type { Metadata } from 'next';
import { EmptyState, Pill } from '@/components/ui';
import { requireMember } from '@/lib/auth';
import { referralStatusLabels, site } from '@/lib/content';
import { getMemberOptions } from '@/lib/data/member';
import { formatMoney, formatShortDate } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { SendReferralForm, UpdateReferralForm } from './ReferralForms';

export const metadata: Metadata = { title: 'Referral tracker' };

const refTone = { new: 'gray', contacted: 'teal', meeting_set: 'teal', closed_deal: 'green', not_a_fit: 'amber' } as const;

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const sp = await searchParams;
  const viewer = await requireMember('/referrals');
  const me = viewer.profile;
  const supabase = await createClient();
  const [members, refsRes] = await Promise.all([
    getMemberOptions(me.id),
    supabase
      .from('referrals')
      .select(
        'id, from_id, to_id, contact_name, prospect_phone, prospect_email, amount, notes, status, created_at, from:profiles!referrals_from_id_fkey(first_name, last_name), to:profiles!referrals_to_id_fkey(first_name, last_name)',
      )
      .or(`from_id.eq.${me.id},to_id.eq.${me.id}`)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  if (refsRes.error) throw new Error('Could not load your referrals');
  const received = refsRes.data.filter((r) => r.to_id === me.id);
  const given = refsRes.data.filter((r) => r.from_id === me.id);
  const validTo = members.some((m) => m.id === sp.to) ? sp.to : undefined;

  const slip = (r: (typeof refsRes.data)[number], isReceived: boolean) => {
    const other = isReceived ? r.from : r.to;
    return (
      <li key={r.id} className="border-line flex flex-col gap-2 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <span className="text-ink-muted text-sm">{isReceived ? '← From' : 'To →'}</span>{' '}
            <strong>
              {other?.first_name} {other?.last_name}
            </strong>{' '}
            · {r.contact_name}
          </span>
          <span className="text-ink-muted flex flex-wrap items-center gap-2 text-sm">
            {formatShortDate(new Date(r.created_at))}
            <Pill tone={refTone[r.status]}>{referralStatusLabels[r.status]}</Pill>
          </span>
        </div>
        {r.prospect_phone || r.prospect_email || r.notes ? (
          <div className="text-ink-soft flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
            {r.prospect_phone ? <a href={`tel:${r.prospect_phone.replace(/[^0-9+]/g, '')}`}>{r.prospect_phone}</a> : null}
            {r.prospect_email ? <a href={`mailto:${r.prospect_email}`}>{r.prospect_email}</a> : null}
            {r.notes ? <span>{r.notes}</span> : null}
          </div>
        ) : null}
        {r.amount !== null ? (
          <span className="text-ink-soft text-[15px]">
            Value: <strong>{formatMoney(r.amount)}</strong>
          </span>
        ) : null}
        {isReceived ? <UpdateReferralForm id={r.id} status={r.status} amount={r.amount} label={r.contact_name} /> : null}
      </li>
    );
  };

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <div>
          <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Referral tracker</h1>
          <p className="text-ink-muted m-0 mt-1">
            Pass business to fellow {site.name} members with a referral slip. The member who receives it updates the status; a referral that produces business
            becomes a closed deal, and its dollar value counts toward the business the group has generated.
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-5">
            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="recv-h">
              <h2 id="recv-h" className="h3">
                Referrals I received
              </h2>
              {received.length === 0 ? (
                <EmptyState title="No referrals received yet" />
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">{received.map((r) => slip(r, true))}</ul>
              )}
            </section>
            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="given-h">
              <h2 id="given-h" className="h3">
                Referrals I gave
              </h2>
              {given.length === 0 ? (
                <EmptyState title="No referrals given yet">File your first referral slip with the form.</EmptyState>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">{given.map((r) => slip(r, false))}</ul>
              )}
            </section>
          </div>
          <SendReferralForm members={members.map((m) => ({ id: m.id, label: `${m.first_name} ${m.last_name} · ${m.business_name}` }))} defaultTo={validTo} />
        </div>
      </div>
    </div>
  );
}
