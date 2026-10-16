import { NextResponse } from 'next/server';
import { getUpcomingCalendar } from '@/lib/data/events';
import { env } from '@/lib/env';
import { buildIcs } from '@/lib/ics';
import { site } from '@/lib/content';

// Subscribable feed of upcoming meetings and events (Google / Outlook / Apple Calendar).
export async function GET() {
  const items = await getUpcomingCalendar(60);
  const body = buildIcs(
    items.map((m) => ({
      uid: m.id,
      title: m.title,
      description:
        m.kind === 'member' ? [m.hostName ? `Member event hosted by ${m.hostName}` : null, m.description].filter(Boolean).join('\n\n') : m.description,
      location: m.is_online && m.onlineUrl ? m.onlineUrl : m.location,
      start: new Date(m.starts_at),
      end: new Date(m.ends_at),
      url: `${env.siteUrl}/events/${m.slug}`,
    })),
    site.shortName,
  );
  return new NextResponse(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
}
