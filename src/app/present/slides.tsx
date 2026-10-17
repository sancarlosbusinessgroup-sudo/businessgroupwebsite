import Image from 'next/image';
import type { ReactNode } from 'react';
import { initials } from '@/components/ui';
import { leaderboardMetrics, site, slotDescriptions, slotLabels, slotTitles } from '@/lib/content';
import type { DeckData, SpeakerCard } from '@/lib/data/slides';
import { formatMeetingDate, formatMeetingTime, formatMoney } from '@/lib/dates';
import { env, mediaUrl } from '@/lib/env';
import { chunk, slideLabel, type SlideKey } from '@/lib/slides';
import type { DeckSlide } from './Deck';

// Slide layouts. Sizes use container units (cqw) so text scales with the 16:9 stage and stays readable on a shared screen.

function Frame({ eyebrow, title, children, center }: { eyebrow?: string; title: string; children?: ReactNode; center?: boolean }) {
  return (
    <div className={`flex h-full flex-col gap-[2.2cqw] p-[5cqw] ${center ? 'items-center justify-center text-center' : ''}`}>
      {eyebrow ? <p className="font-display text-sky m-0 text-[1.8cqw] font-bold tracking-[0.14em] uppercase">{eyebrow}</p> : null}
      <h2 className="font-display text-on-band m-0 text-[4.4cqw] leading-[1.08] font-extrabold">{title}</h2>
      {children}
    </div>
  );
}

function Face({ name, path, size = 12 }: { name: string; path: string | null; size?: number }) {
  const url = mediaUrl('profile-media', path);
  return (
    <span
      className="bg-teal-tint text-teal-hover font-display relative flex flex-none items-center justify-center overflow-hidden rounded-full font-extrabold"
      style={{ width: `${size}cqw`, height: `${size}cqw`, fontSize: `${size * 0.36}cqw` }}
      aria-hidden="true"
    >
      {url ? <Image src={url} alt="" fill sizes="25vw" className="object-cover" /> : initials(name)}
    </span>
  );
}

function SpeakerSlide({ label, description, s }: { label: string; description: string; s: SpeakerCard | null }) {
  if (!s)
    return (
      <Frame eyebrow="Presentation" title={label} center>
        <Big>{description}</Big>
        <p className="text-on-band-muted m-0 text-[2.4cqw]">This slot is open today.</p>
      </Frame>
    );
  return (
    <div className="flex h-full flex-col gap-[1.6cqw] p-[5cqw]">
      <p className="font-display text-sky m-0 text-[1.8cqw] font-bold tracking-[0.14em] uppercase">Presentation</p>
      <h2 className="font-display text-on-band m-0 text-[4.4cqw] leading-[1.08] font-extrabold">{label}</h2>
      <p className="text-on-band-muted m-0 text-[2cqw] leading-snug">{description}</p>
      <div className="flex flex-1 items-center gap-[4cqw]">
        <Face name={s.display_name} path={s.avatar_path} size={20} />
        <div className="flex min-w-0 flex-col gap-[1cqw]">
          <p className="font-display text-on-band m-0 text-[3.6cqw] font-extrabold">{s.display_name}</p>
          {s.business ? <p className="text-sky m-0 text-[2.4cqw] font-semibold">{s.business}</p> : null}
          {s.topic ? <p className="text-on-band m-0 mt-[1.5cqw] text-[3cqw] leading-tight italic">“{s.topic}”</p> : null}
          {s.topic_description ? <p className="text-on-band-muted m-0 text-[2cqw]">{s.topic_description}</p> : null}
        </div>
      </div>
    </div>
  );
}

const Big = ({ children }: { children: ReactNode }) => <p className="text-on-band-muted m-0 text-[2.4cqw] leading-snug">{children}</p>;

export function buildSlides(d: DeckData): DeckSlide[] {
  const start = new Date(d.meeting.starts_at);
  const visitUrl = `${env.siteUrl.replace(/^https?:\/\//, '')}/visit`;
  const out: DeckSlide[] = [];
  const add = (key: SlideKey, node: ReactNode, suffix = '') => {
    const note = d.notes[key];
    out.push({
      id: key + suffix,
      label: slideLabel(key) + (suffix ? ` ${suffix}` : ''),
      node: note ? (
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1">{node}</div>
          <p className="bg-band-2 text-on-band border-accent mx-[5cqw] mb-[3cqw] rounded-[1cqw] border-l-[0.6cqw] px-[1.6cqw] py-[1.1cqw] text-[2cqw] leading-snug whitespace-pre-line">
            {note}
          </p>
        </div>
      ) : (
        node
      ),
    });
  };

  for (const key of d.slides) {
    switch (key) {
      case 'welcome':
        add(
          key,
          <Frame eyebrow={`Meeting #${d.number}`} title={`Welcome to ${site.name}`} center>
            <Image src="/images/logo-mark.png" alt="" width={256} height={256} className="order-first h-[14cqw] w-[14cqw]" />
            <Big>
              {formatMeetingDate(start)} · {formatMeetingTime(start)} PT
            </Big>
          </Frame>,
        );
        break;
      case 'networking':
        add(
          key,
          <Frame eyebrow="8:15 – 8:30 AM" title="Open Networking" center>
            <Big>A chance to chat, check tech, and warm up for the day — especially helpful on Zoom!</Big>
          </Frame>,
        );
        break;
      case 'introductions':
        add(
          key,
          <Frame eyebrow="Introductions" title="Welcome, everyone">
            <Big>We welcome everyone, introduce the leadership team, and get things started.</Big>
            {d.leadership.length ? (
              <ul className="m-0 grid flex-1 list-none grid-cols-3 content-start gap-[1.4cqw] p-0">
                {d.leadership.slice(0, 12).map((l) => (
                  <li key={`${l.name}${l.role}`} className="bg-band-2 flex flex-col gap-[0.3cqw] rounded-[1cqw] px-[1.4cqw] py-[1cqw]">
                    <span className="text-on-band text-[2.1cqw] font-bold">{l.name}</span>
                    <span className="text-sky text-[1.6cqw] font-semibold">{l.role}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Frame>,
        );
        break;
      case 'roundtable':
        add(
          key,
          <Frame eyebrow="Roundtable check-in" title="Your 30-second spiel & Win of the Week" center>
            <Big>Everyone gets a moment to share their 30-second spiel and their “Win of the Week.” We encourage positive updates!</Big>
          </Frame>,
        );
        break;
      case 'phones':
        add(
          key,
          <Frame title="Please silence your phones" center>
            <svg viewBox="0 0 24 24" className="text-sky h-[14cqw] w-[14cqw]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <rect x="6" y="2" width="12" height="20" rx="2.5" />
              <path d="M11 18h2M3 3l18 18" strokeLinecap="round" />
            </svg>
            <Big>Thank you. Notifications off helps everyone stay present.</Big>
          </Frame>,
        );
        break;
      case 'visitors':
        add(
          key,
          <Frame eyebrow="For visitors" title="Visiting today? Welcome!">
            <Big>
              {site.name} meets {site.meetingCadence.toLowerCase()} at {site.meetingTime} PT. Guests may attend twice for free, then apply to join at{' '}
              <strong className="text-on-band">{visitUrl}</strong>.
            </Big>
            <p className="text-sky m-0 mt-[1cqw] text-[1.8cqw] font-bold tracking-[0.1em] uppercase">Open professions (one member each)</p>
            {d.openCategories.length ? (
              <ul className="m-0 flex list-none flex-wrap gap-[1cqw] p-0">
                {d.openCategories.map((c) => (
                  <li key={c} className="bg-band-2 text-on-band rounded-full px-[1.6cqw] py-[0.6cqw] text-[2cqw] font-semibold">
                    {c}
                  </li>
                ))}
              </ul>
            ) : (
              <Big>Ask us about joining: we’ll let you know which professions are open.</Big>
            )}
          </Frame>,
        );
        break;
      case 'newcomers':
        add(
          key,
          <Frame eyebrow="Please welcome" title="New members & today’s visitors">
            <div className="grid flex-1 grid-cols-2 gap-[4cqw]">
              <div className="flex flex-col gap-[1cqw]">
                <p className="text-sky m-0 text-[1.8cqw] font-bold tracking-[0.1em] uppercase">New members</p>
                {d.newMembers.length ? (
                  <ul className="m-0 flex list-none flex-col gap-[0.8cqw] p-0 text-[2.3cqw]">
                    {d.newMembers.slice(0, 6).map((m) => (
                      <li key={`${m.first_name}${m.last_name}`}>
                        <strong className="text-on-band">
                          {m.first_name} {m.last_name}
                        </strong>
                        <span className="text-on-band-muted"> · {m.business_name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Big>No new members since the last meeting.</Big>
                )}
              </div>
              <div className="flex flex-col gap-[1cqw]">
                <p className="text-sky m-0 text-[1.8cqw] font-bold tracking-[0.1em] uppercase">Visitors</p>
                {d.visitors.length ? (
                  <ul className="m-0 flex list-none flex-col gap-[0.8cqw] p-0 text-[2.3cqw]">
                    {d.visitors.slice(0, 6).map((v, n) => (
                      <li key={`${v.display_name}${n}`}>
                        <strong className="text-on-band">{v.display_name}</strong>
                        {v.business_name ? <span className="text-on-band-muted"> · {v.business_name}</span> : null}
                        {v.invited_by ? <span className="text-on-band-muted block text-[1.7cqw]">Guest of {v.invited_by}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Big>Visitors who registered will appear here.</Big>
                )}
              </div>
            </div>
          </Frame>,
        );
        break;
      case 'asks': {
        const pages = chunk(d.asks, 6);
        if (!pages.length)
          add(
            key,
            <Frame eyebrow="Weekly specific asks" title="This week we’re looking for…" center>
              <Big>Add your ask on your dashboard and it will appear here.</Big>
            </Frame>,
          );
        pages.forEach((page, p) =>
          add(
            key,
            <Frame eyebrow={`Weekly specific asks${pages.length > 1 ? ` · ${p + 1} of ${pages.length}` : ''}`} title="This week we’re looking for…">
              <ul className="m-0 grid flex-1 list-none grid-cols-2 content-start gap-[2cqw] p-0">
                {page.map((a) => (
                  <li key={`${a.first_name}${a.last_name}`} className="bg-band-2 flex flex-col gap-[0.4cqw] rounded-[1.2cqw] p-[1.6cqw]">
                    <span className="text-sky text-[1.6cqw] font-bold">
                      {a.first_name} {a.last_name} · {a.business_name}
                    </span>
                    <span className="text-on-band text-[2.1cqw] leading-snug">{a.weekly_ask}</span>
                  </li>
                ))}
              </ul>
            </Frame>,
            pages.length > 1 ? `(${p + 1} of ${pages.length})` : '',
          ),
        );
        break;
      }
      case 'five_minute':
        add(key, <SpeakerSlide label={slotTitles.education} description={slotDescriptions.education} s={d.five} />);
        break;
      case 'ten_minute':
        add(key, <SpeakerSlide label={slotTitles.presentation} description={slotDescriptions.presentation} s={d.ten} />);
        break;
      case 'summary':
        add(
          key,
          <Frame eyebrow="Activity numbers" title="Our numbers">
            <p className="text-on-band-muted m-0 text-[2cqw]">We share referral stats, one-on-ones, and closed business from the last meeting.</p>
            <table className="w-full flex-1 border-separate border-spacing-[1cqw] text-left">
              <thead>
                <tr>
                  <th scope="col" className="text-[1.8cqw]">
                    <span className="sr-only">Period</span>
                  </th>
                  {['One-on-ones', 'Referrals', 'Closed deals', 'Closed business'].map((h) => (
                    <th key={h} scope="col" className="text-sky text-[1.8cqw] font-bold tracking-[0.08em] uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.totals.map(({ label, t }) => (
                  <tr key={label}>
                    <th scope="row" className="text-on-band-muted text-[2.1cqw] font-semibold">
                      {label}
                    </th>
                    {[t.one_on_ones, t.referrals, t.closed_deals, formatMoney(t.closed_amount)].map((v, n) => (
                      <td key={n} className="font-display text-on-band text-[3.6cqw] font-extrabold tabular-nums">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Frame>,
        );
        break;
      case 'leaderboards':
        add(
          key,
          <Frame eyebrow="This month" title="Leaderboards">
            <div className="grid flex-1 grid-cols-4 gap-[2cqw]">
              {leaderboardMetrics.map((m) => {
                const rows = d.leaders.filter((r) => r.metric === m.key);
                return (
                  <div key={m.key} className="flex flex-col gap-[0.8cqw]">
                    <h3 className="text-sky m-0 text-[1.7cqw] font-bold tracking-[0.08em] uppercase">{m.label}</h3>
                    {rows.length ? (
                      <ol className="m-0 flex list-none flex-col gap-[0.6cqw] p-0">
                        {rows.map((r) => (
                          <li key={r.profile_id} className="bg-band-2 flex items-center gap-[0.8cqw] rounded-[0.8cqw] px-[1cqw] py-[0.6cqw] text-[1.8cqw]">
                            <span className="text-sky w-[2cqw] font-extrabold">{r.rank}</span>
                            <span className="text-on-band min-w-0 flex-1 truncate">
                              {r.first_name} {r.last_name.slice(0, 1)}.
                            </span>
                            <strong className="text-on-band tabular-nums">{r.value}</strong>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-on-band-muted m-0 text-[1.7cqw]">Nothing yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Frame>,
        );
        break;
      case 'events':
        add(
          key,
          <Frame eyebrow="Events & announcements" title="Upcoming events & announcements">
            <p className="text-on-band-muted m-0 text-[2cqw]">We wrap up with upcoming events, shout-outs, and reminders.</p>
            {d.events.length ? (
              <ul className="m-0 grid flex-1 list-none grid-cols-2 content-start gap-[1.6cqw] p-0">
                {d.events.map((e) => (
                  <li key={e.id} className="bg-band-2 flex flex-col gap-[0.4cqw] rounded-[1.2cqw] p-[1.6cqw]">
                    <span className="text-sky text-[1.6cqw] font-bold">
                      {formatMeetingDate(new Date(e.starts_at))} · {formatMeetingTime(new Date(e.starts_at))}
                    </span>
                    <span className="text-on-band text-[2.2cqw] leading-tight font-bold">{e.title}</span>
                    <span className="text-on-band-muted text-[1.6cqw]">
                      {e.kind === 'member' && e.hostName ? `Hosted by ${e.hostName} · ` : ''}
                      {e.is_online ? 'Online' : e.location}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Big>No events posted yet. Members can post events on the Events page.</Big>
            )}
          </Frame>,
        );
        break;
      case 'closing':
        add(
          key,
          <Frame eyebrow="See you next time" title="Thank you for joining us" center>
            {d.next ? (
              <>
                <Big>
                  Next meeting: <strong className="text-on-band">{formatMeetingDate(new Date(d.next.starts_at))}</strong> ·{' '}
                  {formatMeetingTime(new Date(d.next.starts_at))} PT
                </Big>
                <ul className="m-0 flex list-none flex-col gap-[0.8cqw] p-0 text-[2.2cqw]">
                  {(
                    [
                      ['education', d.next.five],
                      ['presentation', d.next.ten],
                    ] as const
                  ).map(([slot, s]) => (
                    <li key={slot}>
                      <span className="text-sky font-bold">{slotLabels[slot]}:</span>{' '}
                      <span className="text-on-band">{s ? `${s.display_name}${s.topic ? ` · “${s.topic}”` : ''}` : 'open, claim it on the Meetings page'}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Big>The next meeting date will be posted soon.</Big>
            )}
          </Frame>,
        );
        break;
    }
  }
  return out;
}
