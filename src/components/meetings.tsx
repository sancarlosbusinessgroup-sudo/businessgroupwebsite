import Link from 'next/link';
import { slotLabels, site } from '@/lib/content';
import type { CalendarItem } from '@/lib/data/events';
import type { MeetingWithSpeakers, Speaker } from '@/lib/data/public';
import { calendarEventFor } from '@/lib/calendar-links';
import { formatDayMonth, formatMeetingDate, formatMeetingTime } from '@/lib/dates';
import { env, mediaUrl } from '@/lib/env';
import { AddToCalendar } from './AddToCalendar';
import { Avatar, DateBadge } from './ui';
import { Countdown } from './Countdown';

export function speakerFor(m: MeetingWithSpeakers | { speakers: Speaker[] }, slot: 'education' | 'presentation') {
  const list = 'meeting_speakers' in m ? m.meeting_speakers : m.speakers;
  return list.find((s) => s.slot === slot) ?? null;
}

/**
 * "Next meeting" card. Dark on the member dashboard; on Home (variant "glass") it is a white panel that fades slightly
 * transparent so the bridge photo shows through.
 */
export function NextMeetingCard({ meeting, member, variant = 'dark' }: { meeting: MeetingWithSpeakers | null; member: boolean; variant?: 'dark' | 'glass' }) {
  const glass = variant === 'glass';
  const shell = glass
    ? 'on-white border border-white/60 bg-linear-to-br from-white/95 via-white/90 to-white/80 shadow-xl backdrop-blur-[2px]'
    : 'bg-band text-on-band';
  const t = glass
    ? {
        eyebrow: 'text-teal-text',
        title: 'text-heading',
        sub: 'text-ink-soft',
        line: 'border-line',
        item: 'border border-line bg-white/75',
        label: 'text-teal-text',
        name: 'text-heading',
        biz: 'text-ink-soft',
        topic: 'text-ink',
        primary: 'btn btn-primary',
        secondary: 'btn btn-outline',
      }
    : {
        eyebrow: 'text-sky',
        title: 'text-on-band',
        sub: 'text-on-band-muted',
        line: 'border-band-line',
        item: 'bg-band-2',
        label: 'text-sky',
        name: '',
        biz: 'text-on-band-muted',
        topic: 'text-on-band',
        primary: 'btn btn-light',
        secondary: 'btn btn-ghost-band',
      };
  if (!meeting) {
    return (
      <div className={`flex flex-col gap-3 rounded-[20px] p-7 ${shell}`}>
        <p className={`eyebrow m-0 ${t.eyebrow}`}>Next meeting</p>
        <p className={`font-display m-0 text-xl font-bold ${t.title}`}>The next meeting date will be posted soon.</p>
      </div>
    );
  }
  const start = new Date(meeting.starts_at);
  const edu = speakerFor(meeting, 'education');
  const main = speakerFor(meeting, 'presentation');
  return (
    <section aria-labelledby="next-meeting-title" className={`flex flex-col gap-5 rounded-[20px] p-7 ${shell}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`font-display m-0 text-[13px] font-bold tracking-[0.12em] uppercase ${t.eyebrow}`}>Next meeting starts in</p>
        {meeting.is_online ? <span className="pill bg-green text-on-teal">On Zoom</span> : null}
      </div>
      <Countdown target={meeting.starts_at} tone={glass ? 'light' : 'dark'} />
      <div className={`flex flex-col gap-1 border-t pt-4 ${t.line}`}>
        <h2 id="next-meeting-title" className={`font-display m-0 text-xl font-bold ${t.title}`}>
          {formatMeetingDate(start)} · {formatMeetingTime(start)} PT
        </h2>
        <p className={`m-0 text-base ${t.sub}`}>{meeting.title}</p>
      </div>
      {edu || main ? (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
          {[
            { s: edu, label: slotLabels.education },
            { s: main, label: slotLabels.presentation },
          ].map(({ s, label }, i) =>
            s ? (
              <li key={label} className={`flex items-center gap-3 rounded-xl p-3.5 ${t.item}`}>
                <Avatar name={s.display_name} size={44} index={i} photo={mediaUrl('profile-media', s.profile?.avatar_path)} />
                <div className="min-w-0">
                  <div className={`text-xs font-bold tracking-[0.08em] uppercase ${t.label}`}>{label}</div>
                  <div className={`text-base font-semibold ${t.name}`}>{s.display_name}</div>
                  {s.business ? <div className={`text-[13px] ${t.biz}`}>{s.business}</div> : null}
                  {s.topic ? <div className={`mt-0.5 text-[13px] italic ${t.topic}`}>“{s.topic}”</div> : null}
                </div>
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2.5">
        <Link className={t.primary} href={member ? '/meetings' : '/login?next=/meetings'}>
          {member ? 'Join on Zoom' : 'Members: log in to join'}
        </Link>
        <AddToCalendar
          event={calendarEventFor({ ...meeting, kind: 'group', cancelledReason: meeting.cancelled_reason }, env.siteUrl)}
          icsHref={`/events/${meeting.slug}/calendar.ics`}
          buttonClass={t.secondary}
        />
      </div>
    </section>
  );
}

export function EventCard({ item, member }: { item: CalendarItem; member: boolean }) {
  const start = new Date(item.starts_at);
  const end = new Date(item.ends_at);
  const d = formatDayMonth(start);
  const where = item.is_online ? (item.kind === 'group' ? (item.location ?? 'Online · Zoom') : 'Online') : (item.location ?? '');
  return (
    <article className="card flex flex-wrap overflow-hidden">
      <div className={`flex flex-[0_0_150px] items-center justify-center p-5 ${item.is_online ? 'bg-teal-tint' : 'bg-amber-tint'}`}>
        <DateBadge day={d.day} month={d.month} sub={d.weekday} size="lg" />
      </div>
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2 px-[22px] py-5">
        <div className="text-ink-muted flex flex-wrap items-center gap-2 text-sm">
          <span className="pill bg-green-tint text-green-ink">{item.category}</span>
          {item.cancelledReason ? <span className="pill bg-red-tint text-red">Cancelled</span> : null}
          {item.visibility === 'members' ? <span className="pill bg-amber-tint text-amber">Members only</span> : null}
          <span>
            {formatMeetingTime(start)}–{formatMeetingTime(end)}
          </span>
          <span aria-hidden="true">·</span>
          <span>{where}</span>
        </div>
        {item.kind === 'member' ? (
          <p className="text-berry m-0 text-sm font-semibold">Member event · hosted by {item.hostName ?? `a ${site.shortName} member`}</p>
        ) : null}
        <h3 className="font-display text-heading m-0 text-[21px] leading-tight font-bold">
          <Link
            href={`/events/${item.slug}`}
            className={`text-heading no-underline hover:underline ${item.cancelledReason ? 'decoration-red line-through' : ''}`}
          >
            {item.title}
          </Link>
        </h3>
        {item.cancelledReason ? (
          <p className="text-red m-0 text-base font-semibold">No meeting this week: {item.cancelledReason}.</p>
        ) : item.description ? (
          <p className="text-ink-soft m-0 line-clamp-3 text-base">{item.description}</p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap gap-2.5">
          {item.kind === 'group' && item.is_online && !item.cancelledReason ? (
            <Link className="btn btn-primary btn-sm" href={member ? '/meetings' : '/login?next=/meetings'}>
              {member ? 'Join on Zoom' : 'Join · members'}
            </Link>
          ) : null}
          <AddToCalendar
            event={calendarEventFor(item, env.siteUrl)}
            icsHref={`/events/${item.slug}/calendar.ics`}
            buttonClass="btn btn-outline btn-sm"
            srSuffix={` for ${item.title}`}
          />
          <Link className="btn btn-sm text-teal-text" href={`/events/${item.slug}`}>
            View details<span className="sr-only"> for {item.title}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
