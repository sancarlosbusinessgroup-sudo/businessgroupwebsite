import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { EventCard } from '@/components/meetings';
import { Avatar, EmptyState, PageHero } from '@/components/ui';
import { getViewer, isApproved } from '@/lib/auth';
import { site, slotDescriptions, slotTitles } from '@/lib/content';
import { getCalendarBetween, getUpcomingCalendar, type CalendarKind } from '@/lib/data/events';
import { getNextMeeting } from '@/lib/data/public';
import { formatMeetingDate, formatMeetingTime, localDateKey, monthGrid } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { eventCategories } from '@/lib/validation';

// One calendar page per kind: group meetings (/group-meetings) and member events (/events).

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type CalendarSearch = { view?: string; month?: string; category?: string };

const copy = {
  group: {
    basePath: '/group-meetings',
    crumb: 'Meetings',
    title: 'Group meetings',
    lead: `We meet ${site.meetingCadence.toLowerCase()} at ${site.meetingTime} on Zoom, with occasional in-person gatherings. Guests may attend twice for free.`,
    heading: 'Upcoming meetings',
    noun: ['meeting', 'meetings'],
    empty: 'No upcoming meetings in this category',
    allLabel: 'Show all meetings',
    people: 'Organizers',
  },
  member: {
    basePath: '/events',
    crumb: 'Member events',
    title: 'Member events',
    lead: 'Workshops, socials and open houses hosted by our members across the Peninsula.',
    heading: 'Upcoming member events',
    noun: ['event', 'events'],
    empty: 'No upcoming member events in this category',
    allLabel: 'Show all member events',
    people: 'Hosts',
  },
} as const;

function parseMonth(raw: string | undefined): { y: number; m: number } {
  const now = localDateKey(new Date());
  const src = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : now.slice(0, 7);
  const [y, m] = src.split('-').map(Number) as [number, number];
  return { y, m: Math.min(Math.max(m - 1, 0), 11) };
}

const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;

export async function CalendarPage({ kind, sp }: { kind: CalendarKind; sp: CalendarSearch }) {
  const c = copy[kind];
  const view = sp.view === 'month' ? 'month' : 'list';
  const category = (eventCategories as readonly string[]).includes(sp.category ?? '') ? sp.category : undefined;
  const { y, m } = parseMonth(sp.month);

  const [viewer, next, upcomingAll] = await Promise.all([
    getViewer(),
    kind === 'group' ? getNextMeeting() : Promise.resolve(null),
    getUpcomingCalendar(16, kind),
  ]);
  const member = isApproved(viewer);
  const matches = (e: { category: string }) => !category || e.category === category;
  const upcoming = upcomingAll.filter(matches);

  const counts: Record<string, number> = { all: upcomingAll.length };
  for (const e of upcomingAll) counts[e.category] = (counts[e.category] ?? 0) + 1;
  const tags = [...new Set(upcomingAll.flatMap((e) => e.tags))].slice(0, 8);

  // Organizers (group) or hosts (member events): public names of approved members
  const personIds = [...new Set(upcomingAll.map((e) => e.organizerId ?? e.hostId).filter((x): x is string => !!x))];
  const supabase = await createClient();
  const { data: people } = personIds.length
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', personIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] };
  const organizers = (people ?? []).map((o) => ({
    name: `${o.first_name} ${o.last_name}`,
    count: upcomingAll.filter((e) => (e.organizerId ?? e.hostId) === o.id).length,
  }));

  // Month view: the month in Pacific time; ±1 day margin, then bucket by local date
  const monthEvents =
    view === 'month'
      ? (
          await getCalendarBetween(new Date(Date.UTC(y, m, 1) - 86400000).toISOString(), new Date(Date.UTC(y, m + 1, 1) + 86400000).toISOString(), kind)
        ).filter(matches)
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
    return str ? `${c.basePath}?${str}` : c.basePath;
  };

  const tab = (active: boolean) =>
    `flex min-h-10 items-center rounded-full px-[18px] font-display text-sm font-bold no-underline ${active ? 'bg-surface text-heading' : 'text-ink-muted'}`;

  return (
    <>
      <PageHero crumb={c.crumb} title={c.title} lead={c.lead}>
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
              <h2 className="font-display m-0 text-[28px] font-extrabold">{c.heading}</h2>
              <p className="text-ink-muted m-0 text-[15px]" aria-live="polite">
                {upcoming.length} {upcoming.length === 1 ? c.noun[0] : c.noun[1]} found
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
              <EmptyState title={c.empty}>
                {category ? <Link href={c.basePath}>{c.allLabel}</Link> : null}
                {kind === 'member' && !category ? 'Members can post workshops, socials and open houses.' : null}
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-4">
                {upcoming.map((e) => (
                  <EventCard key={e.id} item={e} member={member} />
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
              <div className="overflow-x-auto" role="region" aria-label={`Calendar for ${MONTHS[m]} ${y}`} tabIndex={0}>
                <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1.5">
                  <caption className="sr-only">
                    {c.title} in {MONTHS[m]} {y}
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
                                    e.cancelledReason ? 'bg-red-tint text-red line-through' : e.is_online ? 'bg-teal text-on-teal' : 'bg-amber-tint text-amber'
                                  }`}
                                >
                                  {e.cancelledReason ? 'Cancelled: ' : `${formatMeetingTime(new Date(e.starts_at))} `}
                                  {e.regular ? 'Group meeting' : e.title}
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
                  Online
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="bg-amber-tint h-3 w-3 rounded-sm" aria-hidden="true" />
                  In person
                </span>
              </div>
            </div>
          )}
        </div>

        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4" aria-label={`${c.title}: filters and info`}>
          <div className="card flex flex-col gap-3 p-5">
            <h2 className="font-display m-0 text-sm tracking-[0.1em] uppercase">Browse by category</h2>
            <div className="flex flex-wrap gap-2">
              {[{ label: 'All', value: undefined as string | undefined }, ...eventCategories.map((x) => ({ label: x, value: x as string | undefined }))]
                .filter((x) => x.value === undefined || (counts[x.value] ?? 0) > 0 || x.value === category)
                .map((x) => {
                  const active = category === x.value;
                  return (
                    <Link
                      key={x.label}
                      href={q({ view: view === 'month' ? 'month' : undefined, category: x.value })}
                      aria-current={active ? 'true' : undefined}
                      className={`chip no-underline ${active ? 'border-teal bg-teal text-on-teal' : ''}`}
                    >
                      {x.label} · {x.value ? (counts[x.value] ?? 0) : counts.all}
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
              <h2 className="font-display m-0 text-sm tracking-[0.1em] uppercase">{c.people}</h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {organizers.map((o, i) => (
                  <li key={o.name} className="flex items-center gap-3">
                    <Avatar name={o.name} index={i} />
                    <div>
                      <div className="font-semibold">{o.name}</div>
                      <div className="text-ink-muted text-sm">
                        {o.count} {o.count === 1 ? c.noun[0] : c.noun[1]}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {kind === 'member' ? (
            <>
              <div className="card flex flex-col gap-2.5 p-5">
                <h2 className="font-display m-0 text-lg">Hosting something?</h2>
                <p className="text-ink-muted m-0 text-[15px]">Members can post workshops, socials and open houses. They appear here right away.</p>
                <Link className="btn btn-primary btn-sm self-start" href={member ? '/events/new' : '/login?next=/events/new'}>
                  {member ? 'Post an event' : 'Log in to post an event'}
                </Link>
              </div>
              <div className="card flex flex-col gap-2.5 p-5">
                <h2 className="font-display m-0 text-lg">Looking for our meetings?</h2>
                <p className="text-ink-muted m-0 text-[15px]">The group meets {site.meetingCadence.toLowerCase()} on Zoom.</p>
                <Link className="btn btn-outline btn-sm self-start" href="/group-meetings">
                  See group meetings
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="card flex flex-col gap-3 p-5">
                <h2 className="font-display m-0 text-lg">Presentations at every meeting</h2>
                <dl className="m-0 flex flex-col gap-2.5">
                  {(['education', 'presentation'] as const).map((slot) => (
                    <div key={slot}>
                      <dt className="text-teal-text font-bold">{slotTitles[slot]}</dt>
                      <dd className="text-ink-soft m-0 text-[15px]">{slotDescriptions[slot]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="bg-band text-on-band flex flex-col gap-2.5 rounded-2xl p-5">
                <h2 className="font-display text-on-band m-0 text-lg">Want to speak at a meeting?</h2>
                <p className="text-on-band-muted m-0 text-[15px]">Members claim 5-minute and 10-minute presentation slots on the members&apos; Meetings page.</p>
                <Link className="btn btn-light btn-sm self-start" href={member ? '/meetings' : '/login?next=/meetings'}>
                  {member ? 'Claim a slot' : 'Log in to sign up'}
                </Link>
              </div>
              <div className="card flex flex-col gap-2.5 p-5">
                <h2 className="font-display m-0 text-lg">Member events</h2>
                <p className="text-ink-muted m-0 text-[15px]">Workshops, socials and open houses hosted by our members.</p>
                <Link className="btn btn-outline btn-sm self-start" href="/events">
                  See member events
                </Link>
              </div>
            </>
          )}
          <a className="btn btn-outline btn-sm" href="/calendar.ics">
            Subscribe to the calendar
          </a>
        </aside>
      </section>
    </>
  );
}
