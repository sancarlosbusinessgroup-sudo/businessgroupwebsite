'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { SelectField, TextArea, TextField } from '@/components/forms';
import { Notice } from '@/components/ui';
import { checkImageFile, prepareImage } from '@/lib/images';
import { createClient } from '@/lib/supabase/browser';
import { eventCategories, fieldErrors, formToObject, memberEventSchema } from '@/lib/validation';
import { saveMemberEvent } from '../actions/events';

export type EventDefaults = {
  id?: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt: string;
  format: 'online' | 'in_person';
  onlineUrl: string;
  location: string;
  description: string;
};

type Props = { userId: string; defaults?: EventDefaults; minStart: string };

export function EventForm({ userId, defaults, minStart }: Props) {
  const router = useRouter();
  const editing = !!defaults?.id;
  const [format, setFormat] = useState<'online' | 'in_person'>(defaults?.format ?? 'in_person');
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
        <TextField
          name="startsAt"
          type="datetime-local"
          label="Starts"
          required
          min={minStart}
          defaultValue={defaults?.startsAt}
          error={errors.startsAt}
          help="Pacific time"
        />
        <TextField
          name="endsAt"
          type="datetime-local"
          label="Ends"
          required
          min={minStart}
          defaultValue={defaults?.endsAt}
          error={errors.endsAt}
          help="Pacific time"
        />
      </div>

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
      <TextField
        name="image"
        type="file"
        accept="image/*"
        label="Image (optional)"
        error={errors.image}
        help={editing ? 'Choose a new image to replace the current one. Resized in your browser.' : 'Resized in your browser before upload.'}
        className="field pt-2.5"
      />
      <div className="border-line-soft flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span className="text-ink-muted text-sm">Published right away on the public Events page.</span>
        <button type="submit" className="btn btn-primary" disabled={busy} aria-disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish event'}
        </button>
      </div>
    </form>
  );
}
