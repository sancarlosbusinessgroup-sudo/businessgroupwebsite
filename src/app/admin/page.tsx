import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { EmptyState, Notice, Pill } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { guestStatusLabels } from '@/lib/content';
import { getCategorySeats, getUpcomingMeetings } from '@/lib/data/public';
import { formatMeetingDate, formatMeetingTime, formatShortDate } from '@/lib/dates';
import { MeetingCancelForm } from './MeetingCancelForm';
import { createClient } from '@/lib/supabase/server';
import { resolveCorrection, setGuestStatus, setMemberStatus } from '../actions/admin';
import { SeatForm } from './SeatForm';

export const metadata: Metadata = { title: 'Admin' };

const errors: Record<string, string> = {
  category_full: 'That category is full. Raise its seats under “Category seats” below, or ask the applicant to pick another category.',
  save: 'Something went wrong. Please try again.',
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const [pendingRes, guestsRes, corrRes, seats, downloadsRes, schedule] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, first_name, last_name, business_name, website, guest_meetings_attended, created_at, categories(name), referrer:referred_by(first_name, last_name), member_contacts(email, phone), member_applications(*)',
      )
      .eq('status', 'pending')
      .order('created_at'),
    supabase
      .from('guest_requests')
      .select('id, first_name, last_name, email, business_name, invited_by_text, status, created_at')
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
  ]);
  if (pendingRes.error || guestsRes.error || corrRes.error || downloadsRes.error) throw new Error('Could not load admin data');

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Admin</h1>
        <AdminNav current="/admin" />
        {error && errors[error] ? <Notice tone="error">{errors[error]}</Notice> : null}

        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="ap-h">
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
                  email?: string | null;
                  phone?: string | null;
                  website?: string | null;
                }[];
                return (
                  <li key={p.id} className="border-line flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
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
                    <th scope="col">Invited by</th>
                    <th scope="col">Requested</th>
                    <th scope="col">Status</th>
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
                      </td>
                      <td>
                        <a href={`mailto:${g.email}`}>{g.email}</a>
                      </td>
                      <td>{g.invited_by_text ?? '—'}</td>
                      <td>{formatShortDate(new Date(g.created_at))}</td>
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
                  <span className="text-ink-muted"> · {formatMeetingTime(new Date(m.starts_at))} PT · {m.title}</span>
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
