'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { EventForm } from '@/app/events/EventForm';

/**
 * Dashboard "Add an event" (owner, 2026-10-31): the Post an event form in a pop-up, so members add events without
 * leaving the dashboard. After saving it says so, with a link to the event; the My Events list refreshes behind it.
 */
export function AddEventDialog({ userId, minStart }: { userId: string; minStart: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);

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
        className="btn btn-primary btn-sm"
        aria-haspopup="dialog"
        onClick={() => {
          setSaved(null);
          setRound((r) => r + 1);
          setOpen(true);
        }}
      >
        + Add an event
      </button>
      <dialog
        ref={ref}
        aria-labelledby="add-event-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="bg-canvas text-ink m-auto max-h-[calc(100dvh-32px)] w-[min(820px,calc(100%-32px))] max-w-none overflow-y-auto rounded-[20px] border-0 p-0 backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-4 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="add-event-title" className="font-display m-0 text-[clamp(22px,3vw,28px)] font-extrabold">
                Post an event
              </h2>
              <p className="text-ink-soft m-0">Share a workshop, social or open house. You can edit or delete it later.</p>
            </div>
            <button type="button" className="btn btn-outline btn-sm flex-none" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {saved ? (
            <div className="card flex flex-col items-start gap-3 p-6" role="status">
              <h3 className="font-display m-0 text-[22px]">Your event is posted!</h3>
              <p className="text-ink-soft m-0">It now shows under My Events on your dashboard.</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/events/${saved}`} className="btn btn-primary btn-sm">
                  View the event
                </Link>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setSaved(null);
                    setRound((r) => r + 1);
                  }}
                >
                  Post another event
                </button>
              </div>
            </div>
          ) : open ? (
            <EventForm key={round} userId={userId} minStart={minStart} onSaved={setSaved} />
          ) : null}
        </div>
      </dialog>
    </>
  );
}
