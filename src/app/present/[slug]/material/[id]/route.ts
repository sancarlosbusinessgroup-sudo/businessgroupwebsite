// A presenter's uploaded material (PDF, image or YouTube video), linked from the meeting recap email.
// Members only: files are private, so each visit gets a fresh short-lived signed link.
import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  await requireMember(`/present/${slug}/material/${id}`);
  const supabase = await createClient();
  const back = new URL(`/present/${encodeURIComponent(slug)}`, _request.url);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(back);
  const { data: m } = await supabase
    .from('meeting_slide_media')
    .select('kind, storage_path, youtube_id, start_seconds, meetings!inner(slug)')
    .eq('id', id)
    .eq('meetings.slug', slug)
    .maybeSingle();
  if (!m) return NextResponse.redirect(back);
  if (m.kind === 'youtube' && m.youtube_id) {
    return NextResponse.redirect(`https://www.youtube.com/watch?v=${m.youtube_id}${m.start_seconds ? `&t=${m.start_seconds}s` : ''}`);
  }
  if (m.storage_path) {
    const { data } = await supabase.storage.from('slide-media').createSignedUrl(m.storage_path, 3600);
    if (data?.signedUrl) return NextResponse.redirect(data.signedUrl);
  }
  return NextResponse.redirect(back);
}
