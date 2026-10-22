import Link from 'next/link';
import type { Metadata } from 'next';
import { DateBadge, EmptyState, Notice, Pill, StatTile } from '@/components/ui';
import { speakerFor } from '@/components/meetings';
import { requireMember } from '@/lib/auth';
import { attendanceHistory } from '@/lib/attendance';
import { absencesFor, memberSince } from '@/lib/data/attendance';
import { ABSENCE_LIMIT, lateEarly } from '@/lib/zoom';
import { getUpcomingMeetings } from '@/lib/data/public';
import { formatDayMonth, formatMeetingDate, formatMeetingTime, formatShortDate, inCheckInWindow, nowMs } from '@/lib/dates';
import { attendancePct } from '@/lib/stats';
import { createClient } from '@/lib/supabase/server';
import { joinMeeting, releaseSpeakerSlot } from '../actions/member';
import { ClaimSlotForm } from './ClaimSlotForm';
import { slotDescriptions, slotShort, slotTitles } from '@/lib/content';
import { CorrectionForm } from './CorrectionForm';
import { RsvpSelect } from './RsvpSelect';

export const metadata: Metadata = { title: 'Meetings & attendance' };

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const viewer = await requireMember('/meetings');
  const me = viewer.profile;
  const supabase = await createClient();
  const since = new Date(Math.max(Date.parse(me.approved_at ?? me.created_at), nowMs() - 365 * 86400000)).toISOString();

  const [upcoming, rsvpRes, pastRes, attRes, spokeRes] = await Promise.all([
    getUpcomingMeetings(6),
    supabase.from('rsvps').select('meeting_id, attending').eq('profile_id', me.id),
    supabase
      .from('meetings')
      .select('id, starts_at, ends_at')
      .eq('category', 'Networking')
      .lt('ends_at', new Date().toISOString())
      .gte('starts_at', since)
      .order('starts_at', { ascending: false }),
    supabase.from('attendance').select('meeting_id, status, checked_in_at, method, zoom, substitute, joined_at, left_at, minutes').eq('profile_id', me.id),
    supabase
      .from('meeting_speakers')
      .select('slot, meetings!inner(starts_at)')
      .eq('profile_id', me.id)
      .lt('meetings.starts_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  if (pastRes.error || attRes.error || rsvpRes.error) throw new Error('Could not load your meetings');

  const rsvp = new Map((rsvpRes.data ?? []).map((r) => [r.meeting_id, r.attending ? ('yes' as const) : ('no' as const)]));
  const history = attendanceHistory(pastRes.data ?? [], attRes.data ?? []);
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const thisYear = history.items.filter((i) => i.meeting.starts_at >= yearStart && i.status === 'present').length;
  const lastSpoke = spokeRes.data?.[0];
  const detail = new Map((attRes.data ?? []).map((a) => [a.meeting_id, a]));
  const missed = (await absencesFor(supabase, [{ id: me.id, since: memberSince(me) }])).get(me.id);
  const now = new Date();

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Meetings &amp; attendance</h1>
            <p className="text-ink-muted m-0 mt-1">
              RSVP, join on Zoom, and see your attendance record. Joining from this page during a meeting checks you in.
            </p>
          </div>
          <a className="btn btn-outline btn-sm" href="/calendar.ics">
            Subscribe (Google / Outlook / iCal)
          </a>
        </div>

        {sp.error === 'join' ? <Notice tone="error">We couldn&apos;t open that meeting link. Please try again or contact an admin.</Notice> : null}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
          <StatTile
            label="Attendance · 12 months"
            value={attendancePct(history.present, history.held)}
            sub={`${history.present} of ${history.held} meetings`}
          />
          <StatTile label="Current streak" value={String(history.streak)} sub="meetings in a row" />
          <StatTile
            label="Missed · 6 months"
            value={`${missed?.missed ?? 0} of ${ABSENCE_LIMIT}`}
            sub={missed?.atLimit ? 'You have reached the limit' : 'allowed by the Bylaws'}
          />
          <StatTile label="Attended this year" value={String(thisYear)} sub="Monday meetings" />
          <StatTile
            label="Last spoke"
            value={lastSpoke ? formatShortDate(new Date((lastSpoke.meetings as { starts_at: string }).starts_at)).replace(/, \d{4}$/, '') : '—'}
            sub={lastSpoke ? `${slotShort[lastSpoke.slot]} presentation` : 'Claim a slot below'}
          />
        </div>

        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="up-h">
          <h2 id="up-h" className="font-display m-0 text-[22px] font-extrabold">
            Upcoming meetings
          </h2>
          <dl className="text-ink-soft m-0 grid gap-x-6 gap-y-1 text-[15px] sm:grid-cols-2">
            {(['education', 'presentation'] as const).map((slot) => (
              <div key={slot}>
                <dt className="text-teal-text inline font-bold">{slotTitles[slot]}: </dt>
                <dd className="m-0 inline">{slotDescriptions[slot]}</dd>
              </div>
            ))}
          </dl>
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming meetings scheduled" />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
              {upcoming.map((m) => {
                const start = new Date(m.starts_at);
                const d = formatDayMonth(start);
                const live = inCheckInWindow(start, new Date(m.ends_at), now);
                const edu = speakerFor(m, 'education');
                const main = speakerFor(m, 'presentation');
                const cancelled = m.cancelled_reason;
                return (
                  <li key={m.id} className="border-line flex flex-wrap items-center gap-4 rounded-[14px] border p-4">
                    <DateBadge day={d.day} month={d.month} />
                    <div className="min-w-0 flex-[1_1_260px]">
                      <h3 className={`font-display m-0 text-base font-bold ${cancelled ? 'line-through' : ''}`}>{m.title}</h3>
                      {cancelled ? <p className="text-red m-0 text-sm font-semibold">Cancelled: {cancelled}</p> : null}
                      <p className="text-ink-muted m-0 text-sm">
                        {formatMeetingDate(start)} · {formatMeetingTime(start)} PT · {m.location}
                      </p>
                      {m.category === 'Networking' && !cancelled ? (
                        <ul className="text-ink-soft m-0 mt-1 list-none p-0 text-sm">
                          {[
                            { k: '5-minute', s: edu },
                            { k: '10-minute', s: main },
                          ].map(({ k, s }) => (
                            <li key={k}>
                              {k}: {s ? s.display_name : 'open'}
                              {s?.topic ? <em> · “{s.topic}”</em> : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className={`flex flex-wrap items-center gap-2 ${cancelled ? 'hidden' : ''}`}>
                      <RsvpSelect meetingId={m.id} meetingLabel={`${m.title}, ${formatMeetingDate(start)}`} value={rsvp.get(m.id) ?? ''} />
                      {m.category === 'Networking'
                        ? (['education', 'presentation'] as const).map((slot) => {
                            const s = speakerFor(m, slot);
                            if (s?.profile_id === me.id)
                              return (
                                <form key={slot} action={releaseSpeakerSlot}>
                                  <input type="hidden" name="meetingId" value={m.id} />
                                  <input type="hidden" name="slot" value={slot} />
                                  <button type="submit" className="btn btn-outline btn-sm">
                                    Release my {slotShort[slot]} slot
                                  </button>
                                </form>
                              );
                            return null;
                          })
                        : null}
                      {m.is_online ? (
                        <form action={joinMeeting}>
                          <input type="hidden" name="meetingId" value={m.id} />
                          <button type="submit" className={`btn btn-sm ${live ? 'btn-primary' : 'btn-outline'}`}>
                            {live ? 'Join now & check in' : 'Open Zoom link'}
                          </button>
                        </form>
                      ) : null}
                    </div>
                    {m.category === 'Networking' && !cancelled && start.getTime() > now.getTime()
                      ? (['education', 'presentation'] as const)
                          .filter((slot) => !speakerFor(m, slot))
                          .map((slot) => <ClaimSlotForm key={slot} meetingId={m.id} slot={slot} when={formatMeetingDate(start)} />)
                      : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-ink-muted m-0 text-sm">
            Meeting slides: <Link href="/present/next">open the slides for the next meeting</Link>.
          </p>
        </section>

        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="hist-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="hist-h" className="font-display m-0 text-[22px] font-extrabold">
              My attendance history
            </h2>
            <span className="text-ink-muted text-sm">Taken from the Zoom attendance report, or when you join from this site</span>
          </div>
          {history.items.length === 0 ? (
            <EmptyState title="No past meetings yet">Your history starts with your first meeting as a member.</EmptyState>
          ) : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="My attendance table">
              <table className="data-table">
                <caption className="sr-only">Attendance at past meetings</caption>
                <thead>
                  <tr>
                    <th scope="col">Meeting</th>
                    <th scope="col">On Zoom</th>
                    <th scope="col">How</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.items.slice(0, 12).map((i) => {
                    const a = detail.get(i.meeting.id);
                    const flags = a?.zoom ? lateEarly(i.meeting, a.joined_at, a.left_at) : { late: false, leftEarly: false };
                    const sub = !!a?.substitute;
                    return (
                      <tr key={i.meeting.id}>
                        <td>{formatMeetingDate(new Date(i.meeting.starts_at))}</td>
                        <td>
                          {a?.zoom && a.joined_at
                            ? `${formatMeetingTime(new Date(a.joined_at))}–${a.left_at ? formatMeetingTime(new Date(a.left_at)) : '?'} · ${a.minutes ?? 0} min`
                            : i.checkedInAt
                              ? formatMeetingTime(new Date(i.checkedInAt))
                              : '—'}
                          {flags.late ? (
                            <span className="ml-2">
                              <Pill tone="amber">Late</Pill>
                            </span>
                          ) : null}
                          {flags.leftEarly ? (
                            <span className="ml-2">
                              <Pill tone="amber">Left early</Pill>
                            </span>
                          ) : null}
                        </td>
                        <td>{a?.zoom ? 'Zoom report' : i.method === 'self' ? 'Joined from site' : i.method === 'admin' ? 'Marked by admin' : '—'}</td>
                        <td>
                          <Pill tone={sub ? 'teal' : i.status === 'present' ? 'green' : i.status === 'excused' ? 'amber' : 'red'}>
                            {sub ? 'Sent a substitute' : i.status === 'present' ? 'Present' : i.status === 'excused' ? 'Excused' : 'Absent'}
                          </Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <CorrectionForm meetings={history.items.slice(0, 12).map((i) => ({ id: i.meeting.id, label: formatMeetingDate(new Date(i.meeting.starts_at)) }))} />
        </section>
      </div>
    </div>
  );
}
