import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { Pill } from '@/components/ui';

export const metadata: Metadata = { title: 'Application status' };

export default async function PendingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/pending');
  const p = viewer.profile;
  if (p?.status === 'approved') redirect('/dashboard');

  const declined = p?.status === 'declined' || p?.status === 'inactive';
  return (
    <section className="container-site flex justify-center py-16">
      <div className="card flex w-full max-w-[640px] flex-col gap-4 p-8">
        <h1 className="font-display m-0 text-[28px] font-extrabold">{declined ? 'Membership not active' : 'Application received'}</h1>
        {declined ? (
          <p className="text-ink-soft m-0">
            Your membership isn&apos;t active right now. Please contact a member of the leadership team if you have questions.
          </p>
        ) : (
          <>
            <p className="text-ink-soft m-0">
              Thanks{p ? `, ${p.first_name}` : ''}! Your account is a <strong>Guest applicant</strong>. Member pages, meeting links and the directory&apos;s
              contact details open up once the membership committee approves you.
            </p>
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              <li className="border-line flex justify-between gap-3 rounded-xl border px-4 py-3.5">
                <span>Attend 2 meetings as a guest</span>
                <strong className={p && p.guest_meetings_attended >= 2 ? 'text-green-ink' : 'text-amber'}>{p?.guest_meetings_attended ?? 0} of 2</strong>
              </li>
              <li className="border-line flex justify-between gap-3 rounded-xl border px-4 py-3.5">
                <span>One-on-ones with the membership committee</span>
                <strong className="text-amber">3 to schedule</strong>
              </li>
              <li className="border-line flex justify-between gap-3 rounded-xl border px-4 py-3.5">
                <span>Committee approval</span>
                <Pill tone="amber">Pending</Pill>
              </li>
            </ol>
            <div className="flex flex-wrap gap-2.5">
              <Link className="btn btn-primary" href="/visit#request">
                Request a guest invite
              </Link>
              <Link className="btn btn-outline" href="/profile">
                Edit my profile
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
