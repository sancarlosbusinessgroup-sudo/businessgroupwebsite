'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/forms';
import { Notice } from '@/components/ui';
import { resetSlideSettings, saveSlideSettings } from '@/app/actions/slides';
import { TIMER_KEYS, timerLabels, type TimerSettings } from '@/lib/slides';
import { idle, SLIDE_NOTE_MAX } from '@/lib/validation';

type Row = { key: string; label: string; shown: boolean; position: number; note: string };

export function SlideSettingsForm({ meetingId, rows, deckHref, timers }: { meetingId: string; rows: Row[]; deckHref: string; timers: TimerSettings }) {
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
        <p className="text-ink-muted m-0 text-sm">
          Untick a slide to skip it. Change the numbers to reorder (lower shows first). Use “Extra text” to add your own words to any slide, such as shout-outs,
          reminders or announcements; it appears at the bottom of that slide.
        </p>
        <ul className="m-0 flex list-none flex-col p-0">
          {rows.map((r) => (
            <li key={r.key} className="border-line-soft flex flex-wrap items-center gap-3 border-t py-3">
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
              <div className="w-full">
                <label htmlFor={`note-${r.key}`} className="text-ink-muted text-sm font-semibold">
                  Extra text<span className="sr-only"> for “{r.label}”</span>
                </label>
                <textarea
                  id={`note-${r.key}`}
                  name={`note_${r.key}`}
                  defaultValue={state.values?.[`note_${r.key}`] ?? r.note}
                  maxLength={SLIDE_NOTE_MAX}
                  rows={2}
                  className="field mt-1 min-h-0 w-full py-2"
                  aria-invalid={state.errors?.[`note_${r.key}`] ? true : undefined}
                  aria-describedby={state.errors?.[`note_${r.key}`] ? `note-${r.key}-err` : undefined}
                />
                {state.errors?.[`note_${r.key}`] ? (
                  <p id={`note-${r.key}-err`} className="text-red m-0 text-sm">
                    {state.errors[`note_${r.key}`]}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <fieldset className="border-line-soft m-0 flex flex-col gap-1 border-t p-0 pt-4">
          <legend className="font-display text-heading float-left mb-1 w-full p-0 text-lg font-bold">Timers</legend>
          <p className="text-ink-muted m-0 mb-1 text-sm">
            Timers are off unless you tick them here. Tick a timer to show it on that slide (or on the presenter’s added slides) for this meeting.
          </p>
          {TIMER_KEYS.map((k) => (
            <label key={k} className="flex min-h-9 items-center gap-2.5">
              <input
                type="checkbox"
                name={`timer_${k}`}
                defaultChecked={state.status === 'error' && state.values ? state.values[`timer_${k}`] === 'on' : timers[k]}
                className="h-5 w-5 flex-none accent-[var(--teal)]"
              />
              <span>Show timer: {timerLabels[k]}</span>
            </label>
          ))}
        </fieldset>
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
