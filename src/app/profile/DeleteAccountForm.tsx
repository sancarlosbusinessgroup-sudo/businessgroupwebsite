'use client';

import { useActionState, useState } from 'react';
import { SubmitButton, TextField } from '@/components/forms';
import { idle } from '@/lib/validation';
import { deleteMyAccount } from '../actions/auth';

/** My profile → Delete my account (owner, 2026-10-23). Two steps: open, then type DELETE. */
export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteMyAccount, idle);
  return (
    <section className="card border-red/40 flex scroll-mt-24 flex-col gap-3 p-5" aria-labelledby="del-h" id="delete-account">
      <h2 id="del-h" className="h3">
        Delete my account
      </h2>
      <p className="text-ink-muted m-0 text-sm">
        This removes your login, profile, photo, logo, contact details and meeting RSVPs for good, and you leave the directory. Referral slips and one-on-ones
        you shared with other members stay in their history as “Former member”. This can’t be undone.
      </p>
      {!open ? (
        <div>
          <button type="button" className="btn btn-outline btn-sm text-red" onClick={() => setOpen(true)}>
            Delete my account…
          </button>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-3" aria-label="Confirm account deletion" noValidate>
          <div className="max-w-xs">
            <TextField name="confirm" label="Type DELETE to confirm" autoComplete="off" required error={state.errors?.confirm} />
          </div>
          {state.message ? (
            <p role="alert" className="text-red m-0 text-sm font-semibold">
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingText="Deleting…" className="btn btn-sm bg-red text-white">
              Delete my account for good
            </SubmitButton>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
