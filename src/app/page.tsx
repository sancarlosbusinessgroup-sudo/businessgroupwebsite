import Image from 'next/image';
import Link from 'next/link';
import { EventCard, NextMeetingCard } from '@/components/meetings';
import { CheckIcon, EmptyState, SectionHead } from '@/components/ui';
import { getViewer, isApproved } from '@/lib/auth';
import { howItWorks, site } from '@/lib/content';
import { getGallery, getMemberCount, getNextMeeting, getUpcomingMeetings } from '@/lib/data/public';
import { formatShortDate } from '@/lib/dates';
import { mediaUrl } from '@/lib/env';

export default async function HomePage() {
  const [viewer, next, upcoming, photos, count] = await Promise.all([
    getViewer(),
    getNextMeeting(),
    getUpcomingMeetings(3),
    getGallery(undefined, 3),
    getMemberCount(),
  ]);
  const member = isApproved(viewer);

  return (
    <>
      <section className="border-line bg-canvas border-b">
        <div className="container-site flex flex-wrap items-center gap-12 py-16 md:pb-20">
          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-5">
            <p className="eyebrow m-0">San Carlos · SF Peninsula · Since {site.founded}</p>
            <h1 className="font-display text-heading m-0 text-[clamp(38px,5vw,60px)] leading-[1.05] font-extrabold tracking-[-0.02em]">
              Local businesses, growing through real referrals.
            </h1>
            <p className="text-ink-soft m-0 max-w-[560px] text-xl">
              We meet every other Monday at 8:15 AM, mostly on Zoom with occasional in-person gatherings. Come as a guest up to two times, free. No pressure,
              just connection.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link className="btn btn-primary" href="/visit">
                Visit a meeting free
              </Link>
              <Link className="btn btn-outline" href="/join">
                Become a member
              </Link>
            </div>
            <p className="text-ink-muted m-0 flex items-center gap-2.5 text-base">
              <CheckIcon className="text-green" />
              Zero membership dues. Participation is what we ask.
            </p>
          </div>
          <div className="min-w-0 flex-[1_1_420px]">
            <NextMeetingCard meeting={next} member={member} />
          </div>
        </div>
      </section>

      <section className="container-site py-10" aria-label="At a glance">
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          {[
            { v: String(site.founded), l: 'Founded with the San Carlos Chamber of Commerce' },
            { v: String(count), l: 'Member businesses in the directory' },
            { v: site.meetingCadence, l: `${site.meetingTime}, online with hybrid gatherings` },
            { v: '$0', l: 'Annual dues. Participation, not payment' },
          ].map((s) => (
            <div key={s.l} className="flex flex-col-reverse px-1 py-2">
              <dt className="text-ink-muted">{s.l}</dt>
              <dd className="font-display text-teal-text m-0 text-[34px] font-extrabold">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="container-site flex flex-col gap-8 py-14">
        <SectionHead eyebrow="How membership works" title="More than networking. A system for business growth." />
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 p-0">
          {howItWorks.map((s, i) => (
            <li key={s.title} className="card flex flex-col gap-2.5 p-6">
              <span className="font-display text-green font-extrabold" aria-hidden="true">
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
            title="Events & meetings"
            action={
              <Link href="/events" className="text-base font-bold">
                See the full calendar →
              </Link>
            }
          />
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming events yet">Check back soon.</EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              {upcoming.map((m) => (
                <EventCard key={m.id} meeting={m} member={member} />
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
            <Link className="btn btn-primary" href="/join">
              Visit or join
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
