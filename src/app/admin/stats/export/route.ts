import { NextResponse, type NextRequest } from 'next/server';
import { getViewer, isAdmin } from '@/lib/auth';
import { getAdminStats, getLastMeetingDate } from '@/lib/data/member';
import { toCsv } from '@/lib/exports';
import { sortStatRows } from '@/lib/stats';
import { parseStatsSearch, statColumns } from '../params';

export const dynamic = 'force-dynamic';

// CSV of every member's counts for the chosen period (admins only; the database checks again).
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!isAdmin(viewer)) return NextResponse.redirect(new URL('/dashboard', req.url));
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { range, sort, dir } = parseStatsSearch(sp, await getLastMeetingDate());
  const rows = sortStatRows(await getAdminStats(range), sort, dir);
  const body = toCsv(
    ['First name', 'Last name', 'Business', ...statColumns.map((c) => c.label)],
    rows.map((r) => [r.first_name, r.last_name, r.business_name, ...statColumns.map((c) => Number(r[c.key]))]),
  );
  const name = `member-stats-${range.from ?? 'start'}-to-${range.to ?? 'now'}.csv`;
  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'private, no-store' },
  });
}
