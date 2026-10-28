import type { MetadataRoute } from 'next';
import { site } from '@/lib/content';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: 'BARP',
    description: 'A San Carlos business networking group: one trusted member per category, meeting every other Monday.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0c7b74',
    icons: [{ src: '/icon.png', sizes: 'any', type: 'image/png' }],
  };
}
