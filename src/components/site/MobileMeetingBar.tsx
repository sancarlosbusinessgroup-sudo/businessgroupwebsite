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
 * Phones only: a bar fixed to the bottom of the screen with the next meeting's date (owner, 2026-10-24).
 * Logged out: "Log In". Logged in: "Join in Zoom" (which checks members in during the meeting), and a second row
 * with "Referrals" and "One-on-ones". When live chat is on, a round chat button sits beside Log In (visitors) or
 * beside One-on-ones (members), replacing the floating chat bubble on phones. Hidden on the meeting slides.
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

  const chatButton = chatEnabled ? (
    <button type="button" onClick={openChat} aria-label="Chat with support" className="btn btn-primary btn-sm h-11 w-11 shrink-0 rounded-full p-0">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
      </svg>
    </button>
  ) : null;

  const pad = 'pr-[max(16px,env(safe-area-inset-right,0px))] pl-[max(16px,env(safe-area-inset-left,0px))]';
  return (
    <>
      {/* Room at the end of the page so the bar never covers the footer. */}
      <div aria-hidden="true" className={`${member ? 'h-[136px]' : 'h-[72px]'} md:hidden`} />
      <aside
        aria-label="Next meeting"
        data-mobile-meeting-bar={member ? 'member' : 'visitor'}
        className="bg-band text-on-band border-band-line fixed inset-x-0 bottom-0 z-40 flex flex-col border-t pb-[max(10px,env(safe-area-inset-bottom,0px))] md:hidden"
      >
        <div className={`flex items-center justify-between gap-3 pt-2.5 ${pad}`}>
          <p className="m-0 min-w-0 text-sm leading-tight">
            <span className="text-on-band-muted block text-xs font-semibold tracking-wide uppercase">Next meeting</span>
            <span className="block truncate font-bold">{when ?? 'Date to be announced'}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {member ? (
              meetingId ? (
                <form action={joinMeeting} className="m-0">
                  <input type="hidden" name="meetingId" value={meetingId} />
                  <button type="submit" className="btn btn-primary btn-sm">
                    Join in Zoom
                  </button>
                </form>
              ) : null
            ) : (
              <>
                <Link href="/login" className="btn btn-primary btn-sm shrink-0">
                  Log In
                </Link>
                {chatButton}
              </>
            )}
          </div>
        </div>
        {member ? (
          <nav aria-label="Report activity" className={`border-band-line mt-2.5 grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-t pt-2.5 ${pad}`}>
            <Link href="/referrals" className="btn btn-ghost-band btn-sm w-full">
              Referrals
            </Link>
            <Link href="/one-on-ones" className="btn btn-ghost-band btn-sm w-full">
              One-on-ones
            </Link>
            {chatButton}
          </nav>
        ) : null}
      </aside>
    </>
  );
}
