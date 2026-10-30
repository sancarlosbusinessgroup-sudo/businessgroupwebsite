'use client';

import { useId, useState, type ReactNode } from 'react';
import { adminHelp, type AdminTab } from '@/lib/admin-help';

/**
 * The short description under each Admin tab's menu, ending in "Read more" (owner, 2026-10-30). Clicking it drops
 * down "How This Works": the step-by-step bullets for that tab. Pass the page's own description as children when it
 * has links or live counts; otherwise the one from admin-help.ts is used.
 */
export function HowThisWorks({ tab, children }: { tab: AdminTab; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const help = adminHelp[tab];
  return (
    <div className="how-this-works flex max-w-[820px] flex-col gap-3">
      <p className="text-ink-muted m-0">
        {children ?? help.summary}{' '}
        <button
          type="button"
          className="text-teal-text inline cursor-pointer border-0 bg-transparent p-0 font-bold whitespace-nowrap underline-offset-2 hover:underline"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Show less' : 'Read more'}
          <span aria-hidden="true" className={`ml-1 inline-block text-[0.8em] transition-transform ${open ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
      </p>
      <section id={id} hidden={!open} aria-labelledby={`${id}-h`} className="border-teal/40 bg-teal-tint/60 rounded-[14px] border p-5">
        <h2 id={`${id}-h`} className="font-display text-heading m-0 mb-2.5 flex items-center gap-2.5 text-base font-bold">
          <span aria-hidden="true" className="bg-surface text-teal-text flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold">
            ?
          </span>
          How This Works
        </h2>
        <ul className="text-ink-soft m-0 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed">
          {help.steps.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
