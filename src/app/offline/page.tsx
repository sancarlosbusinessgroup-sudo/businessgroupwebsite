import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/lib/content';

export const metadata: Metadata = { title: 'Offline', robots: { index: false } };

/** Shown by the service worker when a page can't be loaded because there is no connection. */
export default function OfflinePage() {
  return (
    <div className="container-site flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="h1">You’re offline</h1>
      <p className="text-ink-soft m-0 max-w-[480px] text-lg">{site.name} needs a connection for this page. Check your Wi-Fi or mobile data and try again.</p>
      <Link className="btn btn-primary" href="/">
        Try again
      </Link>
    </div>
  );
}
