'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/forms';
import { idle } from '@/lib/validation';
import { saveChampion } from '../../actions/champion';

export function ChampionForm({
  month,
  members,
  current,
  autoId,
  reason,
}: {
  month: string;
  members: { id: string; name: string; points: number }[];
  current: string | null;
  autoId: string | null;
  reason: string | null;
}) {
  const [state, action] = useActionState(saveChampion, idle);
  const errors = state.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" aria-label="Choose the champion" noValidate>
      <input type="hidden" name="month" value={month} />
      <div>
        <label className="label" htmlFor="champ-who">
          Champion
        </label>
        {/* React resets the form after each submit: remount with the submitted values so a choice isn't lost on an error. */}
        <select
          key={`who-${state.values?.profileId ?? ''}`}
          id="champ-who"
          name="profileId"
          className="field"
          defaultValue={state.values?.profileId ?? current ?? autoId ?? ''}
          aria-invalid={errors.profileId ? true : undefined}
          aria-describedby={errors.profileId ? 'champ-who-error' : undefined}
        >
          <option value="">Choose a member…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.points} pts{m.id === autoId ? ' (automatic pick)' : ''}
            </option>
          ))}
        </select>
        {errors.profileId ? (
          <p className="error-text m-0" id="champ-who-error">
            {errors.profileId}
          </p>
        ) : null}
      </div>
      <div>
        <label className="label" htmlFor="champ-reason">
          Reason
        </label>
        <textarea
          key={`reason-${state.values?.reason ?? ''}`}
          id="champ-reason"
          name="reason"
          className="field min-h-24"
          maxLength={1000}
          defaultValue={state.values?.reason ?? reason ?? ''}
          aria-invalid={errors.reason ? true : undefined}
          aria-describedby={errors.reason ? 'champ-reason-error' : 'champ-reason-help'}
        />
        {errors.reason ? (
          <p className="error-text m-0" id="champ-reason-error">
            {errors.reason}
          </p>
        ) : (
          <p className="help m-0" id="champ-reason-help">
            Shown on the champion slide and profile. Required when you choose someone other than the automatic pick.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Saving…">Save champion</SubmitButton>
        {state.status === 'success' ? (
          <span role="status" className="text-green-ink text-sm font-semibold">
            {state.message}
          </span>
        ) : state.message ? (
          <span role="alert" className="text-red text-sm font-semibold">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
