import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatMeetingDate, formatMeetingTime } from '@/lib/dates';
import { managementRecapsEnabled } from '@/lib/email/cron';
import { latestEndedMeetingForMgmt, managementRecapFor } from '@/lib/email/management-recap';
import { siteUrl } from '@/lib/email/notify';
import { managementRecapEmail } from '@/lib/email/templates';
import { createAdminClient } from '@/lib/supabase/admin';
import { ManagementRecapSwitchForm } from './ManagementRecapSwitchForm';

export const metadata: Metadata = { title: 'Management recap' };

/**
 * The Management recap (owner, 2026-10-30) as admins receive it after a meeting, built from the live data of the most
 * recent meeting. Nothing is sent from this page; admins can switch the automatic email off or on here.
 */
export default async function AdminManagementRecapPage() {
  const viewer = await requireAdmin();
  const db = createAdminClient();
  const now = new Date();
  const [meeting, enabled] = db ? await Promise.all([latestEndedMeetingForMgmt(db, now), managementRecapsEnabled(db)]) : [null, true];

  let email: { subject: string; html: string; text: string } | null = null;
  if (db && meeting) {
    const content = await managementRecapFor(db, meeting, now);
    email = managementRecapEmail({ siteUrl: siteUrl(), firstName: viewer.profile.first_name || 'there', ...content });
  }
  const srcDoc = email
    ? email.html.includes('<head>')
      ? email.html.replace('<head>', '<head><base target="_blank">')
      : `<base target="_blank">${email.html}`
    : '';

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Management recap</h1>
        <AdminNav current="/admin/management-recap" />
        <HowThisWorks tab="/admin/management-recap" />
        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="mrecap-h">
          <h2 id="mrecap-h" className="font-display m-0 text-[22px] font-extrabold">
            The email the Management Team receives after a meeting
          </h2>
          <p className="text-ink-muted m-0 text-sm">
            The Management recap goes to every admin automatically once the meeting&apos;s attendance has been taken (around noon Pacific on meeting days), or
            the next morning if it hasn&apos;t been. Below is exactly what it says, built from the live data of the most recent ended meeting. Nothing is sent
            from this page, and the greeting uses your first name.
          </p>
          <div className="border-line flex flex-col gap-2 rounded-[14px] border p-4">
            <ManagementRecapSwitchForm enabled={enabled} />
            <p className="text-ink-muted m-0 text-sm">
              {enabled
                ? 'Turn it off before noon Pacific on a meeting day to stop that meeting’s Management recap from going out.'
                : 'While it is off, no Management recap is sent. If you turn it back on within 36 hours of a meeting, that meeting’s recap goes out at the next run.'}
            </p>
          </div>
          {meeting && email ? (
            <>
              <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-ink-muted font-semibold">Meeting</dt>
                <dd className="m-0">
                  {meeting.title} · {formatMeetingDate(new Date(meeting.starts_at))} at {formatMeetingTime(new Date(meeting.starts_at))} PT
                </dd>
                <dt className="text-ink-muted font-semibold">Subject</dt>
                <dd className="m-0">{email.subject}</dd>
              </dl>
              <iframe
                title="Management recap email preview"
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
            <EmptyState title="No meeting has ended yet">The Management recap preview appears here once a regular meeting has ended.</EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
