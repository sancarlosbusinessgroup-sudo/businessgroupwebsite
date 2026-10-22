'use client';

import { useActionState } from 'react';
import { PasswordField, SubmitButton } from '@/components/forms';
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
      <PasswordField name="password" label="New password" autoComplete="new-password" required error={errors.password} help="At least 8 characters." />
      <PasswordField name="confirm" label="Confirm new password" autoComplete="new-password" required error={errors.confirm} />
      <SubmitButton pendingText="Saving…">Save password</SubmitButton>
    </form>
  );
}
