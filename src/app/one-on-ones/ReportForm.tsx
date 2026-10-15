'use client';

import { useActionState } from 'react';
import { SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { StarRating } from '@/components/StarRating';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { idle, oneOnOneSchema } from '@/lib/validation';
import { reportOneOnOne } from '../actions/member';

type Props = { members: { id: string; label: string }[]; today: string; minDate: string; defaultPartner?: string };

export function ReportForm({ members, today, minDate, defaultPartner }: Props) {
  const [state, action] = useActionState(reportOneOnOne, idle);
  const { clientErrors, onSubmit } = useClientValidation(oneOnOneSchema());
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.status === 'error' ? (state.values ?? {}) : {};

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="card flex flex-col gap-[18px] p-6" aria-labelledby="report-h">
      <div>
        <h2 id="report-h" className="font-display m-0 text-[22px]">
          Report a one-on-one
        </h2>
        <p className="text-ink-muted m-0 text-sm">Your signed-in account is recorded as the reporter.</p>
      </div>
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <SelectField
        name="partnerId"
        label="Who did you meet with?"
        required
        defaultValue={v.partnerId ?? defaultPartner ?? ''}
        error={errors.partnerId}
        key={`p-${state.status}`}
      >
        <option value="">Choose a member</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </SelectField>
      <div className="flex flex-wrap gap-5">
        <div className="flex-[1_1_220px]">
          <TextField
            name="metOn"
            type="date"
            label="Activity date"
            required
            min={minDate}
            max={today}
            defaultValue={v.metOn ?? today}
            error={errors.metOn}
            help="Today or the previous 14 days."
          />
        </div>
        <div className="flex-[1_1_240px]">
          <StarRating
            key={`r-${state.status}`}
            name="rating"
            legend="How was the one-on-one?"
            help="Ratings are private and never shown to either participant."
            error={errors.rating}
          />
        </div>
      </div>
      <TextArea
        name="note"
        label="Private note"
        placeholder="Briefly describe the outcome or next steps."
        defaultValue={v.note}
        error={errors.note}
        help="Kept with the activity record and not included in group summaries."
      />
      <div className="border-line-soft flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span className="text-ink-muted text-sm">Private details stay out of group summaries.</span>
        <SubmitButton pendingText="Reporting…">Report one-on-one</SubmitButton>
      </div>
    </form>
  );
}
