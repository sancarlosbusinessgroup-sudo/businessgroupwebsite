import type { Metadata } from 'next';
import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { EventCard } from '@/components/meetings';
import { Avatar, EmptyState, PageHero } from '@/components/ui';
import { getViewer, isApproved } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getMeetingsBetween, getNextMeeting, getUpcomingMeetings } from '@/lib/data/public';
import { formatMeetingDate, formatMeetingTime, localDateKey, monthGrid } from '@/lib/dates';

export const metadata: Metadata = { title: 'Events' };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Search = { view?: string; month?: string; category?: string };

function parseMonth(raw: string | undefined): { y: number; m: number } {
  const now = localDateKey(new Date());
  const src = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : now.slice(0, 7);
  const [y, m] = src.split('-').map(Number) as [number, number];
  return { y, m: Math.min(Math.max(m - 1, 0), 11) };
}

const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;

export default async function EventsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const view = sp.view === 'month' ? 'month' : 'list';
  const category = sp.category === 'Networking' || sp.category === 'Social' ? sp.category : undefined;
  const { y, m } = parseMonth(sp.month);

  const [viewer, next, upcomingAll] = await Promise.all([getViewer(), getNextMeeting(), getUpcomingMeetings(12)]);
  const member = isApproved(viewer);
  const upcoming = category ? upcomingAll.filter((e) => e.category === category) : upcomingAll;

  const counts = { all: upcomingAll.length, Networking: 0, Social: 0 } as Record<string, number>;
  for (const e of upcomingAll) counts[e.category] = (counts[e.category] ?? 0) + 1;
  const tags = [...new Set(upcomingAll.flatMap((e) => e.tags))].slice(0, 8);

  // Organizers (public names of approved members)
  const orgIds = [...new Set(upcomingAll.map((e) => e.organizer_id).filter((x): x is string => !!x))];
  const supabase = await createClient();
  const { data: orgs } = orgIds.length
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', orgIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] };
  const organizers = (orgs ?? []).map((o) => ({
    name: `${o.first_name} ${o.last_name}`,
    count: upcomingAll.filter((e) => e.organizer_id === o.id).length,
  }));

  // Month view data (calendar covers the month in Pacific time; ±1 day margin then bucket by local date)
  const monthEvents =
    view === 'month'
      ? await getMeetingsBetween(new Date(Date.UTC(y, m, 1) - 86400000).toISOString(), new Date(Date.UTC(y, m + 1, 1) + 86400000).toISOString())
      : [];
  const byDay = new Map<string, typeof monthEvents>();
  for (const e of monthEvents) {
    const k = localDateKey(new Date(e.starts_at));
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const today = localDateKey(new Date());
  const prev = m === 0 ? monthKey(y - 1, 11) : monthKey(y, m - 1);
  const nextM = m === 11 ? monthKey(y + 1, 0) : monthKey(y, m + 1);
  const q = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
    const str = s.toString();
    return str ? `/events?${str}` : '/events';
  };

  const tab = (active: boolean) =>
    `flex min-h-10 items-center rounded-full px-[18px] font-display text-sm font-bold no-underline ${active ? 'bg-surface text-heading' : 'text-ink-muted'}`;

  return (
    <>
      <PageHero
        crumb="Events"
        title="Business networking events"
        lead="Meetings every other Monday at 8:15 AM on Zoom, plus member-hosted gatherings across the Peninsula."
      >
        {next ? (
          <div className="card min-w-0 flex-[1_1_380px]">
            <div className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="eyebrow text-teal-text">Next meeting in</span>
                <span className="text-ink-muted text-sm">
                  {formatMeetingDate(new Date(next.starts_at))} · {formatMeetingTime(new Date(next.starts_at))} PT
                </span>
              </div>
              <Countdown target={next.starts_at} />
            </div>
          </div>
        ) : null}
      </PageHero>

      <section className="container-site flex flex-wrap items-start gap-8 pt-10 pb-16">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display m-0 text-[28px] font-extrabold">Upcoming events</h2>
              <p className="text-ink-muted m-0 text-[15px]" aria-live="polite">
                {upcoming.length} {upcoming.length === 1 ? 'event' : 'events'} found
              </p>
            </div>
            <nav aria-label="View" className="bg-line-soft flex rounded-full p-1">
              <Link className={tab(view === 'list')} aria-current={view === 'list' ? 'page' : undefined} href={q({ category })}>
                List
              </Link>
              <Link className={tab(view === 'month')} aria-current={view === 'month' ? 'page' : undefined} href={q({ view: 'month', category })}>
                Calendar
              </Link>
            </nav>
          </div>

          {view === 'list' ? (
            upcoming.length === 0 ? (
              <EmptyState title="No upcoming events in this category">
                <Link href="/events">Show all events</Link>
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-4">
                {upcoming.map((e) => (
                  <EventCard key={e.id} meeting={e} member={member} />
                ))}
              </div>
            )
          ) : (
            <div className="card flex flex-col gap-3.5 p-5">
              <div className="flex items-center justify-between">
                <Link className="btn btn-outline btn-sm px-3.5" href={q({ view: 'month', month: prev, category })} aria-label="Previous month">
                  ‹
                </Link>
                <h3 className="font-display m-0 text-xl font-extrabold" aria-live="polite">
                  {MONTHS[m]} {y}
                </h3>
                <Link className="btn btn-outline btn-sm px-3.5" href={q({ view: 'month', month: nextM, category })} aria-label="Next month">
                  ›
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1.5">
                  <caption className="sr-only">
                    Events in {MONTHS[m]} {y}
                  </caption>
                  <thead>
                    <tr>
                      {DOWS.map((d) => (
                        <th key={d} scope="col" className="text-ink-muted py-1 text-[13px] font-bold">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.ceil(monthGrid(y, m).length / 7) }, (_, w) => (
                      <tr key={w}>
                        {Array.from({ length: 7 }, (_, d) => {
                          const cell = monthGrid(y, m)[w * 7 + d] ?? null;
                          if (!cell) return <td key={d} className="bg-canvas h-[92px] rounded-[10px]" />;
                          const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
                          const evs = byDay.get(key) ?? [];
                          const isToday = key === today;
                          return (
                            <td
                              key={d}
                              className={`border-line-soft h-[92px] rounded-[10px] border p-2 align-top ${isToday ? 'bg-band text-on-band' : 'bg-surface'}`}
                              aria-current={isToday ? 'date' : undefined}
                            >
                              <div className="text-sm font-bold">{cell.day}</div>
                              {evs.map((e) => (
                                <Link
                                  key={e.id}
                                  href={`/events/${e.slug}`}
                                  className={`mt-1 block rounded-md px-1.5 py-1 text-xs leading-tight font-semibold no-underline ${
                                    e.is_online ? 'bg-teal text-on-teal' : 'bg-amber-tint text-amber'
                                  }`}
                                >
                                  {formatMeetingTime(new Date(e.starts_at))} {e.category === 'Networking' ? 'SCBNG' : e.title}
                                </Link>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-ink-muted flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="bg-teal h-3 w-3 rounded-sm" aria-hidden="true" />
                  Zoom meeting
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="bg-amber-tint h-3 w-3 rounded-sm" aria-hidden="true" />
                  In-person event
                </span>
              </div>
            </div>
          )}
        </div>

        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4" aria-label="Event filters and info">
          <div className="card flex flex-col gap-3 p-5">
            <h2 className="font-display m-0 text-sm tracking-[0.1em] uppercase">Browse by category</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'All', value: undefined, n: counts.all },
                { label: 'Networking', value: 'Networking', n: counts.Networking },
                { label: 'Social', value: 'Social', n: counts.Social },
              ].map((c) => {
                const active = category === c.value;
                return (
                  <Link
                    key={c.label}
                    href={q({ view: view === 'month' ? 'month' : undefined, category: c.value })}
                    aria-current={active ? 'true' : undefined}
                    className={`chip no-underline ${active ? 'border-teal bg-teal text-on-teal' : ''}`}
                  >
                    {c.label} · {c.n ?? 0}
                  </Link>
                );
              })}
            </div>
          </div>
          {tags.length ? (
            <div className="card flex flex-col gap-3 p-5">
              <h2 className="font-display m-0 text-sm tracking-[0.1em] uppercase">Popular topics</h2>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {tags.map((t) => (
                  <li key={t} className="chip">
                    #{t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {organizers.length ? (
            <div className="card flex flex-col gap-3 p-5">
              <h2 className="font-display m-0 text-sm tracking-[0.1em] uppercase">Organizers</h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {organizers.map((o, i) => (
                  <li key={o.name} className="flex items-center gap-3">
                    <Avatar name={o.name} index={i} />
                    <div>
                      <div className="font-semibold">{o.name}</div>
                      <div className="text-ink-muted text-sm">
                        {o.count} {o.count === 1 ? 'event' : 'events'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="bg-band text-on-band flex flex-col gap-2.5 rounded-2xl p-5">
            <h2 className="font-display text-on-band m-0 text-lg">Want to speak at a meeting?</h2>
            <p className="text-on-band-muted m-0 text-[15px]">Members claim 5-minute education or 10-minute presentation slots on the Meetings page.</p>
            <Link className="btn btn-light btn-sm self-start" href={member ? '/meetings' : '/login?next=/meetings'}>
              {member ? 'Claim a slot' : 'Log in to sign up'}
            </Link>
          </div>
          <a className="btn btn-outline btn-sm" href="/calendar.ics">
            Subscribe to the calendar
          </a>
        </aside>
      </section>
    </>
  );
}
