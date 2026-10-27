'use client';

import { useActionState } from 'react';
import { SelectField, SubmitButton, TextField } from '@/components/forms';
import { Notice } from '@/components/ui';
import { albums } from '@/lib/content';
import { idle } from '@/lib/validation';
import { adminUpdateGalleryPhoto } from '../../actions/admin-edit';

export function PhotoForm({ photo }: { photo: { id: string; caption: string; album: string; taken_on: string | null } }) {
  const [state, action] = useActionState(adminUpdateGalleryPhoto, idle);
  const v = state.values ?? {};
  const errors = state.errors ?? {};
  const prefix = `ph-${photo.id}`;
  return (
    <form action={action} className="flex flex-col gap-2" aria-label={`Edit photo: ${photo.caption}`}>
      <input type="hidden" name="id" value={photo.id} />
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <TextField id={`${prefix}-c`} name="caption" label="Caption" required defaultValue={v.caption ?? photo.caption} error={errors.caption} maxLength={140} />
      <div className="grid grid-cols-2 gap-2">
        <SelectField id={`${prefix}-a`} name="album" label="Album" defaultValue={v.album ?? photo.album} error={errors.album}>
          {albums.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </SelectField>
        <TextField id={`${prefix}-d`} name="takenOn" type="date" label="Taken on" defaultValue={v.takenOn ?? photo.taken_on ?? ''} error={errors.takenOn} />
      </div>
      <div>
        <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}
