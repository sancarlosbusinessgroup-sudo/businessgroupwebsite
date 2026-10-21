'use client';

import { useRef } from 'react';
import { setRsvp } from '../actions/member';

/** RSVP as a dropdown. Choosing an answer saves it straight away. */
export function RsvpSelect({ meetingId, meetingLabel, value }: { meetingId: string; meetingLabel: string; value: 'yes' | 'no' | '' }) {
  const form = useRef<HTMLFormElement>(null);
  const tone = value === 'yes' ? 'border-green bg-green-tint text-green-ink' : value === 'no' ? 'text-ink-muted' : 'text-heading';
  return (
    <form ref={form} action={setRsvp} className="m-0">
      <input type="hidden" name="meetingId" value={meetingId} />
      <label htmlFor={`rsvp-${meetingId}`} className="sr-only">
        RSVP for {meetingLabel}
      </label>
      <select
        id={`rsvp-${meetingId}`}
        name="answer"
        defaultValue={value}
        key={value}
        onChange={() => form.current?.requestSubmit()}
        className={`field !min-h-[40px] w-auto !rounded-full !py-0 pr-9 text-[15px] font-semibold ${tone}`}
      >
        <option value="">RSVP</option>
        <option value="yes">Can attend</option>
        <option value="no">Can’t attend</option>
      </select>
      <noscript>
        <button type="submit" className="btn btn-sm border-line-strong text-heading ml-2">
          Save
        </button>
      </noscript>
    </form>
  );
}
