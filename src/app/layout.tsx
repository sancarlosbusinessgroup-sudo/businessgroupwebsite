import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '@/components/site/Footer';
import { Header } from '@/components/site/Header';
import { LiveChat } from '@/components/site/LiveChat';
import { MobileMeetingBar } from '@/components/site/MobileMeetingBar';
import { getViewer } from '@/lib/auth';
import { chatVisitor, tidioConfigFromEnv } from '@/lib/chat';
import { site } from '@/lib/content';
import { getNextMeeting } from '@/lib/data/public';
import { formatMeetingDate, formatMeetingTime } from '@/lib/dates';
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
  const [viewer, next] = await Promise.all([getViewer(), getNextMeeting().catch(() => null)]);
  const approved = viewer?.profile?.status === 'approved';
  const nextStart = next ? new Date(next.starts_at) : null;
  return (
    <html lang="en" className={`${jakarta.variable} ${sourceSans.variable}`}>
      <body>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        {next || chat ? (
          <MobileMeetingBar
            meetingId={next?.id ?? null}
            when={nextStart ? `${formatMeetingDate(nextStart)} · ${formatMeetingTime(nextStart)} PT` : null}
            member={approved}
            chatEnabled={!!chat}
          />
        ) : null}
        {chat ? (
          <LiveChat {...chat} visitor={approved ? chatVisitor(viewer?.userId ?? null, viewer?.profile ?? null, viewer?.email ?? null) : undefined} />
        ) : null}
      </body>
    </html>
  );
}
