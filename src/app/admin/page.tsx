import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { EmptyState, Notice, Pill } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { getCategorySeats, getNextMeeting } from '@/lib/data/public';
import { formatMeetingDate, formatMeetingTime, formatShortDate } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { absencesFor, memberSince } from '@/lib/data/attendance';
import { ABSENCE_LIMIT, parseZoomMeetingId } from '@/lib/zoom';
import { zoomConfigured } from '@/lib/zoom-api';
import Link from 'next/link';
import { resolveCorrection } from '../actions/admin';
import { GuestSections } from './GuestSections';
import { ResendEmailButton } from './ResendEmailButton';
import { resendTarget } from '@/lib/email/resend-target';
import { NewsletterSyncForm } from './NewsletterSyncForm';
import { SeatForm } from './SeatForm';

export const metadata: Metadata = { title: 'Admin' };

const errors: Record<string, string> = {
  category_full: 'That category is full. Raise its seats under “Category seats” below, or ask the applicant to pick another category.',
  save: 'Something went wrong. Please try again.',
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string; zoomError?: string }> }) {
  const { error, zoomError } = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const [corrRes, seats, downloadsRes, onboardRes, mailRes] = await Promise.all([
    supabase
      .from('attendance_corrections')
      .select('id, note, created_at, profile:profiles!attendance_corrections_profile_id_fkey(first_name, last_name), meeting:meetings(starts_at)')
      .eq('resolved', false)
      .order('created_at'),
    getCategorySeats(),
    supabase
      .from('directory_downloads')
      .select('id, format, created_at, profile:profiles(first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('member_onboarding')
      .select('profile_id, invited_at, reminded_at, completed_at, profile:profiles(first_name, last_name)')
      .order('invited_at', { ascending: false })
      .limit(30),
    supabase
      .from('email_log')
      .select('id, kind, dedupe_key, recipient, subject, status, error, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
  ]);
  const next = await getNextMeeting();
  const { data: nextLink } = next ? await supabase.from('meeting_links').select('join_url').eq('meeting_id', next.id).maybeSingle() : { data: null };
  const nextZoomId = parseZoomMeetingId(nextLink?.join_url);
  const { data: approved } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, approved_at, member_since, created_at')
    .eq('status', 'approved');
  const absences = await absencesFor(
    supabase,
    (approved ?? []).map((p) => ({ id: p.id, since: memberSince(p) })),
  );
  const atLimit = (approved ?? []).filter((p) => absences.get(p.id)?.atLimit);
  if (corrRes.error || downloadsRes.error) throw new Error('Could not load admin data');

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Admin</h1>
        <AdminNav current="/admin" />
        <HowThisWorks tab="/admin" />
        {atLimit.length ? (
          <Notice tone="error">
            {atLimit.length === 1 ? '1 member has' : `${atLimit.length} members have`} reached the absence limit ({ABSENCE_LIMIT} missed meetings in 6 months):{' '}
            {atLimit.map((p) => `${p.first_name} ${p.last_name}`).join(', ')}. <Link href="/admin/attendance">Open attendance</Link>
          </Notice>
        ) : null}
        {error && errors[error] ? <Notice tone="error">{errors[error]}</Notice> : null}

        <section id="zoom" className="card flex flex-col gap-3 p-[22px]" aria-labelledby="zoom-h">
          <h2 id="zoom-h" className="font-display m-0 text-[22px] font-extrabold">
            Zoom
          </h2>
          {zoomError ? <Notice tone="error">{zoomError.slice(0, 300)}</Notice> : null}
          {next ? (
            <p className="m-0">
              Next meeting: <strong>{formatMeetingDate(new Date(next.starts_at))}</strong>, {formatMeetingTime(new Date(next.starts_at))}
              {nextZoomId ? ` · Zoom meeting ${nextZoomId.replace(/^(\d{3})(\d{4})(\d+)$/, '$1 $2 $3')}` : ' · no Zoom link saved'}
            </p>
          ) : (
            <p className="m-0">There is no upcoming meeting on the calendar.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {zoomConfigured() && next && nextZoomId ? (
              <a className="btn btn-primary" href="/admin/zoom/start">
                Start meeting as host
              </a>
            ) : (
              <span className="text-ink-muted text-sm">Starting the meeting from here needs the Zoom keys and a Zoom link on the next meeting.</span>
            )}
            <Link className="btn btn-outline btn-sm" href="/admin/attendance">
              Attendance
            </Link>
          </div>
          <p className="text-ink-muted m-0 text-sm">
            Opens Zoom as the host. Sign in to Zoom with the group’s account if asked. Only one person can be host: the first manager starts it, then makes the
            others co-hosts in Zoom (Participants → hover a name → More → Make co-host).
          </p>
        </section>

        <GuestSections back="/admin" />

        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="co-h">
          <h2 id="co-h" className="font-display m-0 text-[22px] font-extrabold">
            Attendance correction requests
          </h2>
          {corrRes.data.length === 0 ? (
            <EmptyState title="No open requests" />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {corrRes.data.map((c) => (
                <li key={c.id} className="border-line flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                  <div>
                    <strong>
                      {c.profile?.first_name} {c.profile?.last_name}
                    </strong>
                    {c.meeting ? ` · meeting ${formatShortDate(new Date(c.meeting.starts_at))}` : ''}
                    <p className="text-ink-soft m-0 text-[15px]">{c.note}</p>
                  </div>
                  <form action={resolveCorrection}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="btn btn-outline btn-sm">
                      Mark resolved
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <p className="text-ink-muted m-0 text-sm">To change an attendance record, edit the attendance table in the Supabase dashboard (see README).</p>
        </section>
        <section className="card flex flex-wrap items-center justify-between gap-3 p-[22px]" aria-labelledby="sched-h">
          <div>
            <h2 id="sched-h" className="font-display m-0 text-[22px] font-extrabold">
              Meeting schedule
            </h2>
            <p className="text-ink-muted m-0 text-[15px]">Cancel, hide, edit or add meetings, and manage presentation slots, on the Meetings page.</p>
          </div>
          <Link href="/admin/meetings" className="btn btn-outline">
            Manage meetings →
          </Link>
        </section>

        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="seats-h">
          <h2 id="seats-h" className="font-display m-0 text-[22px] font-extrabold">
            Category seats
          </h2>
          <p className="text-ink-muted m-0 text-[15px]">
            How many approved members each profession can have (usually 1). Full categories are shown as closed on the Visit and Join pages.
          </p>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-x-6 gap-y-1 p-0">
            {seats.map((c) => (
              <li key={c.id} className="border-line-soft flex flex-wrap items-center justify-between gap-2 border-t py-2">
                <span className="font-semibold">
                  {c.name}
                  {!c.open ? <span className="text-ink-muted text-sm font-normal"> · full</span> : null}
                </span>
                <SeatForm id={c.id} name={c.name} seatLimit={c.seat_limit} taken={c.taken} />
              </li>
            ))}
          </ul>
        </section>

        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="ob-h">
          <h2 id="ob-h" className="font-display m-0 text-[22px] font-extrabold">
            Onboarding &amp; email
          </h2>
          <p className="text-ink-muted m-0 text-sm">
            Approved members get a welcome email with the onboarding form, and a reminder after 3 days if they haven&apos;t finished it. The newsletter list in
            Brevo is updated on approval; use the button to re-sync everyone.
          </p>
          <NewsletterSyncForm />
          <h3 className="h3 mt-2 mb-0">Onboarding</h3>
          {(onboardRes.data ?? []).length === 0 ? (
            <EmptyState title="No one is onboarding yet" />
          ) : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Onboarding table">
              <table className="data-table">
                <caption className="sr-only">Members approved since email was set up, and whether they finished onboarding</caption>
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Approved</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(onboardRes.data ?? []).map((o) => (
                    <tr key={o.profile_id}>
                      <td>
                        {o.profile?.first_name} {o.profile?.last_name}
                      </td>
                      <td>{formatShortDate(new Date(o.invited_at))}</td>
                      <td>
                        {o.completed_at ? (
                          <Pill tone="green">Done {formatShortDate(new Date(o.completed_at))}</Pill>
                        ) : o.reminded_at ? (
                          <Pill tone="amber">Reminded</Pill>
                        ) : (
                          <Pill tone="gray">Not yet</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 className="h3 mt-2 mb-0">Recent emails</h3>
          {(mailRes.data ?? []).length === 0 ? (
            <EmptyState title="No emails sent yet" />
          ) : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Recent emails table">
              <table className="data-table">
                <caption className="sr-only">The last 25 emails the site sent</caption>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">To</th>
                    <th scope="col">Subject</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Resend</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(mailRes.data ?? []).map((m) => (
                    <tr key={m.id}>
                      <td>{formatShortDate(new Date(m.created_at))}</td>
                      <td>{m.recipient}</td>
                      <td>{m.subject}</td>
                      <td title={m.error ?? undefined}>
                        <Pill tone={m.status === 'sent' ? 'green' : m.status === 'failed' ? 'red' : 'gray'}>
                          {m.status === 'sent' ? 'Sent' : m.status === 'failed' ? 'Failed' : 'Not sent'}
                        </Pill>
                      </td>
                      <td>{resendTarget(m.kind, m.dedupe_key) ? <ResendEmailButton id={m.id} to={m.recipient} failed={m.status === 'failed'} /> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="dl-h">
          <h2 id="dl-h" className="font-display m-0 text-[22px] font-extrabold">
            Directory downloads
          </h2>
          {downloadsRes.data.length === 0 ? (
            <EmptyState title="No downloads yet" />
          ) : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Directory downloads table">
              <table className="data-table">
                <caption className="sr-only">Latest member directory downloads</caption>
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Format</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {downloadsRes.data.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {d.profile?.first_name} {d.profile?.last_name}
                      </td>
                      <td>{d.format === 'vcf' ? 'vCard' : 'CSV'}</td>
                      <td>
                        {formatShortDate(new Date(d.created_at))},{' '}
                        {new Date(d.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })} PT
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
