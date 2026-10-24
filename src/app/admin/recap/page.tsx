import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatMeetingDate, formatMeetingTime } from '@/lib/dates';
import { siteUrl } from '@/lib/email/notify';
import { latestEndedMeeting, recapForMeeting, recapShared } from '@/lib/email/recap';
import { meetingRecapEmail } from '@/lib/email/templates';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Meeting recap preview' };

/**
 * The meeting recap email as members receive it after a meeting ends, built from the live data of the most recent
 * meeting. Read-only: nothing is sent from this page. The greeting uses the admin's first name.
 */
export default async function AdminRecapPage() {
  const viewer = await requireAdmin();
  const db = createAdminClient();
  const now = new Date();
  const meeting = db ? await latestEndedMeeting(db, now) : null;

  let email: { subject: string; html: string; text: string } | null = null;
  if (db && meeting) {
    const shared = await recapShared(db, now);
    const built = await recapForMeeting(db, meeting, shared);
    email = meetingRecapEmail({ siteUrl: siteUrl(), firstName: viewer.profile.first_name || 'there', ...built });
  }
  // The iframe shows the HTML as a standalone page; links open in a new tab so the preview stays put.
  const srcDoc = email
    ? email.html.includes('<head>')
      ? email.html.replace('<head>', '<head><base target="_blank">')
      : `<base target="_blank">${email.html}`
    : '';

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Meeting recap preview</h1>
        <AdminNav current="/admin/recap" />
        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="recap-h">
          <h2 id="recap-h" className="font-display m-0 text-[22px] font-extrabold">
            The email members receive after a meeting
          </h2>
          <p className="text-ink-muted m-0 text-sm">
            The recap goes to every member automatically around noon Pacific, once the meeting has ended. Below is exactly what it says, built from the live
            data of the most recent ended meeting: its talks and materials, today&apos;s visitors and who invited them, member events and the next meeting.
            Nothing is sent from this page, and the greeting uses your first name, as each member sees their own.
          </p>
          {meeting && email ? (
            <>
              <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-ink-muted font-semibold">Meeting</dt>
                <dd className="m-0">
                  {meeting.title}
                  {meeting.starts_at ? ` · ${formatMeetingDate(new Date(meeting.starts_at))} at ${formatMeetingTime(new Date(meeting.starts_at))} PT` : ''}
                </dd>
                <dt className="text-ink-muted font-semibold">Subject</dt>
                <dd className="m-0">{email.subject}</dd>
              </dl>
              <iframe
                title="Recap email preview"
                srcDoc={srcDoc}
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                className="bg-surface border-line h-[960px] w-full rounded-[14px] border"
              />
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold">Plain-text version (for email apps that show no pictures)</summary>
                <pre className="mt-3 font-sans text-sm leading-relaxed whitespace-pre-wrap">{email.text}</pre>
              </details>
            </>
          ) : (
            <EmptyState title="No meeting has ended yet">The recap preview appears here once a regular meeting has ended.</EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
