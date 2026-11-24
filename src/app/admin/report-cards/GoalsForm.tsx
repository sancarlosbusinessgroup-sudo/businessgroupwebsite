'use client';

import { useActionState } from 'react';
import { saveReportCardGoals } from '@/app/actions/report-cards';
import { SubmitButton } from '@/components/forms';
import type { Goals } from '@/lib/report-card';
import { idle } from '@/lib/validation';

const fields: { key: keyof Goals; label: string; max: number; unit?: string }[] = [
  { key: 'attendance_pct', label: 'Attendance', max: 100, unit: '%' },
  { key: 'one_on_ones', label: 'One-on-ones', max: 200 },
  { key: 'referrals', label: 'Referrals given', max: 200 },
  { key: 'visitors', label: 'Visitors brought', max: 200 },
];

/** The group's goals per quarter (owner, 2026-11-24). Blank = no goal. */
export function GoalsForm({ goals }: { goals: Goals }) {
  const [state, action] = useActionState(saveReportCardGoals, idle);
  return (
    <form action={action} className="card flex flex-col gap-3 p-5" aria-labelledby="goals-h">
      <h2 id="goals-h" className="font-display m-0 text-xl font-extrabold">
        Goals per quarter
      </h2>
      <p className="text-ink-muted m-0 text-sm">The same goals for every member. Leave a box empty for no goal.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="label" htmlFor={`goal-${f.key}`}>
              {f.label}
              {f.unit ? ` (${f.unit})` : ''}
            </label>
            <input
              id={`goal-${f.key}`}
              name={f.key}
              type="number"
              inputMode="numeric"
              min={0}
              max={f.max}
              step={1}
              className="field"
              defaultValue={goals[f.key] ?? ''}
              placeholder="No goal"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Saving…" className="btn btn-primary btn-sm">
          Save goals
        </SubmitButton>
        {state.status !== 'idle' && state.message ? (
          <p
            role={state.status === 'error' ? 'alert' : 'status'}
            className={`m-0 text-sm font-semibold ${state.status === 'error' ? 'text-red' : 'text-green-ink'}`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
