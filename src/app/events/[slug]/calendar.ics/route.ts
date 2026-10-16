import { site } from '@/lib/content';
import { NextResponse } from 'next/server';
import { getCalendarItemBySlug } from '@/lib/data/events';
import { env } from '@/lib/env';
import { buildIcs } from '@/lib/ics';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return new NextResponse('Not found', { status: 404 });
  const m = await getCalendarItemBySlug(slug);
  if (!m) return new NextResponse('Not found', { status: 404 });
  const url = `${env.siteUrl}/events/${m.slug}`;
  const body = buildIcs(
    [
      {
        uid: m.id,
        title: m.title,
        description:
          m.kind === 'group'
            ? `${m.description ?? ''}\n\nMembers: join from ${env.siteUrl}/meetings`
            : [m.hostName ? `Member event hosted by ${m.hostName}` : null, m.description].filter(Boolean).join('\n\n'),
        location: m.is_online && m.onlineUrl ? m.onlineUrl : m.location,
        start: new Date(m.starts_at),
        end: new Date(m.ends_at),
        url,
      },
    ],
    site.shortName,
  );
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${m.slug}.ics"`,
    },
  });
}
