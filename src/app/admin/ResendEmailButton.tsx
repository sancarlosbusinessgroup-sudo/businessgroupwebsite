'use client';

import { useActionState } from 'react';
import { resendEmail } from '@/app/actions/admin';
import { SubmitButton } from '@/components/forms';
import { idle } from '@/lib/validation';

// Stays mounted after a successful resend (the row turns "Sent"), so the confirmation is still shown and announced.
export function ResendEmailButton({ id, to, failed }: { id: number; to: string; failed: boolean }) {
  const [state, action] = useActionState(resendEmail, idle);
  if (!failed && state.status === 'idle') return null;
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      {failed ? (
        <SubmitButton pendingText="Sending…" className="btn btn-outline btn-sm">
          Resend<span className="sr-only"> email to {to}</span>
        </SubmitButton>
      ) : null}
      {state.status !== 'idle' && state.message ? (
        <span
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-sm font-semibold ${state.status === 'error' ? 'text-red' : 'text-green-ink'}`}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
