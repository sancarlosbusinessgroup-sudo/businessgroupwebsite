'use client';

import { useActionState } from 'react';
import { idle } from '@/lib/validation';
import { setSeatLimit } from '../actions/admin';

export function SeatForm({ id, name, seatLimit, taken }: { id: number; name: string; seatLimit: number; taken: number }) {
  const [state, action] = useActionState(setSeatLimit, idle);
  const fid = `seats-${id}`;
  const error = state.errors?.seatLimit;
  return (
    <form action={action} noValidate className="flex flex-wrap items-center gap-2" aria-label={`Seats for ${name}`}>
      <input type="hidden" name="id" value={id} />
      <label htmlFor={fid} className="text-ink-muted text-sm">
        Seats
      </label>
      <input
        id={fid}
        name="seatLimit"
        type="number"
        min={1}
        max={99}
        defaultValue={state.values?.seatLimit ?? seatLimit}
        className="field w-20"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : undefined}
      />
      <button type="submit" className="btn btn-outline btn-sm">
        Save
      </button>
      <span className="text-ink-muted text-sm">{taken} taken</span>
      {state.status === 'success' ? (
        <span role="status" className="text-green-ink text-sm font-semibold">
          Saved
        </span>
      ) : null}
      {error ? (
        <span role="alert" id={`${fid}-error`} className="text-red text-sm font-semibold">
          {error}
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
