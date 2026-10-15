'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { SelectField, TextField } from '@/components/forms';
import { Notice } from '@/components/ui';
import { albums } from '@/lib/content';
import { checkImageFile, prepareImage } from '@/lib/images';
import { createClient } from '@/lib/supabase/browser';
import { fieldErrors, formToObject, galleryMetaSchema } from '@/lib/validation';
import { addGalleryPhoto } from '../actions/member';

type Phase = { kind: 'idle' } | { kind: 'working'; text: string } | { kind: 'done' } | { kind: 'error'; text: string };

export function UploadPhoto({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get('photo') as File | null;
    const meta = galleryMetaSchema.safeParse(formToObject(fd));
    const errs = meta.success ? {} : fieldErrors(meta.error);
    const fileErr = checkImageFile(file);
    if (fileErr) errs.photo = fileErr;
    setErrors(errs);
    if (!meta.success || fileErr || !file) return;

    try {
      setPhase({ kind: 'working', text: 'Resizing photo…' });
      const { full, thumb } = await prepareImage(file);
      setPhase({ kind: 'working', text: 'Uploading…' });
      const supabase = createClient();
      const id = crypto.randomUUID();
      const imagePath = `${userId}/${id}.webp`;
      const thumbPath = `${userId}/${id}-thumb.webp`;
      const up1 = await supabase.storage.from('gallery').upload(imagePath, full, { contentType: 'image/webp' });
      if (up1.error) throw up1.error;
      const up2 = await supabase.storage.from('gallery').upload(thumbPath, thumb, { contentType: 'image/webp' });
      if (up2.error) throw up2.error;
      const res = await addGalleryPhoto({ ...meta.data, imagePath, thumbPath });
      if (res.status !== 'success') throw new Error(res.message ?? 'Could not save the photo');
      setPhase({ kind: 'done' });
      form.reset();
      router.refresh();
    } catch {
      setPhase({ kind: 'error', text: 'The upload did not finish. Please try again.' });
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)} aria-expanded={false}>
        Upload photos
      </button>
    );
  }

  const busy = phase.kind === 'working';
  return (
    <form onSubmit={onSubmit} noValidate className="card flex w-full flex-col gap-4 p-5" aria-label="Upload a photo">
      {phase.kind === 'done' ? <Notice tone="success">Photo added to the gallery.</Notice> : null}
      {phase.kind === 'error' ? <Notice tone="error">{phase.text}</Notice> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          name="photo"
          type="file"
          accept="image/*"
          label="Photo"
          required
          error={errors.photo}
          help="Resized to 2000px and location data removed before upload."
          className="field pt-2.5"
        />
        <SelectField name="album" label="Album" required error={errors.album} defaultValue="">
          <option value="" disabled>
            Choose an album
          </option>
          {albums.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </SelectField>
        <TextField name="caption" label="Caption" required maxLength={140} error={errors.caption} />
        <TextField name="takenOn" type="date" label="Date taken" error={errors.takenOn} />
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" className="btn btn-primary" disabled={busy} aria-disabled={busy}>
          {busy ? phase.text : 'Upload photo'}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setOpen(false)} disabled={busy}>
          Close
        </button>
      </div>
    </form>
  );
}
