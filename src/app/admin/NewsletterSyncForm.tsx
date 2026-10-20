'use client';

import { useActionState } from 'react';
import { syncNewsletter } from '@/app/actions/admin';
import { SubmitButton } from '@/components/forms';
import { idle } from '@/lib/validation';

export function NewsletterSyncForm() {
  const [state, action] = useActionState(syncNewsletter, idle);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton pendingText="Syncing…" className="btn btn-outline btn-sm">
        Sync newsletter list
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
    </form>
  );
}
