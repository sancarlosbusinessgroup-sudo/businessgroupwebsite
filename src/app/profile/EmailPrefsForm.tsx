'use client';

import { useActionState } from 'react';
import { saveEmailPrefs } from '@/app/actions/member';
import { Checkbox, SubmitButton } from '@/components/forms';
import { type PrefKey, prefKeys, prefLabels } from '@/lib/email/prefs';
import { idle } from '@/lib/validation';

export function EmailPrefsForm({ on, isAdmin }: { on: Record<PrefKey, boolean>; isAdmin: boolean }) {
  const [state, action] = useActionState(saveEmailPrefs, idle);
  const keys = prefKeys.filter((k) => k !== 'digest' || isAdmin);
  return (
    <form id="email" action={action} noValidate className="card flex scroll-mt-24 flex-col gap-2 p-5" aria-labelledby="email-prefs-h">
      <h2 id="email-prefs-h" className="h3">
        Email notifications
      </h2>
      <p className="text-ink-muted m-0 text-sm">Account emails (approval, password reset) are always sent. Untick anything you’d rather not get.</p>
      {keys.map((k) => (
        <Checkbox key={k} name={k} label={prefLabels[k]} defaultChecked={on[k]} />
      ))}
      {!isAdmin ? <input type="hidden" name="digest" value={on.digest ? 'on' : ''} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
          Save email settings
        </SubmitButton>
        {state.status === 'success' ? (
          <span role="status" className="text-green-ink text-sm font-semibold">
            {state.message}
          </span>
        ) : null}
        {state.status === 'error' && state.message ? (
          <span role="alert" className="text-red text-sm font-semibold">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
