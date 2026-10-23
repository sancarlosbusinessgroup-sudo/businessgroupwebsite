'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { checkImageFile, prepareImage } from '@/lib/images';
import { createClient } from '@/lib/supabase/browser';
import { removeProfileMedia, setProfileMedia } from '../actions/member';

export function MediaUpload({ userId, kind, label, hasFile = false }: { userId: string; kind: 'avatar' | 'logo'; label: string; hasFile?: boolean }) {
  const id = useId();
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err' | 'busy'; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const what = kind === 'avatar' ? 'photo' : 'logo';

  async function onRemove() {
    setConfirming(false);
    setMsg({ tone: 'busy', text: 'Removing…' });
    const res = await removeProfileMedia({ kind });
    if (res.status !== 'success') {
      setMsg({ tone: 'err', text: `Could not remove your ${what}. Please try again.` });
      return;
    }
    setMsg({ tone: 'ok', text: `${what === 'photo' ? 'Photo' : 'Logo'} removed` });
    router.refresh();
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const err = checkImageFile(file);
    if (err || !file) {
      setMsg({ tone: 'err', text: err ?? 'Choose a photo' });
      return;
    }
    try {
      setMsg({ tone: 'busy', text: 'Uploading…' });
      const { full } = await prepareImage(file, 800, 200);
      const path = `${userId}/${kind}-${crypto.randomUUID()}.webp`;
      const { error } = await createClient().storage.from('profile-media').upload(path, full, { contentType: 'image/webp' });
      if (error) throw error;
      const res = await setProfileMedia({ kind, path });
      if (res.status !== 'success') throw new Error();
      setMsg({ tone: 'ok', text: 'Saved' });
      router.refresh();
    } catch {
      setMsg({ tone: 'err', text: 'Upload failed. Please try again.' });
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="btn btn-outline btn-sm cursor-pointer has-[:focus-visible]:outline-3">
          {label}
          <input id={id} type="file" accept="image/*" className="sr-only" onChange={onChange} disabled={msg?.tone === 'busy'} />
        </label>
        {hasFile && !confirming ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirming(true)} disabled={msg?.tone === 'busy'}>
            Remove {what}
          </button>
        ) : null}
        {hasFile && confirming ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Remove your {what}?</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={onRemove}>
              Yes, remove
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </span>
        ) : null}
      </div>
      {msg ? (
        <span role={msg.tone === 'err' ? 'alert' : 'status'} className={`text-sm font-semibold ${msg.tone === 'err' ? 'text-red' : 'text-green-ink'}`}>
          {msg.text}
        </span>
      ) : null}
    </div>
  );
}
