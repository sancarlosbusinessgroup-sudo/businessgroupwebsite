// Live attendance for Admin → Attendance, polled every few seconds by the live panel. Admins only.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getViewer, isAdmin } from '@/lib/auth';
import { loadLiveAttendance } from '@/lib/data/live-attendance';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAdmin(await getViewer())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get('m'));
  if (!id.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const summary = await loadLiveAttendance(await createClient(), id.data);
  if (!summary) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(summary, { headers: { 'cache-control': 'no-store' } });
}
