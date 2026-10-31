'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminLinks } from '@/lib/content';
import { useDropdown } from './useDropdown';

/**
 * Header "Admin" dropdown (owner, 2026-10-30): every admin section, in the same order as the admin tabs.
 * Disclosure pattern like "Report Activity": a button that opens a list of links; Escape or a click outside closes it.
 */
export function AdminMenu() {
  const pathname = usePathname();
  const { open, close, wrapProps, buttonProps, panelClass } = useDropdown();
  const active = pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/present/');

  const isCurrent = (href: string) =>
    href === '/admin'
      ? pathname === '/admin'
      : href === '/present/next'
        ? pathname.startsWith('/present/')
        : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div {...wrapProps} className="relative w-full md:w-auto">
      <button
        {...buttonProps}
        aria-controls="admin-menu"
        className={`font-display hover:bg-teal-tint hover:text-teal-hover flex min-h-11 cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-3 text-[15px] font-bold transition-colors ${
          active ? 'text-teal-hover' : 'text-teal-text'
        }`}
      >
        Admin
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden="true">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>
      <ul
        id="admin-menu"
        aria-label="Admin sections"
        className={`border-line bg-surface m-0 mt-1 list-none flex-col gap-0.5 rounded-2xl p-1.5 md:absolute md:top-full md:right-0 md:z-40 md:max-h-[75vh] md:min-w-[230px] md:overflow-y-auto md:border md:shadow-lg ${panelClass}`}
      >
        {adminLinks.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={isCurrent(l.href) ? 'page' : undefined}
              onClick={close}
              className={`font-display flex min-h-11 items-center rounded-full px-3 text-[15px] font-semibold no-underline ${
                isCurrent(l.href) ? 'bg-teal-tint text-teal-hover' : 'text-ink-soft hover:bg-teal-tint hover:text-teal-hover transition-colors'
              }`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
