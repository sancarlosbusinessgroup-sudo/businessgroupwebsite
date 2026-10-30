import type { MetadataRoute } from 'next';
import { site } from '@/lib/content';

/** Installable web app (owner, 2026-10-30): home-screen icon, full-screen, shortcuts to the reporting pages. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: site.name,
    short_name: 'BARP',
    description: 'A San Carlos business networking group: one trusted member per category, meeting every other Monday.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0c7b74',
    categories: ['business', 'social'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Report a referral', url: '/referrals', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Report a one-on-one', url: '/one-on-ones', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Meetings', url: '/meetings', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
