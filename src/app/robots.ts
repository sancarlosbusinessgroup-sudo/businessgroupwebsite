import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/** Search engines may index the public pages; member-only and account pages are kept out (audit, 2026-10-27). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/dashboard',
        '/profile',
        '/referrals',
        '/closed-business',
        '/one-on-ones',
        '/present',
        '/onboarding',
        '/pending',
        '/auth',
        '/api',
        '/choose-password',
        '/reset-password',
        '/forgot-password',
        '/login',
        '/join',
      ],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
