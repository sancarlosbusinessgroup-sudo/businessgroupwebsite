import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar, CheckIcon } from '@/components/ui';
import { getCategories } from '@/lib/data/public';
import { createClient } from '@/lib/supabase/server';
import { referralCode as referralCodeSchema } from '@/lib/validation';
import { JoinForm } from './JoinForm';
import { site } from '@/lib/content';

export const metadata: Metadata = { title: `Join ${site.name}` };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const code = referralCodeSchema.safeParse(ref);
  const referralCode = code.success ? code.data : undefined;
  const supabase = await createClient();
  const [categories, referrer] = await Promise.all([
    getCategories(),
    referralCode ? supabase.from('profiles').select('first_name, last_name').eq('referral_code', referralCode).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const referrerName = referrer.data ? `${referrer.data.first_name} ${referrer.data.last_name}` : undefined;

  return (
    <div className="bg-canvas">
      <section className="container-site flex flex-wrap items-start gap-10 pt-12 pb-[72px]">
        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <p className="eyebrow m-0">Membership application</p>
          <h1 className="font-display m-0 text-[clamp(32px,4vw,46px)] leading-[1.08] font-extrabold">Join {site.name}</h1>
          <p className="text-ink-soft m-0">No dues. One business per category. Members commit to showing up, one-on-ones and tracking activity.</p>
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
        <JoinForm categories={categories} referralCode={referralCode} referrerName={referrerName} />
      </section>
    </div>
  );
}
