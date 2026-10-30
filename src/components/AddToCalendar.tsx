'use client';

import { useEffect, useId, useRef } from 'react';
import { calendarLinks, type CalendarEventInput } from '@/lib/calendar-links';

/**
 * "Add to calendar" menu: Google, Outlook.com, Microsoft 365, Yahoo, Apple Calendar (.ics) and a plain .ics download.
 * A <details> disclosure, so it works before the page hydrates; closes on Escape and on a click outside. When open it
 * takes the full row and lists the calendars below the button.
 */
export function AddToCalendar({
  event,
  icsHref,
  buttonClass = 'btn btn-outline',
  srSuffix,
}: {
  event: { title: string; starts_at: string; ends_at: string; details?: string | null; location?: string | null };
  icsHref: string;
  buttonClass?: string;
  /** Extra screen-reader text after "Add to calendar", e.g. " for Networking meeting". */
  srSuffix?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const id = useId();
  const input: CalendarEventInput = {
    title: event.title,
    start: new Date(event.starts_at),
    end: new Date(event.ends_at),
    details: event.details,
    location: event.location,
  };
  const links = calendarLinks(input);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDown = (e: MouseEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && el.open) {
        el.open = false;
        el.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  const item = 'text-ink hover:bg-teal-tint flex min-h-11 items-center rounded-lg px-3 text-[15px] font-semibold no-underline';

  return (
    <details ref={ref} className="add-to-calendar open:basis-full">
      <summary className={`${buttonClass} cursor-pointer list-none gap-1.5 [&::-webkit-details-marker]:hidden`} aria-describedby={`${id}-hint`}>
        Add to calendar{srSuffix ? <span className="sr-only">{srSuffix}</span> : null}
        <span aria-hidden="true" className="text-[0.8em]">
          ▾
        </span>
      </summary>
      <span id={`${id}-hint`} className="sr-only">
        Opens a list of calendar apps
      </span>
      {/* In the page flow, not floating: cards and the Home hero clip anything that sticks out. */}
      <ul className="bg-surface border-line m-0 mt-2 grid list-none grid-cols-1 gap-0.5 rounded-xl border p-1.5 shadow-md sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.id}>
            <a className={item} href={l.href} target="_blank" rel="noopener noreferrer" onClick={close}>
              {l.label}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
        <li>
          <a className={item} href={icsHref} onClick={close}>
            Apple Calendar
          </a>
        </li>
        <li>
          <a className={item} href={icsHref} download onClick={close}>
            Download .ics file
          </a>
        </li>
      </ul>
    </details>
  );
}
