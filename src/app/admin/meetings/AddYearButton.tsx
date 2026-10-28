'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/forms';
import { Notice } from '@/components/ui';
import { idle } from '@/lib/validation';
import { adminScheduleYear } from '../../actions/admin-edit';

/** Admin → Meetings: add every-other-Monday meetings until a year from today (owner, 2026-10-28). */
export function AddYearButton() {
  const [state, action] = useActionState(adminScheduleYear, idle);
  return (
    <form action={action} className="flex flex-col gap-2">
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <div>
        <SubmitButton pendingText="Adding…" className="btn btn-outline">
          Add meetings for the next 12 months
        </SubmitButton>
      </div>
    </form>
  );
}
