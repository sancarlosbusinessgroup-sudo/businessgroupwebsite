'use client';

import { useActionState } from 'react';
import { SubmitButton, TextArea, TextField } from '@/components/forms';
import { Notice } from '@/components/ui';
import { idle } from '@/lib/validation';
import { submitGuestSurvey } from '../../actions/guest-survey';

const choices = [
  ['yes', 'Yes'],
  ['maybe', 'Maybe'],
  ['no', 'No'],
] as const;

function YesMaybeNo({ name, legend, error, value }: { name: string; legend: string; error?: string; value?: string }) {
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="label">
        {legend} <span className="text-red">*</span>
      </legend>
      <div className="flex flex-wrap gap-4">
        {choices.map(([v, l]) => (
          <label key={v} className="flex min-h-11 items-center gap-2 text-base">
            <input type="radio" name={name} value={v} defaultChecked={value === v} className="h-5 w-5 accent-[var(--teal)]" />
            {l}
          </label>
        ))}
      </div>
      {error ? (
        <p className="error-text m-0" id={`${name}-error`}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function SurveyForm({ token, firstName }: { token: string; firstName: string }) {
  const [state, action] = useActionState(submitGuestSurvey, idle);
  if (state.status === 'success') {
    return (
      <Notice tone="success">
        {state.message === 'already' ? 'We already have your answers. Thank you!' : `Thank you, ${firstName}! Your answers have been sent to the group.`}
      </Notice>
    );
  }
  const errors = state.errors ?? {};
  const v = state.status === 'error' ? (state.values ?? {}) : {};
  return (
    <form action={action} noValidate className="card flex flex-col gap-5 p-7" aria-label="Visitor survey">
      <input type="hidden" name="token" value={token} />
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <YesMaybeNo name="comingBack" legend="Are you coming back?" error={errors.comingBack} value={v.comingBack} />
      <YesMaybeNo name="interestedInJoining" legend="Are you interested in joining?" error={errors.interestedInJoining} value={v.interestedInJoining} />
      <TextArea
        name="mostInteresting"
        label="What was the most interesting part of the meeting?"
        maxLength={1000}
        defaultValue={v.mostInteresting}
        error={errors.mostInteresting}
      />
      <TextField
        name="oneOnOneWith"
        label="Who would you like to have a one-on-one with?"
        maxLength={300}
        defaultValue={v.oneOnOneWith}
        error={errors.oneOnOneWith}
        help="A member’s name or the kind of business."
      />
      <TextArea name="comments" label="Anything else you’d like to tell us?" maxLength={1000} defaultValue={v.comments} error={errors.comments} />
      <SubmitButton pendingText="Sending…">Send my answers</SubmitButton>
    </form>
  );
}
