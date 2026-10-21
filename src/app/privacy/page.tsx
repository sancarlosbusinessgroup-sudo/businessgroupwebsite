import type { Metadata } from 'next';
import { PageHero } from '@/components/ui';

export const metadata: Metadata = { title: 'Privacy statement' };

export default function PrivacyPage() {
  return (
    <>
      <PageHero crumb="Privacy statement" title="Privacy statement" />
      <section className="container-site flex max-w-[760px] flex-col gap-4 py-12">
        <p className="m-0">[Privacy statement to be provided by group leadership.]</p>
        <p className="text-ink-muted m-0">
          Technical facts for that statement: member contact details are visible only to signed-in, approved members, who can also download them (downloads are
          logged); one-on-one notes are private to their author; per-member activity counts are visible only to admins; uploaded photos have location data
          removed before upload. Live chat on the site is provided by tawk.to: messages you type in the chat window, and the name and email of signed-in
          members, are stored by tawk.to so the support team can reply.
        </p>
      </section>
    </>
  );
}
