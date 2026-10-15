'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { emailOnlySchema, idle } from '@/lib/validation';
import { requestPasswordReset } from '../actions/auth';

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, idle);
  const { clientErrors, onSubmit } = useClientValidation(emailOnlySchema);
  if (state.status === 'success') {
    return (
      <>
        <Notice tone="success">If {state.values?.email} has an account, a reset link is on its way. Check your inbox.</Notice>
        <Link href="/login" className="font-bold">
          Back to log in
        </Link>
      </>
    );
  }
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <TextField
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={(clientErrors ?? state.errors)?.email}
      />
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
