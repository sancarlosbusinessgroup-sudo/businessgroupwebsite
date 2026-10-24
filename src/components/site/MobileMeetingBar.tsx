'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { joinMeeting } from '@/app/actions/member';
import { chatHiddenOn } from '@/lib/chat';

type Props = { meetingId: string; when: string; member: boolean };

/**
 * Phones only (owner, 2026-10-24): a bar fixed to the bottom of the screen with the next meeting's date and the
 * Zoom link. Members open Zoom (which checks them in during the meeting); visitors get "Request an invite",
 * since the Zoom link is for members and invited guests. Hidden on the meeting slides.
 */
export function MobileMeetingBar({ meetingId, when, member }: Props) {
  const pathname = usePathname();
  if (chatHiddenOn(pathname)) return null;
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
          <span className="block truncate font-bold">{when}</span>
        </p>
        {member ? (
          <form action={joinMeeting} className="m-0 shrink-0">
            <input type="hidden" name="meetingId" value={meetingId} />
            <button type="submit" className="btn btn-primary btn-sm">
              Join on Zoom
            </button>
          </form>
        ) : (
          <Link href="/visit#request" className="btn btn-primary btn-sm shrink-0">
            Request an invite
          </Link>
        )}
      </aside>
    </>
  );
}
