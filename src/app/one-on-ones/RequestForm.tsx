'use client';

import { useActionState } from 'react';
import { SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { idle, oneOnOneRequestSchema } from '@/lib/validation';
import { requestOneOnOne } from '../actions/member';

type Props = { members: { id: string; label: string }[]; today: string };

/** Ask another member for a one-on-one that hasn't happened yet. */
export function RequestForm({ members, today }: Props) {
  const [state, action] = useActionState(requestOneOnOne, idle);
  const { clientErrors, onSubmit } = useClientValidation(oneOnOneRequestSchema());
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.status === 'error' ? (state.values ?? {}) : {};

  return (
    <form
      action={action}
      onSubmit={onSubmit}
      noValidate
      className="card flex flex-col gap-[18px] p-6"
      aria-labelledby="request-h"
      key={state.status === 'success' ? 'sent' : 'form'}
    >
      <div>
        <h2 id="request-h" className="font-display m-0 text-[22px]">
          Request a one-on-one
        </h2>
        <p className="text-ink-muted m-0 text-sm">For a one-on-one that hasn&apos;t happened yet. The member sees your request on this page and can accept it.</p>
      </div>
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <SelectField name="inviteeId" id="inviteeId" label="Who would you like to meet?" required defaultValue={v.inviteeId ?? ''} error={errors.inviteeId}>
        <option value="">Choose a member</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </SelectField>
      <div className="max-w-xs">
        <TextField
          name="proposedOn"
          id="proposedOn"
          type="date"
          label="Suggested date"
          min={today}
          defaultValue={v.proposedOn}
          error={errors.proposedOn}
          help="Optional. You can agree on a time together."
        />
      </div>
      <TextArea
        name="message"
        id="request-message"
        label="Message"
        placeholder="e.g. I'd love to learn more about your ideal clients. Coffee in San Carlos or Zoom?"
        defaultValue={v.message}
        error={errors.message}
        maxLength={500}
      />
      <div className="border-line-soft flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        <SubmitButton pendingText="Sending…">Send request</SubmitButton>
      </div>
    </form>
  );
}
