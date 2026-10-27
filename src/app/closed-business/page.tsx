import type { Metadata } from 'next';
import { EmptyState, Notice } from '@/components/ui';
import { requireMember } from '@/lib/auth';
import { getMemberOptions } from '@/lib/data/member';
import { formatMoney, localDateKey } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { ReferralSlip, referralSelect, type ReferralRow } from '../referrals/ReferralSlip';
import { FileClosedBusinessForm } from './ClosedBusinessForm';

export const metadata: Metadata = { title: 'Closed Businesses' };

// Closed Businesses (owner, 2026-10-25): referrals that became business, the member's open received
// referrals with a reminder to mark them closed, and a form for closed business that was never filed.
export default async function ClosedBusinessPage() {
  const viewer = await requireMember('/closed-business');
  const me = viewer.profile;
  const isAdmin = me.role === 'admin';
  const supabase = await createClient();
  const [members, refsRes] = await Promise.all([
    getMemberOptions(me.id),
    supabase.from('referrals').select(referralSelect).or(`from_id.eq.${me.id},to_id.eq.${me.id}`).order('created_at', { ascending: false }).limit(200),
  ]);
  if (refsRes.error) throw new Error('Could not load your referrals');
  const rows = refsRes.data as unknown as ReferralRow[];
  const openReceived = rows.filter((r) => r.to_id === me.id && r.status !== 'closed_deal' && r.status !== 'not_a_fit');
  const closed = rows.filter((r) => r.status === 'closed_deal').sort((a, b) => (b.closed_at ?? b.created_at).localeCompare(a.closed_at ?? a.created_at));
  const closedReceived = closed.filter((r) => r.to_id === me.id);
  const closedGiven = closed.filter((r) => r.from_id === me.id);
  const total = (list: ReferralRow[]) => list.reduce((sum, r) => sum + (r.amount ?? 0), 0);

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <div>
          <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Closed Businesses</h1>
          <p className="text-ink-soft mt-2 mb-0 max-w-[70ch]">Referrals that have turned into business.</p>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-5">
            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="mark-h">
              <h2 id="mark-h" className="h3">
                Mark referrals as closed business
              </h2>
              <Notice tone="info">
                Did a referral you received turn into business? Set its Status to <strong>Closed business</strong>, enter the value, and press Save.
              </Notice>
              {openReceived.length === 0 ? (
                <EmptyState title="No open referrals">Referrals you receive will show here until you mark them.</EmptyState>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {openReceived.map((r) => (
                    <ReferralSlip key={r.id} r={r} isReceived isAdmin={isAdmin} />
                  ))}
                </ul>
              )}
            </section>

            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="closed-recv-h">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="closed-recv-h" className="h3">
                  Closed business I received
                </h2>
                {closedReceived.length ? (
                  <span className="text-ink-muted text-sm">
                    {closedReceived.length} · <strong className="text-ink-soft">{formatMoney(total(closedReceived))}</strong>
                  </span>
                ) : null}
              </div>
              {closedReceived.length === 0 ? (
                <EmptyState title="No closed business received yet" />
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {closedReceived.map((r) => (
                    <ReferralSlip key={r.id} r={r} isReceived isAdmin={isAdmin} />
                  ))}
                </ul>
              )}
            </section>

            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="closed-given-h">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="closed-given-h" className="h3">
                  Closed business from my referrals
                </h2>
                {closedGiven.length ? (
                  <span className="text-ink-muted text-sm">
                    {closedGiven.length} · <strong className="text-ink-soft">{formatMoney(total(closedGiven))}</strong>
                  </span>
                ) : null}
              </div>
              {closedGiven.length === 0 ? (
                <EmptyState title="None yet">When a member marks your referral as closed business, it shows here.</EmptyState>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {closedGiven.map((r) => (
                    <ReferralSlip key={r.id} r={r} isReceived={false} isAdmin={isAdmin} />
                  ))}
                </ul>
              )}
            </section>
          </div>
          <FileClosedBusinessForm
            members={members.map((m) => ({ id: m.id, label: `${m.first_name} ${m.last_name} · ${m.business_name}` }))}
            today={localDateKey(new Date())}
          />
        </div>
      </div>
    </div>
  );
}
