'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { PasswordField, SubmitButton, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { type LoginNotice, loginNotices } from '@/lib/approval';
import { idle, loginSchema } from '@/lib/validation';
import { signInWithPassword } from '../actions/auth';

export function LoginForms({ next, linkError, notice, className = '' }: { next: string; linkError: boolean; notice: LoginNotice | null; className?: string }) {
  const [pwState, pwAction] = useActionState(signInWithPassword, idle);
  const pwV = useClientValidation(loginSchema);

  return (
    <div className={`border-line bg-surface min-w-0 flex-[1_1_400px] overflow-hidden rounded-[20px] border ${className}`}>
      <div className="flex flex-col gap-4 p-7">
        <h2 className="font-display m-0 text-2xl">Welcome back</h2>
        {notice && !pwState.message ? <Notice tone={notice === 'confirmed' ? 'success' : 'info'}>{loginNotices[notice]}</Notice> : null}
        {linkError ? <Notice tone="error">That link has expired or was already used. Please log in or request a new one.</Notice> : null}

        <div>
          <form action={pwAction} onSubmit={pwV.onSubmit} noValidate className="flex flex-col gap-4">
            {pwState.message ? <Notice tone="error">{pwState.message}</Notice> : null}
            <input type="hidden" name="next" value={next} />
            <TextField
              name="email"
              id="pw-email"
              type="email"
              label="Email"
              autoComplete="username"
              required
              defaultValue={pwState.values?.email}
              error={(pwV.clientErrors ?? pwState.errors)?.email}
            />
            <PasswordField name="password" label="Password" autoComplete="current-password" required error={(pwV.clientErrors ?? pwState.errors)?.password} />
            <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
            <Link href="/forgot-password" className="text-[15px] font-bold">
              Forgot your password?
            </Link>
          </form>
        </div>

        <p className="border-line text-ink-muted m-0 border-t pt-4 text-[15px]">
          Not a member yet?{' '}
          <Link href="/visit#request" className="font-bold">
            Request an invite
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
