import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireMember } from '@/lib/auth';
import { getNextMeeting } from '@/lib/data/public';

export const metadata: Metadata = { title: 'Meeting slides', robots: { index: false } };

/** The deck for the next (or currently running) regular meeting. */
export default async function PresentNextPage() {
  await requireMember('/present/next');
  const next = await getNextMeeting();
  if (next) redirect(`/present/${next.slug}`);
  return (
    <div className="container-site flex flex-col gap-4 py-16">
      <h1 className="h2">No upcoming meeting</h1>
      <p className="m-0">Slides appear here once the next meeting is on the calendar.</p>
      <Link href="/meetings">Back to meetings</Link>
    </div>
  );
}
