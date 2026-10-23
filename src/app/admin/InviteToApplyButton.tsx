'use client';

import { useActionState } from 'react';
import { inviteToApply } from '@/app/actions/admin';
import { SubmitButton } from '@/components/forms';
import { idle } from '@/lib/validation';

export function InviteToApplyButton({ id, name, sentOn }: { id: string; name: string; sentOn: string | null }) {
  const [state, action] = useActionState(inviteToApply, idle);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <SubmitButton pendingText="Sending…" className="btn btn-primary btn-sm">
        {sentOn ? 'Send again' : 'Invite to apply'}
        <span className="sr-only"> ({name})</span>
      </SubmitButton>
      {state.status !== 'idle' && state.message ? (
        <span
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-sm font-semibold ${state.status === 'error' ? 'text-red' : 'text-green-ink'}`}
        >
          {state.message}
        </span>
      ) : sentOn ? (
        <span className="text-ink-muted text-sm">Invited {sentOn}</span>
      ) : null}
    </form>
  );
}
