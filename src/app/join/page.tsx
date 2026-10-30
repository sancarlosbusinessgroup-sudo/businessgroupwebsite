import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar, CheckIcon } from '@/components/ui';
import { getCategorySeats, referrerByCode } from '@/lib/data/public';
import { formatShortDate, nowMs } from '@/lib/dates';
import { referralCode as referralCodeSchema } from '@/lib/validation';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { JoinForm, type JoinPrefill } from './JoinForm';
import { site } from '@/lib/content';

// Reached only from an admin's "Invite to apply" email, so search engines should not list it.
export const metadata: Metadata = { title: `Join ${site.name}`, robots: { index: false, follow: false } };

/** An admin's "Invite to apply" email links here with ?invite=<guest request id>: fill in what we already know. */
async function invitePrefill(invite: string | undefined): Promise<{ prefill: JoinPrefill; code: string | null } | null> {
  const id = z.uuid().safeParse(invite);
  const db = id.success ? createAdminClient() : null;
  if (!db || !id.success) return null;
  const { data: g } = await db
    .from('guest_requests')
    .select('first_name, last_name, email, business_name, status, referrer:profiles!guest_requests_referrer_id_fkey(referral_code)')
    .eq('id', id.data)
    .maybeSingle();
  if (!g || g.status === 'applied' || g.status === 'joined') return null;
  const ref = g.referrer as { referral_code: string } | null;
  return { prefill: { firstName: g.first_name, lastName: g.last_name, email: g.email, businessName: g.business_name ?? '' }, code: ref?.referral_code ?? null };
}

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ ref?: string; invite?: string }> }) {
  const { ref, invite } = await searchParams;
  const invited = await invitePrefill(invite);
  const code = referralCodeSchema.safeParse(ref ?? invited?.code ?? undefined);
  const referralCode = code.success ? code.data : undefined;
  const [categories, referrer] = await Promise.all([getCategorySeats(), referrerByCode(referralCode)]);
  const referrerName = referrer?.name;

  return (
    <div className="bg-canvas">
      <section className="container-site flex flex-wrap items-start gap-10 pt-12 pb-[72px]">
        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <p className="eyebrow m-0">Membership application</p>
          <h1 className="font-display m-0 text-[clamp(32px,4vw,46px)] leading-[1.08] font-extrabold">Join {site.name}</h1>
          <p className="text-ink-soft m-0">
            No membership fees. One business per category. Members commit to showing up, one-to-ones and bringing referrals or visitors. See our{' '}
            <Link href="/bylaws">Bylaws and Procedures</Link>.
          </p>
          {invited ? (
            <div className="card border-teal flex flex-col gap-1 border-l-4 p-5">
              <strong className="text-heading">You&apos;re invited to apply, {invited.prefill.firstName}!</strong>
              <span className="text-ink-muted text-[15px]">We&apos;ve filled in the details we already have. Please complete the rest of the form.</span>
            </div>
          ) : null}
          {referrerName ? (
            <div className="card flex items-center gap-3.5 p-5">
              <Avatar name={referrerName} size={48} />
              <p className="m-0 text-[15px]">
                <strong className="text-heading">Invited by {referrerName}</strong>
                <br />
                <span className="text-ink-muted">Referral code {referralCode}. They get credit when you join.</span>
              </p>
            </div>
          ) : null}
          <ul className="m-0 flex list-none flex-col gap-3 p-0 text-base">
            {[
              'Your business listed in the public directory',
              'Meeting links and attendance, all in one place',
              'A growth dashboard and your own referral link',
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <CheckIcon className="text-green mt-0.5" />
                {t}
              </li>
            ))}
          </ul>
          <p className="text-ink-muted m-0 text-[15px]">
            Already a member?{' '}
            <Link href="/login" className="font-bold">
              Log in
            </Link>
          </p>
        </aside>
        <JoinForm
          categories={categories}
          referralCode={referralCode}
          referrerName={referrerName}
          today={formatShortDate(new Date(nowMs()))}
          prefill={invited?.prefill}
        />
      </section>
    </div>
  );
}
