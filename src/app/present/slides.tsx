import Image from 'next/image';
import type { ReactNode } from 'react';
import { initials } from '@/components/ui';
import { leaderboardMetrics, site } from '@/lib/content';
import type { DeckData, SlideMedia, SpeakerCard } from '@/lib/data/slides';
import { formatMeetingDate, formatMeetingTime, formatMoney } from '@/lib/dates';
import { env, mediaUrl } from '@/lib/env';
import { procedures } from '@/lib/governance';
import { chunk, slideLabel, slideTime, type SlideKey } from '@/lib/slides';
import type { DeckSlide } from './Deck';
import { PdfPageSlide, SlideTimer, YouTubeSlide } from './SlideWidgets';

// Meeting slides in the style of the group's printed Bylaws: white pages, the logo lockup top left, a grey
// "card" for the agenda time, chevron bullets and the Golden Gate photo along the foot.
// Sizes use container units (cqw) so everything scales with the 16:9 stage on a shared screen.

const BRIDGE = '/images/hero-bridge.jpg';

function Lockup({ size = 1 }: { size?: number }) {
  return (
    <span className="flex items-center" style={{ gap: `${0.9 * size}cqw` }}>
      <Image src="/images/logo-mark.png" alt="" width={256} height={256} style={{ width: `${5.2 * size}cqw`, height: `${5.2 * size}cqw` }} />
      <span className="flex flex-col leading-none">
        <span className="font-display font-extrabold tracking-[-0.03em]" style={{ fontSize: `${3.1 * size}cqw` }}>
          <span className="text-[#12346e]">Bay</span>
          <span className="text-[#1f7fd0]">Area</span>
        </span>
        <span className="text-[#4a5a5f]" style={{ fontSize: `${1.32 * size}cqw`, letterSpacing: '0.12em', marginTop: `${0.25 * size}cqw` }}>
          Referral Partners
        </span>
      </span>
      <span className="sr-only">{site.name}</span>
    </span>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="mt-[0.35cqw] h-[2cqw] w-[2cqw] flex-none" aria-hidden="true">
      <path d="M3 2.5 17 10 3 17.5l3.2-7.5z" fill="#0e7c74" />
    </svg>
  );
}

const Bullets = ({ items, size = 2.3 }: { items: ReactNode[]; size?: number }) => (
  <ul className="m-0 flex list-none flex-col gap-[1.2cqw] p-0" style={{ fontSize: `${size}cqw` }}>
    {items.map((t, i) => (
      <li key={i} className="text-on-band-muted flex gap-[1.2cqw] leading-snug">
        <Chevron />
        <span>{t}</span>
      </li>
    ))}
  </ul>
);

const Lead = ({ children }: { children: ReactNode }) => <p className="text-on-band-muted m-0 max-w-[70cqw] text-[2.3cqw] leading-snug">{children}</p>;

type Ctx = { n: number; total: number; date: string; meetingNo: number };

/** Standard page: logo, agenda time card, title area, content, Golden Gate strip and footer. */
function Page({
  ctx,
  time,
  title,
  hideTitle,
  children,
  aside,
}: {
  ctx: Ctx;
  time: string | null;
  title: string;
  hideTitle?: boolean;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="relative flex h-full flex-col bg-white">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[12cqw]" aria-hidden="true">
        <Image src={BRIDGE} alt="" fill sizes="100vw" className="object-cover object-[50%_62%] opacity-55" />
        <span className="absolute inset-0 bg-gradient-to-b from-white via-white/70 to-white/10" />
        <span className="absolute inset-x-0 bottom-0 h-[0.8cqw] bg-gradient-to-r from-[#0e7c74] via-[#12a89d] to-[#00c2cb]" />
      </div>
      <header className="relative flex items-center justify-between px-[4.5cqw] pt-[3cqw]">
        <Lockup size={0.85} />
        <div className="rounded-[1.4cqw] bg-gradient-to-br from-[#eef0f4] to-[#f8f9fb] px-[2cqw] py-[0.9cqw] text-right shadow-[0_0.2cqw_0.8cqw_rgba(0,0,0,0.06)]">
          <p className="font-display m-0 text-[1.5cqw] font-bold text-[#0e7c74]">{time ? `${time} AM` : 'Today'}</p>
          <p className="m-0 text-[1.3cqw] text-[#3b4a4f]">{ctx.date}</p>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 gap-[3.5cqw] px-[4.5cqw] pt-[2.2cqw] pb-[7cqw]">
        <div className="flex min-w-0 flex-1 flex-col gap-[1.8cqw]">
          <h2 className={hideTitle ? 'sr-only' : 'font-display text-on-band m-0 text-[4.2cqw] leading-[1.05] font-extrabold tracking-[-0.01em]'}>{title}</h2>
          {children}
        </div>
        {aside ? <div className="flex flex-none flex-col items-center justify-center">{aside}</div> : null}
      </div>
      <footer className="absolute inset-x-[4.5cqw] bottom-[1.6cqw] flex items-center justify-between text-[1.25cqw] font-semibold text-[#0e5a55]">
        <span>
          {site.name} · Meeting #{ctx.meetingNo}
        </span>
        <span className="tabular-nums">
          {ctx.n} / {ctx.total}
        </span>
      </footer>
    </div>
  );
}

/** Full-bleed Golden Gate page for the opening and closing slides. */
function Hero({ ctx, kicker, title, children }: { ctx: Ctx; kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="relative h-full overflow-hidden bg-white">
      <Image src={BRIDGE} alt="" fill sizes="100vw" priority className="object-cover object-[60%_55%]" />
      <span className="absolute inset-0 bg-gradient-to-r from-white via-white/92 to-white/5" aria-hidden="true" />
      <span className="absolute inset-x-0 bottom-0 h-[0.9cqw] bg-gradient-to-r from-[#0e7c74] via-[#12a89d] to-[#00c2cb]" aria-hidden="true" />
      <div className="relative flex h-full max-w-[62cqw] flex-col justify-center gap-[2cqw] px-[6cqw]">
        <Lockup size={1.35} />
        <p className="font-display m-0 mt-[1.5cqw] text-[1.7cqw] font-bold tracking-[0.28em] text-[#0e7c74] uppercase">{kicker}</p>
        <h2 className="font-display text-on-band m-0 text-[5.4cqw] leading-[1.02] font-extrabold tracking-[-0.015em]">{title}</h2>
        {children}
      </div>
      <p className="absolute right-[3cqw] bottom-[2cqw] m-0 text-[1.25cqw] font-semibold text-white [text-shadow:0_0.1cqw_0.4cqw_rgba(0,0,0,0.5)]">
        {ctx.n} / {ctx.total}
      </p>
    </div>
  );
}

function Face({ name, path, size = 12, square = false }: { name: string; path: string | null; size?: number; square?: boolean }) {
  const url = mediaUrl('profile-media', path);
  return (
    <span
      className={`font-display relative flex flex-none items-center justify-center overflow-hidden bg-[#e0f4f4] font-extrabold text-[#0c7b74] ${square ? 'rounded-[1.4cqw]' : 'rounded-full'}`}
      style={{ width: `${size}cqw`, height: `${size}cqw`, fontSize: `${size * 0.36}cqw` }}
      aria-hidden="true"
    >
      {url ? <Image src={url} alt="" fill sizes="25vw" className="object-cover" /> : initials(name)}
    </span>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <p className="text-on-band-muted m-0 text-[2cqw]">{children}</p>;

function Speaker({ s, fallback }: { s: SpeakerCard | null; fallback: string }) {
  if (!s)
    return (
      <div className="flex flex-1 items-center">
        <Muted>{fallback}</Muted>
      </div>
    );
  return (
    <div className="flex flex-1 items-center gap-[3cqw]">
      <Face name={s.display_name} path={s.avatar_path} size={17} square />
      <div className="flex min-w-0 flex-col gap-[0.8cqw]">
        <p className="font-display text-on-band m-0 text-[3.4cqw] leading-tight font-extrabold">{s.display_name}</p>
        {s.business ? <p className="m-0 text-[2.1cqw] font-semibold text-[#0c7b74]">{s.business}</p> : null}
        {s.topic_description ? <p className="text-on-band-muted m-0 text-[1.8cqw] leading-snug">{s.topic_description}</p> : null}
      </div>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return (
    <p className="m-0 rounded-[1cqw] border-l-[0.6cqw] border-[#00c2cb] bg-[#effbfc] px-[1.6cqw] py-[1cqw] text-[1.9cqw] leading-snug whitespace-pre-line text-[#1c3b3a]">
      {text}
    </p>
  );
}

/** The presentation's title, large, in place of the slot description. */
const TopicTitle = ({ s }: { s: SpeakerCard | null }) => (
  <p className="font-display m-0 max-w-[68cqw] text-[3cqw] leading-tight font-bold text-[#1c3b3a]">
    {s?.topic ? `“${s.topic}”` : s ? 'Presentation title to be announced' : ''}
  </p>
);

const Chip = ({ children }: { children: ReactNode }) => (
  <li className="rounded-full border border-[#c9eef0] bg-[#effbfc] px-[1.5cqw] py-[0.5cqw] text-[1.8cqw] font-semibold text-[#0c5f5a]">{children}</li>
);

function MediaPage({ ctx, m, page }: { ctx: Ctx; m: SlideMedia; page?: number }) {
  const title = m.title || (m.kind === 'youtube' ? 'Video' : m.kind === 'pdf' ? 'Presentation' : 'Slide');
  return (
    <div className="relative flex h-full flex-col bg-white">
      <header className="flex items-center justify-between gap-[2cqw] px-[3cqw] pt-[1.8cqw] pb-[1.2cqw]">
        <Lockup size={0.6} />
        <h2 className="font-display text-on-band m-0 min-w-0 truncate text-[2.2cqw] font-extrabold">
          {title}
          {m.kind === 'pdf' && m.pageCount > 1 ? <span className="text-on-band-muted font-semibold"> · page {page} of {m.pageCount}</span> : null}
        </h2>
        <span className="text-[1.2cqw] font-semibold text-[#0e5a55] tabular-nums">
          {ctx.n} / {ctx.total}
        </span>
      </header>
      <div className="relative min-h-0 flex-1 px-[3cqw] pb-[2.4cqw]">
        {m.kind === 'youtube' && m.youtubeId ? (
          <YouTubeSlide id={m.youtubeId} start={m.start} title={title} />
        ) : !m.url ? (
          <div className="flex h-full items-center justify-center">
            <Muted>This file could not be loaded.</Muted>
          </div>
        ) : m.kind === 'pdf' ? (
          <PdfPageSlide url={m.url} page={page ?? 1} title={title} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt={title} className="h-full w-full object-contain" />
        )}
      </div>
      <span className="absolute inset-x-0 bottom-0 h-[0.6cqw] bg-gradient-to-r from-[#0e7c74] via-[#12a89d] to-[#00c2cb]" aria-hidden="true" />
    </div>
  );
}

type Spec = { id: string; label: string; render: (ctx: Ctx) => ReactNode };

export function buildSlides(d: DeckData): DeckSlide[] {
  const start = new Date(d.meeting.starts_at);
  const visitUrl = `${env.siteUrl.replace(/^https?:\/\//, '')}/visit`;
  const date = formatMeetingDate(start);
  const specs: Spec[] = [];
  const shown = new Set<string>(d.slides);

  const addMedia = (after: string) => {
    for (const m of d.media.filter((x) => x.afterSlide === after)) {
      const label = m.title || (m.kind === 'youtube' ? 'Video' : m.kind === 'pdf' ? 'Presentation' : 'Added slide');
      if (m.kind === 'pdf')
        for (let p = 1; p <= m.pageCount; p++)
          specs.push({ id: `media-${m.id}-${p}`, label: `${label}, page ${p}`, render: (ctx) => <MediaPage ctx={ctx} m={m} page={p} /> });
      else specs.push({ id: `media-${m.id}`, label, render: (ctx) => <MediaPage ctx={ctx} m={m} /> });
    }
  };

  const add = (key: SlideKey, render: (ctx: Ctx) => ReactNode, suffix = '') =>
    specs.push({ id: key + (suffix ? `-${suffix}` : ''), label: slideLabel(key) + (suffix ? ` (${suffix})` : ''), render });

  /** Standard page with the slide's agenda time and any extra text the admins added. */
  const page = (key: SlideKey, o: { title?: string; hideTitle?: boolean; body: ReactNode; aside?: ReactNode }, suffix = '') =>
    add(
      key,
      (ctx) => (
        <Page ctx={ctx} time={slideTime(key)} title={o.title ?? slideLabel(key)} hideTitle={o.hideTitle} aside={o.aside}>
          {o.body}
          {d.notes[key] ? <Note text={d.notes[key]} /> : null}
        </Page>
      ),
      suffix,
    );


  for (const key of d.slides) {
    switch (key) {
      case 'welcome':
        add(key, (ctx) => (
          <div className="relative h-full overflow-hidden bg-white">
            <Image src={BRIDGE} alt="" fill sizes="100vw" priority className="object-cover object-[60%_55%] opacity-35" />
            <span className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/70 to-white/40" aria-hidden="true" />
            <span className="absolute inset-x-0 bottom-0 h-[0.9cqw] bg-gradient-to-r from-[#0e7c74] via-[#12a89d] to-[#00c2cb]" aria-hidden="true" />
            <div className="relative flex h-full items-center justify-center">
              <h2 className="sr-only">Welcome to {site.name}</h2>
              <Lockup size={2.9} />
            </div>
            <p className="absolute right-[3cqw] bottom-[2cqw] m-0 text-[1.25cqw] font-semibold text-[#0e5a55]">
              {ctx.n} / {ctx.total}
            </p>
          </div>
        ));
        break;
      case 'agenda':
        page(key, {
          title: 'Today’s agenda',
          body: (
            <ol className="m-0 grid list-none grid-flow-col grid-rows-7 gap-x-[4cqw] gap-y-[0.7cqw] p-0">
              {d.slides
                .filter((k) => slideTime(k))
                .filter((k, i, all) => all.findIndex((x) => slideTime(x) === slideTime(k)) === i)
                .map((k) => (
                  <li key={k} className="flex items-center gap-[1.4cqw] text-[1.85cqw]">
                    <span className="h-[1.3cqw] w-[1.3cqw] flex-none rounded-full border-[0.35cqw] border-[#0e7c74]" aria-hidden="true" />
                    <span className="font-display w-[5cqw] flex-none font-extrabold text-[#0e7c74] tabular-nums">{slideTime(k)}</span>
                    <span className="text-[#1c3b3a]">{slideLabel(k)}</span>
                  </li>
                ))}
            </ol>
          ),
        });
        break;
      case 'networking':
        page(key, {
          title: 'Welcome',
          body: (
            <>
              <Bullets items={['Say hello to someone you haven’t met yet.', 'Camera on, name and business in your Zoom name.', 'We call the meeting to order at 8:30 AM sharp.']} />
            </>
          ),
        });
        break;
      case 'call_to_order':
        page(key, {
          title: 'Let’s begin.',
          body: (
            <>
              <Bullets
                items={[
                  'Please turn off or silence all cellphones and other devices.',
                  'Members should be seated, on Zoom or in person, when the meeting is called to order.',
                  'Arrived after 8:30 AM? Please skip your infomercial today. Leaving before 9:30 AM means no infomercial at the next meeting.',
                ]}
                size={2.1}
              />
            </>
          ),
        });
        break;
      case 'leadership': {
        // Everyone on the Management list once, all cards the same: photo, then name and role below.
        const people = d.leadership;
        const cols = people.length > 10 ? 6 : 5;
        const photo = people.length > 12 ? 6.5 : people.length > 10 ? 7.5 : 8.6;
        page(key, {
          title: 'Meet the Management Team',
          body: (
            <ul className="m-0 grid list-none content-start gap-x-[1.6cqw] gap-y-[1.4cqw] p-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {people.map((l) => (
                <li key={l.id} className="flex flex-col items-center gap-[0.5cqw] text-center">
                  <Face name={l.name} path={l.photo} size={photo} square />
                  <span className="font-display text-[1.6cqw] leading-tight font-extrabold text-[#0e7c74]">{l.name}</span>
                  <span className="text-[1.3cqw] leading-tight font-semibold text-[#1c3b3a]">{l.role}</span>
                </li>
              ))}
            </ul>
          ),
        });
        break;
      }
      case 'guests':
        page(key, { title: 'Introduction of Guests', body: null });
        break;
      case 'infomercials':
        page(key, {
          title: '60-second infomercials',
          hideTitle: true,
          aside: <SlideTimer seconds={60} label="60-second infomercial" />,
          body: (
            <>
              <Lead>{procedures.definitions.find((x) => x.term === 'Infomercial')?.text}</Lead>
              <div className="columns-2 gap-[3cqw] [&_li]:break-inside-avoid">
                <Bullets items={['Referrals', 'One-to-ones', 'Closed business', 'Thank-yous', 'Testimonials', 'Leads', 'Announcements']} size={2.5} />
              </div>
            </>
          ),
        });
        break;
      case 'asks': {
        const pages = chunk(d.asks, 6);
        if (!pages.length)
          page(key, { body: <Lead>Add your ask on your dashboard and it will appear here.</Lead> });
        pages.forEach((p, i) =>
          page(
            key,
            {
              body: (
                <ul className="m-0 grid list-none grid-cols-2 content-start gap-[1.4cqw] p-0">
                  {p.map((a) => (
                    <li key={`${a.first_name}${a.last_name}`} className="flex flex-col gap-[0.3cqw] rounded-[1.2cqw] border border-[#c9eef0] bg-[#f7fdfd] px-[1.6cqw] py-[1.2cqw]">
                      <span className="text-[1.5cqw] font-bold text-[#0c7b74]">
                        {a.first_name} {a.last_name} · {a.business_name}
                      </span>
                      <span className="text-[2cqw] leading-snug text-[#1c3b3a]">{a.weekly_ask}</span>
                    </li>
                  ))}
                </ul>
              ),
            },
            pages.length > 1 ? `${i + 1} of ${pages.length}` : '',
          ),
        );
        break;
      }
      case 'statistics': {
        const cycle = d.totals[0]?.t;
        page(key, {
          title: 'Our numbers',
          body: (
            <>
              {cycle ? (
                <ul className="m-0 grid list-none grid-cols-4 gap-[1.4cqw] p-0">
                  {[
                    ['One-to-ones', String(cycle.one_on_ones)],
                    ['Referrals', String(cycle.referrals)],
                    ['Closed deals', String(cycle.closed_deals)],
                    ['Closed business', formatMoney(cycle.closed_amount)],
                  ].map(([l, v]) => (
                    <li key={l} className="flex flex-col gap-[0.4cqw] rounded-[1.4cqw] bg-gradient-to-br from-[#0e7c74] to-[#12a89d] px-[1.6cqw] py-[1.4cqw] text-white">
                      <span className="font-display text-[4.2cqw] leading-none font-extrabold tabular-nums">{v}</span>
                      <span className="text-[1.6cqw] font-semibold">{l}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-on-band-muted m-0 text-[1.6cqw]">Since the last meeting. Month and year so far:</p>
              <table className="w-full max-w-[80cqw] border-separate border-spacing-x-[1cqw] text-left">
                <thead>
                  <tr>
                    <th scope="col" className="text-[1.5cqw]">
                      <span className="sr-only">Period</span>
                    </th>
                    {['One-to-ones', 'Referrals', 'Closed deals', 'Closed business'].map((h) => (
                      <th key={h} scope="col" className="text-[1.4cqw] font-bold tracking-[0.08em] text-[#0e7c74] uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.totals.slice(1).map(({ label, t }) => (
                    <tr key={label}>
                      <th scope="row" className="text-[1.8cqw] font-semibold text-[#355856]">
                        {label}
                      </th>
                      {[t.one_on_ones, t.referrals, t.closed_deals, formatMoney(t.closed_amount)].map((v, n) => (
                        <td key={n} className="font-display text-[2.6cqw] font-extrabold text-[#1c3b3a] tabular-nums">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ),
        });
        break;
      }
      case 'leaderboards':
        page(key, {
          title: 'Leaderboards',
          body: (
            <div className="grid grid-cols-4 gap-[1.6cqw]">
              {leaderboardMetrics.map((m) => {
                const rows = d.leaders.filter((r) => r.metric === m.key);
                return (
                  <div key={m.key} className="flex flex-col gap-[0.7cqw]">
                    <h3 className="m-0 text-[1.45cqw] font-bold tracking-[0.08em] text-[#0e7c74] uppercase">{m.label}</h3>
                    {rows.length ? (
                      <ol className="m-0 flex list-none flex-col gap-[0.5cqw] p-0">
                        {rows.map((r) => (
                          <li key={r.profile_id} className="flex items-center gap-[0.8cqw] rounded-[0.8cqw] bg-[#f2fbfb] px-[1cqw] py-[0.55cqw] text-[1.7cqw]">
                            <span className="w-[2cqw] font-extrabold text-[#0e7c74]">{r.rank}</span>
                            <span className="min-w-0 flex-1 truncate text-[#1c3b3a]">
                              {r.first_name} {r.last_name.slice(0, 1)}.
                            </span>
                            <strong className="text-[#1c3b3a] tabular-nums">{r.value}</strong>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <Muted>Nothing yet.</Muted>
                    )}
                  </div>
                );
              })}
            </div>
          ),
        });
        break;
      case 'five_minute':
        page(key, {
          title: '5-Minute Educational Presentation',
          aside: <SlideTimer seconds={300} label="5-minute presentation" />,
          body: (
            <>
              <TopicTitle s={d.five} />
              <Speaker s={d.five} fallback="This slot is open today." />
            </>
          ),
        });
        break;
      case 'five_qa':
        page(key, {
          title: d.five ? `Questions for ${d.five.display_name.split(' ')[0]}` : 'Questions',
          aside: <SlideTimer seconds={60} label="1 minute of questions" />,
          body: <Lead>One minute of questions for the 5-minute presentation. Keep them short so everyone gets a turn.</Lead>,
        });
        break;
      case 'ten_minute':
        page(key, {
          title: '10-Minute Presentation',
          aside: <SlideTimer seconds={600} label="10-minute presentation" />,
          body: (
            <>
              <TopicTitle s={d.ten} />
              <Speaker s={d.ten} fallback="This slot is open today." />
            </>
          ),
        });
        break;
      case 'ten_qa':
        page(key, {
          title: d.ten ? `Questions for ${d.ten.display_name.split(' ')[0]}` : 'Questions',
          aside: <SlideTimer seconds={300} label="5 minutes of questions" />,
          body: (
            <>
              <Lead>Five minutes of questions for the 10-minute presentation.</Lead>
              <Bullets items={['Who is a perfect referral for them?', 'What should we listen for this week?', 'How do we introduce them?']} />
            </>
          ),
        });
        break;
      case 'announcements':
        page(key, {
          title: 'Upcoming events & announcements',
          body: d.events.length ? (
            <ul className="m-0 grid list-none grid-cols-2 content-start gap-[1.3cqw] p-0">
              {d.events.map((e) => (
                <li key={e.id} className="flex gap-[1.3cqw] rounded-[1.2cqw] border border-[#c9eef0] bg-[#f7fdfd] p-[1.3cqw]">
                  <span className="flex w-[6.4cqw] flex-none flex-col items-center justify-center rounded-[0.9cqw] bg-[#0e7c74] py-[0.6cqw] text-white">
                    <span className="text-[1.2cqw] font-bold uppercase">{new Date(e.starts_at).toLocaleString('en-US', { month: 'short', timeZone: site.timezone })}</span>
                    <span className="font-display text-[2.8cqw] leading-none font-extrabold">
                      {new Date(e.starts_at).toLocaleString('en-US', { day: 'numeric', timeZone: site.timezone })}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-[0.2cqw]">
                    <span className="text-[2cqw] leading-tight font-bold text-[#1c3b3a]">{e.title}</span>
                    <span className="text-[1.5cqw] text-[#355856]">
                      {formatMeetingTime(new Date(e.starts_at))} · {e.is_online ? 'Online' : e.location}
                      {e.kind === 'member' && e.hostName ? ` · Hosted by ${e.hostName}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Lead>No events posted yet. Members can post events on the Events page.</Lead>
          ),
        });
        break;
      case 'visitors_thanks':
        page(key, {
          title: 'Thank you for visiting. We will contact you.',
          body: (
            <>
              <Bullets
                items={[
                  'Next step: one-to-ones with three members of our leadership team.',
                  'The leadership team then reviews your application. Only one person per business category.',
                  <>
                    Apply or learn more at <strong className="text-[#0e7c74]">{visitUrl}</strong>
                  </>,
                ]}
                size={2.1}
              />
              <p className="m-0 text-[1.5cqw] font-bold tracking-[0.12em] text-[#0e7c74] uppercase">Open professions</p>
              {d.openCategories.length ? (
                <ul className="m-0 flex max-w-[80cqw] list-none flex-wrap gap-[0.8cqw] p-0">
                  {d.openCategories.slice(0, 16).map((c) => (
                    <Chip key={c}>{c}</Chip>
                  ))}
                </ul>
              ) : (
                <Muted>Ask us which professions are open.</Muted>
              )}
            </>
          ),
        });
        break;
      case 'adjourn':
        add(key, (ctx) => (
          <Hero ctx={ctx} kicker="9:30 AM · Adjourn" title="Thank you for joining us">
            {d.next ? (
              <div className="flex flex-col gap-[0.8cqw] text-[2cqw] text-[#1c3b3a]">
                <p className="m-0 text-[2.3cqw]">
                  Next meeting: <strong className="text-[#0e7c74]">{formatMeetingDate(new Date(d.next.starts_at))}</strong> ·{' '}
                  {formatMeetingTime(new Date(d.next.starts_at))} PT
                </p>
                <p className="m-0">
                  <strong className="text-[#0e7c74]">5-minute:</strong>{' '}
                  {d.next.five ? `${d.next.five.display_name}${d.next.five.topic ? ` · “${d.next.five.topic}”` : ''}` : 'open, claim it on the Meetings page'}
                </p>
                <p className="m-0">
                  <strong className="text-[#0e7c74]">10-minute:</strong>{' '}
                  {d.next.ten ? `${d.next.ten.display_name}${d.next.ten.topic ? ` · “${d.next.ten.topic}”` : ''}` : 'open, claim it on the Meetings page'}
                </p>
              </div>
            ) : (
              <p className="m-0 text-[2.2cqw] text-[#1c3b3a]">The next meeting date will be posted soon.</p>
            )}
            {d.notes.adjourn ? <Note text={d.notes.adjourn} /> : null}
          </Hero>
        ));
        break;
    }
    addMedia(key);
  }
  // Added slides placed after a slide that is hidden for this meeting go at the end, so none are lost.
  for (const anchor of new Set(d.media.map((m) => m.afterSlide))) if (!shown.has(anchor)) addMedia(anchor);

  const meetingNo = d.number;
  return specs.map((s, i) => ({ id: s.id, label: s.label, node: s.render({ n: i + 1, total: specs.length, date, meetingNo }) }));
}
