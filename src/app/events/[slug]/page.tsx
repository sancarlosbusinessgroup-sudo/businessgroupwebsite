import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Countdown } from '@/components/Countdown';
import { speakerFor } from '@/components/meetings';
import { Avatar, PageHero } from '@/components/ui';
import { getViewer, isApproved } from '@/lib/auth';
import { getMeetingBySlug } from '@/lib/data/public';
import { formatMeetingDate, formatMeetingTime, nowMs } from '@/lib/dates';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const m = await getMeetingBySlug(slug);
  return { title: m?.title ?? 'Event' };
}

export default async function EventDetail({ params }: Props) {
  const { slug } = await params;
  const [m, viewer] = await Promise.all([getMeetingBySlug(slug), getViewer()]);
  if (!m) notFound();
  const member = isApproved(viewer);
  const start = new Date(m.starts_at);
  const end = new Date(m.ends_at);
  const upcoming = end.getTime() > nowMs();

  return (
    <>
      <PageHero
        crumb="Events"
        title={m.title}
        lead={`${formatMeetingDate(start)} · ${formatMeetingTime(start)}–${formatMeetingTime(end)} PT · ${m.location ?? ''}`}
      >
        {upcoming ? (
          <div className="card min-w-0 flex-[1_1_360px] p-5">
            <Countdown target={m.starts_at} />
          </div>
        ) : null}
      </PageHero>
      <section className="container-site flex flex-wrap gap-10 py-14">
        <div className="flex min-w-0 flex-[2_1_420px] flex-col gap-5 text-lg">
          {m.description ? <p className="m-0">{m.description}</p> : null}
          {m.meeting_speakers.length ? (
            <div className="flex flex-col gap-3">
              <h2 className="h3">Speakers</h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {(['education', 'presentation'] as const).map((slot, i) => {
                  const s = speakerFor(m, slot);
                  return s ? (
                    <li key={slot} className="card flex items-center gap-3 p-4">
                      <Avatar name={s.display_name} size={44} index={i} />
                      <div>
                        <div className="text-ink-muted text-[13px] font-bold tracking-[0.08em] uppercase">
                          {slot === 'education' ? '5-minute education' : '10-minute presentation'}
                        </div>
                        <div className="font-semibold">{s.display_name}</div>
                        {s.business ? <div className="text-ink-muted text-[15px]">{s.business}</div> : null}
                      </div>
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          ) : null}
        </div>
        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-3">
          {m.is_online && upcoming ? (
            <Link className="btn btn-primary" href={member ? '/meetings' : '/login?next=/meetings'}>
              {member ? 'Join on Zoom' : 'Members: log in to join'}
            </Link>
          ) : null}
          {upcoming ? (
            <a className="btn btn-outline" href={`/events/${m.slug}/calendar.ics`}>
              Add to calendar
            </a>
          ) : null}
          {!member && upcoming ? (
            <Link className="btn btn-outline" href="/visit#request">
              Request a guest invite
            </Link>
          ) : null}
          <Link href="/events" className="mt-2 text-[15px] font-bold">
            ← All events
          </Link>
        </aside>
      </section>
    </>
  );
}
