// "Start meeting as host" (admins only). Asks Zoom for a fresh host link for the next (or running) BARP meeting
// and sends the admin straight to it. The host link is never stored or shown on a page.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getNextMeeting } from '@/lib/data/public';
import { createClient } from '@/lib/supabase/server';
import { parseZoomMeetingId } from '@/lib/zoom';
import { hostStartUrl, zoomConfigured, ZoomError } from '@/lib/zoom-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  await requireAdmin();
  const back = (message: string) => NextResponse.redirect(new URL(`/admin?zoomError=${encodeURIComponent(message)}#zoom`, request.url), 303);
  if (!zoomConfigured()) return back('Zoom is not connected yet. Add the three ZOOM_ values in Vercel.');

  const meeting = await getNextMeeting();
  if (!meeting) return back('There is no upcoming meeting on the calendar.');
  const supabase = await createClient();
  const { data: link } = await supabase.from('meeting_links').select('join_url').eq('meeting_id', meeting.id).maybeSingle();
  const zoomId = parseZoomMeetingId(link?.join_url);
  if (!zoomId) return back('No Zoom link is saved for the next meeting.');

  try {
    return NextResponse.redirect(await hostStartUrl(zoomId), 303);
  } catch (e) {
    if (!(e instanceof ZoomError)) console.error('[zoom] start failed', e instanceof Error ? e.message : e);
    return back(e instanceof ZoomError ? e.message : 'Could not reach Zoom. Please try again.');
  }
}
