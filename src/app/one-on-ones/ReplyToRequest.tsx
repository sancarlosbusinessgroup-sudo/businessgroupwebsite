'use client';

import { useActionState, useId, useState } from 'react';
import { SubmitButton } from '@/components/forms';
import { idle } from '@/lib/validation';
import { replyOneOnOneRequest } from '../actions/member';

/** "Send a message" next to Accept and Decline: e.g. to explain why you need to decline (owner, 2026-10-24). */
export function ReplyToRequest({ id, requesterName }: { id: string; requesterName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(replyOneOnOneRequest, idle);
  const fieldId = useId();
  const err = state.errors?.message;
  if (!open)
    return (
      <button type="button" className="btn btn-outline btn-sm" aria-expanded="false" onClick={() => setOpen(true)}>
        Send a message
      </button>
    );
  return (
    <form action={action} noValidate className="bg-canvas flex basis-full flex-col gap-2 rounded-xl p-3" aria-label={`Message to ${requesterName}`}>
      <input type="hidden" name="id" value={id} />
      <label className="label" htmlFor={fieldId}>
        Your message <span className="text-ink-muted font-normal">(for example why you need to decline, or another time that suits you)</span>
      </label>
      <textarea
        id={fieldId}
        name="message"
        className="field min-h-[88px]"
        maxLength={500}
        defaultValue={state.status === 'success' ? '' : (state.values?.message ?? '')}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? `${fieldId}-error` : undefined}
      />
      {err ? (
        <p className="error-text m-0" id={`${fieldId}-error`}>
          {err}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingText="Sending…" className="btn btn-primary btn-sm">
          Send message
        </SubmitButton>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>
          Close
        </button>
        {state.status === 'success' ? (
          <p role="status" className="text-teal-text m-0 text-sm font-semibold">
            Message sent.
          </p>
        ) : null}
        {state.status === 'error' && state.message ? (
          <p role="alert" className="text-red m-0 text-sm font-semibold">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
