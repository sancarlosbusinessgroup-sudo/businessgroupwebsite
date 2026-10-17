'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { NavItem } from '@/lib/content';

const linkClass = (active: boolean) =>
  `flex min-h-11 items-center rounded-full px-3 text-[15px] font-semibold no-underline ${
    active ? 'bg-teal-tint text-teal-hover' : 'text-ink-soft hover:text-heading'
  }`;

/** A menu entry that opens a short list of links (disclosure pattern: button + list). */
function SubMenu({ item, isActive, onNavigate }: { item: NavItem; isActive: (href: string) => boolean; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const children = item.children ?? [];
  const active = children.some((c) => isActive(c.href));
  const id = `submenu-${item.label.toLowerCase().replace(/[^a-z]+/g, '-')}`;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`${linkClass(active)} w-full cursor-pointer gap-1.5 border-0 bg-transparent font-[inherit] md:w-auto`}
      >
        {item.label}
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden="true">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>
      <ul
        id={id}
        hidden={!open}
        className="border-line bg-surface m-0 flex list-none flex-col gap-0.5 rounded-2xl p-1.5 pl-4 md:absolute md:top-full md:left-0 md:z-40 md:mt-1 md:min-w-[200px] md:border md:pl-1.5 md:shadow-lg"
      >
        {children.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              aria-current={isActive(c.href) ? 'page' : undefined}
              onClick={() => {
                setOpen(false);
                onNavigate();
              }}
              className={linkClass(isActive(c.href))}
            >
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NavLinks({ items, actions }: { items: readonly NavItem[]; actions: ReactNode }) {
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
          {items.map((item) =>
            item.children?.length ? (
              <SubMenu key={item.label} item={item} isActive={isActive} onNavigate={() => setOpen(false)} />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={linkClass(isActive(item.href))}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      </div>
    </>
  );
}
