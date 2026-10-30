'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/forms';
import { idle } from '@/lib/validation';
import { setMeetingCancelled } from '../actions/admin';

/** Cancel a meeting with a reason (it stays on the schedule), or restore a cancelled one. */
export function MeetingCancelForm({ id, label, reason }: { id: string; label: string; reason: string | null }) {
  const [state, action] = useActionState(setMeetingCancelled, idle);
  const status =
    state.status === 'success' ? (
      <span role="status" className="text-green-ink self-center text-sm font-semibold">
        {state.message}
      </span>
    ) : state.status === 'error' && state.message && !state.errors?.reason ? (
      <span role="alert" className="text-red self-center text-sm font-semibold">
        {state.message}
      </span>
    ) : null;

  if (reason)
    return (
      <form action={action} className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label={`Restore ${label}`}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="restore" value="1" />
        <span className="text-red text-sm font-semibold">Cancelled: {reason}</span>
        <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
          Restore meeting
        </SubmitButton>
        {status}
      </form>
    );

  const fid = `reason-${id}`;
  const error = state.errors?.reason;
  return (
    <form action={action} className="flex flex-wrap items-start gap-2" aria-label={`Cancel ${label}`} noValidate>
      <input type="hidden" name="id" value={id} />
      <div className="flex w-full flex-col gap-1 sm:w-60">
        <label htmlFor={fid} className="sr-only">
          Reason for cancelling
        </label>
        <input
          id={fid}
          name="reason"
          className="field min-h-11"
          placeholder="Reason, e.g. Thanksgiving"
          maxLength={120}
          defaultValue={state.values?.reason}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-error` : undefined}
        />
        {error ? (
          <p className="error-text m-0" id={`${fid}-error`}>
            {error}
          </p>
        ) : null}
      </div>
      <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
        Cancel meeting
      </SubmitButton>
      {status}
    </form>
  );
}
