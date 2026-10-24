import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import { initials } from '@/components/ui';
import { leaderboardMetrics, site } from '@/lib/content';
import type { DeckData, SlideMedia, SpeakerCard } from '@/lib/data/slides';
import { formatMeetingDate, formatMeetingTime, formatMoney } from '@/lib/dates';
import { env, mediaUrl } from '@/lib/env';
import { groupLeadership } from '@/lib/leadership';
import { chunk, slideLabel, slideTime, type SlideKey } from '@/lib/slides';
import type { DeckSlide } from './Deck';
import { Icon, SilencePhone, type IconName } from './icons';
import { Fireworks, PdfPageSlide, SlideTimer, WebsiteSlide, YouTubeSlide } from './SlideWidgets';

// Meeting slides. Design (owner's references, 2026-10-22): clean white pages in the logo's blues, a cyan-to-blue
// gradient band, soft raised cards, round icon badges, big numbers and a numbered flow for the path to membership.
// The logo sits top left and the Golden Gate photo along the foot. Sizes use container units (cqw) so everything
// scales with the 16:9 stage on a shared screen.

const BRIDGE = '/images/hero-bridge.jpg';
/** The Welcome slide's photo: the group's flag on the Golden Gate tower (owner, 2026-10-24). */
/** Slide 2 (Welcome): the Golden Gate photo slide 1 used before 2026-10-24. */
const WELCOME_PHOTO = '/images/hero-bridge.jpg';
/** Slide 1 (logo): owner's photo of the flag on the Golden Gate tower (2026-10-24). */
const LOGO_PHOTO = '/images/logo-slide-flag.jpg';
/** Owner's BARP Champion artwork (2026-10-24): logo, crown, title and confetti. "Coming soon" version for when nobody is named yet. */
const CHAMPION_BG = '/images/champion-bg.webp';
const CHAMPION_SOON = '/images/champion-coming-soon.webp';
const NAVY = '#12346e';
const BLUE = '#1f7fd0';
const INK = '#1c2b4a';
const MUTED = '#4a5a72';
const GRADIENT = 'linear-gradient(90deg, #5ce1e6 0%, #1f7fd0 58%, #0a47a9 100%)';
/** Five steps, cyan to navy (used for the Visitors flow and the leaderboard headers). */
const STEP_COLORS = ['#14b8c4', '#1599d6', '#1f7fd0', '#1b5fc0', '#12346e'] as const;

const Band = ({ className = '', style }: { className?: string; style?: CSSProperties }) => (
  <span className={`absolute inset-x-0 bottom-0 h-[0.9cqw] ${className}`} style={{ background: GRADIENT, ...style }} aria-hidden="true" />
);

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

/** Round blue badge with a white line icon (the references' icon style). */
function Badge({ name, size = 4.2, color = BLUE, light = false }: { name: IconName; size?: number; color?: string; light?: boolean }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full"
      style={{ width: `${size}cqw`, height: `${size}cqw`, background: light ? '#fff' : color, color: light ? color : '#fff' }}
      aria-hidden="true"
    >
      <Icon name={name} style={{ width: `${size * 0.5}cqw`, height: `${size * 0.5}cqw` }} />
    </span>
  );
}

/** Soft raised card. `tint` gives the pale blue card with a thin border. */
const card = (tint = false) =>
  `rounded-[1.4cqw] ${tint ? 'border border-[#d6e4f5] bg-[#f2f7fd]' : 'bg-white shadow-[0_0.5cqw_1.8cqw_rgba(18,52,110,0.13)] ring-1 ring-[#e6eef8]'}`;

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="mt-[0.35cqw] h-[2cqw] w-[2cqw] flex-none" aria-hidden="true">
      <path d="M3 2.5 17 10 3 17.5l3.2-7.5z" fill={BLUE} />
    </svg>
  );
}

const Bullets = ({ items, size = 2.3 }: { items: ReactNode[]; size?: number }) => (
  <ul className="m-0 flex list-none flex-col gap-[1.2cqw] p-0" style={{ fontSize: `${size}cqw`, color: MUTED }}>
    {items.map((t, i) => (
      <li key={i} className="flex gap-[1.2cqw] leading-snug">
        <Chevron />
        <span>{t}</span>
      </li>
    ))}
  </ul>
);

/** Bullets with a round icon badge in front of each line. */
const IconRows = ({ items, size = 2.2, boxed = false }: { items: [IconName, ReactNode][]; size?: number; boxed?: boolean }) => (
  <ul className={`m-0 flex list-none flex-col p-0 ${boxed ? 'gap-[1.2cqw]' : 'gap-[1.5cqw]'}`}>
    {items.map(([icon, t], i) => (
      <li
        key={i}
        className={`flex items-center gap-[1.5cqw] leading-snug ${boxed ? `${card()} max-w-[60cqw] px-[1.6cqw] py-[1.2cqw]` : ''}`}
        style={{ fontSize: `${size}cqw`, color: INK }}
      >
        <Badge name={icon} size={size * 1.9} />
        <span>{t}</span>
      </li>
    ))}
  </ul>
);

const Lead = ({ children }: { children: ReactNode }) => (
  <p className="m-0 max-w-[72cqw] text-[2.1cqw] leading-snug" style={{ color: MUTED }}>
    {children}
  </p>
);

type Ctx = { n: number; total: number; date: string; meetingNo: number };

/** Standard page: logo, title with a short gradient rule, content, Golden Gate strip and gradient band. */
function Page({
  ctx,
  title,
  center,
  photo,
  children,
  aside,
}: {
  ctx: Ctx;
  title: string;
  center?: boolean;
  /** Show the Welcome photo (flag on the Golden Gate tower) across the right side, fading to white beneath the text. */
  photo?: boolean;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white">
      {photo ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <Image src={WELCOME_PHOTO} alt="" fill sizes="100vw" className="object-cover object-[78%_50%]" />
          <span
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to right, #fff 0%, #fff 34%, rgba(255,255,255,0.88) 44%, rgba(255,255,255,0.5) 52%, rgba(255,255,255,0.12) 60%, rgba(255,255,255,0) 66%)',
            }}
          />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {/* Dotted corner, as in the reference decks. */}
          <span
            className="absolute top-[1.6cqw] right-[2cqw] h-[9cqw] w-[16cqw] opacity-60"
            style={{ backgroundImage: 'radial-gradient(#c5d8ef 0.18cqw, transparent 0.2cqw)', backgroundSize: '1.4cqw 1.4cqw' }}
          />
          <span className="absolute inset-x-0 bottom-0 h-[11cqw]">
            <Image src={BRIDGE} alt="" fill sizes="100vw" className="object-cover object-[50%_62%] opacity-45" />
            <span className="absolute inset-0 bg-gradient-to-b from-white via-white/75 to-white/10" />
          </span>
        </div>
      )}
      <Band />
      <header className="relative flex items-center justify-between px-[4.5cqw] pt-[3cqw]">
        <Lockup size={1.1} />
      </header>
      <div className="relative flex min-h-0 flex-1 gap-[3.5cqw] px-[4.5cqw] pt-[2cqw] pb-[6.5cqw]">
        {/* Title and text sit in the vertical middle of the slide (owner, 2026-10-21). */}
        <div className={`flex min-w-0 flex-1 flex-col justify-center gap-[1.8cqw] ${center ? 'items-center text-center' : ''}`}>
          <div className={`flex flex-col gap-[1cqw] ${center ? 'items-center' : ''}`}>
            <h2 className="font-display m-0 text-[4.2cqw] leading-[1.05] font-extrabold tracking-[-0.01em]" style={{ color: NAVY }}>
              {title}
            </h2>
            <span className="h-[0.5cqw] w-[9cqw] rounded-full" style={{ background: GRADIENT }} aria-hidden="true" />
          </div>
          {children}
        </div>
        {aside ? <div className="flex flex-none flex-col items-center justify-center">{aside}</div> : null}
      </div>
      <footer className="absolute inset-x-[4.5cqw] bottom-[1.8cqw] flex items-center justify-between text-[1.25cqw] font-semibold" style={{ color: NAVY }}>
        <span>
          {site.name} · Meeting #{ctx.meetingNo}
        </span>
        <span className={`tabular-nums ${photo ? 'text-white [text-shadow:0_0.1cqw_0.4cqw_rgba(0,0,0,0.6)]' : ''}`}>
          {ctx.n} / {ctx.total}
        </span>
      </footer>
    </div>
  );
}

/** BARP Champion slide on the owner's artwork, which already carries the logo, crown and title (owner, 2026-10-24). */
function ChampionPage({ ctx, soon, children }: { ctx: Ctx; soon?: boolean; children?: ReactNode }) {
  return (
    <div className="relative h-full overflow-hidden bg-white">
      <Image
        src={soon ? CHAMPION_SOON : CHAMPION_BG}
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
        data-testid="champion-background"
        aria-hidden="true"
      />
      <h2 className="sr-only">BARP Champion</h2>
      {soon ? <p className="sr-only">Coming soon</p> : null}
      <div className="absolute inset-x-[8cqw] top-[16.5cqw] bottom-[9cqw] flex flex-col items-center justify-center text-center">{children}</div>
      <p className="absolute right-[3cqw] bottom-[1.8cqw] m-0 text-[1.25cqw] font-semibold tabular-nums" style={{ color: NAVY }}>
        {ctx.n} / {ctx.total}
      </p>
    </div>
  );
}

/** Full-bleed Golden Gate page for the closing slide. */
function Hero({ ctx, kicker, title, children }: { ctx: Ctx; kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="relative h-full overflow-hidden bg-white">
      <Image src={BRIDGE} alt="" fill sizes="100vw" priority className="object-cover object-[60%_55%]" />
      <span className="absolute inset-0 bg-gradient-to-r from-white via-white/92 to-white/5" aria-hidden="true" />
      <Band />
      <div className="relative flex h-full max-w-[62cqw] flex-col justify-center gap-[2cqw] px-[6cqw]">
        <Lockup size={1.35} />
        <p className="font-display m-0 mt-[1.5cqw] text-[1.7cqw] font-bold tracking-[0.28em] uppercase" style={{ color: BLUE }}>
          {kicker}
        </p>
        <h2 className="font-display m-0 text-[5.4cqw] leading-[1.02] font-extrabold tracking-[-0.015em]" style={{ color: NAVY }}>
          {title}
        </h2>
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
      className={`font-display relative flex flex-none items-center justify-center overflow-hidden bg-[#e3eefb] font-extrabold text-[#1f5fb0] ${square ? 'rounded-[1.2cqw]' : 'rounded-full'}`}
      style={{ width: `${size}cqw`, height: `${size}cqw`, fontSize: `${size * 0.36}cqw` }}
      aria-hidden="true"
    >
      {url ? <Image src={url} alt="" fill sizes="25vw" className="object-cover" /> : initials(name)}
    </span>
  );
}

const Muted = ({ children }: { children: ReactNode }) => (
  <p className="m-0 text-[2cqw]" style={{ color: MUTED }}>
    {children}
  </p>
);

function Speaker({ s, fallback }: { s: SpeakerCard | null; fallback: string }) {
  if (!s)
    return (
      <div className="flex items-center">
        <Muted>{fallback}</Muted>
      </div>
    );
  return (
    <div className="flex items-center gap-[2.4cqw]">
      <span className="rounded-[1.4cqw] shadow-[0_0.5cqw_1.6cqw_rgba(18,52,110,0.22)]">
        <Face name={s.display_name} path={s.avatar_path} size={13} square />
      </span>
      <div className="flex min-w-0 flex-col gap-[0.6cqw]">
        <p className="font-display m-0 text-[3.2cqw] leading-tight font-extrabold" style={{ color: NAVY }}>
          {s.display_name}
        </p>
        {s.business ? (
          <p className="m-0 text-[2cqw] font-semibold italic" style={{ color: BLUE }}>
            {s.business}
          </p>
        ) : null}
        {s.topic_description ? (
          <p className="m-0 max-w-[50cqw] text-[1.7cqw] leading-snug" style={{ color: MUTED }}>
            {s.topic_description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return (
    <p
      className="m-0 rounded-[1cqw] border-l-[0.6cqw] border-[#1f7fd0] bg-[#f2f7fd] px-[1.6cqw] py-[1cqw] text-[1.9cqw] leading-snug whitespace-pre-line"
      style={{ color: INK }}
    >
      {text}
    </p>
  );
}

/** The presentation's title on a gradient banner that runs in from the left edge (as in the AI presentation sample). */
const TopicBanner = ({ s }: { s: SpeakerCard | null }) =>
  s ? (
    <div
      className="-ml-[4.5cqw] flex min-h-[8cqw] max-w-[74cqw] items-center rounded-r-[1.6cqw] py-[1.6cqw] pr-[3cqw] pl-[4.5cqw] shadow-[0_0.6cqw_1.8cqw_rgba(10,71,169,0.25)]"
      style={{ background: GRADIENT }}
    >
      <p className="font-display m-0 text-[2.9cqw] leading-tight font-extrabold text-white [text-shadow:0_0.1cqw_0.3cqw_rgba(0,0,0,0.25)]">
        {s.topic ? `“${s.topic}”` : 'Presentation title to be announced'}
      </p>
    </div>
  ) : null;

const Chip = ({ children }: { children: ReactNode }) => (
  <li className="rounded-full border border-[#d6e4f5] bg-[#f2f7fd] px-[1.5cqw] py-[0.5cqw] text-[1.8cqw] font-semibold text-[#1b4f99]">{children}</li>
);

function MediaPage({ ctx, m, page, timers }: { ctx: Ctx; m: SlideMedia; page?: number; timers: DeckData['timers'] }) {
  const title = m.title || (m.kind === 'youtube' ? 'Video' : m.kind === 'pdf' ? 'Presentation' : m.kind === 'link' ? 'Website' : 'Slide');
  // A presenter's own slides keep that presentation's timer on top (same countdown as the presentation slide).
  const timer =
    m.afterSlide === 'five_minute' && timers.five_materials ? (
      <SlideTimer id="five_minute" seconds={300} label="5-minute presentation" compact />
    ) : m.afterSlide === 'ten_minute' && timers.ten_materials ? (
      <SlideTimer id="ten_minute" seconds={600} label="10-minute presentation" compact />
    ) : null;
  return (
    <div className="relative flex h-full flex-col bg-white">
      <header className="flex items-center justify-between gap-[2cqw] px-[3cqw] pt-[1.8cqw] pb-[1.2cqw]">
        <Lockup size={0.6} />
        <h2 className="font-display m-0 min-w-0 truncate text-[2.2cqw] font-extrabold" style={{ color: NAVY }}>
          {title}
          {m.kind === 'pdf' && m.pageCount > 1 ? (
            <span className="font-semibold" style={{ color: MUTED }}>
              {' '}
              · page {page} of {m.pageCount}
            </span>
          ) : null}
        </h2>
        <span className="flex flex-none items-center gap-[1.4cqw]">
          {timer}
          <span className="text-[1.2cqw] font-semibold tabular-nums" style={{ color: NAVY }}>
            {ctx.n} / {ctx.total}
          </span>
        </span>
      </header>
      <div className="relative min-h-0 flex-1 px-[3cqw] pb-[2.4cqw]">
        {m.kind === 'link' && m.url ? (
          <WebsiteSlide url={m.url} title={title} />
        ) : m.kind === 'youtube' && m.youtubeId ? (
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
      <Band className="h-[0.6cqw]" />
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
      const label = m.title || (m.kind === 'youtube' ? 'Video' : m.kind === 'pdf' ? 'Presentation' : m.kind === 'link' ? 'Website' : 'Added slide');
      if (m.kind === 'pdf')
        for (let p = 1; p <= m.pageCount; p++)
          specs.push({ id: `media-${m.id}-${p}`, label: `${label}, page ${p}`, render: (ctx) => <MediaPage ctx={ctx} m={m} page={p} timers={d.timers} /> });
      else specs.push({ id: `media-${m.id}`, label, render: (ctx) => <MediaPage ctx={ctx} m={m} timers={d.timers} /> });
    }
  };

  const add = (key: SlideKey, render: (ctx: Ctx) => ReactNode, suffix = '') =>
    specs.push({ id: key + (suffix ? `-${suffix}` : ''), label: slideLabel(key) + (suffix ? ` (${suffix})` : ''), render });

  /** Standard page with the slide's agenda time and any extra text the admins added. */
  const page = (key: SlideKey, o: { title?: string; center?: boolean; photo?: boolean; body: ReactNode; aside?: ReactNode }, suffix = '') =>
    add(
      key,
      (ctx) => (
        <Page ctx={ctx} title={o.title ?? slideLabel(key)} center={o.center} photo={o.photo} aside={o.aside}>
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
            {/* Owner's photo of the flag on the Golden Gate tower, full strength (2026-10-24). The logo sits over the sky on the
                left so the flag stays in view; a soft white glow around the letters makes it stand out. */}
            <Image src={LOGO_PHOTO} alt="" fill sizes="100vw" priority className="object-cover object-center" />
            <Band />
            <div className="relative flex h-full items-center justify-start pb-[12cqw] pl-[5cqw]">
              <h2 className="sr-only">Welcome to {site.name}</h2>
              <span
                className="absolute top-[38%] left-[29%] h-[34cqw] w-[66cqw] -translate-x-1/2 -translate-y-1/2"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.78) 30%, rgba(255,255,255,0.4) 52%, rgba(255,255,255,0) 72%)',
                }}
                aria-hidden="true"
              />
              <div
                className="relative"
                style={{ filter: 'drop-shadow(0 0 0.6cqw #fff) drop-shadow(0 0 1.4cqw rgba(255,255,255,0.9)) drop-shadow(0 0 3cqw rgba(255,255,255,0.7))' }}
              >
                <Lockup size={2.4} />
              </div>
            </div>
            <p className="absolute right-[3cqw] bottom-[2cqw] m-0 text-[1.25cqw] font-semibold text-white [text-shadow:0_0.1cqw_0.4cqw_rgba(0,0,0,0.6)]">
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
                    <span className="h-[1.3cqw] w-[1.3cqw] flex-none rounded-full border-[0.35cqw] border-[#1f7fd0]" aria-hidden="true" />
                    <span className="font-display w-[5cqw] flex-none font-extrabold text-[#1f7fd0] tabular-nums">{slideTime(k)}</span>
                    <span className="text-[#1c2b4a]">{slideLabel(k)}</span>
                  </li>
                ))}
            </ol>
          ),
        });
        break;
      case 'networking':
        page(key, {
          title: 'Welcome',
          photo: true,
          body: (
            <IconRows
              boxed
              items={[
                ['video', 'Please can you put your camera on, and add your name and business to your Zoom Window.'],
                ['clock', 'Meeting called to order at 8:30am sharp'],
              ]}
            />
          ),
        });
        break;
      case 'call_to_order':
        page(key, {
          title: 'Let’s begin.',
          center: true,
          body: <SilencePhone className="h-[17cqw] w-[17cqw]" />,
        });
        break;
      case 'visitor_path': {
        // Numbered flow in the style of the owner's sample diagrams: white icon circle on a coloured pennant,
        // a dashed timeline with matching dots, and the step below (owner, 2026-10-22).
        const steps: [IconName, string][] = [
          ['userPlus', 'Attend as a guest'],
          ['clipboard', 'Receive all application forms'],
          ['chat', 'Have a one-on-one with the Membership Committee'],
          ['badgeCheck', 'Application approved'],
          ['trendingUp', 'We help you grow your business by referral'],
        ];
        page(key, {
          title: 'Visitors',
          body: (
            <ol className="m-0 mt-[2.6cqw] grid list-none grid-cols-5 p-0" aria-label="How to become a member">
              {steps.map(([icon, t], i) => {
                const color = STEP_COLORS[i] ?? BLUE;
                return (
                  <li key={t} className="flex flex-col items-center text-center">
                    <div className="relative w-full px-[0.9cqw]">
                      <span
                        className="absolute top-[-3.6cqw] left-1/2 z-10 flex h-[7.2cqw] w-[7.2cqw] -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-[0_0.5cqw_1.4cqw_rgba(18,52,110,0.22)]"
                        aria-hidden="true"
                      >
                        <Icon name={icon} style={{ width: '3.4cqw', height: '3.4cqw', color }} />
                      </span>
                      <div
                        className="flex h-[12.5cqw] items-end justify-center pb-[2.6cqw]"
                        style={{ background: color, clipPath: 'polygon(0 0, 100% 0, 100% 74%, 50% 100%, 0 74%)' }}
                      >
                        <span className="font-display text-[4cqw] leading-none font-extrabold text-white/95 tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                    <div className="my-[1.4cqw] flex w-full items-center" aria-hidden="true">
                      <span className={`h-0 flex-1 border-t-[0.25cqw] border-dashed border-[#b8c6d8] ${i === 0 ? 'invisible' : ''}`} />
                      <span
                        className="h-[2cqw] w-[2cqw] rounded-full ring-[0.4cqw] ring-white"
                        style={{ background: color, boxShadow: `0 0 0 0.55cqw ${color}33` }}
                      />
                      <span className={`h-0 flex-1 border-t-[0.25cqw] border-dashed border-[#b8c6d8] ${i === steps.length - 1 ? 'invisible' : ''}`} />
                    </div>
                    <span className="font-display px-[0.6cqw] text-[1.75cqw] leading-snug font-bold" style={{ color: INK }}>
                      {t}
                    </span>
                  </li>
                );
              })}
            </ol>
          ),
        });
        break;
      }
      case 'leadership': {
        // Grouped like the group's printed Management Team slide (owner, 2026-10-22):
        // column 1 the first two leaders (and the Attendance Managers), column 2 the other roles,
        // column 3 the Membership Committee. Each person: photo, role in bold, name, business in italics.
        const team = groupLeadership(d.leadership);
        type P = (typeof d.leadership)[number];
        const Person = ({ p, role }: { p: P; role?: string }) => (
          <li className="flex items-center gap-[1.2cqw]">
            <span className="rounded-[1.2cqw] shadow-[0_0.3cqw_0.9cqw_rgba(18,52,110,0.2)]">
              <Face name={p.name} path={p.photo} size={4.9} square />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              {role ? (
                <span className="font-display text-[1.45cqw] font-extrabold" style={{ color: BLUE }}>
                  {role}
                </span>
              ) : null}
              <span className="text-[1.55cqw] font-semibold" style={{ color: INK }}>
                {p.name}
              </span>
              {p.business ? (
                <span className="text-[1.25cqw] italic" style={{ color: MUTED }}>
                  {p.business}
                </span>
              ) : null}
            </span>
          </li>
        );
        const Group = ({ heading, children }: { heading?: string; children: ReactNode }) => (
          <div className="flex min-w-0 flex-col gap-[0.9cqw]">
            {heading ? (
              <h3 className="font-display m-0 text-[1.6cqw] font-extrabold" style={{ color: NAVY }}>
                {heading}
              </h3>
            ) : null}
            <ul className="m-0 flex list-none flex-col gap-[0.9cqw] p-0">{children}</ul>
          </div>
        );
        const Panel = ({ color, children }: { color: string; children: ReactNode }) => (
          <div
            className={`${card()} flex flex-col gap-[1.4cqw] overflow-hidden px-[1.6cqw] pt-[1.8cqw] pb-[1.6cqw]`}
            style={{ borderTop: `0.5cqw solid ${color}` }}
          >
            {children}
          </div>
        );
        const top = team.leaders.slice(0, 2);
        const others = team.leaders.slice(2);
        page(key, {
          title: 'Meet the Management Team',
          body: (
            <div className="grid grid-cols-3 items-start gap-x-[2cqw]">
              <Panel color={STEP_COLORS[0]}>
                <Group>
                  {top.map((p) => (
                    <Person key={p.id} p={p} role={p.title} />
                  ))}
                </Group>
                {team.attendance.length ? (
                  <Group heading="Attendance Managers">
                    {team.attendance.map((p) => (
                      <Person key={p.id} p={p} />
                    ))}
                  </Group>
                ) : null}
              </Panel>
              <Panel color={STEP_COLORS[2]}>
                <Group>
                  {others.map((p) => (
                    <Person key={p.id} p={p} role={p.title} />
                  ))}
                </Group>
              </Panel>
              {team.committee.length ? (
                <Panel color={STEP_COLORS[4]}>
                  <Group heading="Membership Committee">
                    {team.committee.map((p) => (
                      <Person key={p.id} p={p} />
                    ))}
                  </Group>
                </Panel>
              ) : (
                <span />
              )}
            </div>
          ),
        });
        break;
      }
      case 'guests':
        page(key, { title: 'Introduction of Visitors', center: true, body: null });
        break;
      case 'infomercials': {
        const items: [IconName, string][] = [
          ['megaphone', 'Infomercial'],
          ['share', 'Referrals'],
          ['chat', 'One-to-ones'],
          ['dollar', 'Closed business'],
          ['heart', 'Thank-yous'],
          ['star', 'Testimonials'],
          ['bulb', 'Leads'],
        ];
        page(key, {
          title: '60-second infomercial and reporting',
          aside: d.timers.infomercials ? <SlideTimer seconds={60} label="60-second infomercial" /> : undefined,
          body: (
            <>
              <ul className="m-0 grid list-none grid-cols-4 gap-[1.2cqw] p-0">
                {items.map(([icon, t]) => (
                  <li key={t} className={`${card(true)} flex items-center gap-[1cqw] px-[1.2cqw] py-[1.1cqw]`}>
                    <Badge name={icon} size={3.8} />
                    <span className="font-display text-[1.8cqw] leading-tight font-bold" style={{ color: INK }}>
                      {t}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ),
        });
        break;
      }
      case 'asks': {
        const pages = chunk(d.asks, 6);
        if (!pages.length) page(key, { body: <Lead>Add your ask on your dashboard and it will appear here.</Lead> });
        pages.forEach((p, i) =>
          page(
            key,
            {
              body: (
                <ul className="m-0 grid list-none grid-cols-2 content-start gap-[1.4cqw] p-0">
                  {p.map((a) => (
                    <li key={`${a.first_name}${a.last_name}`} className={`${card(true)} flex flex-col gap-[0.3cqw] px-[1.6cqw] py-[1.2cqw]`}>
                      <span className="text-[1.5cqw] font-bold" style={{ color: BLUE }}>
                        {a.first_name} {a.last_name} · {a.business_name}
                      </span>
                      <span className="text-[2cqw] leading-snug" style={{ color: INK }}>
                        {a.weekly_ask}
                      </span>
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
        const tiles: [IconName, string, string][] = cycle
          ? [
              ['chat', String(cycle.one_on_ones), 'One-to-ones'],
              ['share', String(cycle.referrals), 'Referrals'],
              ['badgeCheck', String(cycle.closed_deals), 'Closed business'],
              ['dollar', formatMoney(cycle.closed_amount), 'Closed business ($)'],
            ]
          : [];
        page(key, {
          title: 'Statistics',
          body: (
            <>
              {cycle ? (
                <ul className="m-0 grid list-none grid-cols-4 gap-[1.4cqw] p-0" aria-label="Since the last meeting">
                  {tiles.map(([icon, v, l], i) => {
                    const hi = i === tiles.length - 1;
                    return (
                      <li
                        key={l}
                        className={`flex flex-col gap-[0.8cqw] rounded-[1.4cqw] px-[1.6cqw] py-[1.4cqw] ${hi ? 'text-white shadow-[0_0.6cqw_1.8cqw_rgba(10,71,169,0.3)]' : card(true)}`}
                        style={hi ? { background: 'linear-gradient(135deg, #1f7fd0, #0a47a9)' } : undefined}
                      >
                        <Badge name={icon} size={3.6} light={hi} />
                        <span className="font-display text-[3.8cqw] leading-none font-extrabold tabular-nums" style={hi ? undefined : { color: BLUE }}>
                          {v}
                        </span>
                        <span className="text-[1.6cqw] font-semibold" style={hi ? undefined : { color: INK }}>
                          {l}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <p className="m-0 text-[1.5cqw]" style={{ color: MUTED }}>
                Since the last meeting. Month and year so far:
              </p>
              <table className="w-full max-w-[80cqw] border-separate border-spacing-x-[1cqw] text-left">
                <thead>
                  <tr>
                    <th scope="col" className="text-[1.5cqw]">
                      <span className="sr-only">Period</span>
                    </th>
                    {['One-to-ones', 'Referrals', 'Closed business', 'Closed business ($)'].map((h) => (
                      <th key={h} scope="col" className="text-[1.3cqw] font-bold tracking-[0.08em] uppercase" style={{ color: BLUE }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.totals.slice(1).map(({ label, t }) => (
                    <tr key={label}>
                      <th scope="row" className="text-[1.7cqw] font-semibold" style={{ color: MUTED }}>
                        {label}
                      </th>
                      {[t.one_on_ones, t.referrals, t.closed_deals, formatMoney(t.closed_amount)].map((v, n) => (
                        <td key={n} className="font-display text-[2.4cqw] font-extrabold tabular-nums" style={{ color: NAVY }}>
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
      case 'leaderboards': {
        const icons: Record<string, IconName> = { one_on_ones: 'chat', referrals: 'share', closed_deals: 'badgeCheck', visitors: 'userPlus' };
        page(key, {
          title: 'Leaderboards',
          body: (
            <div className="grid grid-cols-4 gap-[1.6cqw]">
              {leaderboardMetrics.map((m, i) => {
                const rows = d.leaders.filter((r) => r.metric === m.key);
                const color = STEP_COLORS[i + 1] ?? BLUE;
                return (
                  <div key={m.key} className={`${card()} flex flex-col overflow-hidden`}>
                    {/* Coloured header with a pointer, as in the roadmap sample. */}
                    <div className="relative flex items-center gap-[0.9cqw] px-[1.3cqw] py-[1cqw] text-white" style={{ background: color }}>
                      <Icon name={icons[m.key] ?? 'award'} style={{ width: '2.2cqw', height: '2.2cqw' }} />
                      <h3 className="font-display m-0 text-[1.55cqw] font-extrabold text-white">{m.label}</h3>
                      <span
                        className="absolute -bottom-[0.9cqw] left-1/2 h-[1.8cqw] w-[1.8cqw] -translate-x-1/2 rotate-45"
                        style={{ background: color }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="px-[1.1cqw] pt-[1.6cqw] pb-[1.1cqw]">
                      {rows.length ? (
                        <ol className="m-0 flex list-none flex-col gap-[0.5cqw] p-0">
                          {rows.map((r) => (
                            <li key={r.profile_id} className="flex items-center gap-[0.8cqw] text-[1.6cqw]">
                              <span
                                className="flex h-[2.3cqw] w-[2.3cqw] flex-none items-center justify-center rounded-full text-[1.2cqw] font-extrabold text-white"
                                style={{ background: color }}
                              >
                                {r.rank}
                              </span>
                              <span className="min-w-0 flex-1 truncate" style={{ color: INK }}>
                                {r.first_name} {r.last_name.slice(0, 1)}.
                              </span>
                              <strong className="tabular-nums" style={{ color: NAVY }}>
                                {r.value}
                              </strong>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <Muted>Nothing yet.</Muted>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ),
        });
        break;
      }
      case 'champion': {
        // BARP Champion (owner, 2026-10-23/24): the chosen champion at every meeting (this month's, else last month's), otherwise the leaders so far.
        const c = d.champion;
        const award = c.award;
        if (award) {
          const pts = award.points;
          const facts = (
            [
              ['share', pts.referrals, 'referrals'],
              ['badgeCheck', pts.closed, 'closed business'],
              ['chat', pts.oneOnOnes, 'one-on-ones'],
              ['userPlus', pts.visitors, 'visitors'],
              ['calendar', pts.meetings, 'meetings'],
            ] as [IconName, number | undefined, string][]
          ).filter(([, n]) => typeof n === 'number' && n > 0);
          add(key, (ctx) => (
            <ChampionPage ctx={ctx}>
              <Fireworks />
              <div className="flex flex-col items-center gap-[1.1cqw]">
                <p className="font-display m-0 text-[1.8cqw] font-bold tracking-[0.18em] uppercase" style={{ color: BLUE }}>
                  {award.label}
                </p>
                <div className="flex items-center gap-[2.4cqw]">
                  <span className="rounded-[1.6cqw] shadow-[0_0.6cqw_2cqw_rgba(245,158,11,0.45)] ring-[0.4cqw] ring-[#fbbf24]">
                    <Face name={award.name} path={award.avatar} size={11} square />
                  </span>
                  <div className="flex min-w-0 flex-col items-start gap-[0.5cqw] text-left">
                    <p className="font-display m-0 text-[3.6cqw] leading-tight font-extrabold" style={{ color: NAVY }}>
                      {award.name}
                    </p>
                    {award.business ? (
                      <p className="m-0 text-[1.9cqw] font-semibold italic" style={{ color: BLUE }}>
                        {award.business}
                      </p>
                    ) : null}
                    {typeof pts.points === 'number' ? (
                      <p className="m-0 text-[1.7cqw]" style={{ color: MUTED }}>
                        {pts.points} points
                      </p>
                    ) : null}
                  </div>
                </div>
                {award.reason ? (
                  <p className="m-0 max-w-[64cqw] text-[1.8cqw] leading-snug italic" style={{ color: INK }}>
                    “{award.reason}”
                  </p>
                ) : null}
                {facts.length ? (
                  <ul className="m-0 flex list-none flex-wrap justify-center gap-[1cqw] p-0">
                    {facts.map(([icon, n, l]) => (
                      <li
                        key={l}
                        className={`${card(true)} flex items-center gap-[0.8cqw] px-[1.2cqw] py-[0.6cqw] text-[1.6cqw] font-bold`}
                        style={{ color: INK }}
                      >
                        <Badge name={icon} size={2.8} />
                        {n} {l}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </ChampionPage>
          ));
        } else if (c.leaders.length) {
          add(key, (ctx) => (
            <ChampionPage ctx={ctx}>
              <div className="flex flex-col items-center gap-[1.2cqw]">
                <p className="font-display m-0 text-[1.8cqw] font-bold tracking-[0.18em] uppercase" style={{ color: BLUE }}>
                  Leading {c.monthLabel} so far
                </p>
                <ol className="m-0 flex list-none items-end gap-[2.4cqw] p-0" aria-label={`Leading ${c.monthLabel} so far`}>
                  {c.leaders.map((l, i) => (
                    <li key={l.id} className={`${card()} flex flex-col items-center gap-[0.6cqw] px-[1.8cqw] py-[1.2cqw] ${i === 0 ? 'scale-110' : ''}`}>
                      <span className="font-display text-[2.2cqw] font-extrabold" style={{ color: STEP_COLORS[i * 2] ?? BLUE }}>
                        {i + 1}
                      </span>
                      <Face name={l.name} path={l.avatar} size={7} square />
                      <span className="font-display text-[1.7cqw] font-extrabold" style={{ color: NAVY }}>
                        {l.name}
                      </span>
                      <span className="text-[1.4cqw] font-semibold" style={{ color: MUTED }}>
                        {l.points} points
                      </span>
                    </li>
                  ))}
                </ol>
                {d.notes.champion ? <Note text={d.notes.champion} /> : null}
              </div>
            </ChampionPage>
          ));
        } else {
          // Nobody named yet: the owner's artwork with its "Coming soon" banner.
          add(key, (ctx) => (
            <ChampionPage ctx={ctx} soon>
              {d.notes.champion ? <Note text={d.notes.champion} /> : null}
            </ChampionPage>
          ));
        }
        break;
      }
      case 'five_minute':
        page(key, {
          title: '5-Minute Educational Presentation',
          aside: d.timers.five_minute ? <SlideTimer id="five_minute" seconds={300} label="5-minute presentation" /> : undefined,
          body: (
            <>
              <TopicBanner s={d.five} />
              <Speaker s={d.five} fallback="This slot is open today." />
            </>
          ),
        });
        break;
      case 'five_qa':
        page(key, {
          title: d.five ? `Questions for ${d.five.display_name.split(' ')[0]}` : 'Questions',
          aside: d.timers.five_qa ? <SlideTimer seconds={60} label="1 minute of questions" /> : <Badge name="help" size={15} />,
          body: <Lead>One minute of questions for the 5-minute presentation. Keep them short so everyone gets a turn.</Lead>,
        });
        break;
      case 'ten_minute':
        page(key, {
          title: '10-Minute Presentation',
          aside: d.timers.ten_minute ? <SlideTimer id="ten_minute" seconds={600} label="10-minute presentation" /> : undefined,
          body: (
            <>
              <TopicBanner s={d.ten} />
              <Speaker s={d.ten} fallback="This slot is open today." />
            </>
          ),
        });
        break;
      case 'ten_qa':
        page(key, {
          title: d.ten ? `Questions for ${d.ten.display_name.split(' ')[0]}` : 'Questions',
          aside: d.timers.ten_qa ? <SlideTimer seconds={300} label="5 minutes of questions" /> : <Badge name="help" size={15} />,
          body: (
            <>
              <Lead>Five minutes of questions for the 10-minute presentation.</Lead>
              <IconRows
                items={[
                  ['target', 'Who is a perfect referral for them?'],
                  ['ear', 'What should we listen for this week?'],
                  ['users', 'How do we introduce them?'],
                ]}
              />
            </>
          ),
        });
        break;
      case 'announcements':
        page(key, {
          title: 'Upcoming events & announcements',
          body: d.events.length ? (
            <ul className="m-0 grid list-none grid-cols-2 content-start gap-[1.4cqw] p-0">
              {d.events.map((e) => (
                <li key={e.id} className={`${card()} flex gap-[1.3cqw] p-[1.3cqw]`}>
                  {/* Calendar-page badge: the month large on a coloured band, the day below (owner, 2026-10-23: month more obvious). */}
                  <span className="flex w-[8.4cqw] flex-none flex-col overflow-hidden rounded-[1cqw] bg-white shadow-[0_0.3cqw_0.9cqw_rgba(18,52,110,0.18)] ring-1 ring-[#d6e4f5]">
                    <span
                      className="font-display py-[0.5cqw] text-center text-[2cqw] leading-none font-extrabold tracking-[0.06em] text-white uppercase"
                      style={{ background: 'linear-gradient(160deg, #1f7fd0, #0a47a9)' }}
                    >
                      {new Date(e.starts_at).toLocaleString('en-US', { month: 'short', timeZone: site.timezone })}
                    </span>
                    <span className="font-display py-[0.6cqw] text-center text-[3.4cqw] leading-none font-extrabold" style={{ color: NAVY }}>
                      {new Date(e.starts_at).toLocaleString('en-US', { day: 'numeric', timeZone: site.timezone })}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-[0.2cqw]">
                    <span className="text-[2cqw] leading-tight font-bold" style={{ color: NAVY }}>
                      {e.title}
                    </span>
                    <span className="text-[1.6cqw] font-bold" style={{ color: BLUE }}>
                      {new Date(e.starts_at).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: site.timezone })}
                    </span>
                    <span className="text-[1.5cqw]" style={{ color: MUTED }}>
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
                    Apply or learn more at <strong style={{ color: BLUE }}>{visitUrl}</strong>
                  </>,
                ]}
                size={2.1}
              />
              <p className="m-0 text-[1.5cqw] font-bold tracking-[0.12em] uppercase" style={{ color: BLUE }}>
                Open professions
              </p>
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
              <div className="flex flex-col gap-[0.8cqw] text-[2cqw]" style={{ color: INK }}>
                <p className="m-0 text-[2.3cqw]">
                  Next meeting: <strong className="text-[#1f7fd0]">{formatMeetingDate(new Date(d.next.starts_at))}</strong> ·{' '}
                  {formatMeetingTime(new Date(d.next.starts_at))} PT
                </p>
                {/* Next meeting's presenters with their photos (owner, 2026-10-23). */}
                <ul className="m-0 mt-[0.6cqw] flex list-none flex-col gap-[1.2cqw] p-0" aria-label="Presenting next meeting">
                  {(
                    [
                      ['5-minute presentation', d.next.five],
                      ['10-minute presentation', d.next.ten],
                    ] as const
                  ).map(([slotLabel, s]) => (
                    <li key={slotLabel} className="flex items-center gap-[1.4cqw]">
                      {s ? (
                        <span className="rounded-[1.2cqw] shadow-[0_0.4cqw_1.2cqw_rgba(18,52,110,0.25)]">
                          <Face name={s.display_name} path={s.avatar_path} size={7.5} square />
                        </span>
                      ) : (
                        <Badge name="presentation" size={7.5} />
                      )}
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="text-[1.5cqw] font-bold tracking-[0.04em] uppercase" style={{ color: BLUE }}>
                          {slotLabel}
                        </span>
                        <span className="font-display text-[2.3cqw] font-extrabold" style={{ color: NAVY }}>
                          {s ? s.display_name : 'Open: claim it on the Meetings page'}
                        </span>
                        {s?.topic ? <span className="text-[1.6cqw] italic">“{s.topic}”</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="m-0 text-[2.2cqw]" style={{ color: INK }}>
                The next meeting date will be posted soon.
              </p>
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
