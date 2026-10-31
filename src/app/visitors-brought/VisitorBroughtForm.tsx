'use client';

import { useActionState } from 'react';
import { SelectField, SubmitButton, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { idle, visitorBroughtSchema } from '@/lib/validation';
import { logVisitorBrought } from '../actions/visitors';

type Option = { id: string; label: string };

/** Log a guest you brought to a past meeting (owner meeting 2026-10-30). */
export function VisitorBroughtForm({ meetings }: { meetings: Option[] }) {
  const [state, action] = useActionState(logVisitorBrought, idle);
  const { clientErrors, onSubmit } = useClientValidation(visitorBroughtSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.status === 'error' ? (state.values ?? {}) : {};
  return (
    <form
      action={action}
      onSubmit={onSubmit}
      noValidate
      className="card flex min-w-0 flex-[2_1_320px] flex-col gap-3.5 p-[22px]"
      aria-labelledby="log-visitor-h"
      key={state.status === 'success' ? state.message : 'form'}
    >
      <h2 id="log-visitor-h" className="h3">
        Log a visitor you brought
      </h2>
      <p className="text-ink-soft m-0 text-[15px]">
        Brought a guest to a meeting? Log them here. Each visitor counts on the leaderboard and earns you a BARP Champion point.
      </p>
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <SelectField
        name="meetingId"
        label="Meeting they attended"
        required
        defaultValue={v.meetingId ?? meetings[0]?.id ?? ''}
        error={errors.meetingId}
        key={`m-${state.status}`}
      >
        <option value="">Choose a meeting</option>
        {meetings.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <TextField name="firstName" label="Visitor first name" required autoComplete="off" defaultValue={v.firstName} error={errors.firstName} />
        <TextField name="lastName" label="Visitor last name" required autoComplete="off" defaultValue={v.lastName} error={errors.lastName} />
      </div>
      <TextField name="email" type="email" label="Visitor email" required autoComplete="off" defaultValue={v.email} error={errors.email} />
      <TextField name="businessName" label="Visitor business name" defaultValue={v.businessName} error={errors.businessName} />
      <TextField name="phone" type="tel" label="Visitor phone" defaultValue={v.phone} error={errors.phone} />
      <SubmitButton pendingText="Saving…">Log visitor</SubmitButton>
    </form>
  );
}
