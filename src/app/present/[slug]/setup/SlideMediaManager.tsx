'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useId, useState } from 'react';
import { addSlideFile, addVideoOrLink, moveSlideMedia, removeSlideMedia } from '@/app/actions/slides';
import { SelectField, SubmitButton, TextField } from '@/components/forms';
import { Notice } from '@/components/ui';
import { MEDIA_MAX_BYTES, MEDIA_TYPES, PDF_MAX_PAGES } from '@/lib/slides';
import { createClient } from '@/lib/supabase/browser';
import { idle } from '@/lib/validation';
import { countPdfPages } from '../../SlideWidgets';

type Option = { key: string; label: string };
export type MediaRow = { id: string; kind: 'image' | 'pdf' | 'youtube' | 'link'; title: string | null; afterSlide: string; pageCount: number | null; url?: string | null };

const kindLabel = { image: 'Image', pdf: 'PDF', youtube: 'YouTube video', link: 'Website' } as const;

function AfterSelect({ name, options, defaultValue, id, error }: { name: string; options: Option[]; defaultValue: string; id?: string; error?: string }) {
  return (
    <SelectField name={name} id={id} label="Show after" defaultValue={defaultValue} error={error}>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </SelectField>
  );
}

function UploadForm({ meetingId, options, fixedAfter, name = 'Upload an image or PDF' }: { meetingId: string; options: Option[]; fixedAfter?: string; name?: string }) {
  const router = useRouter();
  const fileId = useId();
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get('file');
    if (!(file instanceof File) || !file.size) return setMsg({ tone: 'error', text: 'Choose an image or PDF file.' });
    if (!(MEDIA_TYPES as readonly string[]).includes(file.type)) return setMsg({ tone: 'error', text: 'Use a JPG, PNG, WebP or GIF image, or a PDF.' });
    if (file.size > MEDIA_MAX_BYTES) return setMsg({ tone: 'error', text: 'That file is over 20 MB. Please use a smaller file.' });
    const kind = file.type === 'application/pdf' ? 'pdf' : 'image';
    setBusy(true);
    try {
      let pageCount: number | null = null;
      if (kind === 'pdf') {
        setMsg({ tone: 'info', text: 'Reading the PDF…' });
        pageCount = await countPdfPages(file);
        if (pageCount > PDF_MAX_PAGES) {
          setMsg({ tone: 'error', text: `That PDF has ${pageCount} pages. Please use one with ${PDF_MAX_PAGES} pages or fewer.` });
          return;
        }
      }
      setMsg({ tone: 'info', text: 'Uploading…' });
      const ext = kind === 'pdf' ? 'pdf' : (file.type.split('/')[1] ?? 'img').replace('jpeg', 'jpg');
      const path = `${meetingId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient().storage.from('slide-media').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const res = await addSlideFile({
        meetingId,
        kind,
        path,
        title: String(data.get('title') ?? ''),
        afterSlide: String(data.get('afterSlide') ?? ''),
        pageCount,
      });
      if (res.status !== 'success') throw new Error(res.message);
      setMsg({ tone: 'success', text: res.message ?? 'Added.' });
      form.reset();
      router.refresh();
    } catch {
      setMsg({ tone: 'error', text: 'Upload failed. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3" aria-label={name}>
      <h3 className="h3 m-0">{fixedAfter ? 'Upload an image or PDF' : name}</h3>
      <p className="text-ink-muted m-0 text-sm">
        JPG, PNG, WebP, GIF or PDF, up to 20 MB. Each PDF page becomes its own slide (up to {PDF_MAX_PAGES} pages), so a presenter can step through it
        with the clicker.
      </p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="flex flex-col gap-1">
        <label htmlFor={fileId} className="label">
          File
        </label>
        <input id={fileId} name="file" type="file" accept={MEDIA_TYPES.join(',')} className="field py-2" disabled={busy} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField name="title" id={`${fileId}-title`} label="Title (optional)" maxLength={120} />
        {fixedAfter ? (
          <input type="hidden" name="afterSlide" value={fixedAfter} />
        ) : (
          <AfterSelect name="afterSlide" id={`${fileId}-after`} options={options} defaultValue="ten_minute" />
        )}
      </div>
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Working…' : 'Add to slides'}
        </button>
      </div>
    </form>
  );
}

function LinkForm({ meetingId, options, fixedAfter, name = 'Add a YouTube video or website' }: { meetingId: string; options: Option[]; fixedAfter?: string; name?: string }) {
  const uid = useId();
  const [state, action] = useActionState(addVideoOrLink, idle);
  const errors = state.errors ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-3" aria-label={name} key={state.status === 'success' ? state.message : 'yt'}>
      <h3 className="h3 m-0">{fixedAfter ? 'Add a YouTube video or website' : name}</h3>
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <input type="hidden" name="meetingId" value={meetingId} />
      <TextField
        name="link"
        id={`${uid}-url`}
        label="YouTube or website link"
        placeholder="https://…"
        defaultValue={state.status === 'error' ? state.values?.link : ''}
        error={errors.link}
        help="YouTube videos play in the slide (a link with ?t=90 starts there). Other websites show in the slide too, with an “Open in a new window” button for sites that don’t allow it."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField name="title" id={`${uid}-title`} label="Title (optional)" maxLength={120} defaultValue={state.status === 'error' ? state.values?.title : ''} error={errors.title} />
        {fixedAfter ? (
          <input type="hidden" name="afterSlide" value={fixedAfter} />
        ) : (
          <AfterSelect
            name="afterSlide"
            id={`${uid}-after`}
            options={options}
            defaultValue={state.status === 'error' ? (state.values?.afterSlide ?? 'announcements') : 'announcements'}
            error={errors.afterSlide}
          />
        )}
      </div>
      <div>
        <SubmitButton pendingText="Adding…">Add link</SubmitButton>
      </div>
    </form>
  );
}

const presentations = [
  { slot: 'five_minute', title: '5-minute presentation', help: 'Shown right after the 5-minute presentation slide, before the 1-minute questions.' },
  { slot: 'ten_minute', title: '10-minute presentation', help: 'Shown right after the 10-minute presentation slide, before the 5-minute questions.' },
] as const;

function MediaList({ media, label, name }: { media: MediaRow[]; label: (k: string) => string; name: string }) {
  if (!media.length) return <p className="text-ink-muted m-0">Nothing added yet.</p>;
  return (
    <ul className="m-0 flex list-none flex-col p-0" aria-label={name}>
      {media.map((m) => (
        <li key={m.id} className="border-line-soft flex flex-wrap items-center gap-3 border-t py-3">
          <div className="min-w-0 flex-1">
            <p className="m-0 font-semibold">{m.title || kindLabel[m.kind]}</p>
            <p className="text-ink-muted m-0 text-sm">
              {kindLabel[m.kind]}
              {m.kind === 'pdf' && m.pageCount ? ` · ${m.pageCount} page${m.pageCount === 1 ? '' : 's'}` : ''} · after “{label(m.afterSlide)}”
            </p>
          </div>
          <form action={removeSlideMedia}>
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="kind" value={m.kind} />
            <SubmitButton pendingText="Removing…" className="btn btn-outline btn-sm">
              Remove<span className="sr-only"> {m.title || kindLabel[m.kind]}</span>
            </SubmitButton>
          </form>
        </li>
      ))}
    </ul>
  );
}

/** Upload or link the presenter's materials for the 5- and 10-minute presentations. */
export function PresentationMaterials({ meetingId, options, media }: { meetingId: string; options: Option[]; media: MediaRow[] }) {
  const label = (k: string) => options.find((o) => o.key === k)?.label ?? k;
  return (
    <>
      {presentations.map((p) => (
        <section key={p.slot} className="card flex flex-col gap-5 p-5" aria-labelledby={`${p.slot}-h`}>
          <div>
            <h2 id={`${p.slot}-h`} className="h2 m-0 text-2xl">
              Materials for the {p.title}
            </h2>
            <p className="text-ink-muted m-0 mt-1">Image, PDF, YouTube video or website from the presenter. {p.help} The presentation’s timer shows on top of these slides.</p>
          </div>
          <MediaList media={media.filter((m) => m.afterSlide === p.slot)} label={label} name={`Materials for the ${p.title}`} />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <UploadForm meetingId={meetingId} options={options} fixedAfter={p.slot} name={`Upload for the ${p.title}`} />
            <LinkForm meetingId={meetingId} options={options} fixedAfter={p.slot} name={`Video or website for the ${p.title}`} />
          </div>
        </section>
      ))}
    </>
  );
}

export function SlideMediaManager({ meetingId, options, media }: { meetingId: string; options: Option[]; media: MediaRow[] }) {
  const label = (k: string) => options.find((o) => o.key === k)?.label ?? k;
  return (
    <section className="card flex flex-col gap-6 p-5" aria-labelledby="media-h">
      <div>
        <h2 id="media-h" className="h2 m-0 text-2xl">
          Other added slides
        </h2>
        <p className="text-ink-muted m-0 mt-1">Any other images, PDFs, YouTube videos or websites for this meeting, shown after the slide you choose.</p>
      </div>
      {media.length ? (
        <ul className="m-0 flex list-none flex-col p-0" aria-label="Added slides list">
          {media.map((m) => (
            <li key={m.id} className="border-line-soft flex flex-wrap items-end gap-3 border-t py-3">
              <div className="min-w-0 flex-1">
                <p className="m-0 font-semibold">{m.title || kindLabel[m.kind]}</p>
                <p className="text-ink-muted m-0 text-sm">
                  {kindLabel[m.kind]}
                  {m.kind === 'pdf' && m.pageCount ? ` · ${m.pageCount} page${m.pageCount === 1 ? '' : 's'}` : ''} · after “{label(m.afterSlide)}”
                </p>
              </div>
              <form action={moveSlideMedia} className="flex items-end gap-2" aria-label={`Move ${m.title || kindLabel[m.kind]}`}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="kind" value={m.kind} />
            <input type="hidden" name="kind" value={m.kind} />
                <AfterSelect name="afterSlide" id={`after-${m.id}`} options={options} defaultValue={m.afterSlide} />
                <SubmitButton pendingText="Moving…" className="btn btn-outline btn-sm">
                  Move
                </SubmitButton>
              </form>
              <form action={removeSlideMedia}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="kind" value={m.kind} />
            <input type="hidden" name="kind" value={m.kind} />
                <SubmitButton pendingText="Removing…" className="btn btn-outline btn-sm">
                  Remove<span className="sr-only"> {m.title || kindLabel[m.kind]}</span>
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted m-0">No added slides yet.</p>
      )}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <UploadForm meetingId={meetingId} options={options} />
        <LinkForm meetingId={meetingId} options={options} />
      </div>
    </section>
  );
}
