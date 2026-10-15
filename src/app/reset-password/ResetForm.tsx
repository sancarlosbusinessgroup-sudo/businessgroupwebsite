'use client';

import { useActionState } from 'react';
import { SubmitButton, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { idle, newPasswordSchema } from '@/lib/validation';
import { updatePassword } from '../actions/auth';

export function ResetForm() {
  const [state, action] = useActionState(updatePassword, idle);
  const { clientErrors, onSubmit } = useClientValidation(newPasswordSchema);
  const errors = clientErrors ?? state.errors ?? {};
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <TextField
        name="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        required
        error={errors.password}
        help="At least 8 characters."
      />
      <TextField name="confirm" type="password" label="Confirm new password" autoComplete="new-password" required error={errors.confirm} />
      <SubmitButton pendingText="Saving…">Save password</SubmitButton>
    </form>
  );
}
