'use client';

import { useActionState } from 'react';
import { SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { referralStatusLabels } from '@/lib/content';
import { idle, referralSchema, referralStatuses, referralUpdateSchema } from '@/lib/validation';
import { sendReferral, updateReferral } from '../actions/member';

type Option = { id: string; label: string };

export function SendReferralForm({ members, defaultTo }: { members: Option[]; defaultTo?: string }) {
  const [state, action] = useActionState(sendReferral, idle);
  const { clientErrors, onSubmit } = useClientValidation(referralSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.status === 'error' ? (state.values ?? {}) : {};
  return (
    <form
      action={action}
      onSubmit={onSubmit}
      noValidate
      className="card flex min-w-0 flex-[2_1_320px] flex-col gap-3.5 p-[22px]"
      aria-labelledby="send-ref-h"
      key={state.status === 'success' ? state.message : 'form'}
    >
      <h2 id="send-ref-h" className="h3">
        File a referral slip
      </h2>
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <SelectField name="toId" label="Refer to member" required defaultValue={v.toId ?? defaultTo ?? ''} error={errors.toId} key={`to-${state.status}`}>
        <option value="">Choose a member</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </SelectField>
      <TextField name="contactName" label="Prospect name" required defaultValue={v.contactName} error={errors.contactName} />
      <TextField name="prospectPhone" type="tel" label="Prospect phone" defaultValue={v.prospectPhone} error={errors.prospectPhone} />
      <TextField name="prospectEmail" type="email" label="Prospect email" defaultValue={v.prospectEmail} error={errors.prospectEmail} />
      <TextField
        name="amount"
        inputMode="decimal"
        label="Referral value ($)"
        placeholder="e.g. 2,500"
        defaultValue={v.amount}
        error={errors.amount}
        help="Your best estimate of the business. The member who receives it can update it when the business closes."
      />
      <TextArea name="notes" label="Notes" defaultValue={v.notes} error={errors.notes} />
      <SubmitButton pendingText="Sending…">Send referral slip</SubmitButton>
    </form>
  );
}

export function UpdateReferralForm({ id, status, amount, label }: { id: string; status: string; amount: number | null; label: string }) {
  const [state, action] = useActionState(updateReferral, idle);
  const { clientErrors, onSubmit } = useClientValidation(referralUpdateSchema);
  const errors = clientErrors ?? state.errors ?? {};
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-2" aria-label={`Update referral: ${label}`}>
      <input type="hidden" name="id" value={id} />
      <div className="w-44">
        {/* key: a <select> keeps its first default when React resets the form after saving, so remount it with the saved value. */}
        <SelectField
          key={state.values?.status ?? status}
          name="status"
          id={`st-${id}`}
          label="Status"
          defaultValue={state.values?.status ?? status}
          error={errors.status}
        >
          {referralStatuses.map((s) => (
            <option key={s} value={s}>
              {referralStatusLabels[s]}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="w-36">
        <TextField
          name="amount"
          id={`amt-${id}`}
          inputMode="decimal"
          label="Value ($)"
          defaultValue={state.values?.amount ?? (amount === null ? '' : String(amount))}
          error={errors.amount}
        />
      </div>
      <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
        Save
      </SubmitButton>
      {state.status === 'success' ? (
        <span role="status" className="text-green-ink text-sm font-semibold">
          Saved
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
