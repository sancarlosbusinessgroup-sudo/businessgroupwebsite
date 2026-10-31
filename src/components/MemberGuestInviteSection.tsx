import { MemberGuestInviteForm, type GuestMeeting } from './MemberGuestInviteForm';

/**
 * "Want to Invite A Guest?" band with the members' guest invite form (owner, 2026-10-30). Used on the Invite A Guest
 * page (as the page heading) and in place of the public form on the Visit page when a member is signed in.
 */
export function MemberGuestInviteSection({
  meetings,
  memberName,
  headingLevel = 2,
  id = 'request',
}: {
  meetings: GuestMeeting[];
  memberName: string;
  headingLevel?: 1 | 2;
  id?: string;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section id={id} className="bg-band scroll-mt-6" aria-labelledby={`${id}-title`}>
      <div className="container-site flex flex-wrap gap-10 py-16">
        <div className="text-on-band-muted flex min-w-0 flex-[1_1_320px] flex-col gap-3.5">
          <Heading id={`${id}-title`} className="font-display text-on-band m-0 text-[clamp(28px,3.2vw,40px)] leading-tight font-extrabold">
            Want to Invite A Guest?
          </Heading>
          <p className="m-0 text-lg">Fill out the form for your guest.</p>
        </div>
        <MemberGuestInviteForm meetings={meetings} memberName={memberName} className="flex-[1_1_460px]" />
      </div>
    </section>
  );
}
