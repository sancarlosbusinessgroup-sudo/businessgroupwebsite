'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/forms';
import { Notice } from '@/components/ui';
import { resetSlideSettings, saveSlideSettings } from '@/app/actions/slides';
import { idle } from '@/lib/validation';

type Row = { key: string; label: string; shown: boolean; position: number };

export function SlideSettingsForm({ meetingId, rows, deckHref }: { meetingId: string; rows: Row[]; deckHref: string }) {
  const [state, action] = useActionState(saveSlideSettings, idle);
  const [resetState, reset] = useActionState(resetSlideSettings, idle);
  const formKey = `${state.status}-${resetState.status}-${resetState.message ?? ''}`;
  return (
    <div className="flex flex-col gap-4">
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' ? <Notice tone="error">{state.message}</Notice> : null}
      {resetState.status === 'success' ? <Notice tone="success">{resetState.message}</Notice> : null}
      {resetState.status === 'error' ? <Notice tone="error">{resetState.message}</Notice> : null}
      <form action={action} className="card flex flex-col gap-3 p-5" aria-label="Slides to show" key={formKey}>
        <input type="hidden" name="meetingId" value={meetingId} />
        <p className="text-ink-muted m-0 text-sm">Untick a slide to skip it. Change the numbers to reorder (lower shows first).</p>
        <ul className="m-0 flex list-none flex-col p-0">
          {rows.map((r) => (
            <li key={r.key} className="border-line-soft flex flex-wrap items-center gap-3 border-t py-2.5">
              <input
                id={`show-${r.key}`}
                type="checkbox"
                name={`show_${r.key}`}
                defaultChecked={r.shown}
                aria-label={`Show “${r.label}”`}
                className="h-5 w-5 flex-none accent-[var(--teal)]"
              />
              <label htmlFor={`show-${r.key}`} className="min-w-0 flex-1 font-semibold" aria-hidden="true">
                {r.label}
              </label>
              <label className="text-ink-muted flex items-center gap-2 text-sm">
                <span aria-hidden="true">Position</span>
                <input
                  type="number"
                  name={`order_${r.key}`}
                  defaultValue={r.position}
                  min={0}
                  max={99}
                  className="field w-20"
                  aria-label={`Position of “${r.label}”`}
                />
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingText="Saving…">Save slides</SubmitButton>
          <Link className="btn btn-outline" href={deckHref}>
            Open the slides
          </Link>
        </div>
      </form>
      <form action={reset}>
        <input type="hidden" name="meetingId" value={meetingId} />
        <SubmitButton pendingText="Resetting…" className="btn btn-outline btn-sm">
          Reset to the standard agenda
        </SubmitButton>
      </form>
    </div>
  );
}
