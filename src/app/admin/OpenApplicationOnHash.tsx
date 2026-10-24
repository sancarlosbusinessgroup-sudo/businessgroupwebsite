'use client';

import { useEffect } from 'react';

/**
 * Guest list "See application" links jump to #application-<id> in Pending applications; this opens that
 * person's "View application" details so the answers show straight away (owner, 2026-10-24).
 */
export function OpenApplicationOnHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith('application-')) return;
      const details = document.getElementById(id)?.querySelector('details');
      if (details) details.open = true;
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}
