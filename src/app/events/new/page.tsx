import type { Metadata } from 'next';
import Link from 'next/link';
import { requireMember } from '@/lib/auth';
import { isoToPacificLocal, nowMs } from '@/lib/dates';
import { EventForm } from '../EventForm';

export const metadata: Metadata = { title: 'Post an event' };

export default async function NewEventPage() {
  const viewer = await requireMember('/events/new');
  return (
    <div className="bg-canvas">
      <div className="container-site flex max-w-[860px] flex-col gap-5 pt-8 pb-16">
        <div>
          <Link href="/events" className="text-sm font-bold">
            ← All events
          </Link>
          <h1 className="font-display m-0 mt-3 text-[clamp(28px,3.4vw,40px)] font-extrabold">Post an event</h1>
          <p className="text-ink-muted m-0 mt-1">Share a workshop, social or open house with members and visitors. You can edit or delete it later.</p>
        </div>
        <EventForm userId={viewer.userId} minStart={isoToPacificLocal(new Date(nowMs()).toISOString())} />
      </div>
    </div>
  );
}
