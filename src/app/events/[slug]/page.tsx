import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { notFound } from 'next/navigation';
import { Countdown } from '@/components/Countdown';
import { speakerFor } from '@/components/meetings';
import { Avatar, PageHero } from '@/components/ui';
import { getViewer, isAdmin, isApproved } from '@/lib/auth';
import { JsonLd, eventJsonLd } from '@/components/site/JsonLd';
import { env } from '@/lib/env';
import { site, slotDescriptions, slotTitles } from '@/lib/content';
import { getCalendarItemBySlug, listPathFor } from '@/lib/data/events';
import { formatMeetingDate, formatMeetingTime, nowMs } from '@/lib/dates';
import { mediaUrl } from '@/lib/env';
import { deleteMemberEvent } from '../../actions/events';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const m = await getCalendarItemBySlug(slug);
  return {
    title: m?.title ?? 'Event',
    description: m
      ? m.description
        ? m.description.slice(0, 160)
        : `${m.kind === 'group' ? 'Group meeting' : 'Member event'} on ${new Date(m.starts_at).toDateString()}.`
      : undefined,
  };
}

export default async function EventDetail({ params }: Props) {
  const { slug } = await params;
  const [m, viewer] = await Promise.all([getCalendarItemBySlug(slug), getViewer()]);
  if (!m) notFound();
  const member = isApproved(viewer);
  const canManage = m.kind === 'member' && member && (viewer?.userId === m.hostId || isAdmin(viewer));
  const start = new Date(m.starts_at);
  const end = new Date(m.ends_at);
  const cancelled = !!m.cancelledReason;
  const upcoming = end.getTime() > nowMs() && !cancelled;
  const image = mediaUrl('gallery', m.imagePath);
  const where = m.is_online ? (m.kind === 'group' ? (m.location ?? 'Online · Zoom') : 'Online') : (m.location ?? '');

  return (
    <>
      <JsonLd
        data={eventJsonLd({
          name: m.title,
          startsAt: m.starts_at,
          endsAt: m.ends_at,
          url: `${env.siteUrl}/events/${m.slug}`,
          online: m.is_online,
          location: m.location,
          description: m.description,
        })}
      />
      <PageHero
        crumb={m.kind === 'group' ? 'Meetings' : 'Member events'}
        title={m.title}
        lead={`${formatMeetingDate(start)} · ${formatMeetingTime(start)}–${formatMeetingTime(end)} PT · ${where}`}
      >
        {upcoming ? (
          <div className="card min-w-0 flex-[1_1_360px] p-5">
            <Countdown target={m.starts_at} />
          </div>
        ) : null}
      </PageHero>
      <section className="container-site flex flex-wrap gap-10 py-14">
        <div className="flex min-w-0 flex-[2_1_420px] flex-col gap-5 text-lg">
          {cancelled ? (
            <div role="status" className="bg-red-tint text-red rounded-2xl p-4 text-base font-semibold">
              This meeting is cancelled: {m.cancelledReason}. The schedule continues with the next meeting.
            </div>
          ) : null}
          {m.kind === 'member' ? (
            <p className="text-berry m-0 text-base font-semibold">
              Member event · hosted by{' '}
              {m.hostName && m.hostSlug ? <Link href={`/members/${m.hostSlug}`}>{m.hostName}</Link> : (m.hostName ?? `a ${site.shortName} member`)}
              <span className="text-ink-muted font-normal"> · {m.category}</span>
            </p>
          ) : null}
          {image ? (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl">
              <Image src={image} alt="" fill sizes="(min-width: 1024px) 700px, 100vw" className="object-cover" />
            </div>
          ) : null}
          {m.description ? <p className="m-0 whitespace-pre-line">{m.description}</p> : null}
          {m.kind === 'member' && !m.is_online && m.location ? (
            <p className="m-0">
              <strong>Address:</strong> {m.location}
            </p>
          ) : null}
          {m.regular ? (
            <div className="flex flex-col gap-3">
              <h2 className="h3">Presentations</h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {(['education', 'presentation'] as const).map((slot, i) => {
                  const s = speakerFor(m, slot);
                  return (
                    <li key={slot} className="card flex flex-col gap-2 p-4">
                      <div className="text-teal-text text-[13px] font-bold tracking-[0.08em] uppercase">{slotTitles[slot]}</div>
                      <p className="text-ink-soft m-0 text-[15px]">{slotDescriptions[slot]}</p>
                      {s ? (
                        <div className="flex items-center gap-3">
                          <Avatar name={s.display_name} size={44} index={i} />
                          <div>
                            <div className="font-semibold">{s.display_name}</div>
                            {s.business ? <div className="text-ink-muted text-[15px]">{s.business}</div> : null}
                            {s.topic ? <div className="text-[15px] italic">“{s.topic}”</div> : null}
                          </div>
                        </div>
                      ) : (
                        <p className="text-ink-muted m-0 text-[15px]">{cancelled ? 'No presentation (meeting cancelled).' : 'Speaker to be announced.'}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-3">
          {m.kind === 'group' && m.is_online && upcoming ? (
            <Link className="btn btn-primary" href={member ? '/meetings' : '/login?next=/meetings'}>
              {member ? 'Join on Zoom' : 'Members: log in to join'}
            </Link>
          ) : null}
          {m.kind === 'member' && m.is_online && m.onlineUrl && upcoming ? (
            <a className="btn btn-primary" href={m.onlineUrl} target="_blank" rel="noopener noreferrer nofollow">
              Join online
            </a>
          ) : null}
          {upcoming ? (
            <a className="btn btn-outline" href={`/events/${m.slug}/calendar.ics`}>
              Add to calendar
            </a>
          ) : null}
          {!member && upcoming && m.kind === 'group' ? (
            <Link className="btn btn-outline" href="/visit#request">
              Request a guest invite
            </Link>
          ) : null}
          {canManage ? (
            <div className="border-line mt-2 flex flex-col gap-2 border-t pt-4">
              <Link className="btn btn-outline" href={`/events/${m.slug}/edit`}>
                Edit event
              </Link>
              <ConfirmDelete action={deleteMemberEvent} id={m.id} what="event" />
            </div>
          ) : null}
          <Link href={listPathFor(m.kind)} className="mt-2 text-[15px] font-bold">
            {m.kind === 'group' ? '← All meetings' : '← All member events'}
          </Link>
        </aside>
      </section>
    </>
  );
}
