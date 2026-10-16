'use client';

import { useActionState } from 'react';
import { saveWeeklyAsk } from '@/app/actions/member';
import { idle } from '@/lib/validation';
import { SubmitButton, TextField } from './forms';

/** "This week I'm looking for…" (A3). Shown in the directory, on profiles and (later) on meeting slides. */
export function WeeklyAskForm({ current, updated }: { current: string | null; updated?: string | null }) {
  const [state, action] = useActionState(saveWeeklyAsk, idle);
  return (
    <form action={action} noValidate className="card flex flex-col gap-3 p-5" aria-labelledby="ask-form-h">
      <h2 id="ask-form-h" className="h3">
        My ask this week
      </h2>
      <TextField
        name="weeklyAsk"
        label="This week I'm looking for…"
        defaultValue={state.status === 'error' ? state.values?.weeklyAsk : (current ?? '')}
        maxLength={160}
        error={state.errors?.weeklyAsk}
        help={updated ? `Last updated ${updated}. Shown in the directory and on your profile.` : 'Shown in the directory and on your profile.'}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
          Save my ask
        </SubmitButton>
        {state.status === 'success' ? (
          <span role="status" className="text-green-ink text-sm font-semibold">
            {state.message}
          </span>
        ) : null}
        {state.status === 'error' && state.message ? (
          <span role="alert" className="text-red text-sm font-semibold">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
