import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isAdmin, requireMember } from '@/lib/auth';
import { getDeckData } from '@/lib/data/slides';
import { formatMeetingDate } from '@/lib/dates';
import { Deck } from '../Deck';
import { buildSlides } from '../slides';

export const metadata: Metadata = { title: 'Meeting slides', robots: { index: false } };

export default async function PresentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await requireMember(`/present/${slug}`);
  const data = await getDeckData(slug);
  if (!data) notFound();
  return (
    <Deck
      title={`Meeting slides for ${formatMeetingDate(new Date(data.meeting.starts_at))}`}
      slides={buildSlides(data)}
      customizeHref={isAdmin(viewer) ? `/present/${slug}/setup` : undefined}
      exitHref="/meetings"
    />
  );
}
