import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getMeetingBySlug } from '@/lib/data/public';
import { formatMeetingDate } from '@/lib/dates';
import { DEFAULT_SLIDES, resolveNotes, resolveSlides, slideLabel, slideTime } from '@/lib/slides';
import { createClient } from '@/lib/supabase/server';
import { SlideMediaManager } from './SlideMediaManager';
import { SlideSettingsForm } from './SlideSettingsForm';

export const metadata: Metadata = { title: 'Customize slides', robots: { index: false } };

export default async function SlideSetupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireAdmin();
  const meeting = await getMeetingBySlug(slug);
  if (!meeting) notFound();
  const supabase = await createClient();
  const [{ data }, mediaRes] = await Promise.all([
    supabase.from('meeting_slide_settings').select('slides, notes').eq('meeting_id', meeting.id).maybeSingle(),
    supabase.from('meeting_slide_media').select('id, kind, title, after_slide, page_count').eq('meeting_id', meeting.id).order('sort').order('created_at'),
  ]);
  const media = (mediaRes.data ?? []).map((m) => ({ id: m.id, kind: m.kind, title: m.title, afterSlide: m.after_slide, pageCount: m.page_count }));
  const options = DEFAULT_SLIDES.map((k) => ({ key: k, label: `${slideTime(k) ? `${slideTime(k)} · ` : ''}${slideLabel(k)}` }));
  const shown = resolveSlides(data?.slides);
  const hidden = DEFAULT_SLIDES.filter((k) => !shown.includes(k));
  const notes = resolveNotes(data?.notes);
  const rows = [...shown, ...hidden].map((k, n) => ({ key: k, label: `${slideTime(k) ? `${slideTime(k)} · ` : ''}${slideLabel(k)}`, shown: shown.includes(k), position: n + 1, note: notes[k] ?? '' }));

  return (
    <div className="bg-canvas">
      <div className="container-site flex max-w-[820px] flex-col gap-5 pt-8 pb-16">
        <div>
          <Link href={`/present/${slug}`} className="text-sm font-bold">
            ← Back to the slides
          </Link>
          <h1 className="font-display m-0 mt-3 text-[clamp(28px,3.4vw,40px)] font-extrabold">Slides for {formatMeetingDate(new Date(meeting.starts_at))}</h1>
          <p className="text-ink-muted m-0 mt-1">
            {data ? 'This meeting uses a custom order.' : 'This meeting uses the standard agenda.'} Changes apply to this meeting only.
          </p>
        </div>
        <SlideSettingsForm meetingId={meeting.id} rows={rows} deckHref={`/present/${slug}`} />
        <SlideMediaManager meetingId={meeting.id} options={options} media={media} />
      </div>
    </div>
  );
}
