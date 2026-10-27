import type { MetadataRoute } from 'next';
import { getDirectory, getUpcomingMeetings } from '@/lib/data/public';
import { getUpcomingMemberEvents } from '@/lib/data/events';
import { env } from '@/lib/env';

/** The public pages, member listings and upcoming events (audit, 2026-10-27). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl;
  const now = new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/members`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/visit`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/group-meetings`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/events`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/gallery`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/bylaws`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/support`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];
  const [members, meetings, events] = await Promise.all([
    getDirectory().catch(() => []),
    getUpcomingMeetings(12).catch(() => []),
    getUpcomingMemberEvents(50).catch(() => []),
  ]);
  return [
    ...fixed,
    ...members.map((m) => ({ url: `${base}/members/${m.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...meetings.map((m) => ({ url: `${base}/events/${m.slug}`, changeFrequency: 'weekly' as const, priority: 0.5 })),
    ...events.map((e) => ({ url: `${base}/events/${e.slug}`, changeFrequency: 'weekly' as const, priority: 0.5 })),
  ];
}
