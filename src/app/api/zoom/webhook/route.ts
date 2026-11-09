// Zoom webhook (owner, 2026-11-10): Zoom calls this while a meeting runs, each time someone joins or leaves.
// Set up in the Zoom app: Features → Access → Secret Token (→ Vercel ZOOM_WEBHOOK_SECRET_TOKEN), and
// Event Subscriptions → this address, events "Participant/Host joined meeting" and "Participant/Host left meeting".
// Every request is checked against Zoom's signature; anything else is refused.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseParticipantEvent, pickLiveMeeting, urlValidationResponse, verifyZoomRequest } from '@/lib/zoom-live';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? '';
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 100_000) return NextResponse.json({ error: 'too large' }, { status: 413 });
  let body: { event?: string; payload?: { plainToken?: unknown } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  // Zoom checks the address when it is saved in the Zoom app; the answer only proves we know the secret.
  if (body.event === 'endpoint.url_validation') {
    const token = body.payload?.plainToken;
    if (typeof token !== 'string' || !token || token.length > 200) return NextResponse.json({ error: 'bad request' }, { status: 400 });
    return NextResponse.json(urlValidationResponse(secret, token));
  }

  if (!verifyZoomRequest(secret, request.headers.get('x-zm-signature'), request.headers.get('x-zm-request-timestamp'), raw)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const ev = parseParticipantEvent(body);
  if (!ev) return NextResponse.json({ ok: true, ignored: true });
  const db = createAdminClient();
  if (!db) return NextResponse.json({ ok: true, stored: false });

  const t = new Date(ev.at).getTime();
  const { data: meetings, error } = await db
    .from('meetings')
    .select('id, starts_at, ends_at, meeting_links(join_url)')
    .is('cancelled_reason', null)
    .lte('starts_at', new Date(t + 3_600_000).toISOString())
    .gte('ends_at', new Date(t - 3_600_000).toISOString());
  if (error) {
    console.error('[zoom webhook] meetings', error.message);
    // Zoom retries on errors.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const meetingId = pickLiveMeeting(
    (meetings ?? []).map((m) => {
      const l = m.meeting_links as unknown as { join_url: string } | { join_url: string }[] | null;
      return { id: m.id, starts_at: m.starts_at, ends_at: m.ends_at, join_url: (Array.isArray(l) ? l[0]?.join_url : l?.join_url) ?? null };
    }),
    ev.zoomId,
    ev.at,
  );
  if (!meetingId) return NextResponse.json({ ok: true, stored: false });

  const { error: insErr } = await db
    .from('zoom_live_events')
    .upsert(
      { meeting_id: meetingId, event: ev.event, key: ev.key, name: ev.name, email: ev.email, at: ev.at },
      { onConflict: 'meeting_id,event,key,at', ignoreDuplicates: true },
    );
  if (insErr) {
    console.error('[zoom webhook] insert', insErr.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stored: true });
}
