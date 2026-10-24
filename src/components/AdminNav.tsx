import Link from 'next/link';

const links = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/attendance', label: 'Attendance' },
  { href: '/admin/activity', label: 'Member activity' },
  { href: '/admin/champion', label: 'BARP Champion' },
  { href: '/admin/stats', label: 'Member stats' },
  { href: '/admin/leadership', label: 'Management' },
  { href: '/admin/recap', label: 'Recap preview' },
  { href: '/present/next', label: 'Meeting slides' },
] as const;

export function AdminNav({ current }: { current: (typeof links)[number]['href'] }) {
  return (
    // Even rows of tabs: two columns on phones, four on tablets and laptops, one pill-shaped row on wide screens where
    // all of them fit (a pill that wrapped onto several rows looked like a blob on phones; owner, 2026-10-24).
    <nav
      aria-label="Admin sections"
      className="bg-line-soft grid grid-cols-2 gap-1.5 rounded-[22px] p-1.5 sm:grid-cols-4 xl:flex xl:self-start xl:rounded-full xl:p-1"
    >
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.href === current ? 'page' : undefined}
          className={`font-display flex min-h-11 items-center justify-center rounded-full px-3 text-center text-sm leading-tight font-bold no-underline xl:px-5 ${
            l.href === current ? 'bg-surface text-heading' : 'text-ink-muted'
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
