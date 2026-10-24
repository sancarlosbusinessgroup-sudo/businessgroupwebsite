'use client';

import { useActionState } from 'react';
import { sendZoomLink } from '@/app/actions/admin';
import { SubmitButton } from '@/components/forms';
import { idle } from '@/lib/validation';

/** Guest list "Send Zoom link": emails the guest the meeting's Zoom link (owner, 2026-10-24). */
export function SendZoomLinkButton({ id, name, sentOn }: { id: string; name: string; sentOn: string | null }) {
  const [state, action] = useActionState(sendZoomLink, idle);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <SubmitButton pendingText="Sending…" className={`btn btn-sm ${sentOn ? 'btn-outline' : 'btn-primary'}`}>
        {sentOn ? 'Send again' : 'Send Zoom link'}
        <span className="sr-only"> to {name}</span>
      </SubmitButton>
      {state.status !== 'idle' && state.message ? (
        <span
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-sm font-semibold ${state.status === 'error' ? 'text-red' : 'text-green-ink'}`}
        >
          {state.message}
        </span>
      ) : sentOn ? (
        <span className="text-ink-muted text-sm">Sent {sentOn}</span>
      ) : null}
    </form>
  );
}
