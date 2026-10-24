'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { joinMeeting } from '@/app/actions/member';
import { chatHiddenOn } from '@/lib/chat';

type Props = { meetingId: string; when: string; member: boolean };

/**
 * Phones only: a bar fixed to the bottom of the screen with the next meeting's date (owner, 2026-10-24).
 * Logged out: "Log In". Logged in: "Join in Zoom" (which checks members in during the meeting), and a second row
 * with "Referrals" and "One-on-ones". Hidden on the meeting slides.
 */
export function MobileMeetingBar({ meetingId, when, member }: Props) {
  const pathname = usePathname();
  if (chatHiddenOn(pathname)) return null;
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
            <span className="block truncate font-bold">{when}</span>
          </p>
          {member ? (
            <form action={joinMeeting} className="m-0 shrink-0">
              <input type="hidden" name="meetingId" value={meetingId} />
              <button type="submit" className="btn btn-primary btn-sm">
                Join in Zoom
              </button>
            </form>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm shrink-0">
              Log In
            </Link>
          )}
        </div>
        {member ? (
          <nav aria-label="Report activity" className={`border-band-line mt-2.5 grid grid-cols-2 gap-2 border-t pt-2.5 ${pad}`}>
            <Link href="/referrals" className="btn btn-ghost-band btn-sm w-full">
              Referrals
            </Link>
            <Link href="/one-on-ones" className="btn btn-ghost-band btn-sm w-full">
              One-on-ones
            </Link>
          </nav>
        ) : null}
      </aside>
    </>
  );
}
