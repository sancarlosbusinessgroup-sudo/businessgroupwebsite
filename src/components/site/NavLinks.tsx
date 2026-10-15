'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

type Item = { href: string; label: string };

export function NavLinks({ items, actions }: { items: readonly Item[]; actions: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm ml-auto md:hidden"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Close' : 'Menu'}
      </button>
      <div
        id="site-nav"
        className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-3 md:flex md:w-auto md:flex-1 md:flex-row md:flex-wrap md:items-center md:justify-between`}
      >
        <nav aria-label="Main" className="flex flex-col gap-1 md:flex-row md:flex-wrap">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center rounded-full px-3 text-[15px] font-semibold no-underline ${
                  active ? 'bg-teal-tint text-teal-hover' : 'text-ink-soft hover:text-heading'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      </div>
    </>
  );
}
