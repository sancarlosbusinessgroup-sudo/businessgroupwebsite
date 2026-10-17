'use client';

import { useActionState } from 'react';
import { SubmitButton, TextField } from '@/components/forms';
import { idle } from '@/lib/validation';
import { setMeetingCancelled } from '../actions/admin';

/** Cancel a meeting with a reason (it stays on the schedule), or restore a cancelled one. */
export function MeetingCancelForm({ id, label, reason }: { id: string; label: string; reason: string | null }) {
  const [state, action] = useActionState(setMeetingCancelled, idle);
  const status =
    state.status === 'success' ? (
      <span role="status" className="text-green-ink text-sm font-semibold">
        {state.message}
      </span>
    ) : state.status === 'error' && state.message ? (
      <span role="alert" className="text-red text-sm font-semibold">
        {state.message}
      </span>
    ) : null;

  if (reason)
    return (
      <form action={action} className="flex flex-wrap items-center gap-2" aria-label={`Restore ${label}`}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="restore" value="1" />
        <span className="text-red text-sm font-semibold">Cancelled: {reason}</span>
        <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
          Restore meeting
        </SubmitButton>
        {status}
      </form>
    );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2" aria-label={`Cancel ${label}`} noValidate>
      <input type="hidden" name="id" value={id} />
      <div className="w-64">
        <TextField
          name="reason"
          id={`reason-${id}`}
          label="Reason"
          placeholder="e.g. Thanksgiving holiday"
          maxLength={120}
          defaultValue={state.values?.reason}
          error={state.errors?.reason}
        />
      </div>
      <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
        Cancel meeting
      </SubmitButton>
      {status}
    </form>
  );
}
