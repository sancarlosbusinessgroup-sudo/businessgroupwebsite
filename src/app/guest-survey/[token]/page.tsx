import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Notice, PageHero } from '@/components/ui';
import { site } from '@/lib/content';
import { createAdminClient } from '@/lib/supabase/admin';
import { SurveyForm } from './SurveyForm';

export const metadata: Metadata = { title: 'Visitor survey', robots: { index: false, follow: false } };

// Guest follow-up survey (owner meeting 2026-10-30), opened from the emailed link. The token is the only key.
export default async function GuestSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length < 32 || token.length > 100) notFound();
  const db = createAdminClient();
  if (!db) notFound();
  const { data: survey } = await db.from('guest_surveys').select('answered_at, guest:guest_requests(first_name)').eq('token', token).maybeSingle();
  if (!survey) notFound();
  const guest = survey.guest as unknown as { first_name: string } | null;
  const firstName = guest?.first_name ?? 'there';

  return (
    <>
      <PageHero crumb="Visitor survey" title={`Thanks for visiting, ${firstName}`} lead={`Five quick questions about your visit to ${site.name}.`} />
      <section className="container-site flex max-w-[720px] flex-col gap-5 py-10">
        {survey.answered_at ? <Notice tone="success">We already have your answers. Thank you!</Notice> : <SurveyForm token={token} firstName={firstName} />}
        <p className="text-ink-muted m-0 text-[15px]">
          Ready for the next step? <Link href="/join">Apply to join</Link>.
        </p>
      </section>
    </>
  );
}
