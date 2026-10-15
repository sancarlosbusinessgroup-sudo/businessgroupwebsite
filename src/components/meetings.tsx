import Link from 'next/link';
import type { MeetingWithSpeakers } from '@/lib/data/public';
import { formatDayMonth, formatMeetingDate, formatMeetingTime } from '@/lib/dates';
import { Avatar, DateBadge } from './ui';
import { Countdown } from './Countdown';

export function speakerFor(m: MeetingWithSpeakers, slot: 'education' | 'presentation') {
  return m.meeting_speakers.find((s) => s.slot === slot) ?? null;
}

/** Dark "next meeting" card used on Home and the member dashboard. */
export function NextMeetingCard({ meeting, member }: { meeting: MeetingWithSpeakers | null; member: boolean }) {
  if (!meeting) {
    return (
      <div className="bg-band text-on-band flex flex-col gap-3 rounded-[20px] p-7">
        <p className="eyebrow text-sky m-0">Next meeting</p>
        <p className="font-display m-0 text-xl font-bold">The next meeting date will be posted soon.</p>
      </div>
    );
  }
  const start = new Date(meeting.starts_at);
  const edu = speakerFor(meeting, 'education');
  const main = speakerFor(meeting, 'presentation');
  return (
    <section aria-labelledby="next-meeting-title" className="bg-band text-on-band flex flex-col gap-5 rounded-[20px] p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-sky m-0 text-[13px] font-bold tracking-[0.12em] uppercase">Next meeting starts in</p>
        {meeting.is_online ? <span className="pill bg-green text-on-teal">On Zoom</span> : null}
      </div>
      <Countdown target={meeting.starts_at} tone="dark" />
      <div className="border-band-line flex flex-col gap-1 border-t pt-4">
        <h2 id="next-meeting-title" className="font-display text-on-band m-0 text-xl font-bold">
          {formatMeetingDate(start)} · {formatMeetingTime(start)} PT
        </h2>
        <p className="text-on-band-muted m-0 text-base">{meeting.title}</p>
      </div>
      {edu || main ? (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
          {[
            { s: edu, label: '5-min educator' },
            { s: main, label: 'Main presenter' },
          ].map(({ s, label }, i) =>
            s ? (
              <li key={label} className="bg-band-2 flex items-center gap-3 rounded-xl p-3.5">
                <Avatar name={s.display_name} size={44} index={i} />
                <div className="min-w-0">
                  <div className="text-sky text-xs font-bold tracking-[0.08em] uppercase">{label}</div>
                  <div className="text-base font-semibold">{s.display_name}</div>
                  {s.business ? <div className="text-on-band-muted text-[13px]">{s.business}</div> : null}
                </div>
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2.5">
        <Link className="btn btn-light" href={member ? '/meetings' : '/login?next=/meetings'}>
          {member ? 'Join on Zoom' : 'Members: log in to join'}
        </Link>
        <a className="btn btn-ghost-band" href={`/events/${meeting.slug}/calendar.ics`}>
          Add to calendar
        </a>
      </div>
    </section>
  );
}

export function EventCard({ meeting, member }: { meeting: MeetingWithSpeakers; member: boolean }) {
  const start = new Date(meeting.starts_at);
  const end = new Date(meeting.ends_at);
  const d = formatDayMonth(start);
  return (
    <article className="card flex flex-wrap overflow-hidden">
      <div className={`flex flex-[0_0_150px] items-center justify-center p-5 ${meeting.is_online ? 'bg-teal-tint' : 'bg-amber-tint'}`}>
        <DateBadge day={d.day} month={d.month} sub={d.weekday} size="lg" />
      </div>
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2 px-[22px] py-5">
        <div className="text-ink-muted flex flex-wrap items-center gap-2 text-sm">
          <span className="pill bg-green-tint text-green-ink">{meeting.category}</span>
          <span>
            {formatMeetingTime(start)}–{formatMeetingTime(end)}
          </span>
          <span aria-hidden="true">·</span>
          <span>{meeting.location ?? (meeting.is_online ? 'Online · Zoom' : '')}</span>
        </div>
        <h3 className="font-display text-heading m-0 text-[21px] leading-tight font-bold">
          <Link href={`/events/${meeting.slug}`} className="text-heading no-underline hover:underline">
            {meeting.title}
          </Link>
        </h3>
        {meeting.description ? <p className="text-ink-soft m-0 text-base">{meeting.description}</p> : null}
        <div className="mt-1.5 flex flex-wrap gap-2.5">
          {meeting.is_online ? (
            <Link className="btn btn-primary btn-sm" href={member ? '/meetings' : '/login?next=/meetings'}>
              {member ? 'Join on Zoom' : 'Join · members'}
            </Link>
          ) : null}
          <a className="btn btn-outline btn-sm" href={`/events/${meeting.slug}/calendar.ics`}>
            Add to calendar
          </a>
          <Link className="btn btn-sm text-teal-text" href={`/events/${meeting.slug}`}>
            View details<span className="sr-only"> for {meeting.title}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
