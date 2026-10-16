'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/forms';
import { slotShort } from '@/lib/content';
import { idle } from '@/lib/validation';
import { claimSpeakerSlot } from '../actions/member';

/** Claim a 5- or 10-minute slot; the topic is required (shown on the meeting and the slides). */
export function ClaimSlotForm({ meetingId, slot, when }: { meetingId: string; slot: 'education' | 'presentation'; when: string }) {
  const [state, action] = useActionState(claimSpeakerSlot, idle);
  const id = `${meetingId}-${slot}`;
  const err = state.errors?.topic;
  return (
    <form
      action={action}
      noValidate
      className="bg-canvas flex basis-full flex-wrap items-end gap-2 rounded-xl p-3"
      aria-label={`Claim the ${slotShort[slot]} slot on ${when}`}
    >
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="slot" value={slot} />
      <div className="min-w-0 flex-[1_1_220px]">
        <label className="label" htmlFor={`topic-${id}`}>
          Topic <span className="text-ink-muted font-normal">({slotShort[slot]} presentation)</span>
        </label>
        <input
          id={`topic-${id}`}
          name="topic"
          className="field"
          maxLength={120}
          defaultValue={state.values?.topic ?? ''}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `topic-${id}-error` : undefined}
        />
        {err ? (
          <p className="error-text m-0" id={`topic-${id}-error`}>
            {err}
          </p>
        ) : null}
      </div>
      <div className="min-w-0 flex-[1_1_220px]">
        <label className="label" htmlFor={`desc-${id}`}>
          Short description <span className="text-ink-muted font-normal">(optional)</span>
        </label>
        <input id={`desc-${id}`} name="topicDescription" className="field" maxLength={500} defaultValue={state.values?.topicDescription ?? ''} />
      </div>
      <SubmitButton pendingText="Claiming…" className="btn btn-outline btn-sm">
        Claim
      </SubmitButton>
      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-red m-0 w-full text-sm font-semibold">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
