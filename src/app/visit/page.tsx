import type { Metadata } from 'next';
import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { CheckIcon, PageHero, SectionHead } from '@/components/ui';
import { joinSteps, meetingFormat, visitTips, site } from '@/lib/content';
import { getNextMeeting, getUpcomingMeetings } from '@/lib/data/public';
import { formatMeetingDate, formatMeetingTime } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { referralCode as referralCodeSchema } from '@/lib/validation';
import { GuestRequestForm } from './GuestRequestForm';

export const metadata: Metadata = { title: 'Visit a meeting' };

export default async function VisitPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const code = referralCodeSchema.safeParse(ref);
  const referralCode = code.success ? code.data : undefined;

  const supabase = await createClient();
  const [next, upcoming, referrer] = await Promise.all([
    getNextMeeting(),
    getUpcomingMeetings(6),
    referralCode ? supabase.from('profiles').select('first_name, last_name').eq('referral_code', referralCode).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const referrerName = referrer.data ? `${referrer.data.first_name} ${referrer.data.last_name}` : undefined;
  const meetingOptions = upcoming
    .filter((m) => m.category === 'Networking')
    .slice(0, 3)
    .map((m) => ({ id: m.id, label: `${formatMeetingDate(new Date(m.starts_at))} · Zoom` }));

  return (
    <>
      <PageHero
        crumb={`Visit ${site.name}`}
        title={`Come visit ${site.name}`}
        lead={
          <>
            You&apos;re welcome to attend up to <strong>two meetings for free</strong>. No pressure, just connection.
          </>
        }
      >
        <div className="card min-w-0 flex-[1_1_400px]">
          <div className="flex flex-col gap-3.5 p-[22px]">
            <span className="eyebrow text-teal-text">Next meeting coming in</span>
            {next ? (
              <>
                <Countdown target={next.starts_at} />
                <div className="text-ink-muted flex flex-wrap justify-between gap-2 text-[15px]">
                  <span>
                    {formatMeetingDate(new Date(next.starts_at))} · {formatMeetingTime(new Date(next.starts_at))} PT
                  </span>
                  <span>{next.is_online ? 'Online via Zoom' : next.location}</span>
                </div>
              </>
            ) : (
              <p className="m-0">The next date will be posted soon.</p>
            )}
            <div className="flex flex-wrap gap-2.5">
              <a className="btn btn-primary btn-sm" href="#request">
                Request an invite
              </a>
              <Link className="btn btn-outline btn-sm" href="/members">
                View our members
              </Link>
            </div>
          </div>
        </div>
      </PageHero>

      <section className="container-site flex flex-wrap gap-12 py-16">
        <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-4">
          <p className="eyebrow m-0">What to expect</p>
          <h2 className="h2">Easy and welcoming</h2>
          <p className="m-0 text-lg">We meet every other Monday morning at 8:15 AM, mostly online via Zoom, with occasional in-person hybrid gatherings.</p>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {[
              'Casual, local-focused conversation with fellow business owners',
              'A chance to introduce yourself and your business',
              'A look at how we support each other with referrals',
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <CheckIcon className="text-green mt-0.5" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-teal-tint flex min-w-0 flex-[1_1_420px] flex-col gap-3 rounded-2xl p-7">
          <h3 className="h3 text-[19px]">Tips for your first visit</h3>
          <ul className="m-0 flex flex-col gap-2 pl-5 text-base">
            {visitTips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-line bg-canvas border-y">
        <div className="container-site flex flex-col gap-7 py-16">
          <SectionHead eyebrow="Our meeting format" title="What a typical Monday looks like" />
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-10 p-0">
            {meetingFormat.map((s) => (
              <li key={s.title} className="border-line flex flex-col gap-1 border-t py-4">
                <h3 className="font-display m-0 text-[15px] tracking-[0.06em] uppercase">{s.title}</h3>
                <p className="text-ink-soft m-0 text-base">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-site flex flex-col gap-7 py-16">
        <div className="flex max-w-[760px] flex-col gap-2.5">
          <p className="eyebrow m-0">How to join</p>
          <h2 className="h2">From guest to member in four steps</h2>
          <p className="text-ink-soft m-0">
            Members attend meetings, schedule one-on-ones, refer business when it makes sense (no quotas), and track their activity so we know how we&apos;re
            growing.
          </p>
        </div>
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 p-0">
          {joinSteps.map((s, i) => (
            <li key={s.title} className="card flex flex-col gap-1.5 p-[22px]">
              <span className="font-display text-teal-text text-sm font-extrabold tracking-[0.08em]">STEP {i + 1}</span>
              <strong className="text-heading text-lg">{s.title}</strong>
              <span className="text-ink-muted text-[15px]">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="request" className="bg-band" aria-labelledby="request-title">
        <div className="container-site flex flex-wrap gap-10 py-16">
          <div className="text-on-band-muted flex min-w-0 flex-[1_1_360px] flex-col gap-3.5">
            <p className="font-display text-sky m-0 text-[13px] font-bold tracking-[0.12em] uppercase">Want to visit?</p>
            <h2 id="request-title" className="font-display text-on-band m-0 text-[clamp(28px,3.2vw,40px)] leading-tight font-extrabold">
              Request a guest invite
            </h2>
            <p className="m-0">
              We&apos;ll send the Zoom link and a calendar invite. If a member invited you, tell us who, so they get credit in their referral tracker.
            </p>
          </div>
          <GuestRequestForm meetings={meetingOptions} referralCode={referralCode} referrerName={referrerName} />
        </div>
      </section>
    </>
  );
}
