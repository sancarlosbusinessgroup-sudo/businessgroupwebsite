'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { joinMeeting } from '@/app/actions/member';
import { chatHiddenOn } from '@/lib/chat';
import { openLiveChat } from '@/lib/chat-client';

type Props = {
  /** The next regular meeting (null when none is scheduled yet). */
  meetingId: string | null;
  when: string | null;
  member: boolean;
  /** Live chat is on: show the round chat button, which replaces the floating chat bubble on phones. */
  chatEnabled: boolean;
};

/**
 * Phones only (owner, 2026-10-24): a bar fixed to the bottom of the screen with the next meeting's date, the Zoom
 * link and a round chat button. Members open Zoom (which checks them in during the meeting); visitors get "Request
 * an invite", since the Zoom link is for members and invited guests. Hidden on the meeting slides.
 */
export function MobileMeetingBar({ meetingId, when, member, chatEnabled }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  if (chatHiddenOn(pathname)) return null;

  async function openChat() {
    const opened = await openLiveChat();
    // If the chat can't load (ad blocker, offline), the support page explains and offers other ways to reach us.
    if (!opened) router.push('/support');
  }

  const action = member ? (
    meetingId ? (
      <JoinForm meetingId={meetingId} />
    ) : null
  ) : (
    <Link href="/visit#request" className="btn btn-primary btn-sm shrink-0">
      Request an invite
    </Link>
  );

  return (
    <>
      <div aria-hidden="true" className="h-[72px] md:hidden" />
      <aside
        aria-label="Next meeting"
        data-mobile-meeting-bar=""
        className="bg-band text-on-band border-band-line fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t pt-2.5 pr-[max(16px,env(safe-area-inset-right,0px))] pb-[max(10px,env(safe-area-inset-bottom,0px))] pl-[max(16px,env(safe-area-inset-left,0px))] md:hidden"
      >
        <p className="m-0 min-w-0 text-sm leading-tight">
          <span className="text-on-band-muted block text-xs font-semibold tracking-wide uppercase">Next meeting</span>
          <span className="block font-bold">{when ?? 'Date to be announced'}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {chatEnabled ? (
            <button type="button" onClick={openChat} aria-label="Chat with support" className="btn btn-primary btn-sm h-11 w-11 shrink-0 rounded-full p-0">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function JoinForm({ meetingId }: { meetingId: string }) {
  return (
    <form action={joinMeeting} className="m-0">
      <input type="hidden" name="meetingId" value={meetingId} />
      <button type="submit" className="btn btn-primary btn-sm">
        Join on Zoom
      </button>
    </form>
  );
}
