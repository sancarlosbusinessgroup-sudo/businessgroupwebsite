// Meeting recap job, called by Vercel Cron (see vercel.json) around noon Pacific with "Authorization: Bearer $CRON_SECRET".
import { NextResponse } from 'next/server';
import { runRecaps } from '@/lib/email/cron';

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
    return NextResponse.json({ ok: true, meetingRecaps: await runRecaps(now) });
  } catch (e) {
    console.error('[cron] after-meeting failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
