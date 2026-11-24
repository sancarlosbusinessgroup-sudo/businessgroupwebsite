'use client';

import { useActionState } from 'react';
import { addPanelSlot } from '@/app/actions/guests';
import { SubmitButton } from '@/components/forms';
import { idle } from '@/lib/validation';

/** Add another time to choose from (any member of Management). */
export function AddSlotForm({ interviewId }: { interviewId: string }) {
  const [state, action] = useActionState(addPanelSlot, idle);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="interviewId" value={interviewId} />
      <div>
        <label className="label" htmlFor="new-slot">
          Add another time (Pacific)
        </label>
        <input id="new-slot" name="time" type="datetime-local" step={900} className="field" required />
      </div>
      <SubmitButton pendingText="Adding…" className="btn btn-outline btn-sm">
        Add time
      </SubmitButton>
      {state.status !== 'idle' && state.message ? (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`m-0 w-full text-sm font-semibold ${state.status === 'error' ? 'text-red' : 'text-green-ink'}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
