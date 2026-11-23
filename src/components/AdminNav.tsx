import Link from 'next/link';

import { getViewer, isSuperAdmin } from '@/lib/auth';
import { adminLinks, adminLinksFor } from '@/lib/content';

export async function AdminNav({ current }: { current: (typeof adminLinks)[number]['href'] }) {
  // Gallery is for Super Admins only (owner, 2026-11-24); other admins don't see the tab.
  const links = adminLinksFor(isSuperAdmin(await getViewer()));
  return (
    // Even rows of tabs: two columns on phones, four on tablets and laptops, one pill-shaped row on wide screens where
    // all of them fit (a pill that wrapped onto several rows looked like a blob on phones; owner, 2026-10-24).
    <nav
      aria-label="Admin sections"
      className="bg-line-soft grid grid-cols-2 gap-1.5 rounded-[22px] p-1.5 sm:grid-cols-4 xl:flex xl:flex-wrap xl:self-start xl:rounded-[22px] xl:p-1"
    >
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.href === current ? 'page' : undefined}
          className={`font-display flex min-h-11 items-center justify-center rounded-full px-3 text-center text-sm leading-tight font-bold no-underline xl:px-5 ${
            l.href === current ? 'bg-surface text-heading' : 'text-ink-muted hover:bg-surface/70 hover:text-heading transition-colors'
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
