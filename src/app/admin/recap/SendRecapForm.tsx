'use client';

import { useActionState, useState } from 'react';
import { sendMemberRecapNow } from '@/app/actions/admin';
import { SubmitButton } from '@/components/forms';
import { idle } from '@/lib/validation';

/**
 * Send the Member recap after checking the preview (owner, 2026-11-10). Extra addresses are optional; Send asks once
 * more before anything goes out.
 */
export function SendRecapForm({ meetingId, members, visitors }: { meetingId: string; members: number; visitors: string[] }) {
  const [state, action] = useActionState(sendMemberRecapNow, idle);
  const [confirming, setConfirming] = useState(false);
  const [extra, setExtra] = useState('');
  const extraCount = extra.split(/[\s,;]+/).filter(Boolean).length;
  const total = members + visitors.length + extraCount;
  return (
    <form action={(fd) => (setConfirming(false), action(fd))} className="flex flex-col gap-3" aria-label="Send the Member recap">
      <input type="hidden" name="meetingId" value={meetingId} />
      <p className="m-0 text-sm">
        Goes to <strong>{members}</strong> {members === 1 ? 'member' : 'members'} (everyone except those who turned the recap off) and{' '}
        <strong>{visitors.length}</strong> {visitors.length === 1 ? 'visitor' : 'visitors'} with an email
        {visitors.length ? ` (${visitors.join(', ')})` : ''}.
      </p>
      <div>
        <label className="label" htmlFor="extraEmails">
          More email addresses (optional)
        </label>
        <textarea
          id="extraEmails"
          name="extraEmails"
          rows={3}
          className="field"
          value={extra}
          onChange={(e) => (setExtra(e.target.value), setConfirming(false))}
          placeholder="name@example.com, another@example.com"
          aria-describedby="extraEmails-help"
        />
        <p id="extraEmails-help" className="text-ink-muted m-0 mt-1 text-sm">
          Separate addresses with commas or new lines. Each address gets the recap once; pressing Send again only reaches addresses that haven’t had it.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {confirming ? (
          <>
            <SubmitButton pendingText="Sending…" className="btn btn-primary">
              Yes, send to {total} {total === 1 ? 'person' : 'people'}
            </SubmitButton>
            <button type="button" className="btn btn-outline" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>
            Send recap
          </button>
        )}
      </div>
      {state.status === 'success' ? (
        <p role="status" className="text-green-ink m-0 text-sm font-semibold">
          {state.message}
        </p>
      ) : null}
      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-red m-0 text-sm font-semibold">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
