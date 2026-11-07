'use client';

import { useState } from 'react';
import { removeMyMaterial } from '@/app/actions/presenter';
import { LinkForm, UploadForm, kindLabel, type MediaRow } from '@/app/present/[slug]/setup/SlideMediaManager';
import { SubmitButton } from '@/components/forms';
import { slotShort } from '@/lib/content';

export type MyMaterial = MediaRow & { mine: boolean };

/**
 * The presenter's own slides for their 5- or 10-minute presentation (owner, 2026-11-07): upload an image, PDF or
 * PowerPoint, or add a YouTube video or website. It shows in the meeting slides right after their presentation slide.
 * They can remove what they added until the meeting starts; admins see, move or remove everything in Customize slides.
 */
export function PresenterMaterials({
  meetingId,
  slot,
  userId,
  when,
  items,
}: {
  meetingId: string;
  slot: 'education' | 'presentation';
  userId: string;
  when: string;
  items: MyMaterial[];
}) {
  const [open, setOpen] = useState(false);
  const name = `my ${slotShort[slot]} presentation on ${when}`;
  const presenter = { userId, slot };
  return (
    <section className="bg-canvas flex basis-full flex-col gap-3 rounded-xl p-3" aria-label={`Slides for ${name}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-display m-0 text-base font-bold">My slides</h4>
          <p className="text-ink-muted m-0 text-sm">
            Add a PDF, PowerPoint, image, YouTube video or website. It shows in the meeting slides right after your presentation slide. You can add or remove
            until the meeting starts.
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : items.length ? 'Add more' : 'Add my slides'}
        </button>
      </div>
      {items.length ? (
        <ul className="m-0 flex list-none flex-col p-0" aria-label={`Added for ${name}`}>
          {items.map((m) => (
            <li key={m.id} className="border-line-soft flex flex-wrap items-center gap-3 border-t py-2">
              <div className="min-w-0 flex-1">
                <p className="m-0 font-semibold">{m.title || kindLabel[m.kind]}</p>
                <p className="text-ink-muted m-0 text-sm">
                  {kindLabel[m.kind]}
                  {m.kind === 'pdf' && m.pageCount ? ` · ${m.pageCount} page${m.pageCount === 1 ? '' : 's'}` : ''}
                  {m.mine ? '' : ' · added by an admin'}
                </p>
              </div>
              {m.mine ? (
                <form action={removeMyMaterial}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="kind" value={m.kind} />
                  <SubmitButton pendingText="Removing…" className="btn btn-outline btn-sm">
                    Remove<span className="sr-only"> {m.title || kindLabel[m.kind]}</span>
                  </SubmitButton>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {open ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <UploadForm meetingId={meetingId} options={[]} fixedAfter="mine" name={`Upload for ${name}`} presenter={presenter} />
          <LinkForm meetingId={meetingId} options={[]} fixedAfter="mine" name={`Video or website for ${name}`} presenter={presenter} />
        </div>
      ) : null}
    </section>
  );
}
