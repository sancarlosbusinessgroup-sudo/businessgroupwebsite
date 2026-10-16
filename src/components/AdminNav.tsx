import Link from 'next/link';

const links = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/stats', label: 'Member stats' },
  { href: '/admin/leadership', label: 'Management' },
] as const;

export function AdminNav({ current }: { current: (typeof links)[number]['href'] }) {
  return (
    <nav aria-label="Admin sections" className="bg-line-soft flex flex-wrap gap-1.5 self-start rounded-full p-1">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.href === current ? 'page' : undefined}
          className={`font-display flex min-h-11 items-center rounded-full px-5 text-sm font-bold no-underline ${
            l.href === current ? 'bg-surface text-heading' : 'text-ink-muted'
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
