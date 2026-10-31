import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { requireMember } from '@/lib/auth';
import { guestStatusLabels } from '@/lib/content';
import { formatMeetingDate, formatShortDate } from '@/lib/dates';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { VisitorBroughtForm } from './VisitorBroughtForm';

export const metadata: Metadata = { title: 'Visitors brought' };

// Report Activity → Visitors brought (owner meeting 2026-10-30): members log guests they brought to a meeting.
export default async function VisitorsBroughtPage() {
  const viewer = await requireMember('/visitors-brought');
  const me = viewer.profile;
  const supabase = await createClient();
  const admin = createAdminClient();
  const { since, now } = pastWindow();
  const [meetingsRes, mineRes] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, starts_at')
      .eq('category', 'Networking')
      .is('cancelled_reason', null)
      .gte('starts_at', since)
      .lte('starts_at', now)
      .order('starts_at', { ascending: false })
      .limit(12),
    // Members can't read the guest list themselves; only their own visitors are shown, read on the server.
    admin
      ? admin
          .from('guest_requests')
          .select('id, first_name, last_name, business_name, status, created_at, meeting:meetings(starts_at)')
          .eq('referrer_id', me.id)
          .in('status', ['visited', 'applied', 'joined'])
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (meetingsRes.error) throw new Error('Could not load meetings');
  const meetings = (meetingsRes.data ?? []).map((m) => ({ id: m.id, label: formatMeetingDate(new Date(m.starts_at)) }));
  const mine = (mineRes.data ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    business_name: string | null;
    status: keyof typeof guestStatusLabels;
    created_at: string;
    meeting: { starts_at: string } | null;
  }[];

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <div>
          <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Visitors brought</h1>
          <p className="text-ink-soft mt-2 mb-0 max-w-[70ch]">
            Guests you brought to our meetings. Inviting someone to an upcoming meeting? Use <Link href="/invite-guest">Invite A Guest</Link> instead.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-5">
          {meetings.length ? (
            <VisitorBroughtForm meetings={meetings} />
          ) : (
            <div className="min-w-0 flex-[2_1_320px]">
              <EmptyState title="No past meetings to choose from yet" />
            </div>
          )}
          <section className="card flex min-w-0 flex-[1_1_300px] flex-col gap-3 p-[22px]" aria-labelledby="my-visitors-h">
            <h2 id="my-visitors-h" className="h3">
              My visitors ({mine.length})
            </h2>
            {mine.length === 0 ? (
              <p className="text-ink-muted m-0">No visitors logged yet.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {mine.map((g) => (
                  <li key={g.id} className="border-line-soft border-b pb-2 last:border-b-0">
                    <strong>
                      {g.first_name} {g.last_name}
                    </strong>
                    {g.business_name ? <span className="text-ink-muted"> · {g.business_name}</span> : null}
                    <div className="text-ink-muted text-sm">
                      {g.meeting ? `Visited ${formatShortDate(new Date(g.meeting.starts_at))}` : `Logged ${formatShortDate(new Date(g.created_at))}`} ·{' '}
                      {guestStatusLabels[g.status]}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Meetings from the last 180 days up to now (outside the component body so render stays pure). */
function pastWindow() {
  const now = new Date();
  return { now: now.toISOString(), since: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString() };
}
