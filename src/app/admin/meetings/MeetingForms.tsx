'use client';

import { useActionState } from 'react';
import { Checkbox, SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { slotTitles } from '@/lib/content';
import { assignSlotSchema, idle, meetingSchema } from '@/lib/validation';
import { adminAssignSlot, adminSaveMeeting, adminSetSlotTopic } from '../../actions/admin-edit';

export type MeetingDefaults = {
  id?: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  isOnline: boolean;
  joinUrl: string;
  passcode: string;
};

type Member = { id: string; label: string };
type Slot = keyof typeof slotTitles;

/** Edit a meeting (or add one when `defaults.id` is empty). */
export function MeetingForm({ defaults, heading }: { defaults: MeetingDefaults; heading: string }) {
  const [state, action] = useActionState(adminSaveMeeting, idle);
  const { clientErrors, onSubmit } = useClientValidation(meetingSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.status !== 'idle' && state.values ? state.values : null;
  const val = (k: keyof MeetingDefaults) => (v ? (v[k] ?? '') : String(defaults[k] ?? ''));
  const prefix = defaults.id ? `m-${defaults.id}` : 'm-new';
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="card flex flex-col gap-[22px] p-7" aria-labelledby={`${prefix}-h`}>
      <h2 id={`${prefix}-h`} className="h3">
        {heading}
      </h2>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <TextField id={`${prefix}-title`} name="title" label="Title" required defaultValue={val('title')} error={errors.title} />
        </div>
        <TextField
          id={`${prefix}-start`}
          name="startsAt"
          type="datetime-local"
          label="Starts (Pacific time)"
          required
          defaultValue={val('startsAt')}
          error={errors.startsAt}
        />
        <TextField
          id={`${prefix}-end`}
          name="endsAt"
          type="datetime-local"
          label="Ends (Pacific time)"
          required
          defaultValue={val('endsAt')}
          error={errors.endsAt}
        />
        <TextField
          id={`${prefix}-location`}
          name="location"
          label="Location"
          defaultValue={val('location')}
          error={errors.location}
          help="e.g. Online · Zoom, or an address."
        />
        <div className="pt-7">
          <Checkbox name="isOnline" label="Held online" defaultChecked={v ? v.isOnline === 'on' : defaults.isOnline} />
        </div>
        <TextField
          id={`${prefix}-join`}
          name="joinUrl"
          type="url"
          label="Zoom link"
          placeholder="https://zoom.us/j/…"
          defaultValue={val('joinUrl')}
          error={errors.joinUrl}
          help="Members see it when they check in. Leave empty to remove."
        />
        <TextField id={`${prefix}-pass`} name="passcode" label="Zoom passcode" defaultValue={val('passcode')} error={errors.passcode} />
        <div className="md:col-span-2">
          <TextArea
            id={`${prefix}-desc`}
            name="description"
            label="Description"
            defaultValue={val('description')}
            error={errors.description}
            maxLength={2000}
            rows={3}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">{defaults.id ? 'Save meeting' : 'Add meeting'}</SubmitButton>
      </div>
    </form>
  );
}

/** Give a slot to a member (the member is emailed; whoever had it is emailed too). */
export function AssignSlotForm({ meetingId, slot, members, current }: { meetingId: string; slot: Slot; members: Member[]; current: string | null }) {
  const [state, action] = useActionState(adminAssignSlot, idle);
  const { clientErrors, onSubmit } = useClientValidation(assignSlotSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.values ?? {};
  const prefix = `assign-${slot}`;
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-3" aria-label={`Assign the ${slotTitles[slot]}`}>
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="slot" value={slot} />
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SelectField
          id={`${prefix}-member`}
          name="profileId"
          label={current ? 'Reassign to' : 'Assign to'}
          required
          defaultValue={v.profileId ?? ''}
          error={errors.profileId}
        >
          <option value="">Choose a member</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </SelectField>
        <TextField id={`${prefix}-topic`} name="topic" label="Topic (optional)" defaultValue={v.topic ?? ''} error={errors.topic} />
      </div>
      <div>
        <SubmitButton pendingText="Assigning…" className="btn btn-outline btn-sm">
          {current ? 'Reassign slot' : 'Assign slot'}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Edit the topic shown on the slides. */
export function SlotTopicForm({ meetingId, slot, topic, description }: { meetingId: string; slot: Slot; topic: string | null; description: string | null }) {
  const [state, action] = useActionState(adminSetSlotTopic, idle);
  const v = state.values ?? {};
  const errors = state.errors ?? {};
  const prefix = `topic-${slot}`;
  return (
    <form action={action} className="flex flex-col gap-3" aria-label={`Topic for the ${slotTitles[slot]}`}>
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="slot" value={slot} />
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <TextField id={`${prefix}-t`} name="topic" label="Topic" defaultValue={v.topic ?? topic ?? ''} error={errors.topic} maxLength={120} />
      <TextArea
        id={`${prefix}-d`}
        name="topicDescription"
        label="Description"
        defaultValue={v.topicDescription ?? description ?? ''}
        error={errors.topicDescription}
        maxLength={500}
        rows={2}
      />
      <div>
        <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
          Save topic
        </SubmitButton>
      </div>
    </form>
  );
}
