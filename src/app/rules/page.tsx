import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHero } from '@/components/ui';
import { RulesSections } from '@/components/Rules';
import { requireMember } from '@/lib/auth';
import { site } from '@/lib/content';
import { governanceEffective } from '@/lib/governance';

export const metadata: Metadata = {
  title: 'Rules',
  description: `The rules ${site.name} members agree to.`,
  robots: { index: false, follow: false },
};

/** Support → Rules (owner, 2026-11-24): the rules from the Bylaws and Procedures, in one place for members. */
export default async function RulesPage() {
  await requireMember('/rules');
  return (
    <>
      <PageHero crumb="Rules" title="Rules" lead={<>The rules every member agrees to, from our Bylaws and Procedures (effective {governanceEffective}).</>} />
      <div className="container-site flex flex-wrap items-start gap-10 py-12">
        <nav aria-label="On this page" className="card flex min-w-0 flex-[1_1_220px] flex-col gap-2 p-5 text-[15px] lg:sticky lg:top-6">
          <p className="eyebrow m-0">On this page</p>
          <a href="#attendance">Attendance and absences</a>
          <a href="#tardiness">Arriving late and leaving early</a>
          <a href="#expectations">What every member does</a>
          <a href="#meetings">At meetings</a>
          <a href="#presentations">Presentations</a>
          <a href="#membership">Joining and staying a member</a>
          <a href="#dues">Dues</a>
          <Link href="/bylaws" className="mt-2 font-bold">
            Full Bylaws &amp; Procedures →
          </Link>
        </nav>
        <div className="min-w-0 flex-[3_1_560px]">
          <RulesSections />
        </div>
      </div>
    </>
  );
}
