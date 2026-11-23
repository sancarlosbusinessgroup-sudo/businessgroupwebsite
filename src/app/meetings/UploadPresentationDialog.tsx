'use client';

import { useEffect, useRef, useState } from 'react';
import { SlotMaterials, type MediaRow } from '@/app/present/[slug]/setup/SlideMediaManager';
import { slotTitles } from '@/lib/content';
import { PresenterMaterials, type MyMaterial } from './PresenterMaterials';

/**
 * Meetings page: "Upload presentation" beside a 5- or 10-minute presenter (owner, 2026-11-24). Opens a pop-up with the
 * same upload options as Customize slides (PDF, PowerPoint, image, YouTube video, website). The presenter adds to their
 * own slot (until the meeting starts); admins can add for any presenter.
 */
export function UploadPresentationDialog(
  props: {
    meetingId: string;
    slot: 'education' | 'presentation';
    when: string;
    presenter: string;
  } & ({ mode: 'presenter'; userId: string; items: MyMaterial[] } | { mode: 'admin'; items: MediaRow[] }),
) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = `upload-${props.meetingId}-${props.slot}`;
  const count = props.items.length;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="text-teal-text cursor-pointer border-0 bg-transparent p-0 text-sm font-bold underline"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Upload presentation
        <span className="sr-only">
          {' '}
          for the {slotTitles[props.slot]} on {props.when}
        </span>
        {count ? <span className="text-ink-muted font-normal no-underline"> ({count} added)</span> : null}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="bg-canvas text-ink m-auto max-h-[calc(100dvh-32px)] w-[min(880px,calc(100%-32px))] max-w-none overflow-y-auto rounded-[20px] border-0 p-0 backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-4 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id={titleId} className="font-display m-0 text-[clamp(22px,3vw,28px)] font-extrabold">
                Upload presentation
              </h2>
              <p className="text-ink-soft m-0">
                {slotTitles[props.slot]} · {props.when} · {props.presenter}
              </p>
              <p className="text-ink-muted m-0 text-sm">
                A PDF, PowerPoint, image, YouTube video or website. It shows in the meeting slides right after the presentation slide.
              </p>
            </div>
            <button type="button" className="btn btn-outline btn-sm flex-none" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {open ? (
            props.mode === 'presenter' ? (
              <PresenterMaterials meetingId={props.meetingId} slot={props.slot} userId={props.userId} when={props.when} items={props.items} embedded />
            ) : (
              <SlotMaterials
                meetingId={props.meetingId}
                slot={props.slot === 'education' ? 'five_minute' : 'ten_minute'}
                options={[]}
                media={props.items}
                compact
              />
            )
          ) : null}
        </div>
      </dialog>
    </>
  );
}
