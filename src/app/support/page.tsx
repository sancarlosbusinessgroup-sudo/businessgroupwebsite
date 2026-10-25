import Link from 'next/link';
import type { Metadata } from 'next';
import Image from 'next/image';
import { PageHero } from '@/components/ui';
import { site, supportFaq, supportIntro, supportTeam, supportTopics } from '@/lib/content';
import { tidioConfigFromEnv } from '@/lib/chat';
import { requireMember } from '@/lib/auth';
import { SupportChatButton } from './SupportChatButton';

const bands = ['bg-teal-tint', 'bg-green-tint', 'bg-amber-tint'];

export const metadata: Metadata = { title: 'Support' };

export default async function SupportPage() {
  // Members only (owner, 2026-10-23).
  await requireMember('/support');
  const chatEnabled = tidioConfigFromEnv() !== null;
  return (
    <>
      <PageHero
        crumb="Support"
        title="Support"
        lead={`Questions about the ${site.name} website, your member account or our meetings? Our support team is happy to help.`}
      >
        <div className="card flex min-w-0 flex-[1_1_320px] flex-col gap-3 p-6">
          <h2 className="font-display m-0 text-xl font-extrabold">Need a hand?</h2>
          <p className="text-ink-soft m-0 text-[15px]">Start a chat with the support team. We&apos;ll get back to you as soon as we can.</p>
          {chatEnabled ? (
            <p className="text-ink-muted m-0 text-sm">
              You can also start a chat from any page: the chat bubble in the corner, or on phones the round chat button at the bottom of the screen. If nobody
              is online, leave a message and we&apos;ll reply by email.
            </p>
          ) : null}
          <div>
            <SupportChatButton chatEnabled={chatEnabled} />
          </div>
        </div>
      </PageHero>

      <section className="container-site flex flex-col gap-6 py-14" aria-labelledby="team-h">
        <div className="flex flex-col gap-2">
          <p className="eyebrow m-0">Who we are</p>
          <h2 id="team-h" className="h2">
            Your support team
          </h2>
        </div>
        <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-3">
          {supportTeam.map((t, i) => (
            <li key={t.name} className="flex flex-col gap-3">
              {/* Round photo, three quarters of the column width (owner, 2026-10-24); photo and name open their profile (owner, 2026-10-25). */}
              <Link href={t.profile} className="group flex flex-col gap-3 no-underline">
                <span
                  data-testid={`support-photo-${t.photo.replace(/^.*\/|\.webp$/g, '')}`}
                  className={`relative mx-auto block aspect-square w-3/4 overflow-hidden rounded-full ${bands[i % bands.length]} transition-shadow group-hover:ring-4 group-hover:ring-[#0c7b74]/40`}
                >
                  <Image src={t.photo} alt="" fill sizes="(max-width: 640px) 75vw, 285px" className="object-cover object-top" />
                </span>
                <span className="flex flex-col items-center gap-0.5 text-center">
                  <h3 className="font-display text-heading m-0 text-xl font-bold group-hover:underline">{t.name}</h3>
                  <span className="text-teal-text font-semibold">{t.role}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex max-w-[72ch] flex-col gap-3">
          {supportIntro.map((p) => (
            <p key={p.slice(0, 24)} className="text-ink-soft m-0 text-[17px] leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      </section>

      <section className="border-line bg-canvas border-y" aria-labelledby="help-h">
        <div className="container-site flex flex-col gap-6 py-14">
          <div className="flex flex-col gap-2">
            <p className="eyebrow m-0">How we can help</p>
            <h2 id="help-h" className="h2">
              Ask us about
            </h2>
          </div>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-0">
            {supportTopics.map((t) => (
              <li key={t.title} className="card border-t-accent flex flex-col gap-1.5 border-t-4 p-5">
                <h3 className="font-display m-0 text-lg font-bold">{t.title}</h3>
                <p className="text-ink-muted m-0 text-[15px]">{t.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-site flex max-w-[880px] flex-col gap-5 py-14" aria-labelledby="faq-h">
        <div className="flex flex-col gap-2">
          <p className="eyebrow m-0">Quick answers</p>
          <h2 id="faq-h" className="h2">
            Frequently asked questions
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {supportFaq.map((f) => (
            <details key={f.q} className="card group p-5">
              <summary className="font-display text-heading cursor-pointer text-lg font-bold">{f.q}</summary>
              <p className="text-ink-soft m-0 mt-2">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="bg-teal-tint flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6">
          <p className="text-heading m-0 font-semibold">Still stuck? Chat with the support team.</p>
          <SupportChatButton chatEnabled={chatEnabled} />
        </div>
      </section>
    </>
  );
}
