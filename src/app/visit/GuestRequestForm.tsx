'use client';

import { useActionState } from 'react';
import { SelectField, SubmitButton, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { guestRequestSchema, idle } from '@/lib/validation';
import { submitGuestRequest } from '../actions/public';

type Meeting = { id: string; label: string };

export function GuestRequestForm({ meetings, referralCode, referrerName }: { meetings: Meeting[]; referralCode?: string; referrerName?: string }) {
  const [state, action] = useActionState(submitGuestRequest, idle);
  const { clientErrors, onSubmit } = useClientValidation(guestRequestSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.values ?? {};

  if (state.status === 'success') {
    return (
      <div className="card flex flex-col items-start gap-2.5 p-7" role="status">
        <h3 className="font-display m-0 text-[22px]">You&apos;re on the list, {state.message}!</h3>
        <p className="text-ink-soft m-0">A member of the leadership team will email you the Zoom link and a calendar invite before the meeting.</p>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={onSubmit}
      noValidate
      className="card grid min-w-0 flex-[1_1_460px] grid-cols-1 gap-4 p-7 sm:grid-cols-2"
      aria-describedby="guest-form-note"
    >
      {state.status === 'error' && state.message ? (
        <div className="sm:col-span-2">
          <Notice tone="error">{state.message}</Notice>
        </div>
      ) : null}
      <TextField name="firstName" label="First name" autoComplete="given-name" required defaultValue={v.firstName} error={errors.firstName} />
      <TextField name="lastName" label="Last name" autoComplete="family-name" required defaultValue={v.lastName} error={errors.lastName} />
      <TextField name="email" type="email" label="Email" autoComplete="email" required defaultValue={v.email} error={errors.email} />
      <TextField name="businessName" label="Business name" autoComplete="organization" defaultValue={v.businessName} error={errors.businessName} />
      <TextField name="phone" type="tel" label="Phone" autoComplete="tel" required defaultValue={v.phone} error={errors.phone} />
      <TextField name="website" type="url" label="Website" autoComplete="url" placeholder="https://" defaultValue={v.website} error={errors.website} />
      <TextField
        name="invitedBy"
        label="Who invited you?"
        defaultValue={v.invitedBy ?? (referrerName ? `${referrerName} (via referral link)` : '')}
        error={errors.invitedBy}
      />
      <SelectField name="meetingId" label="Which meeting?" defaultValue={v.meetingId} error={errors.meetingId}>
        {meetings.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </SelectField>
      {referralCode ? <input type="hidden" name="referralCode" value={referralCode} /> : null}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="f-company">Company (leave empty)</label>
        <input id="f-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Sending…" className="btn btn-primary w-full">
          Send my invite request
        </SubmitButton>
        <p id="guest-form-note" className="help m-0 mt-2">
          We use your details to send the meeting invite. After the meeting, we introduce visitors to our members by name, business and the contact details you
          give here, so they can follow up with you.
        </p>
      </div>
    </form>
  );
}
