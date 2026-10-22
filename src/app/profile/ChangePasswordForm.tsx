'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { PasswordField, SubmitButton } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { changePasswordSchema, idle } from '@/lib/validation';
import { changePassword } from '../actions/auth';

/** My profile → Change password (owner, 2026-10-23). */
export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, idle);
  const { clientErrors, onSubmit } = useClientValidation(changePasswordSchema);
  const errors = clientErrors ?? state.errors ?? {};
  return (
    <form
      id="password"
      key={state.status === 'success' ? state.message : 'form'}
      action={action}
      onSubmit={onSubmit}
      noValidate
      className="card flex scroll-mt-24 flex-col gap-4 p-5"
      aria-labelledby="pw-h"
    >
      <h2 id="pw-h" className="h3">
        Change password
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PasswordField name="current" id="pw-current" label="Current password" autoComplete="current-password" required error={errors.current} />
        <PasswordField
          name="password"
          id="pw-new"
          label="New password"
          autoComplete="new-password"
          required
          error={errors.password}
          help="At least 8 characters."
        />
        <PasswordField name="confirm" id="pw-confirm" label="Confirm new password" autoComplete="new-password" required error={errors.confirm} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
          Change password
        </SubmitButton>
        {state.status === 'success' ? (
          <span role="status" className="text-green-ink text-sm font-semibold">
            {state.message}
          </span>
        ) : state.message ? (
          <span role="alert" className="text-red text-sm font-semibold">
            {state.message}
          </span>
        ) : null}
        <Link href="/forgot-password" className="text-sm font-bold">
          Forgot your current password?
        </Link>
      </div>
    </form>
  );
}
