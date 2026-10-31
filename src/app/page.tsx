import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { EventCard, NextMeetingCard } from '@/components/meetings';
import { JsonLd, organizationJsonLd } from '@/components/site/JsonLd';
import { EmptyState, Notice, SectionHead } from '@/components/ui';
import { getViewer, isApproved } from '@/lib/auth';
import { howItWorks, site } from '@/lib/content';
import { getUpcomingCalendar } from '@/lib/data/events';
import { getGallery, getMemberCount, getNextMeeting } from '@/lib/data/public';
import { formatShortDate } from '@/lib/dates';
import { mediaUrl } from '@/lib/env';

export const metadata: Metadata = {
  description:
    'Bay Area Referral Partners is a San Carlos business networking group: one trusted member per category, meeting every other Monday to pass referrals and grow together across the SF Peninsula.',
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  const [viewer, next, meetings, events, photos, count] = await Promise.all([
    getViewer(),
    getNextMeeting(),
    getUpcomingCalendar(3, 'group'),
    getUpcomingCalendar(3, 'member'),
    getGallery(undefined, 3),
    getMemberCount(),
  ]);
  const member = isApproved(viewer);

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      {account === 'deleted' ? (
        <div className="container-site pt-4">
          <Notice tone="success">Your account has been deleted. Thank you for being part of {site.name}.</Notice>
        </div>
      ) : null}
      <section className="bg-band relative isolate overflow-hidden">
        <Image
          src="/images/hero-bridge.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-[70%_center] brightness-110 saturate-[1.15]"
        />
        <div
          className="bg-band/60 md:from-band/70 md:via-band/35 absolute inset-0 -z-10 md:bg-transparent md:bg-linear-to-r md:to-transparent"
          aria-hidden="true"
        />
        <div className="container-site flex flex-wrap items-center gap-12 py-16 md:py-24">
          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-5">
            <h1 className="font-display text-on-band m-0 text-[clamp(38px,5vw,60px)] leading-[1.05] font-extrabold tracking-[-0.02em] [text-shadow:0_2px_16px_rgb(0_0_0/0.5)]">
              Local businesses, growing through real referrals.
            </h1>
            <p className="text-on-band m-0 max-w-[560px] text-xl font-medium [text-shadow:0_1px_10px_rgb(0_0_0/0.6)]">
              We meet every other Monday at 8:15 AM - 9:30AM on Zoom
            </p>
            <div className="flex flex-wrap gap-3">
              {member ? (
                <Link className="btn btn-light" href="/invite-guest">
                  Invite a Guest
                </Link>
              ) : (
                <Link className="btn btn-light" href="/visit#request">
                  Request for an Invite
                </Link>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-[1_1_420px]">
            <NextMeetingCard meeting={next} member={member} variant="glass" />
          </div>
        </div>
      </section>

      <section className="container-site py-10" aria-label="At a glance">
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          {[
            { v: String(site.founded), l: 'Originally founded with the San Carlos Chamber of Commerce.' },
            { v: String(count), l: 'Member businesses in the directory' },
            { v: site.meetingCadence, l: '8:15am–9:30am' },
            { v: '$0', l: 'No membership fees. We just ask for full participation.' },
          ].map((s) => (
            // Label after the value visually (column-reverse keeps dt before dd for screen readers); justify-end = top in reverse
            <div key={s.l} className="card flex flex-col-reverse justify-end gap-1.5 p-6">
              <dt className="text-ink-muted">{s.l}</dt>
              <dd className="font-display text-teal-text m-0 text-[34px] leading-tight font-extrabold">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="container-site flex flex-col gap-8 py-14">
        <SectionHead eyebrow="How membership works" title="A system for business growth." />
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 p-0">
          {howItWorks.map((s, i) => (
            <li key={s.title} className="card flex flex-col gap-2.5 p-6">
              <span className="font-display text-teal-text text-2xl font-extrabold" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="font-display m-0 text-xl">{s.title}</h3>
              <p className="text-ink-muted m-0 text-base">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-line bg-canvas border-y">
        <div className="container-site flex flex-col gap-7 py-14">
          <SectionHead
            eyebrow="Upcoming"
            title="Meeting Schedules"
            action={
              <Link href="/group-meetings" className="text-base font-bold">
                All meetings →
              </Link>
            }
          />
          {meetings.length === 0 ? (
            <EmptyState title="No upcoming meetings yet">Check back soon.</EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              {meetings.map((m) => (
                <EventCard key={m.id} item={m} member={member} />
              ))}
            </div>
          )}
          <SectionHead
            eyebrow="Hosted by members"
            title="Member events"
            action={
              <Link href="/events" className="text-base font-bold">
                All member events →
              </Link>
            }
          />
          {events.length === 0 ? (
            <EmptyState title="No member events coming up">Members can post workshops, socials and open houses.</EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              {events.map((m) => (
                <EventCard key={m.id} item={m} member={member} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="container-site flex flex-col gap-7 py-14">
        <SectionHead
          eyebrow="Gallery"
          title="Moments from our meetings"
          action={
            <Link href="/gallery" className="text-base font-bold">
              Open the gallery →
            </Link>
          }
        />
        {photos.length === 0 ? (
          <EmptyState title="No photos yet" />
        ) : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 p-0">
            {photos.map((p) => (
              <li key={p.id}>
                <Link href="/gallery" className="text-ink-soft flex flex-col gap-2 no-underline">
                  <span className="bg-ph-a relative block aspect-[4/3] overflow-hidden rounded-[14px]">
                    <Image src={mediaUrl('gallery', p.thumb_path) ?? ''} alt={p.caption} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                  </span>
                  <span className="text-[15px]">
                    {p.caption}
                    {p.taken_on ? <span className="text-ink-muted"> · {formatShortDate(new Date(p.taken_on + 'T12:00:00Z'))}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-teal-tint">
        <div className="mx-auto flex max-w-[880px] flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="h2">Let&apos;s grow our businesses together!</h2>
          <p className="text-ink-soft m-0 text-[19px]">
            {site.name} is dedicated to growing Bay Area Peninsula businesses. Our group of business owners and leaders is here to support you.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link className="btn btn-primary" href="/visit#request">
              Request an invite
            </Link>
            <Link className="btn btn-outline" href="/members">
              Meet our members
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
