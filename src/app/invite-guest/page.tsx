import type { Metadata } from 'next';
import { MemberGuestInviteSection } from '@/components/MemberGuestInviteSection';
import { requireMember } from '@/lib/auth';
import { guestMeetingOptions } from '@/lib/data/public';

export const metadata: Metadata = {
  title: 'Invite A Guest',
  description: 'Invite a guest to a meeting: fill out the form for your guest.',
  robots: { index: false },
};

/** Members only (owner, 2026-10-30): the "Invite A Guest" tab beside Support. */
export default async function InviteGuestPage() {
  const viewer = await requireMember('/invite-guest');
  const meetings = await guestMeetingOptions();
  const me = viewer.profile;
  return <MemberGuestInviteSection meetings={meetings} memberName={`${me.first_name} ${me.last_name}`.trim()} headingLevel={1} id="invite-guest" />;
}
