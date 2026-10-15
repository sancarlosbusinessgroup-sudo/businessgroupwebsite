import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageHero, SectionHead } from '@/components/ui';
import { leadership, metrics, timeline, values } from '@/lib/content';

export const metadata: Metadata = { title: 'About' };

const icons = [
  'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'M3 17l6-6 4 4 8-8M14 7h7v7',
  'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18M9 16l2 2 4-4',
];

export default function AboutPage() {
  return (
    <>
      <PageHero crumb="About" title="About SCBNG" lead="Since 2016, we've helped small businesses and entrepreneurs connect, grow and thrive, together." />

      <section className="container-site flex flex-wrap items-center gap-12 py-16">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-4 text-lg">
          <p className="eyebrow m-0">Our history</p>
          <h2 className="h2">Where it all began</h2>
          <p className="m-0">
            The San Carlos Business Networking Group started in 2016 as part of the San Carlos Chamber of Commerce. It was created for local professionals who
            believe in the power of connection and community-driven referrals.
          </p>
          <p className="m-0">
            When the Chamber closed during the COVID-19 pandemic, our group made a choice: dissolve or keep going. We chose growth, and we&apos;ve been thriving
            ever since.
          </p>
        </div>
        <ol className="border-teal-tint m-0 flex min-w-0 flex-[1_1_360px] list-none flex-col border-l-[3px] p-0">
          {timeline.map((t, i) => (
            <li key={t.year} className={`pl-6 ${i < timeline.length - 1 ? 'pb-[22px]' : ''}`}>
              <div className="font-display text-teal-text font-extrabold">{t.year}</div>
              <div>{t.text}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-line bg-canvas border-y">
        <div className="container-site flex flex-wrap items-center gap-12 py-16">
          <figure className="m-0 flex flex-[0_1_320px] flex-col items-center gap-3 text-center">
            <Image
              src={leadership.photo}
              alt={leadership.name}
              width={260}
              height={260}
              className="border-surface h-[260px] w-[260px] rounded-full border-[6px] object-cover"
            />
            <figcaption className="text-ink-muted text-[15px] italic">{leadership.caption}</figcaption>
          </figure>
          <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-4 text-lg">
            <p className="eyebrow m-0">Leadership</p>
            <h2 className="h2">Consistent leadership</h2>
            <p className="m-0">
              SCBNG has been led since day one by <strong>{leadership.name}</strong> of <em>{leadership.business}</em>. Her steady, committed leadership has
              helped shape a community that values authenticity, generosity and professionalism.
            </p>
            <div>
              <Link className="btn btn-outline" href="/members">
                Meet our members
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-site flex flex-col gap-7 py-16">
        <SectionHead eyebrow="Our values" title="What makes SCBNG special" />
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5 p-0">
          {values.map((v, i) => (
            <li key={v.title} className="card flex flex-col gap-2.5 p-7">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-teal-text"
                aria-hidden="true"
              >
                <path d={icons[i]} />
              </svg>
              <h3 className="font-display m-0 text-xl">{v.title}</h3>
              <p className="text-ink-muted m-0 text-base">{v.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-band text-on-band">
        <div className="container-site flex flex-col gap-7 py-16">
          <div className="flex max-w-[760px] flex-col gap-3">
            <p className="font-display text-sky m-0 text-[13px] font-bold tracking-[0.12em] uppercase">How we track our success together</p>
            <h2 className="font-display text-on-band m-0 text-[clamp(28px,3.2vw,40px)] leading-tight font-extrabold">Our three key participation metrics</h2>
            <p className="text-on-band-muted m-0">
              We measure how often our members connect, support each other, and win new business through real relationships.
            </p>
          </div>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5 p-0">
            {metrics.map((m) => (
              <li key={m.title} className="bg-band-2 flex flex-col gap-2 rounded-2xl p-6">
                <h3 className="font-display text-on-band m-0 text-xl">{m.title}</h3>
                <p className="text-on-band-muted m-0 text-base">{m.text}</p>
              </li>
            ))}
          </ul>
          <p className="text-on-band-muted m-0">
            <strong className="text-on-band">Why it matters:</strong> when people take time to connect, learn and share, amazing things happen. People who work
            together grow together.
          </p>
        </div>
      </section>

      <section className="mx-auto flex max-w-[820px] flex-col items-center gap-4 px-6 py-16 text-center">
        <h2 className="h2">Looking ahead</h2>
        <p className="text-ink-soft m-0 text-xl">
          We&apos;re always growing, and always looking for new members who value connection, contribution and community.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link className="btn btn-primary" href="/visit">
            Visit a meeting
          </Link>
          <Link className="btn btn-outline" href="/join">
            Apply to join
          </Link>
        </div>
      </section>
    </>
  );
}
