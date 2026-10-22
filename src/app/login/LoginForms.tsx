'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { PasswordField, SubmitButton, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { emailOnlySchema, idle, loginSchema, otpSchema } from '@/lib/validation';
import { sendLoginCode, signInWithPassword, verifyLoginCode } from '../actions/auth';

export function LoginForms({ next, linkError }: { next: string; linkError: boolean }) {
  const [tab, setTab] = useState<'code' | 'password'>('password');
  const [pwState, pwAction] = useActionState(signInWithPassword, idle);
  const [sendState, sendAction] = useActionState(sendLoginCode, idle);
  const [codeState, codeAction] = useActionState(verifyLoginCode, idle);
  const pwV = useClientValidation(loginSchema);
  const sendV = useClientValidation(emailOnlySchema);
  const codeV = useClientValidation(otpSchema);
  const codeSent = sendState.status === 'success';

  const tabCls = (on: boolean) =>
    `min-h-14 cursor-pointer border-0 font-display text-[15px] font-bold ${on ? 'bg-surface text-heading shadow-[inset_0_-3px_0_var(--teal)]' : 'bg-canvas text-ink-muted'}`;

  return (
    <div className="border-line bg-surface min-w-0 flex-[1_1_400px] overflow-hidden rounded-[20px] border">
      <div role="tablist" aria-label="Sign-in method" className="border-line grid grid-cols-2 border-b">
        <button
          type="button"
          role="tab"
          id="tab-password"
          aria-selected={tab === 'password'}
          aria-controls="panel-password"
          className={tabCls(tab === 'password')}
          onClick={() => setTab('password')}
        >
          Password
        </button>
        <button
          type="button"
          role="tab"
          id="tab-code"
          aria-selected={tab === 'code'}
          aria-controls="panel-code"
          className={tabCls(tab === 'code')}
          onClick={() => setTab('code')}
        >
          Email me a code
        </button>
      </div>
      <div className="flex flex-col gap-4 p-7">
        <h2 className="font-display m-0 text-2xl">Welcome back</h2>
        {linkError ? <Notice tone="error">That link has expired or was already used. Please log in or request a new one.</Notice> : null}

        <div role="tabpanel" id="panel-password" aria-labelledby="tab-password" hidden={tab !== 'password'}>
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

        <div role="tabpanel" id="panel-code" aria-labelledby="tab-code" hidden={tab !== 'code'}>
          {!codeSent ? (
            <form action={sendAction} onSubmit={sendV.onSubmit} noValidate className="flex flex-col gap-4">
              {sendState.message ? <Notice tone="error">{sendState.message}</Notice> : null}
              <input type="hidden" name="next" value={next} />
              <TextField
                name="email"
                id="code-email"
                type="email"
                label="Email"
                autoComplete="email"
                required
                defaultValue={sendState.values?.email}
                error={(sendV.clientErrors ?? sendState.errors)?.email}
              />
              <SubmitButton pendingText="Sending…">Send my code</SubmitButton>
            </form>
          ) : (
            <form action={codeAction} onSubmit={codeV.onSubmit} noValidate className="flex flex-col gap-4">
              <Notice tone="success">If {sendState.values?.email} has an account, we emailed a 6-digit code and a sign-in link. It expires in 1 hour.</Notice>
              <input type="hidden" name="email" value={sendState.values?.email ?? ''} />
              <input type="hidden" name="next" value={next} />
              <TextField
                name="code"
                label="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                className="field text-xl tracking-[0.4em]"
                error={(codeV.clientErrors ?? codeState.errors)?.code}
              />
              <SubmitButton pendingText="Checking…">Log in</SubmitButton>
            </form>
          )}
        </div>

        <p className="border-line text-ink-muted m-0 border-t pt-4 text-[15px]">
          Not a member yet?{' '}
          <Link href="/join" className="font-bold">
            Apply to join
          </Link>{' '}
          or{' '}
          <Link href="/visit" className="font-bold">
            visit as a guest
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
