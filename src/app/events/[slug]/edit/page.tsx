import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isAdmin, requireMember } from '@/lib/auth';
import { getMemberEventBySlug, getSeriesDates } from '@/lib/data/events';
import { isoToPacificLocal, nowMs } from '@/lib/dates';
import { EventForm } from '../../EventForm';

export const metadata: Metadata = { title: 'Edit event' };

export default async function EditEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await requireMember(`/events/${slug}/edit`);
  const e = await getMemberEventBySlug(slug);
  if (!e) notFound();
  if (e.hostId !== viewer.userId && !isAdmin(viewer)) redirect(`/events/${slug}`);
  // Editing edits every date posted together (owner, 2026-10-31).
  const series = await getSeriesDates(e.seriesId);
  const dates = (series.length ? series : [{ id: e.id, starts_at: e.starts_at, ends_at: e.ends_at }]).map((d) => ({
    id: d.id,
    startsAt: isoToPacificLocal(d.starts_at),
    endsAt: isoToPacificLocal(d.ends_at),
  }));
  return (
    <div className="bg-canvas">
      <div className="container-site flex max-w-[860px] flex-col gap-5 pt-8 pb-16">
        <div>
          <Link href={`/events/${slug}`} className="text-sm font-bold">
            ← Back to the event
          </Link>
          <h1 className="font-display m-0 mt-3 text-[clamp(28px,3.4vw,40px)] font-extrabold">Edit event</h1>
          {dates.length > 1 ? <p className="text-ink-muted m-0 mt-1">Changes apply to all {dates.length} dates of this event.</p> : null}
        </div>
        <EventForm
          userId={viewer.userId}
          minStart={isoToPacificLocal(new Date(Math.min(nowMs(), Date.parse(e.starts_at))).toISOString())}
          defaults={{
            id: e.id,
            title: e.title,
            category: e.category,
            dates,
            visibility: e.visibility,
            format: e.is_online ? 'online' : 'in_person',
            onlineUrl: e.onlineUrl ?? '',
            location: e.location ?? '',
            description: e.description ?? '',
          }}
        />
      </div>
    </div>
  );
}
