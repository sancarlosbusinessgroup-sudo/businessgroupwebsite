import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { EmptyState, Notice, Pill } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { slotTitles } from '@/lib/content';
import { formatMeetingDate, formatMeetingTime, isoToPacificLocal } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { MeetingCancelForm } from '../MeetingCancelForm';
import { MeetingHideForm } from '../MeetingHideForm';
import { AddYearButton } from './AddYearButton';
import { MeetingForm } from './MeetingForms';

export const metadata: Metadata = { title: 'Meetings' };

/** Admin → Meetings: the schedule, each meeting's presenters, and a form to add a meeting (owner, 2026-10-27). */
export default async function AdminMeetingsPage({ searchParams }: { searchParams: Promise<{ deleted?: string; past?: string }> }) {
  const { deleted, past } = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const now = new Date();
  const showPast = past === '1';
  let q = supabase
    .from('meetings')
    .select('id, slug, title, starts_at, ends_at, cancelled_reason, hidden, meeting_speakers(slot, display_name), meeting_links(join_url)')
    .order('starts_at', { ascending: !showPast });
  q = showPast ? q.lt('ends_at', now.toISOString()).limit(40) : q.gt('ends_at', now.toISOString()).limit(120);
  const { data: meetings, error } = await q;
  if (error) throw new Error('Could not load meetings');

  // Default for the "add" form: the Monday after the last scheduled meeting, same times.
  const last = showPast ? null : meetings.at(-1);
  const nextStart = last ? new Date(Date.parse(last.starts_at) + 7 * 86400000) : new Date(now.getTime() + 7 * 86400000);
  const nextEnd = last ? new Date(Date.parse(last.ends_at) + 7 * 86400000) : new Date(nextStart.getTime() + 60 * 60000);

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Meetings</h1>
        <AdminNav current="/admin/meetings" />
        {deleted ? <Notice tone="success">Meeting removed.</Notice> : null}
        <HowThisWorks tab="/admin/meetings">
          Open a meeting to change its date, time or Zoom link, and to revoke or assign the 5- and 10-minute presentation slots. Cancel a meeting for a holiday
          (it stays on the schedule, marked cancelled) or hide one from the website; cancelled and hidden meetings are not shown anywhere on the site (lists,
          countdown, slides, reminder emails) and stay here so you can restore or show them again.
        </HowThisWorks>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/meetings" className={`btn btn-sm ${showPast ? 'btn-outline' : 'btn-primary'}`} aria-current={showPast ? undefined : 'page'}>
            Upcoming
          </Link>
          <Link href="/admin/meetings?past=1" className={`btn btn-sm ${showPast ? 'btn-primary' : 'btn-outline'}`} aria-current={showPast ? 'page' : undefined}>
            Past
          </Link>
        </div>
        <div className="flex flex-wrap items-start gap-5">
          <section className="card flex min-w-0 flex-[3_1_560px] flex-col gap-3.5 p-[22px]" aria-labelledby="list-h">
            <h2 id="list-h" className="h3">
              {showPast ? 'Past meetings' : 'Upcoming meetings'} ({meetings.length})
            </h2>
            {meetings.length === 0 ? (
              <EmptyState title="Nothing scheduled">Add a meeting with the form.</EmptyState>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {meetings.map((m) => {
                  const d = new Date(m.starts_at);
                  const by = (slot: keyof typeof slotTitles) => m.meeting_speakers.find((s) => s.slot === slot)?.display_name;
                  const link = Array.isArray(m.meeting_links) ? m.meeting_links[0] : m.meeting_links;
                  return (
                    <li key={m.id} className="border-line flex flex-col gap-3 rounded-xl border p-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="font-bold">
                          {formatMeetingDate(d)}, {formatMeetingTime(d)}
                          {m.cancelled_reason ? (
                            <span className="ml-2">
                              <Pill tone="red">Cancelled</Pill>
                            </span>
                          ) : null}
                          {m.hidden ? (
                            <span className="ml-2">
                              <Pill tone="amber">Hidden</Pill>
                            </span>
                          ) : null}
                          {!link ? (
                            <span className="ml-2">
                              <Pill tone="gray">No Zoom link</Pill>
                            </span>
                          ) : null}
                        </span>
                        <span className="text-ink-muted text-sm">{m.title}</span>
                        <span className="text-ink-muted text-sm">
                          5-min: {by('education') ?? <em>open</em>} · 10-min: {by('presentation') ?? <em>open</em>}
                        </span>
                      </div>
                      <div className="border-line flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-t pt-3">
                        {!showPast ? <MeetingCancelForm id={m.id} label={m.title} reason={m.cancelled_reason} /> : <span />}
                        <div className="flex flex-wrap items-start gap-2">
                          {!showPast ? <MeetingHideForm id={m.id} label={m.title} hidden={m.hidden} /> : null}
                          <Link href={`/admin/meetings/${m.id}`} className="btn btn-outline btn-sm">
                            Edit<span className="sr-only"> meeting on {formatMeetingDate(d)}</span>
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <div className="flex min-w-0 flex-[2_1_360px] flex-col gap-5">
            <section className="card flex flex-col gap-3 p-[22px]" aria-labelledby="year-h">
              <h2 id="year-h" className="h3">
                Keep a year scheduled
              </h2>
              <p className="text-ink-muted m-0 text-sm">
                Adds a meeting every other Monday after the last one on the schedule, until twelve months from today. Same time, title and location as the last
                meeting; dates that already exist are skipped. Add Zoom links afterwards.
              </p>
              <AddYearButton />
            </section>
            <MeetingForm
              heading="Add a meeting"
              defaults={{
                title: last?.title.replace(/:.*$/, '') ?? 'Bay Area Referral Partners Meeting',
                description: '',
                startsAt: isoToPacificLocal(nextStart.toISOString()),
                endsAt: isoToPacificLocal(nextEnd.toISOString()),
                location: 'Online · Zoom',
                isOnline: true,
                joinUrl: '',
                passcode: '',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
