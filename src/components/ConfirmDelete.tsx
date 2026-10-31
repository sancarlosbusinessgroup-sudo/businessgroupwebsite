'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

function Yes() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-sm bg-red text-white" disabled={pending}>
      {pending ? 'Deleting…' : 'Yes, delete'}
    </button>
  );
}

/** "Delete" with a second, inline confirmation so nothing is removed by a stray click (owner, 2026-10-23). */
export function ConfirmDelete({
  action,
  id,
  what,
  className = '',
  extra,
  label = 'Delete',
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  /** e.g. "referral to Ana Lee" — used in the button's accessible name and the question. */
  what: string;
  className?: string;
  /** Extra hidden fields, e.g. where to go afterwards. */
  extra?: Record<string, string>;
  /** Visible button text (default "Delete"). */
  label?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" className={`btn btn-outline btn-sm text-red ${className}`} onClick={() => setAsking(true)}>
        {label}
        {label === 'Delete' ? <span className="sr-only"> {what}</span> : null}
      </button>
    );
  return (
    <form action={action} className={`flex flex-wrap items-center gap-2 text-sm ${className}`} aria-label={`Delete ${what}`}>
      <input type="hidden" name="id" value={id} />
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <span className="font-semibold">Delete this for good?</span>
      <Yes />
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </form>
  );
}
