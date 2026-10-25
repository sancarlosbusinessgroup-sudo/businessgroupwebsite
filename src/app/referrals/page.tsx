import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui';
import { requireMember } from '@/lib/auth';
import { getMemberOptions } from '@/lib/data/member';
import { createClient } from '@/lib/supabase/server';
import { SendReferralForm } from './ReferralForms';
import { ReferralSlip, referralSelect, type ReferralRow } from './ReferralSlip';

export const metadata: Metadata = { title: 'Referral tracker' };

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const sp = await searchParams;
  const viewer = await requireMember('/referrals');
  const me = viewer.profile;
  const supabase = await createClient();
  const [members, refsRes] = await Promise.all([
    getMemberOptions(me.id),
    supabase
      .from('referrals')
      .select(referralSelect)
      .or(`from_id.eq.${me.id},to_id.eq.${me.id}`)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  if (refsRes.error) throw new Error('Could not load your referrals');
  const rows = refsRes.data as unknown as ReferralRow[];
  const received = rows.filter((r) => r.to_id === me.id);
  const given = rows.filter((r) => r.from_id === me.id);
  const validTo = members.some((m) => m.id === sp.to) ? sp.to : undefined;

  const slip = (r: ReferralRow, isReceived: boolean) => <ReferralSlip key={r.id} r={r} isReceived={isReceived} isAdmin={me.role === 'admin'} />;

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <div>
          <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Referral tracker</h1>
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
