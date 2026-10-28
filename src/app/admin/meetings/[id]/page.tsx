import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { EmptyState, Notice, Pill } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { slotDescriptions, slotTitles } from '@/lib/content';
import { formatMeetingDate, formatMeetingTime, isoToPacificLocal } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { adminDeleteMeeting, adminRevokeSlot, adminSetRsvp } from '../../../actions/admin-edit';
import { MeetingCancelForm } from '../../MeetingCancelForm';
import { MeetingHideForm } from '../../MeetingHideForm';
import { AssignSlotForm, MeetingForm, SlotTopicForm } from '../MeetingForms';

export const metadata: Metadata = { title: 'Edit meeting' };

const slots = ['education', 'presentation'] as const;

/** Admin → Meetings → one meeting: details, Zoom link, presentation slots and RSVPs (owner, 2026-10-27). */
export default async function AdminMeetingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const [{ id }, { added }] = await Promise.all([params, searchParams]);
  await requireAdmin();
  const supabase = await createClient();
  const [mRes, linkRes, membersRes, rsvpRes] = await Promise.all([
    supabase.from('meetings').select('*, meeting_speakers(slot, display_name, business, profile_id, topic, topic_description)').eq('id', id).maybeSingle(),
    supabase.from('meeting_links').select('join_url, passcode').eq('meeting_id', id).maybeSingle(),
    supabase.from('profiles').select('id, first_name, last_name, business_name').eq('status', 'approved').order('first_name').order('last_name'),
    supabase.from('rsvps').select('profile_id, attending, profile:profiles(first_name, last_name)').eq('meeting_id', id).order('created_at'),
  ]);
  const m = mRes.data;
  if (!m) notFound();
  const members = (membersRes.data ?? []).map((p) => ({ id: p.id, label: `${p.first_name} ${p.last_name} · ${p.business_name}` }));
  const d = new Date(m.starts_at);
  const rsvps = rsvpRes.data ?? [];
  const rsvpIds = new Set(rsvps.map((r) => r.profile_id));

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <div>
          <Link href="/admin/meetings" className="text-sm font-bold">
            ← All meetings
          </Link>
          <h1 className="font-display m-0 mt-3 flex flex-wrap items-center gap-3 text-[clamp(28px,3.4vw,40px)] font-extrabold">
            {formatMeetingDate(d)}, {formatMeetingTime(d)}
            {m.cancelled_reason ? <Pill tone="red">Cancelled: {m.cancelled_reason}</Pill> : null}
          </h1>
          <p className="text-ink-muted m-0 mt-1">
            {m.title} · <Link href={`/events/${m.slug}`}>public page</Link>
          </p>
        </div>
        <AdminNav current="/admin/meetings" />
        {added ? <Notice tone="success">Meeting added. It is on the schedule now.</Notice> : null}
        <div className="card flex flex-wrap items-center gap-4 p-4">
          <MeetingCancelForm id={m.id} label={m.title} reason={m.cancelled_reason} />
          <MeetingHideForm id={m.id} label={m.title} hidden={m.hidden} />
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-5">
            <MeetingForm
              heading="Details"
              defaults={{
                id: m.id,
                title: m.title,
                description: m.description ?? '',
                startsAt: isoToPacificLocal(m.starts_at),
                endsAt: isoToPacificLocal(m.ends_at),
                location: m.location ?? '',
                isOnline: m.is_online,
                joinUrl: linkRes.data?.join_url ?? '',
                passcode: linkRes.data?.passcode ?? '',
              }}
            />
            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="rsvp-h">
              <h2 id="rsvp-h" className="h3">
                RSVPs ({rsvps.filter((r) => r.attending).length} coming)
              </h2>
              {rsvps.length === 0 ? (
                <EmptyState title="No RSVPs yet" />
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {rsvps.map((r) => (
                    <li key={r.profile_id} className="border-line flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2">
                      <span className="text-sm">
                        <span className="font-bold">
                          {r.profile?.first_name} {r.profile?.last_name}
                        </span>{' '}
                        <Pill tone={r.attending ? 'green' : 'gray'}>{r.attending ? 'Coming' : 'Not coming'}</Pill>
                      </span>
                      <span className="flex gap-2">
                        <form action={adminSetRsvp}>
                          <input type="hidden" name="meetingId" value={m.id} />
                          <input type="hidden" name="profileId" value={r.profile_id} />
                          <input type="hidden" name="value" value={r.attending ? 'no' : 'yes'} />
                          <button type="submit" className="btn btn-outline btn-sm">
                            Mark {r.attending ? 'not coming' : 'coming'}
                          </button>
                        </form>
                        <form action={adminSetRsvp}>
                          <input type="hidden" name="meetingId" value={m.id} />
                          <input type="hidden" name="profileId" value={r.profile_id} />
                          <input type="hidden" name="value" value="none" />
                          <button type="submit" className="btn btn-outline btn-sm text-red">
                            Remove
                          </button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <form action={adminSetRsvp} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="meetingId" value={m.id} />
                <input type="hidden" name="value" value="yes" />
                <div className="min-w-[240px] flex-1">
                  <label className="label" htmlFor="rsvp-add">
                    Add an RSVP for
                  </label>
                  <select id="rsvp-add" name="profileId" className="field" defaultValue="">
                    <option value="">Choose a member</option>
                    {members
                      .filter((p) => !rsvpIds.has(p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-outline btn-sm">
                  Add
                </button>
              </form>
            </section>
          </div>

          <div className="flex min-w-0 flex-[2_1_360px] flex-col gap-5">
            {slots.map((slot) => {
              const s = m.meeting_speakers.find((x) => x.slot === slot);
              return (
                <section key={slot} className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby={`slot-${slot}-h`}>
                  <h2 id={`slot-${slot}-h`} className="h3">
                    {slotTitles[slot]}
                  </h2>
                  <p className="text-ink-muted m-0 text-sm">{slotDescriptions[slot]}</p>
                  {s ? (
                    <>
                      <p className="m-0">
                        <span className="font-bold">{s.display_name}</span>
                        {s.business ? <span className="text-ink-muted"> · {s.business}</span> : null}
                        {!s.profile_id ? <span className="text-ink-muted"> · no linked account</span> : null}
                      </p>
                      <SlotTopicForm meetingId={m.id} slot={slot} topic={s.topic} description={s.topic_description} />
                      <form action={adminRevokeSlot}>
                        <input type="hidden" name="meetingId" value={m.id} />
                        <input type="hidden" name="slot" value={slot} />
                        <button type="submit" className="btn btn-outline btn-sm text-red">
                          Revoke this slot<span className="sr-only"> from {s.display_name}</span>
                        </button>
                      </form>
                      <p className="text-ink-muted m-0 text-sm">The member is emailed when their slot is revoked or reassigned.</p>
                    </>
                  ) : (
                    <p className="m-0">
                      <Pill tone="amber">Open</Pill>
                    </p>
                  )}
                  <AssignSlotForm meetingId={m.id} slot={slot} members={members} current={s?.display_name ?? null} />
                </section>
              );
            })}
            <section className="card flex flex-col gap-3 p-[22px]" aria-labelledby="danger-h">
              <h2 id="danger-h" className="h3">
                Remove this meeting
              </h2>
              <p className="text-ink-muted m-0 text-sm">
                Takes it off the schedule for good, including its RSVPs, attendance and presentation slots. To keep it listed as cancelled, use the Overview
                instead.
              </p>
              <ConfirmDelete action={adminDeleteMeeting} id={m.id} what={`meeting on ${formatMeetingDate(d)}`} className="self-start" />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
