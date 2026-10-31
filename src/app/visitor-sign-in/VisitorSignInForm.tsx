'use client';

import { useActionState } from 'react';
import { SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { idle, visitorSignInSchema } from '@/lib/validation';
import { submitVisitorSignIn } from '../actions/public';

type Member = { id: string; name: string; business: string | null };

/** The visitor sign-in form (link shared in the Zoom chat during a meeting). */
export function VisitorSignInForm({ members, meetingToday }: { members: Member[]; meetingToday: boolean }) {
  const [state, action] = useActionState(submitVisitorSignIn, idle);
  const { clientErrors, onSubmit } = useClientValidation(visitorSignInSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.values ?? {};

  if (state.status === 'success') {
    return (
      <div className="card flex flex-col items-start gap-2.5 p-7" role="status">
        <h2 className="font-display m-0 text-[24px]">Thank you, {state.message}!</h2>
        <p className="text-ink-soft m-0">
          {v.today === 'yes'
            ? 'You’re signed in. Enjoy the meeting! After today, we introduce our visitors to the members so they can follow up with you.'
            : 'We have your details. A member of the Membership Committee will email you the Zoom link before the next meeting.'}
        </p>
      </div>
    );
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="card grid min-w-0 grid-cols-1 gap-4 p-7 sm:grid-cols-2" aria-describedby="signin-note">
      {state.status === 'error' && state.message ? (
        <div className="sm:col-span-2">
          <Notice tone="error">{state.message}</Notice>
        </div>
      ) : null}
      <TextField name="firstName" label="First name" autoComplete="given-name" required defaultValue={v.firstName} error={errors.firstName} />
      <TextField name="lastName" label="Last name" autoComplete="family-name" required defaultValue={v.lastName} error={errors.lastName} />
      <TextField name="email" type="email" label="Email" autoComplete="email" required defaultValue={v.email} error={errors.email} />
      <TextField name="phone" type="tel" label="Phone" autoComplete="tel" required defaultValue={v.phone} error={errors.phone} />
      <TextField name="businessName" label="Business name" autoComplete="organization" defaultValue={v.businessName} error={errors.businessName} />
      <TextField name="website" type="url" label="Website" autoComplete="url" placeholder="https://" defaultValue={v.website} error={errors.website} />
      <div className="sm:col-span-2">
        <TextArea
          name="businessDescription"
          label="Tell us about your business"
          help="Optional: your industry and the services you offer."
          rows={2}
          maxLength={1000}
          defaultValue={v.businessDescription}
          error={errors.businessDescription}
        />
      </div>
      <SelectField name="invitedById" label="Which member invited you?" defaultValue={v.invitedById ?? ''} error={errors.invitedById}>
        <option value="">Not in the list / not sure</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.business ? ` · ${m.business}` : ''}
          </option>
        ))}
      </SelectField>
      <TextField
        name="invitedBy"
        label="Or type who invited you"
        help="Only if they are not in the list."
        defaultValue={v.invitedBy}
        error={errors.invitedBy}
      />
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="f-company">Company (leave empty)</label>
        <input id="f-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Signing in…" className="btn btn-primary w-full">
          {meetingToday ? 'Sign in as a visitor' : 'Send my details'}
        </SubmitButton>
        <p id="signin-note" className="help m-0 mt-2">
          After the meeting, we introduce visitors to our members by name, business and the contact details you give here, so they can follow up with you.
        </p>
      </div>
    </form>
  );
}
