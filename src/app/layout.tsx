import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '@/components/site/Footer';
import { Header } from '@/components/site/Header';
import { site } from '@/lib/content';
import { env } from '@/lib/env';
import { jakarta, sourceSans } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: site.name, template: `%s · ${site.shortName}` },
  description: 'A San Carlos business networking group: meet every other Monday, refer each other, and grow together across the SF Peninsula.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1a20' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${sourceSans.variable}`}>
      <body>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
