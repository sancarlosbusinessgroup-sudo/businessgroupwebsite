'use client';

import { useActionState } from 'react';
import { SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { warmthOptions } from '@/lib/content';
import { idle, referralSchema, referralUpdateSchema } from '@/lib/validation';
import { sendReferral, updateReferral } from '../actions/member';

type Option = { id: string; label: string };

export function SendReferralForm({ members, defaultTo }: { members: Option[]; defaultTo?: string }) {
  const [state, action] = useActionState(sendReferral, idle);
  const { clientErrors, onSubmit } = useClientValidation(referralSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.status === 'error' ? (state.values ?? {}) : {};
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="card flex min-w-0 flex-[2_1_320px] flex-col gap-3.5 p-[22px]" aria-labelledby="send-ref-h">
      <h2 id="send-ref-h" className="h3">
        Log a referral
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
      <TextField name="contactName" label="Contact name" required defaultValue={v.contactName} error={errors.contactName} />
      <SelectField name="warmth" label="How warm is it?" required defaultValue={v.warmth ?? 'warm'} error={errors.warmth}>
        {warmthOptions.map((w) => (
          <option key={w.value} value={w.value}>
            {w.label}
          </option>
        ))}
      </SelectField>
      <TextArea name="notes" label="Notes" defaultValue={v.notes} error={errors.notes} />
      <SubmitButton pendingText="Sending…">Send referral</SubmitButton>
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
      <div className="w-36">
        <SelectField name="status" id={`st-${id}`} label="Status" defaultValue={state.values?.status ?? status}>
          <option value="sent">Sent</option>
          <option value="contacted">Contacted</option>
          <option value="closed">Closed</option>
          <option value="not_a_fit">Not a fit</option>
        </SelectField>
      </div>
      <div className="w-32">
        <TextField
          name="closedAmount"
          id={`amt-${id}`}
          label="Amount ($)"
          inputMode="decimal"
          defaultValue={state.values?.closedAmount ?? (amount ? String(amount) : '')}
          error={errors.closedAmount}
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
