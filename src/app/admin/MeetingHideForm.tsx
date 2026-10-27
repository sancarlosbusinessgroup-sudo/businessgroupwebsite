'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/forms';
import { idle } from '@/lib/validation';
import { setMeetingHidden } from '../actions/admin';

/** Hide an upcoming meeting from the website, or show a hidden one again (Admin → Meeting schedule). */
export function MeetingHideForm({ id, label, hidden }: { id: string; label: string; hidden: boolean }) {
  const [state, action] = useActionState(setMeetingHidden, idle);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2" aria-label={`${hidden ? 'Show' : 'Hide'} ${label}`}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="hidden" value={hidden ? '0' : '1'} />
      {hidden ? <span className="pill bg-amber-tint text-amber">Hidden</span> : null}
      <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
        {hidden ? 'Show on website' : 'Hide from website'}
      </SubmitButton>
      {state.status === 'success' ? (
        <span role="status" className="text-green-ink text-sm font-semibold">
          {state.message}
        </span>
      ) : state.status === 'error' && state.message ? (
        <span role="alert" className="text-red text-sm font-semibold">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
