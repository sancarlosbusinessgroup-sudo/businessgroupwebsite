import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { Notice } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { GuestSections } from '../GuestSections';

export const metadata: Metadata = { title: 'Guest Invites & Applications' };

const errors: Record<string, string> = {
  category_full: 'That category is full. Raise its seats under “Category seats” on the Overview tab, or ask the applicant to pick another category.',
  save: 'Something went wrong. Please try again.',
};

/**
 * Admin → Guest Invites & Applications (owner, 2026-11-23): Pending applications, Visitor sign-in link and Guest invite
 * requests on their own tab. The same sections stay on Overview; both pages render GuestSections.
 */
export default async function AdminGuestsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  await requireAdmin();

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Guest Invites &amp; Applications</h1>
        <AdminNav current="/admin/guests" />
        <HowThisWorks tab="/admin/guests" />
        {error && errors[error] ? <Notice tone="error">{errors[error]}</Notice> : null}
        <GuestSections back="/admin/guests" />
      </div>
    </div>
  );
}
