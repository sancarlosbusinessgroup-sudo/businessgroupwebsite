import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { EmptyState, Notice, Pill } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { guestStatusLabels } from '@/lib/content';
import { getCategorySeats, getNextMeeting, getUpcomingMeetings } from '@/lib/data/public';
import { formatMeetingDate, formatMeetingTime, formatShortDate } from '@/lib/dates';
import { MeetingCancelForm } from './MeetingCancelForm';
import { createClient } from '@/lib/supabase/server';
import { absencesFor, memberSince } from '@/lib/data/attendance';
import { ABSENCE_LIMIT, parseZoomMeetingId } from '@/lib/zoom';
import { zoomConfigured } from '@/lib/zoom-api';
import Link from 'next/link';
import { resolveCorrection, setGuestOneOnOnes, setGuestStatus, setMemberStatus } from '../actions/admin';
import { SendZoomLinkButton } from './SendZoomLinkButton';
import { OpenApplicationOnHash } from './OpenApplicationOnHash';
import { InviteToApplyButton } from './InviteToApplyButton';
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
  const [pendingRes, guestsRes, corrRes, seats, downloadsRes, schedule, onboardRes, mailRes, invitesRes, zoomSentRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, first_name, last_name, business_name, website, guest_meetings_attended, created_at, categories(name), referrer:referred_by(first_name, last_name), member_contacts(email, phone), member_applications(*)',
      )
      .eq('status', 'pending')
      .order('created_at'),
    supabase
      .from('guest_requests')
      .select('id, first_name, last_name, email, business_name, phone, website, invited_by_text, status, created_at, one_on_ones_done_at')
      .order('created_at', { ascending: false })
      .limit(50),
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
    getUpcomingMeetings(10),
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
    supabase.from('email_log').select('dedupe_key, created_at').eq('kind', 'apply_invite').eq('status', 'sent').order('created_at').limit(500),
    supabase.from('email_log').select('dedupe_key, created_at').eq('kind', 'guest_zoom_link').eq('status', 'sent').order('created_at').limit(500),
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
  const invitedOn = new Map((invitesRes.data ?? []).map((r) => [r.dedupe_key.split(':')[0], formatShortDate(new Date(r.created_at))]));
  const zoomSentOn = new Map((zoomSentRes.data ?? []).map((r) => [r.dedupe_key.split(':')[0], formatShortDate(new Date(r.created_at))]));
  if (pendingRes.error || guestsRes.error || corrRes.error || downloadsRes.error) throw new Error('Could not load admin data');
  // Guests who have applied: their pending membership application, matched by email (for "Application approval").
  const pendingByEmail = new Map(
    pendingRes.data.flatMap((p) => {
      const c = Array.isArray(p.member_contacts) ? p.member_contacts[0] : p.member_contacts;
      return c?.email ? [[c.email.toLowerCase(), { id: p.id, name: `${p.first_name} ${p.last_name}` }] as const] : [];
    }),
  );

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Admin</h1>
        <AdminNav current="/admin" />
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

        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="ap-h">
          <OpenApplicationOnHash />
          <h2 id="ap-h" className="font-display m-0 text-[22px] font-extrabold">
            Pending applications ({pendingRes.data.length})
          </h2>
          {pendingRes.data.length === 0 ? (
            <EmptyState title="No applications waiting" />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {pendingRes.data.map((p) => {
                const contact = Array.isArray(p.member_contacts) ? p.member_contacts[0] : p.member_contacts;
                const referrer = Array.isArray(p.referrer) ? p.referrer[0] : p.referrer;
                const app = Array.isArray(p.member_applications) ? p.member_applications[0] : p.member_applications;
                const refs = (app?.references ?? []) as {
                  name?: string;
                  business?: string | null;
                  business_name?: string | null;
                  email?: string | null;
                  phone?: string | null;
                  website?: string | null;
                }[];
                return (
                  <li
                    key={p.id}
                    id={`application-${p.id}`}
                    className="border-line target:ring-teal flex scroll-mt-24 flex-wrap items-center justify-between gap-3 rounded-xl border p-4 target:ring-2"
                  >
                    <div className="min-w-0">
                      <strong>
                        {p.first_name} {p.last_name}
                      </strong>{' '}
                      · {p.business_name} {p.categories ? `(${p.categories.name})` : ''}
                      <div className="text-ink-muted text-sm">
                        {contact?.email} · applied {formatShortDate(new Date(p.created_at))} · guest visits: {p.guest_meetings_attended}
                        {referrer ? ` · referred by ${referrer.first_name} ${referrer.last_name}` : ''}
                      </div>
                      {app ? (
                        <details className="mt-2">
                          <summary className="text-teal-text cursor-pointer text-sm font-bold">View application</summary>
                          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
                            {[
                              { k: 'Application date', v: formatShortDate(new Date(`${app.applied_on}T12:00:00Z`)) },
                              { k: 'Business phone', v: app.business_phone },
                              { k: 'Business address', v: app.business_address },
                              { k: 'Website', v: p.website },
                              { k: 'In business for', v: app.years_in_business },
                              { k: 'Product or service', v: app.product_service },
                              { k: 'Education & credentials', v: app.credentials },
                              { k: 'Networking groups', v: app.networking_groups },
                              { k: 'Signed', v: `${app.signature_name} · ${formatShortDate(new Date(app.agreed_at))}` },
                            ].map((r) => (
                              <div key={r.k}>
                                <dt className="text-ink-muted text-[13px] font-bold">{r.k}</dt>
                                <dd className="m-0 whitespace-pre-line">{r.v || '—'}</dd>
                              </div>
                            ))}
                          </dl>
                          {refs.length ? (
                            <div className="mt-3">
                              <p className="text-ink-muted m-0 text-[13px] font-bold">References</p>
                              <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0 text-[15px]">
                                {refs.map((r, i) => (
                                  <li key={i}>
                                    <strong>{r.name}</strong>
                                    {r.business ? ` · ${r.business}` : ''}
                                    {r.business_name ? ` · ${r.business_name}` : ''}
                                    {r.email ? (
                                      <>
                                        {' · '}
                                        <a href={`mailto:${r.email}`}>{r.email}</a>
                                      </>
                                    ) : null}
                                    {r.phone ? ` · ${r.phone}` : ''}
                                    {r.website ? ` · ${r.website}` : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </details>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <form action={setMemberStatus}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="status" value="approved" />
                        <button type="submit" className="btn btn-primary btn-sm">
                          Approve
                          <span className="sr-only">
                            {' '}
                            {p.first_name} {p.last_name}
                          </span>
                        </button>
                      </form>
                      <form action={setMemberStatus}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="status" value="declined" />
                        <button type="submit" className="btn btn-outline btn-sm">
                          Decline
                          <span className="sr-only">
                            {' '}
                            {p.first_name} {p.last_name}
                          </span>
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="gr-h">
          <h2 id="gr-h" className="font-display m-0 text-[22px] font-extrabold">
            Guest invite requests
          </h2>
          <p className="text-ink-muted m-0 text-sm">
            <strong>Send Zoom link</strong> emails the guest the Zoom link for their meeting. After they have visited and the Membership Committee agrees, use{' '}
            <strong>Invite to apply</strong> to email them the membership application form, already filled in with their name and email. Mark their one-on-ones
            with the Membership Committee as done, then <strong>Approved</strong> approves their application and emails them their welcome.
          </p>
          {guestsRes.data.length === 0 ? (
            <EmptyState title="No guest requests yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <caption className="sr-only">Guest invite requests</caption>
                <thead>
                  <tr>
                    <th scope="col">Guest</th>
                    <th scope="col">Email</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Invited by</th>
                    <th scope="col">Requested</th>
                    <th scope="col">Zoom link</th>
                    <th scope="col">Status</th>
                    <th scope="col">Application</th>
                    <th scope="col">One-on-ones</th>
                    <th scope="col">Application approval</th>
                  </tr>
                </thead>
                <tbody>
                  {guestsRes.data.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <strong>
                          {g.first_name} {g.last_name}
                        </strong>
                        <div className="text-ink-muted text-sm">{g.business_name}</div>
                        {g.website ? (
                          <div className="text-sm">
                            <a href={g.website} target="_blank" rel="noopener noreferrer">
                              {g.website.replace(/^https?:\/\//i, '')}
                            </a>
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <a href={`mailto:${g.email}`}>{g.email}</a>
                      </td>
                      <td className="whitespace-nowrap">{g.phone ?? '—'}</td>
                      <td>{g.invited_by_text ?? '—'}</td>
                      <td className="whitespace-nowrap">{formatShortDate(new Date(g.created_at))}</td>
                      <td>
                        {g.status === 'joined' ? (
                          '—'
                        ) : (
                          <SendZoomLinkButton id={g.id} name={`${g.first_name} ${g.last_name}`} sentOn={zoomSentOn.get(g.id) ?? null} />
                        )}
                      </td>
                      <td>
                        {g.status === 'requested' ? (
                          <form action={setGuestStatus}>
                            <input type="hidden" name="id" value={g.id} />
                            <input type="hidden" name="status" value="visited" />
                            <button type="submit" className="btn btn-outline btn-sm">
                              Mark visited
                              <span className="sr-only">
                                {' '}
                                for {g.first_name} {g.last_name}
                              </span>
                            </button>
                          </form>
                        ) : (
                          <Pill tone={g.status === 'joined' ? 'green' : 'teal'}>{guestStatusLabels[g.status]}</Pill>
                        )}
                      </td>
                      <td>
                        {g.status === 'requested' || g.status === 'visited' ? (
                          <InviteToApplyButton id={g.id} name={`${g.first_name} ${g.last_name}`} sentOn={invitedOn.get(g.id) ?? null} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {g.one_on_ones_done_at ? (
                          <div className="flex flex-col items-start gap-1">
                            <Pill tone="green">Done</Pill>
                            <form action={setGuestOneOnOnes}>
                              <input type="hidden" name="id" value={g.id} />
                              <input type="hidden" name="done" value="false" />
                              <button type="submit" className="text-teal-text cursor-pointer border-0 bg-transparent p-0 text-sm underline">
                                Undo
                                <span className="sr-only">
                                  {' '}
                                  one-on-ones for {g.first_name} {g.last_name}
                                </span>
                              </button>
                            </form>
                          </div>
                        ) : (
                          <form action={setGuestOneOnOnes}>
                            <input type="hidden" name="id" value={g.id} />
                            <input type="hidden" name="done" value="true" />
                            <button type="submit" className="btn btn-outline btn-sm">
                              Done?
                              <span className="sr-only">
                                {' '}
                                Mark one-on-ones done for {g.first_name} {g.last_name}
                              </span>
                            </button>
                          </form>
                        )}
                      </td>
                      <td>
                        {(() => {
                          if (g.status === 'joined') return <Pill tone="green">Approved</Pill>;
                          const applicant = pendingByEmail.get(g.email.toLowerCase());
                          if (!applicant) return <span className="text-ink-muted text-sm">Waiting for their application</span>;
                          return (
                            <div className="flex flex-col items-start gap-1.5">
                              <a href={`#application-${applicant.id}`} className="text-sm font-bold">
                                See application
                                <span className="sr-only">
                                  {' '}
                                  of {g.first_name} {g.last_name}
                                </span>
                              </a>
                              <form action={setMemberStatus}>
                                <input type="hidden" name="id" value={applicant.id} />
                                <input type="hidden" name="status" value="approved" />
                                <button type="submit" className="btn btn-primary btn-sm">
                                  Approved
                                  <span className="sr-only">
                                    {' '}
                                    (approve the application of {g.first_name} {g.last_name})
                                  </span>
                                </button>
                              </form>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="sched-h">
          <h2 id="sched-h" className="font-display m-0 text-[22px] font-extrabold">
            Meeting schedule
          </h2>
          <p className="text-ink-muted m-0 text-[15px]">
            Cancel a meeting for a holiday or any other reason. It stays on the schedule, marked cancelled with your reason; the countdown and slides move to
            the next meeting.
          </p>
          <ul className="m-0 flex list-none flex-col p-0">
            {schedule.map((m) => (
              <li key={m.id} className="border-line-soft flex flex-wrap items-center justify-between gap-3 border-t py-3">
                <span>
                  <strong>{formatMeetingDate(new Date(m.starts_at))}</strong>
                  <span className="text-ink-muted">
                    {' '}
                    · {formatMeetingTime(new Date(m.starts_at))} PT · {m.title}
                  </span>
                </span>
                <MeetingCancelForm id={m.id} label={m.title} reason={m.cancelled_reason} />
              </li>
            ))}
          </ul>
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
