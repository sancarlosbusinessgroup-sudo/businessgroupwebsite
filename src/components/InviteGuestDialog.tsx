'use client';

import { useEffect, useRef, useState } from 'react';
import { MemberGuestInviteForm, type GuestMeeting } from './MemberGuestInviteForm';

/**
 * Dashboard "Invite a Guest" button (owner, 2026-10-30): opens a pop-up with the members' guest invite form instead of
 * going to another page. Escape, the Close button or a click on the backdrop closes it.
 */
export function InviteGuestDialog({ meetings, memberName }: { meetings: GuestMeeting[]; memberName: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  // A fresh form each time the pop-up opens.
  const [round, setRound] = useState(0);

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
        className="btn btn-ghost-band btn-sm"
        aria-haspopup="dialog"
        onClick={() => {
          setRound((r) => r + 1);
          setOpen(true);
        }}
      >
        Invite a Guest
      </button>
      <dialog
        ref={ref}
        aria-labelledby="invite-guest-dialog-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="bg-canvas text-ink m-auto max-h-[calc(100dvh-32px)] w-[min(720px,calc(100%-32px))] max-w-none overflow-y-auto rounded-[20px] border-0 p-0 backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-4 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="invite-guest-dialog-title" className="font-display m-0 text-[clamp(22px,3vw,28px)] font-extrabold">
                Want to Invite a Guest?
              </h2>
              <p className="text-ink-soft m-0">Fill out the form for your guest.</p>
            </div>
            <button type="button" className="btn btn-outline btn-sm flex-none" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {open ? <MemberGuestInviteForm key={round} meetings={meetings} memberName={memberName} idPrefix="dlg" /> : null}
        </div>
      </dialog>
    </>
  );
}
