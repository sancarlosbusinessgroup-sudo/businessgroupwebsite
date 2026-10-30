import type { Metadata } from 'next';
import { PageHero } from '@/components/ui';
import { site } from '@/lib/content';
import { signInMembers, todaysMeeting } from '@/lib/data/visitor-sign-in';
import { formatMeetingDate, formatMeetingTime } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { VisitorSignInForm } from './VisitorSignInForm';

export const metadata: Metadata = {
  title: 'Visitor sign-in',
  description: `Visiting a ${site.name} meeting? Sign in with your details.`,
  robots: { index: false, follow: false },
};

// Always fresh: which meeting is "today" depends on the moment the visitor opens the link.
export const dynamic = 'force-dynamic';

/**
 * Visitor sign-in (owner, 2026-10-30). Management copies this link from the Admin page and pastes it in the Zoom chat,
 * so visitors who came without asking for an invite can leave their details. They land in Admin → Guest invite requests.
 */
export default async function VisitorSignInPage() {
  const supabase = await createClient();
  const [meeting, members] = await Promise.all([todaysMeeting(supabase), signInMembers(supabase)]);
  const start = meeting ? new Date(meeting.starts_at) : null;

  return (
    <>
      <PageHero
        crumb="Visitor sign-in"
        title={`Welcome to ${site.name}!`}
        lead={
          start
            ? `Thanks for joining today’s meeting (${formatMeetingDate(start)}, ${formatMeetingTime(start)} PT). Please sign in so our members can get to know you.`
            : 'Thanks for your interest. Leave your details and we’ll send you the Zoom link for our next meeting.'
        }
      />
      <section className="container-site max-w-[880px] pt-10 pb-16">
        <VisitorSignInForm members={members} meetingToday={!!meeting} />
      </section>
    </>
  );
}
