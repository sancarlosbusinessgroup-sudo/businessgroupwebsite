'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { COUNTED_BADGE, filingNotices, WAITING_BADGE, type FilingKind } from '@/lib/filing-notices';
import type { ActionState } from '@/lib/validation';

// Pop-up after filing a referral, one-on-one, closed business or visitor (owner, 2026-11-26): says whether it already
// counts in the stats, leaderboards and slides, or waits for the other member's confirmation.
//
// One host for the whole site (in the root layout), fed by the forms' actions. It can't live inside a form: marking a
// slip "Closed business" moves it to another list, which removes its form before a pop-up inside it could open.

type Shown = { kind: FilingKind; n: number } | null;
let shown: Shown = null;
let count = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function announceFiling(kind: FilingKind) {
  shown = { kind, n: ++count };
  emit();
}
function dismiss() {
  shown = null;
  emit();
}

/** Wraps a form's server action: when it reports a filing, the pop-up opens (also if the form disappears). */
export function withFilingNotice(action: (prev: ActionState, data: FormData) => Promise<ActionState>) {
  return async (prev: ActionState, data: FormData) => {
    const result = await action(prev, data);
    if (result.status === 'success' && result.filing) announceFiling(result.filing);
    return result;
  };
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** "Got it", Escape or a click outside closes it. The form's own "saved" message stays on the page too. */
export function FilingNoticeHost() {
  const current = useSyncExternalStore(
    subscribe,
    () => shown,
    () => null,
  );
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (current && !d.open) d.showModal();
    if (!current && d.open) d.close();
  }, [current]);

  const notice = current ? filingNotices[current.kind] : null;
  return (
    <dialog
      ref={ref}
      // Only point at the title and text while they exist (a closed pop-up has none).
      aria-labelledby={current ? 'filing-notice-title' : undefined}
      aria-describedby={current ? 'filing-notice-body' : undefined}
      data-filing-notice={current?.kind}
      onClose={dismiss}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
      className="bg-canvas text-ink m-auto w-[min(480px,calc(100%-32px))] max-w-none rounded-[20px] border-0 p-0 backdrop:bg-black/60"
    >
      {notice ? (
        <div className="flex flex-col gap-3 p-6" key={current?.n}>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-extrabold tracking-[0.06em] uppercase ${notice.counted ? 'bg-teal-tint text-teal-text' : 'bg-amber-tint text-amber'}`}
          >
            {notice.counted ? COUNTED_BADGE : WAITING_BADGE}
          </span>
          <h2 id="filing-notice-title" className="font-display m-0 text-[clamp(20px,2.6vw,24px)] leading-tight font-extrabold">
            {notice.title}
          </h2>
          <div id="filing-notice-body" className="flex flex-col gap-2">
            <p className="m-0">{notice.body}</p>
            {notice.next ? <p className="text-ink-soft m-0 text-sm">{notice.next}</p> : null}
          </div>
          <button type="button" className="btn btn-primary mt-1 self-end" onClick={dismiss} autoFocus>
            Got it
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
