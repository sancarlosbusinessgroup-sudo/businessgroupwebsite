import { site } from '@/lib/content';
import { env } from '@/lib/env';

/** Structured data for search engines (audit, 2026-10-27). Rendered as a script tag; nothing visible. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // The JSON is built here from our own data, never from user input, and "<" is escaped so it can't close the tag.
  // eslint-disable-next-line react/no-danger
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: env.siteUrl,
    logo: `${env.siteUrl}/images/logo.png`,
    foundingDate: String(site.founded),
    areaServed: site.serviceArea,
    description: 'A San Carlos business networking group: one trusted member per category, meeting every other Monday to pass referrals.',
  };
}

export function eventJsonLd(e: {
  name: string;
  startsAt: string;
  endsAt: string;
  url: string;
  online: boolean;
  location?: string | null;
  description?: string | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.name,
    startDate: e.startsAt,
    endDate: e.endsAt,
    url: e.url,
    description: e.description ?? undefined,
    eventAttendanceMode: e.online ? 'https://schema.org/OnlineEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
    location: e.online
      ? { '@type': 'VirtualLocation', url: e.url }
      : { '@type': 'Place', name: e.location ?? 'San Carlos, CA', address: e.location ?? 'San Carlos, CA' },
    organizer: { '@type': 'Organization', name: site.name, url: env.siteUrl },
  };
}
