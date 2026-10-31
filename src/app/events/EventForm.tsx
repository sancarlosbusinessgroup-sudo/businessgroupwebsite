'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { SelectField, TextArea, TextField } from '@/components/forms';
import { Notice } from '@/components/ui';
import { checkImageFile, prepareImage } from '@/lib/images';
import { createClient } from '@/lib/supabase/browser';
import { MAX_EVENT_DATES, eventCategories, eventDateField, fieldErrors, formToObject, memberEventSchema } from '@/lib/validation';
import { saveMemberEvent } from '../actions/events';

/** "YYYY-MM-DDTHH:mm" plus whole days / one hour, as typed in a datetime-local field (no time zone maths needed). */
function shiftLocal(v: string, minutes: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!) + minutes * 60000);
  return d.toISOString().slice(0, 16);
}
const addDays = (v: string, days: number) => shiftLocal(v, days * 24 * 60);
const addHour = (v: string) => shiftLocal(v, 60);

export type EventDateDefaults = { id?: string; startsAt: string; endsAt: string };

export type EventDefaults = {
  id?: string;
  title: string;
  category: string;
  /** Every date of the event (one when it was posted with a single date). */
  dates: EventDateDefaults[];
  visibility: 'public' | 'members';
  format: 'online' | 'in_person';
  onlineUrl: string;
  location: string;
  description: string;
};

type Props = {
  userId: string;
  defaults?: EventDefaults;
  minStart: string;
  /** Pop-up use (dashboard): called with the new event's link instead of opening it. */
  onSaved?: (slug: string) => void;
};

type DateRow = EventDateDefaults & { key: number };
let rowKey = 0;
const toRows = (dates: EventDateDefaults[] | undefined): DateRow[] =>
  (dates?.length ? dates : [{ startsAt: '', endsAt: '' }]).map((d) => ({ ...d, key: ++rowKey }));

export function EventForm({ userId, defaults, minStart, onSaved }: Props) {
  const router = useRouter();
  const editing = !!defaults?.id;
  const [format, setFormat] = useState<'online' | 'in_person'>(defaults?.format ?? 'in_person');
  const [visibility, setVisibility] = useState<'public' | 'members'>(defaults?.visibility ?? 'public');
  const [dates, setDates] = useState<DateRow[]>(() => toRows(defaults?.dates));
  const setDate = (key: number, patch: Partial<DateRow>) => setDates((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const values = formToObject(fd);
    const file = fd.get('image') as File | null;
    const parsed = memberEventSchema().safeParse(values);
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    const hasFile = !!file && file.size > 0;
    const fileErr = hasFile ? checkImageFile(file) : null;
    if (fileErr) errs.image = fileErr;
    setErrors(errs);
    if (Object.keys(errs).length) {
      setMessage('Please fix the highlighted fields.');
      const first = Object.keys(errs)[0];
      (first ? (form.elements.namedItem(first) as HTMLElement | null) : null)?.focus?.();
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (hasFile && file) {
        const { full } = await prepareImage(file, 1600, 400);
        const path = `${userId}/event-${crypto.randomUUID()}.webp`;
        const up = await createClient().storage.from('gallery').upload(path, full, { contentType: 'image/webp' });
        if (up.error) throw up.error;
        values.imagePath = path;
      }
      const res = await saveMemberEvent(values);
      if (res.status === 'success' && res.slug) {
        if (onSaved) {
          router.refresh();
          onSaved(res.slug);
          return;
        }
        router.push(`/events/${res.slug}`);
        router.refresh();
        return;
      }
      setErrors(res.errors ?? {});
      setMessage(res.message ?? 'Something went wrong. Please try again.');
    } catch {
      setMessage('The image upload did not finish. Please try again, or post without an image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card flex flex-col gap-5 p-6" aria-label={editing ? 'Edit event' : 'Post an event'}>
      {message ? <Notice tone="error">{message}</Notice> : null}
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <TextField name="title" label="Event title" required maxLength={160} defaultValue={defaults?.title} error={errors.title} />
        </div>
        <SelectField name="category" label="Category" required defaultValue={defaults?.category ?? 'Networking'} error={errors.category}>
          {eventCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <div className="hidden md:block" />
      </div>

      {/* Several dates (owner, 2026-10-31): each date becomes its own event, linked together. */}
      <fieldset className="border-line m-0 flex flex-col gap-3 rounded-xl border p-4" aria-describedby="dates-help">
        <legend className="label px-1.5">When</legend>
        <p id="dates-help" className="help m-0">
          Pacific time. Holding it more than once? Add each date and time; every date gets its own listing.
        </p>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {dates.map((d, i) => (
            <li key={d.key} className={`grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-start ${i ? 'border-line-soft border-t pt-3' : ''}`}>
              {d.id ? <input type="hidden" name={eventDateField('dateId', i)} value={d.id} /> : null}
              <TextField
                id={`f-startsAt-${d.key}`}
                name={eventDateField('startsAt', i)}
                type="datetime-local"
                label={i === 0 ? 'Starts' : `Date ${i + 1} starts`}
                required
                min={d.id ? undefined : minStart}
                value={d.startsAt}
                onChange={(e) => {
                  const startsAt = e.currentTarget.value;
                  // Keep the same length as the first date when the end is still empty or before the start.
                  setDate(d.key, { startsAt, endsAt: d.endsAt && d.endsAt > startsAt ? d.endsAt : addHour(startsAt) });
                }}
                error={errors[eventDateField('startsAt', i)]}
              />
              <TextField
                id={`f-endsAt-${d.key}`}
                name={eventDateField('endsAt', i)}
                type="datetime-local"
                label={i === 0 ? 'Ends' : `Date ${i + 1} ends`}
                required
                min={d.id ? undefined : minStart}
                value={d.endsAt}
                onChange={(e) => setDate(d.key, { endsAt: e.currentTarget.value })}
                error={errors[eventDateField('endsAt', i)]}
              />
              {dates.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm md:mt-[30px]"
                  onClick={() => setDates((rows) => rows.filter((r) => r.key !== d.key))}
                  aria-label={`Remove date ${i + 1}`}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        {errors.dates ? <p className="error-text m-0">{errors.dates}</p> : null}
        {dates.length < MAX_EVENT_DATES ? (
          <div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() =>
                setDates((rows) => {
                  const last = rows[rows.length - 1];
                  // Suggest the same time one week later.
                  return [...rows, { key: ++rowKey, startsAt: addDays(last?.startsAt ?? '', 7), endsAt: addDays(last?.endsAt ?? '', 7) }];
                })
              }
            >
              + Add another date
            </button>
          </div>
        ) : (
          <p className="help m-0">You can add up to {MAX_EVENT_DATES} dates.</p>
        )}
      </fieldset>

      <fieldset className="border-line m-0 flex flex-col gap-3 rounded-xl border p-4">
        <legend className="label px-1.5">Where</legend>
        <div className="flex flex-wrap gap-5">
          {(
            [
              ['in_person', 'In person'],
              ['online', 'Online'],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="format" value={v} checked={format === v} onChange={() => setFormat(v)} className="h-5 w-5 accent-[var(--teal)]" />
              {l}
            </label>
          ))}
        </div>
        {format === 'online' ? (
          <TextField
            name="onlineUrl"
            type="url"
            label="Online link"
            placeholder="https://"
            defaultValue={defaults?.onlineUrl}
            error={errors.onlineUrl}
            help="Shown publicly on the event page."
          />
        ) : (
          <TextField name="location" label="Address" defaultValue={defaults?.location} error={errors.location} maxLength={200} />
        )}
      </fieldset>

      <TextArea name="description" label="Description" defaultValue={defaults?.description} error={errors.description} maxLength={4000} />
      <div className="flex flex-col gap-2">
        <TextField
          name="image"
          type="file"
          accept="image/*"
          label="Image (optional)"
          error={errors.image}
          help={editing ? 'Choose a new image to replace the current one.' : undefined}
          className="field pt-2.5"
          aria-describedby="image-guide"
        />
        {/* Owner, 2026-10-31: guide for the best image size. The event page shows it 16:9, landscape. */}
        <div id="image-guide" className="bg-teal-tint text-ink-soft rounded-xl p-3.5 text-sm">
          <p className="text-heading m-0 font-bold">Best image size</p>
          <ul className="m-0 mt-1 flex list-disc flex-col gap-0.5 pl-5">
            <li>
              <strong>1600 × 900 pixels</strong> (landscape, 16:9). The event page shows it in this shape, so taller images get cropped at the top and bottom.
            </li>
            <li>At least 1200 × 675 pixels so it stays sharp.</li>
            <li>JPG, PNG, WebP or HEIC, up to 25 MB. It&apos;s resized in your browser before upload.</li>
            <li>Keep important text and faces away from the edges.</li>
          </ul>
        </div>
      </div>

      {/* Owner, 2026-10-31: the host chooses who can see the event. */}
      <fieldset className="border-line m-0 flex flex-col gap-2 rounded-xl border p-4">
        <legend className="label px-1.5">Who can see this event?</legend>
        {(
          [
            ['public', 'Everyone (public)', 'Shown on the public Events page and calendar, for members and visitors.'],
            ['members', 'Members only', 'Only signed-in members see it. Visitors and search engines don’t.'],
          ] as const
        ).map(([v, l, hint]) => (
          <label key={v} className="flex min-h-11 items-start gap-2.5 py-1">
            <input
              type="radio"
              name="visibility"
              value={v}
              checked={visibility === v}
              onChange={() => setVisibility(v)}
              className="mt-0.5 h-5 w-5 flex-none accent-[var(--teal)]"
            />
            <span>
              <span className="font-semibold">{l}</span>
              <span className="text-ink-muted block text-sm">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="border-line-soft flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span className="text-ink-muted text-sm">
          {visibility === 'members' ? 'Published right away for signed-in members.' : 'Published right away on the public Events page.'}
          {dates.length > 1 ? ` ${dates.length} dates.` : ''}
        </span>
        <button type="submit" className="btn btn-primary" disabled={busy} aria-disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish event'}
        </button>
      </div>
    </form>
  );
}
