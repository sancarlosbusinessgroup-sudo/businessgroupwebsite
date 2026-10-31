'use client';

import { useActionState, useState } from 'react';
import { SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { idle, memberGuestInviteSchema } from '@/lib/validation';
import { submitMemberGuestInvite } from '@/app/actions/public';

export type GuestMeeting = { id: string; label: string };

type Props = {
  meetings: GuestMeeting[];
  /** The signed-in member's name: shown, read-only, as "Invited by". */
  memberName: string;
  /** Field id prefix, so two copies of the form never share ids. */
  idPrefix?: string;
  className?: string;
};

/**
 * Members' version of the guest invite form (owner, 2026-10-30): the member fills in the guest's details. "Invited by"
 * is the signed-in member, filled in automatically. After sending, "Invite another guest" starts a fresh form.
 */
export function MemberGuestInviteForm(props: Props) {
  const [round, setRound] = useState(0);
  return <InviteForm key={round} {...props} onAnother={() => setRound((r) => r + 1)} />;
}

function InviteForm({ meetings, memberName, idPrefix = 'mg', className = '', onAnother }: Props & { onAnother: () => void }) {
  const [state, action] = useActionState(submitMemberGuestInvite, idle);
  const { clientErrors, onSubmit } = useClientValidation(memberGuestInviteSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.values ?? {};
  const id = (name: string) => `${idPrefix}-${name}`;

  if (state.status === 'success') {
    return (
      <div className={`card flex flex-col items-start gap-2.5 p-7 ${className}`} role="status">
        <h3 className="font-display m-0 text-[22px]">Invitation request sent for {state.message}!</h3>
        <p className="text-ink-soft m-0">
          We emailed your guest to let them know you invited them. A member of the Membership Committee will send them the Zoom link and a calendar invite
          before the meeting. You&apos;ll see them under &ldquo;Your recent guests&rdquo; on your dashboard.
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={onAnother}>
          Invite another guest
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={onSubmit}
      noValidate
      className={`card grid min-w-0 grid-cols-1 gap-4 p-7 sm:grid-cols-2 ${className}`}
      aria-describedby={id('note')}
    >
      {state.status === 'error' && state.message ? (
        <div className="sm:col-span-2">
          <Notice tone="error">{state.message}</Notice>
        </div>
      ) : null}
      <TextField
        id={id('firstName')}
        name="firstName"
        label="Guest first name"
        autoComplete="off"
        required
        defaultValue={v.firstName}
        error={errors.firstName}
      />
      <TextField id={id('lastName')} name="lastName" label="Guest last name" autoComplete="off" required defaultValue={v.lastName} error={errors.lastName} />
      <TextField id={id('email')} name="email" type="email" label="Guest email" autoComplete="off" required defaultValue={v.email} error={errors.email} />
      <TextField id={id('phone')} name="phone" type="tel" label="Guest phone" autoComplete="off" required defaultValue={v.phone} error={errors.phone} />
      <TextField
        id={id('businessName')}
        name="businessName"
        label="Guest business name"
        autoComplete="off"
        defaultValue={v.businessName}
        error={errors.businessName}
      />
      <TextField
        id={id('website')}
        name="website"
        type="url"
        label="Guest website"
        autoComplete="off"
        placeholder="https://"
        defaultValue={v.website}
        error={errors.website}
      />
      <div className="sm:col-span-2">
        <TextArea
          id={id('businessDescription')}
          name="businessDescription"
          label="Tell us about your guest's business"
          help="Briefly describe their business, industry and the services they offer, so we can check it doesn't overlap with an existing member's category."
          required
          rows={3}
          maxLength={1000}
          defaultValue={v.businessDescription}
          error={errors.businessDescription}
        />
      </div>
      <TextField
        id={id('invitedBy')}
        name="invitedByDisplay"
        label="Invited by"
        className="field bg-canvas text-ink-soft cursor-default"
        value={memberName}
        readOnly
        help="That's you: the invitation is credited to you."
      />
      <SelectField id={id('meetingId')} name="meetingId" label="Which meeting?" defaultValue={v.meetingId} error={errors.meetingId}>
        {meetings.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </SelectField>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Sending…" className="btn btn-primary w-full">
          Send the invitation request
        </SubmitButton>
        <p id={id('note')} className="help m-0 mt-2">
          We email your guest to let them know you invited them, then send the Zoom link before the meeting.
        </p>
      </div>
    </form>
  );
}
