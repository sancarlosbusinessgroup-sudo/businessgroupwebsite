import type { Metadata } from 'next';
import { EmptyState, Pill } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { guestStatusLabels } from '@/lib/content';
import { formatShortDate } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { resolveCorrection, setGuestStatus, setMemberStatus } from '../actions/admin';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [pendingRes, guestsRes, corrRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, first_name, last_name, business_name, guest_meetings_attended, created_at, categories(name), referrer:referred_by(first_name, last_name), member_contacts(email, phone)',
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
  ]);
  if (pendingRes.error || guestsRes.error || corrRes.error) throw new Error('Could not load admin data');

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Admin</h1>

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
      </div>
    </div>
  );
}
