import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '@/components/site/Footer';
import { Header } from '@/components/site/Header';
import { LiveChat } from '@/components/site/LiveChat';
import { getViewer } from '@/lib/auth';
import { chatVisitor, tidioConfigFromEnv } from '@/lib/chat';
import { site } from '@/lib/content';
import { env } from '@/lib/env';
import { jakarta, sourceSans } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: site.name, template: `%s · ${site.shortName}` },
  description: 'A local business networking group: meet every other Monday, refer each other, and grow together across the SF Peninsula.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1919' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const chat = tidioConfigFromEnv();
  const viewer = chat ? await getViewer() : null;
  const approved = viewer?.profile?.status === 'approved';
  return (
    <html lang="en" className={`${jakarta.variable} ${sourceSans.variable}`}>
      <body>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        {chat ? (
          <LiveChat {...chat} visitor={approved ? chatVisitor(viewer?.userId ?? null, viewer?.profile ?? null, viewer?.email ?? null) : undefined} />
        ) : null}
      </body>
    </html>
  );
}
