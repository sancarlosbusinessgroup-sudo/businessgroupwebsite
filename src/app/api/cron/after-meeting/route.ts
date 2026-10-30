// After-meeting job: imports Zoom attendance for meetings that just ended (Phase D), then sends the Member recap and
// the Management recap.
// Meeting recap job, called by Vercel Cron (see vercel.json) around noon Pacific with "Authorization: Bearer $CRON_SECRET".
import { NextResponse } from 'next/server';
import { runManagementRecaps, runRecaps } from '@/lib/email/cron';
import { createAdminClient } from '@/lib/supabase/admin';
import { importRecentMeetings } from '@/lib/zoom-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Tests may pin "now" outside production.
  const at = new URL(request.url).searchParams.get('now');
  const now = at && process.env.VERCEL_ENV !== 'production' && !Number.isNaN(Date.parse(at)) ? new Date(at) : new Date();
  try {
    const db = createAdminClient();
    let zoom = { imported: 0, failed: 0 };
    try {
      if (db) zoom = await importRecentMeetings(db, now);
    } catch (e) {
      console.error('[cron] zoom import failed', e instanceof Error ? e.message : e);
    }
    const meetingRecaps = await runRecaps(now);
    // After the Zoom import, so the Management recap has the attendance.
    const managementRecaps = await runManagementRecaps(now);
    return NextResponse.json({ ok: true, zoom, meetingRecaps, managementRecaps });
  } catch (e) {
    console.error('[cron] after-meeting failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
