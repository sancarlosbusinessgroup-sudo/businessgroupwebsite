'use client';

import { useEffect } from 'react';

/** Registers the service worker that makes the site installable and shows /offline without a connection. */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
