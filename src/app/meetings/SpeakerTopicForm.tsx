'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/forms';
import { slotShort } from '@/lib/content';
import { idle } from '@/lib/validation';
import { updateSpeakerTopic } from '../actions/member';

/** The presenter's own slot: write or change the topic, which is the title on the meeting slides (owner, 2026-10-24). */
export function SpeakerTopicForm({
  meetingId,
  slot,
  when,
  topic,
  description,
}: {
  meetingId: string;
  slot: 'education' | 'presentation';
  when: string;
  topic: string | null;
  description: string | null;
}) {
  const [state, action] = useActionState(updateSpeakerTopic, idle);
  const id = `my-${meetingId}-${slot}`;
  const err = state.errors?.topic;
  return (
    <form
      action={action}
      noValidate
      className="bg-canvas flex basis-full flex-wrap items-end gap-2 rounded-xl p-3"
      aria-label={`Topic of my ${slotShort[slot]} presentation on ${when}`}
    >
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="slot" value={slot} />
      <div className="min-w-0 flex-[1_1_220px]">
        <label className="label" htmlFor={`topic-${id}`}>
          Topic <span className="text-ink-muted font-normal">(title on the slides, my {slotShort[slot]} presentation)</span>
        </label>
        <input
          id={`topic-${id}`}
          name="topic"
          className="field"
          maxLength={120}
          defaultValue={state.values?.topic ?? topic ?? ''}
          placeholder={topic ? undefined : 'Add the title of your presentation'}
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
        <input id={`desc-${id}`} name="topicDescription" className="field" maxLength={500} defaultValue={state.values?.topicDescription ?? description ?? ''} />
      </div>
      <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
        Save topic
      </SubmitButton>
      {state.status === 'success' ? (
        <p role="status" className="text-teal-text m-0 w-full text-sm font-semibold">
          Topic saved.
        </p>
      ) : null}
      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-red m-0 w-full text-sm font-semibold">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
