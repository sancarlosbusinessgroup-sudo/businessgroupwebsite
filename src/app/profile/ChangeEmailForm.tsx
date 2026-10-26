'use client';

import { useActionState, useState } from 'react';
import { PasswordField, SubmitButton, TextField } from '@/components/forms';
import { type EmailChangeState } from '@/lib/validation';
import { cancelEmailCode, confirmEmailCode, requestEmailChange } from '../actions/auth';

/** My profile → Change email (owner, 2026-10-27): new address + password → 6-digit code sent there → confirmed. */
export function ChangeEmailForm({ currentEmail, pending }: { currentEmail: string; pending: string | null }) {
  const start: EmailChangeState = pending ? { status: 'idle', step: 'code', pendingEmail: pending } : { status: 'idle', step: 'start' };
  const [requestState, request] = useActionState(requestEmailChange, start);
  const [codeState, confirm] = useActionState(confirmEmailCode, start);
  const [cancelState, cancel] = useActionState(cancelEmailCode, start);
  // The most recent answer from any of the three actions decides which step shows.
  const [latest, setLatest] = useState<'request' | 'code' | 'cancel' | null>(null);
  const state = latest === 'code' ? codeState : latest === 'cancel' ? cancelState : requestState;
  const step = state.step;
  const pendingEmail = state.pendingEmail ?? requestState.pendingEmail ?? pending ?? '';
  const errors = state.errors ?? {};
  const msg =
    state.status === 'success' ? (
      <p role="status" className="text-green-ink m-0 text-sm font-semibold">
        {state.message}
      </p>
    ) : state.message ? (
      <p role="alert" className="text-red m-0 text-sm font-semibold">
        {state.message}
      </p>
    ) : null;

  return (
    <section id="email" className="card flex scroll-mt-24 flex-col gap-4 p-5" aria-labelledby="em-h">
      <h2 id="em-h" className="h3">
        Change email
      </h2>
      <p className="text-ink-muted m-0 text-sm">
        You log in with <strong className="text-ink">{currentEmail}</strong>. Group emails and the directory use the same address.
      </p>
      {step === 'code' ? (
        <form action={confirm} onSubmit={() => setLatest('code')} noValidate className="flex flex-col gap-4" aria-label="Confirm your new email">
          <p className="m-0 text-sm">
            We sent a 6-digit code to <strong>{pendingEmail}</strong>. Type it here within 15 minutes. Check the spam folder if it hasn’t arrived.
          </p>
          <input type="hidden" name="pendingEmail" value={pendingEmail} />
          <div className="max-w-60">
            <TextField
              name="code"
              id="em-code"
              label="Code from the email"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              error={errors.code}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingText="Checking…" className="btn btn-primary btn-sm">
              Confirm new email
            </SubmitButton>
            {msg}
          </div>
        </form>
      ) : null}
      {step === 'code' ? (
        <form action={cancel} onSubmit={() => setLatest('cancel')} aria-label="Use a different email">
          <SubmitButton pendingText="Cancelling…" className="btn btn-outline btn-sm">
            Use a different email
          </SubmitButton>
        </form>
      ) : (
        <form
          key={step === 'done' ? 'done' : 'start'}
          action={request}
          onSubmit={() => setLatest('request')}
          noValidate
          className="flex flex-col gap-4"
          aria-label="Change your login email"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              name="email"
              id="em-new"
              type="email"
              label="New email"
              autoComplete="email"
              required
              defaultValue={step === 'start' ? (requestState.values?.email ?? '') : ''}
              error={errors.email}
            />
            <PasswordField name="current" id="em-current" label="Current password" autoComplete="current-password" required error={errors.current} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingText="Sending code…" className="btn btn-outline btn-sm">
              Send code
            </SubmitButton>
            {msg}
          </div>
        </form>
      )}
    </section>
  );
}
