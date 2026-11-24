'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDropdown } from './useDropdown';

type Item = { key: string; title: string; detail: string; href: string; tone: 'red' | 'amber' | 'teal'; tab: string };

const dot: Record<Item['tone'], string> = { red: 'bg-red', amber: 'bg-amber', teal: 'bg-teal' };
const toneWord: Record<Item['tone'], string> = { red: 'Urgent', amber: 'To do', teal: 'Follow up' };

async function fetchItems(): Promise<Item[] | null> {
  try {
    const r = await fetch('/api/admin/action-items', { cache: 'no-store' });
    if (!r.ok) return null;
    return ((await r.json()) as { items: Item[] }).items;
  } catch {
    // Offline or the server is busy: keep what we had.
    return null;
  }
}

/**
 * Admins' notification bell beside "Admin" (owner, 2026-11-24): pending guest requests, applications and everything
 * else on the Overview's "Items that Need Immediate Action". Loaded in the background (doesn't slow the page), again
 * on every page change and when the tab comes back into view.
 */
export function NotificationBell() {
  const pathname = usePathname();
  const { close, wrapProps, buttonProps, panelClass } = useDropdown();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetchItems().then((x) => {
        if (live && x) setItems(x);
      });
    void load();
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname]);

  const count = items?.length ?? 0;
  const urgent = items?.some((i) => i.tone === 'red') ?? false;
  return (
    <div {...wrapProps} className="relative w-full md:w-auto">
      <button
        {...buttonProps}
        aria-controls="admin-notifications"
        aria-label={count ? `Notifications: ${count} ${count === 1 ? 'item needs' : 'items need'} attention` : 'Notifications'}
        className="text-teal-text hover:bg-teal-tint hover:text-teal-hover relative flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-transparent px-2 transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        <span className="font-display text-[15px] font-semibold md:hidden">Notifications</span>
        {count ? (
          <span
            aria-hidden="true"
            data-testid="bell-count"
            className={`text-surface absolute top-0.5 right-0 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold md:right-0 ${urgent ? 'bg-red' : 'bg-teal-hover'}`}
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>
      <div
        id="admin-notifications"
        className={`border-line bg-surface mt-1 flex-col gap-1 rounded-2xl p-2 md:absolute md:top-full md:right-0 md:z-40 md:max-h-[75vh] md:w-[380px] md:overflow-y-auto md:border md:shadow-lg ${panelClass}`}
      >
        <p className="font-display text-heading m-0 px-2 pt-1 text-[15px] font-extrabold">Needs attention</p>
        {items === null ? (
          <p className="text-ink-muted m-0 px-2 py-2 text-sm">Loading…</p>
        ) : count === 0 ? (
          <p className="text-ink-muted m-0 px-2 py-2 text-sm">Nothing needs your attention right now.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label="Items that need attention">
            {items.slice(0, 12).map((it) => (
              <li key={it.key}>
                <Link href={it.href} onClick={close} className="hover:bg-teal-tint flex items-start gap-2 rounded-xl px-2 py-2 no-underline">
                  <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${dot[it.tone]}`} />
                  <span className="min-w-0">
                    <span className="text-heading block text-[15px] font-semibold">{it.title}</span>
                    <span className="text-ink-muted block text-[13px]">
                      {toneWord[it.tone]} · {it.tab}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin#action-items" onClick={close} className="mt-1 block px-2 py-1.5 text-sm font-bold">
          {count > 12 ? `See all ${count} on the Overview` : 'Open the Overview'}
        </Link>
      </div>
    </div>
  );
}
