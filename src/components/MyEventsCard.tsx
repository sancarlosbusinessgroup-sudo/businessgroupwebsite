import Link from 'next/link';
import type { CalendarItem } from '@/lib/data/events';
import { formatMeetingDate, formatMeetingTime } from '@/lib/dates';
import { AddEventDialog } from './AddEventDialog';

/**
 * Dashboard "My Events" (owner, 2026-10-31): the member's own upcoming events, a pop-up to add one, and a link to all
 * member events. Dates posted together show as one line with the next date and how many more there are.
 */
export function MyEventsCard({ events, userId, minStart }: { events: CalendarItem[]; userId: string; minStart: string }) {
  const groups: { first: CalendarItem; more: number }[] = [];
  const bySeries = new Map<string, { first: CalendarItem; more: number }>();
  for (const e of events) {
    const g = e.seriesId ? bySeries.get(e.seriesId) : undefined;
    if (g) {
      g.more += 1;
      continue;
    }
    const entry = { first: e, more: 0 };
    groups.push(entry);
    if (e.seriesId) bySeries.set(e.seriesId, entry);
  }

  return (
    <section className="card flex flex-col gap-3.5 p-5" aria-labelledby="my-events-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="my-events-h" className="h3 m-0">
          My Events
        </h2>
        <div className="flex flex-wrap gap-2">
          <AddEventDialog userId={userId} minStart={minStart} />
          <Link href="/events" className="btn btn-outline btn-sm">
            Member Events
          </Link>
        </div>
      </div>
      {groups.length ? (
        <ul className="m-0 flex list-none flex-col p-0" aria-label="Your upcoming events">
          {groups.map(({ first: e, more }) => {
            const start = new Date(e.starts_at);
            return (
              <li key={e.id} className="border-line-soft flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t py-3 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <Link href={`/events/${e.slug}`} className="font-semibold">
                    {e.title}
                  </Link>
                  <div className="text-ink-muted text-sm">
                    {formatMeetingDate(start)} · {formatMeetingTime(start)} PT
                    {more ? ` · and ${more} more ${more === 1 ? 'date' : 'dates'}` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {e.visibility === 'members' ? (
                    <span className="pill bg-amber-tint text-amber">Members only</span>
                  ) : (
                    <span className="pill bg-green-tint text-green-ink">Public</span>
                  )}
                  <Link href={`/events/${e.slug}/edit`} className="text-sm font-bold">
                    Edit<span className="sr-only"> {e.title}</span>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-ink-muted m-0 text-[15px]">You have no upcoming events. Post a workshop, social or open house for members and visitors.</p>
      )}
    </section>
  );
}
