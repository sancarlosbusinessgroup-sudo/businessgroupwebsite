'use client';

/* eslint-disable @next/next/no-img-element -- small thumbnails of photos not yet public; next/image would cache them publicly */
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { respondGalleryTag } from '@/app/actions/member';
import { Pill } from '@/components/ui';
import type { TagRequest, WaitingPhoto } from '@/lib/data/gallery-tags';
import { idle, type ActionState } from '@/lib/validation';

function Buttons({ r }: { r: TagRequest }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <button type="submit" name="answer" value="approve" className="btn btn-primary btn-sm" disabled={pending} aria-disabled={pending}>
        {pending ? 'Saving…' : 'Approve'}
        <span className="sr-only"> “{r.caption}”</span>
      </button>
      {r.status === 'declined' ? null : (
        <button type="submit" name="answer" value="decline" className="btn btn-outline btn-sm" disabled={pending} aria-disabled={pending}>
          Don’t show it<span className="sr-only"> (“{r.caption}”)</span>
        </button>
      )}
    </div>
  );
}

function Answer({ r, notify }: { r: TagRequest; notify: (s: ActionState) => void }) {
  // Approving takes the photo off this list, so the answer is confirmed above the list.
  const [, action] = useActionState(async (prev: ActionState, fd: FormData) => {
    const res = await respondGalleryTag(prev, fd);
    notify(res);
    return res;
  }, idle);
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="photoId" value={r.photoId} />
      <Buttons r={r} />
    </form>
  );
}

/** Photos the member is tagged in, waiting for their answer (owner, 2026-11-24). */
export function TagRequests({ requests }: { requests: TagRequest[] }) {
  const [message, setMessage] = useState<ActionState>(idle);
  const shown =
    message.status !== 'idle' && message.message ? (
      <p
        role={message.status === 'error' ? 'alert' : 'status'}
        className={`m-0 text-sm font-semibold ${message.status === 'error' ? 'text-red' : 'text-green-ink'}`}
      >
        {message.message}
      </p>
    ) : null;
  if (!requests.length) return shown;
  const pending = requests.filter((r) => r.status === 'pending').length;
  return (
    <section id="tagged" className="card flex scroll-mt-24 flex-col gap-3 p-5" aria-labelledby="tagged-h">
      <h2 id="tagged-h" className="font-display m-0 text-xl font-extrabold">
        Photos you’re tagged in{pending ? ` (${pending} to answer)` : ''}
      </h2>
      <p className="text-ink-muted m-0 text-sm">A photo appears on the website only after everyone tagged in it approves. If you say no, it stays hidden.</p>
      {shown}
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {requests.map((r) => (
          <li key={r.photoId} className="border-line flex flex-col gap-2 rounded-xl border p-3">
            <a href={r.full} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
              <img src={r.thumb} alt={r.caption} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <span className="sr-only"> (open the full photo in a new tab)</span>
            </a>
            <p className="m-0 text-[15px] font-semibold">{r.caption}</p>
            <p className="text-ink-muted m-0 text-sm">
              Uploaded by {r.uploader}
              {r.status === 'declined' ? (
                <>
                  {' · '}
                  <Pill tone="gray">You said no</Pill>
                </>
              ) : null}
            </p>
            <Answer r={r} notify={setMessage} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const statusTone = { pending: 'amber', approved: 'green', declined: 'red' } as const;
const statusWord = { pending: 'waiting', approved: 'approved', declined: 'said no' } as const;

/** The uploader's photos that aren't live yet, and who still has to answer (owner, 2026-11-24). */
export function WaitingPhotos({ photos }: { photos: WaitingPhoto[] }) {
  if (!photos.length) return null;
  return (
    <section className="card flex flex-col gap-3 p-5" aria-labelledby="waiting-h">
      <h2 id="waiting-h" className="font-display m-0 text-xl font-extrabold">
        Your photos waiting for approval ({photos.length})
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {photos.map((p) => (
          <li key={p.photoId} className="flex flex-wrap items-center gap-3">
            <img src={p.thumb} alt="" className="h-16 w-20 flex-none rounded-lg object-cover" loading="lazy" />
            <div className="min-w-0">
              <p className="m-0 font-semibold">{p.caption}</p>
              <ul className="m-0 mt-1 flex list-none flex-wrap gap-1.5 p-0" aria-label="Tagged members">
                {p.tags.map((t) => (
                  <li key={t.name}>
                    <Pill tone={statusTone[t.status]}>
                      {t.name}: {statusWord[t.status]}
                    </Pill>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
