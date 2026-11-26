'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useTransition } from 'react';

/**
 * Period filter (owner, 2026-11-25): any month, this quarter, this year or all time. Changing it reloads only the
 * numbers on this page (the address keeps the choice, so the page can be shared or bookmarked); focus stays on the menu.
 * Without JavaScript the "Show" button submits the form instead.
 */
export function PeriodPicker({
  name,
  value,
  choices,
  label = 'Show numbers for',
  defaultValue,
}: {
  /** Address parameter, e.g. "p". */
  name: string;
  value: string;
  choices: { value: string; label: string }[];
  label?: string;
  /** The value that needs no parameter (this month). */
  defaultValue: string;
}) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const select = useRef<HTMLSelectElement>(null);
  const chose = useRef(false);
  // The page's navigation moves focus; put it back on the menu once the new numbers are in.
  useEffect(() => {
    if (chose.current && !pending) {
      chose.current = false;
      select.current?.focus();
    }
  }, [value, pending]);

  function choose(v: string) {
    chose.current = true;
    const next = new URLSearchParams(params.toString());
    if (v === defaultValue) next.delete(name);
    else next.set(name, v);
    const qs = next.toString();
    startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false }));
  }

  return (
    <form method="get" action={pathname} className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <label htmlFor={id} className="text-ink-muted text-sm font-bold">
        {label}
      </label>
      <select ref={select} id={id} name={name} className="field w-auto min-w-[200px] py-1.5" value={value} onChange={(e) => choose(e.target.value)}>
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="btn btn-outline btn-sm">
          Show
        </button>
      </noscript>
    </form>
  );
}
