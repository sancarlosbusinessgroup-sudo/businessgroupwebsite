'use client';

import { useActionState, useState } from 'react';
import { SelectField, SubmitButton, TextArea } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { correctionSchema, idle } from '@/lib/validation';
import { requestCorrection } from '../actions/member';

export function CorrectionForm({ meetings }: { meetings: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(requestCorrection, idle);
  const { clientErrors, onSubmit } = useClientValidation(correctionSchema);
  const errors = clientErrors ?? state.errors ?? {};

  if (state.status === 'success') return <Notice tone="success">Thanks. An admin will review your attendance.</Notice>;
  if (!open)
    return (
      <p className="text-ink-muted m-0 text-sm">
        Something wrong?{' '}
        <button
          type="button"
          className="text-teal-text cursor-pointer border-0 bg-transparent p-0 font-bold underline"
          onClick={() => setOpen(true)}
          aria-expanded={false}
        >
          Request an attendance correction
        </button>
      </p>
    );
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="border-line flex flex-col gap-3 rounded-xl border p-4" aria-label="Attendance correction">
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <SelectField name="meetingId" label="Meeting" defaultValue={state.values?.meetingId ?? ''} error={errors.meetingId}>
        <option value="">Choose a meeting</option>
        {meetings.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </SelectField>
      <TextArea name="note" label="What needs fixing?" required defaultValue={state.values?.note} error={errors.note} />
      <div className="flex gap-2">
        <SubmitButton pendingText="Sending…" className="btn btn-primary btn-sm">
          Send request
        </SubmitButton>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
