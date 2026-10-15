import type { Metadata } from 'next';
import { PageHero } from '@/components/ui';

export const metadata: Metadata = { title: 'Privacy statement' };

export default function PrivacyPage() {
  return (
    <>
      <PageHero crumb="Privacy statement" title="Privacy statement" />
      <section className="container-site flex max-w-[760px] flex-col gap-4 py-12">
        <p className="m-0">[Privacy statement to be provided by SCBNG leadership.]</p>
        <p className="text-ink-muted m-0">
          Technical facts for that statement: member contact details are visible only to signed-in, approved members; one-on-one ratings and notes are private
          to their author; uploaded photos have location data removed before upload.
        </p>
      </section>
    </>
  );
}
