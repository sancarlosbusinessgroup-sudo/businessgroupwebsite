'use client';

import { useActionState } from 'react';
import { SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { idle, referralSchema } from '@/lib/validation';
import { fileClosedBusiness } from '../actions/member';

type Option = { id: string; label: string };

/** Same fields as "Give a referral", but saved already marked closed business (owner, 2026-10-25). */
export function FileClosedBusinessForm({ members, today }: { members: Option[]; today: string }) {
  const [state, action] = useActionState(fileClosedBusiness, idle);
  const { clientErrors, onSubmit } = useClientValidation(referralSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.status === 'error' ? (state.values ?? {}) : {};
  return (
    <form
      action={action}
      onSubmit={onSubmit}
      noValidate
      className="card flex min-w-0 flex-[2_1_320px] flex-col gap-3.5 p-[22px]"
      aria-labelledby="file-closed-h"
      key={state.status === 'success' ? state.message : 'form'}
    >
      <h2 id="file-closed-h" className="h3">
        File a closed business
      </h2>
      <p className="text-ink-soft m-0 text-[15px]">
        Forgot to file a referral that has already turned into business? File it here. It is saved as your referral, already marked{' '}
        <strong>Closed business</strong>.
      </p>
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <SelectField name="toId" label="Referred to member" required defaultValue={v.toId ?? ''} error={errors.toId} key={`to-${state.status}`}>
        <option value="">Choose a member</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </SelectField>
      <TextField name="contactName" label="Name of referral" required defaultValue={v.contactName} error={errors.contactName} />
      <TextField name="prospectPhone" type="tel" label="Phone" defaultValue={v.prospectPhone} error={errors.prospectPhone} />
      <TextField name="prospectEmail" type="email" label="Email" defaultValue={v.prospectEmail} error={errors.prospectEmail} />
      <TextField
        name="amount"
        inputMode="decimal"
        label="Value of the business ($)"
        placeholder="e.g. 2,500"
        defaultValue={v.amount}
        error={errors.amount}
        help="The member who received the business can correct it later."
      />
      <TextArea name="notes" label="Notes" defaultValue={v.notes} error={errors.notes} />
      <div className="max-w-xs">
        <TextField
          name="referredOn"
          type="date"
          label="Date the business closed"
          max={today}
          defaultValue={v.referredOn ?? today}
          error={errors.referredOn}
          help="Any past date is fine, e.g. a deal from last month."
        />
      </div>
      <SubmitButton pendingText="Filing…">File closed business</SubmitButton>
    </form>
  );
}
