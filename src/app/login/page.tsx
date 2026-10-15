import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewer, safeNext } from '@/lib/auth';
import { LoginForms } from './LoginForms';
import { site } from '@/lib/content';

export const metadata: Metadata = { title: 'Member login' };

const features = [
  { t: 'Zero membership dues', d: `Participation, not payment, is what ${site.name} values.` },
  { t: 'Local San Carlos & Peninsula focus', d: 'Connections that are relevant to your local market.' },
  { t: 'Community beyond business', d: 'Friendly and collaborative, inside and outside of meetings.' },
  { t: 'Accountability through tracking', d: 'One-on-ones, referrals and closed business keep results real.' },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const viewer = await getViewer();
  if (viewer) redirect(viewer.profile?.status === 'approved' ? next : '/pending');

  return (
    <>
      <section className="container-site flex flex-wrap items-start gap-12 pt-14 pb-[72px]">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
          <p className="eyebrow m-0">{site.name} member growth dashboard</p>
          <h1 className="font-display m-0 text-[clamp(32px,4vw,46px)] leading-[1.08] font-extrabold">More than networking. A system for business growth.</h1>
          <p className="text-ink-soft m-0">
            Log in to find meeting links, track referrals, one-on-ones and closed business, and see the relationships helping your business grow.
          </p>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {features.map((f) => (
              <li key={f.t} className="flex gap-3.5">
                <span className="bg-teal-tint h-10 w-10 flex-none rounded-xl" aria-hidden="true" />
                <div>
                  <h2 className="font-display m-0 text-[17px]">{f.t}</h2>
                  <p className="text-ink-muted m-0 text-[15px]">{f.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <LoginForms next={next} linkError={sp.error === 'link'} />
      </section>
      <section className="bg-band">
        <div className="text-on-band-muted mx-auto flex max-w-[820px] flex-col gap-3 px-6 py-14 text-center">
          <h2 className="font-display text-on-band m-0 text-[clamp(24px,2.8vw,32px)] font-extrabold">
            One conversation can sharpen how another member talks about your business.
          </h2>
          <p className="m-0">
            One introduction can open a new relationship. One trusted relationship can lead to years of referrals, partnerships and support.
          </p>
        </div>
      </section>
    </>
  );
}
