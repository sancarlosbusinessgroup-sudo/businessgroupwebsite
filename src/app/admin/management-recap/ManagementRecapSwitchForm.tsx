'use client';

import { useActionState } from 'react';
import { setManagementRecapsEnabled } from '@/app/actions/admin';
import { SubmitButton } from '@/components/forms';
import { idle } from '@/lib/validation';

/** On/off switch for the automatic Management recap email (Admin → Management recap). */
export function ManagementRecapSwitchForm({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState(setManagementRecapsEnabled, idle);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <p className="m-0 text-sm font-semibold" data-testid="mgmt-recap-status">
        Automatic Management recap email: <span className={enabled ? 'text-green-ink' : 'text-red'}>{enabled ? 'On' : 'Off'}</span>
      </p>
      <input type="hidden" name="recaps" value={enabled ? 'off' : 'on'} />
      <SubmitButton pendingText="Saving…" className={enabled ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}>
        {enabled ? 'Turn off Management recap' : 'Turn on Management recap'}
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
