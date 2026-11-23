import { EmptyState, Pill } from '@/components/ui';
import { getCategorySeats } from '@/lib/data/public';
import { formatShortDate } from '@/lib/dates';
import { resendTarget } from '@/lib/email/resend-target';
import { createClient } from '@/lib/supabase/server';
import { resolveCorrection } from '../actions/admin';
import { NewsletterSyncForm } from './NewsletterSyncForm';
import { ResendEmailButton } from './ResendEmailButton';
import { SeatForm } from './SeatForm';

// Sections that used to be on Admin → Overview and now live on other tabs (owner, 2026-11-24):
//   Attendance correction requests → Attendance; Onboarding and Category seats → Guest Invites & Applications;
//   Email Logs (was "Recent emails") → Change History; Directory downloads → Member Activity.
// Callers must have checked requireAdmin().

/** Members asking to fix their attendance. On Admin → Attendance. */
export async function CorrectionRequests() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('attendance_corrections')
    .select('id, note, created_at, profile:profiles!attendance_corrections_profile_id_fkey(first_name, last_name), meeting:meetings(starts_at)')
    .eq('resolved', false)
    .order('created_at');
  if (error) throw new Error('Could not load attendance correction requests');
  return (
    <section id="corrections" className="card flex scroll-mt-24 flex-col gap-3.5 p-[22px]" aria-labelledby="co-h">
      <h2 id="co-h" className="font-display m-0 text-[22px] font-extrabold">
        Attendance correction requests
      </h2>
      {data.length === 0 ? (
        <EmptyState title="No open requests" />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.map((c) => (
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
      <p className="text-ink-muted m-0 text-sm">Fix the attendance in the table below (choose the meeting first), then mark the request resolved.</p>
    </section>
  );
}

/** New members' onboarding status and the newsletter re-sync. On Admin → Guest Invites & Applications. */
export async function Onboarding() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('member_onboarding')
    .select('profile_id, invited_at, reminded_at, completed_at, profile:profiles(first_name, last_name)')
    .order('invited_at', { ascending: false })
    .limit(30);
  const rows = data ?? [];
  return (
    <section id="onboarding" className="card flex scroll-mt-24 flex-col gap-3.5 p-[22px]" aria-labelledby="ob-h">
      <h2 id="ob-h" className="font-display m-0 text-[22px] font-extrabold">
        Onboarding
      </h2>
      <p className="text-ink-muted m-0 text-sm">
        Approved members get a welcome email with the onboarding form, and a reminder after 3 days if they haven&apos;t finished it. The newsletter list in
        Brevo is updated on approval; use the button to re-sync everyone.
      </p>
      <NewsletterSyncForm />
      {rows.length === 0 ? (
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
              {rows.map((o) => (
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
    </section>
  );
}

/** How many approved members each profession may have. On Admin → Guest Invites & Applications. */
export async function CategorySeats() {
  const seats = await getCategorySeats();
  return (
    <section id="seats" className="card flex scroll-mt-24 flex-col gap-3.5 p-[22px]" aria-labelledby="seats-h">
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
  );
}

/** The last 25 emails the site sent, with Resend on failed ones. On Admin → Change History. */
export async function EmailLogs() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('email_log')
    .select('id, kind, dedupe_key, recipient, subject, status, error, created_at')
    .order('created_at', { ascending: false })
    .limit(25);
  const rows = data ?? [];
  return (
    <section id="email-logs" className="card flex scroll-mt-24 flex-col gap-3.5 p-[22px]" aria-labelledby="mail-h">
      <h2 id="mail-h" className="font-display m-0 text-[22px] font-extrabold">
        Email Logs
      </h2>
      <p className="text-ink-muted m-0 text-sm">The last 25 emails the site sent. Resend any that failed.</p>
      {rows.length === 0 ? (
        <EmptyState title="No emails sent yet" />
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Email logs table">
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
              {rows.map((m) => (
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
  );
}

/** Who downloaded the member directory, and when. On Admin → Member Activity. */
export async function DirectoryDownloads() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('directory_downloads')
    .select('id, format, created_at, profile:profiles(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error('Could not load directory downloads');
  return (
    <section id="downloads" className="card flex scroll-mt-24 flex-col gap-3.5 p-[22px]" aria-labelledby="dl-h">
      <h2 id="dl-h" className="font-display m-0 text-[22px] font-extrabold">
        Directory downloads
      </h2>
      {data.length === 0 ? (
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
              {data.map((d) => (
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
  );
}
