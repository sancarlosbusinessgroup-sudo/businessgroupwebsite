import { NextResponse } from 'next/server';
import { getUpcomingMeetings } from '@/lib/data/public';
import { env } from '@/lib/env';
import { buildIcs } from '@/lib/ics';
import { site } from '@/lib/content';

// Subscribable feed of upcoming meetings and events (Google / Outlook / Apple Calendar).
export async function GET() {
  const meetings = await getUpcomingMeetings(40);
  const body = buildIcs(
    meetings.map((m) => ({
      uid: m.id,
      title: m.title,
      description: m.description,
      location: m.location,
      start: new Date(m.starts_at),
      end: new Date(m.ends_at),
      url: `${env.siteUrl}/events/${m.slug}`,
    })),
    site.shortName,
  );
  return new NextResponse(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
}
