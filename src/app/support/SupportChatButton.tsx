'use client';

import { useId, useRef } from 'react';

/**
 * "Chat with support" button. Live chat isn't connected yet: for now it opens a short notice.
 * To connect a chat provider later, open its widget in `openChat` (e.g. window.Provider?.open()).
 */
export function SupportChatButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  function openChat() {
    dialog.current?.showModal();
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={openChat} data-chat-launcher="support" aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
        </svg>
        Chat with support
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="bg-surface text-ink m-auto w-[min(92vw,440px)] rounded-[20px] border-0 p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-3 p-6">
          <h2 id={titleId} className="font-display m-0 text-xl font-extrabold">
            Live chat is coming soon
          </h2>
          <p className="text-ink-soft m-0">
            We&apos;re setting up a chat window so you can reach the support team right here. Until then, please ask any of us at the next meeting, or check
            the answers below.
          </p>
          <form method="dialog" className="flex justify-end">
            <button type="submit" className="btn btn-outline btn-sm">
              Close
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
