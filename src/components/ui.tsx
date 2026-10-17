import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Page title banner: the Golden Gate photo from Home under a light wash, so titles keep their normal dark colours. */
export function PageHero({ crumb, title, lead, children }: { crumb?: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-line bg-canvas relative isolate overflow-hidden border-b">
      <Image src="/images/hero-bridge.jpg" alt="" fill sizes="100vw" className="-z-20 object-cover object-[70%_center]" />
      <div
        className="bg-canvas/85 md:from-canvas/95 md:via-canvas/80 md:to-canvas/40 absolute inset-0 -z-10 md:bg-transparent md:bg-linear-to-r"
        aria-hidden="true"
      />
      <div className="container-site flex flex-wrap items-center gap-8 py-12">
        <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-3">
          {crumb ? (
            <nav aria-label="Breadcrumb" className="text-ink-muted text-sm">
              <Link href="/">Home</Link> / <span aria-current="page">{crumb}</span>
            </nav>
          ) : null}
          <h1 className="h1">{title}</h1>
          {lead ? <p className="text-ink-soft m-0 max-w-[760px] text-[19px]">{lead}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export function SectionHead({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2.5">
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h2 className="h2">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function DateBadge({ day, month, sub, size = 'md' }: { day: string; month: string; sub?: string; size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  return (
    <div className={`bg-teal-tint flex flex-none flex-col items-center justify-center rounded-xl ${big ? 'h-auto w-[150px] py-5' : 'h-[72px] w-[68px]'}`}>
      <span className={`font-display text-heading leading-none font-extrabold ${big ? 'text-[40px]' : 'text-[26px]'}`}>{day}</span>
      <span className="font-display text-teal-text text-sm font-bold tracking-[0.08em]">{month}</span>
      {sub ? <span className="text-ink-muted mt-1.5 text-[13px]">{sub}</span> : null}
    </div>
  );
}

const tints = ['bg-teal-tint text-teal-text', 'bg-berry-tint text-berry', 'bg-green-tint text-green-ink', 'bg-amber-tint text-amber'] as const;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, size = 40, index = 0 }: { name: string; size?: number; index?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`font-display inline-flex flex-none items-center justify-center rounded-full font-extrabold ${tints[index % tints.length]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

export function StatTile({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'good' }) {
  return (
    <div className="card flex flex-col gap-1 p-[18px]">
      <span className="text-ink-muted text-[13px] font-bold tracking-[0.08em] uppercase">{label}</span>
      <span className={`font-display text-[32px] leading-tight font-extrabold tabular-nums ${tone === 'good' ? 'text-green-ink' : 'text-heading'}`}>
        {value}
      </span>
      {sub ? <span className="text-ink-muted text-sm">{sub}</span> : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-line-strong rounded-[14px] border border-dashed p-6 text-center">
      <p className="font-display text-heading m-0 font-bold">{title}</p>
      {children ? <div className="text-ink-muted mt-1.5 text-[15px]">{children}</div> : null}
    </div>
  );
}

export function Notice({ tone, children }: { tone: 'success' | 'error' | 'info'; children: ReactNode }) {
  const cls = tone === 'success' ? 'bg-green-tint text-green-ink' : tone === 'error' ? 'bg-red-tint text-red' : 'bg-teal-tint text-teal-hover';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-[15px] font-semibold ${cls}`}>
      {children}
    </div>
  );
}

export function Pill({ tone, children }: { tone: 'green' | 'teal' | 'amber' | 'red' | 'gray'; children: ReactNode }) {
  const cls = {
    green: 'bg-green-tint text-green-ink',
    teal: 'bg-teal-tint text-teal-hover',
    amber: 'bg-amber-tint text-amber',
    red: 'bg-red-tint text-red',
    gray: 'bg-line-soft text-ink-soft',
  }[tone];
  return <span className={`pill ${cls}`}>{children}</span>;
}

export function PhotoPlaceholder({ label, tone = 0 }: { label?: string; tone?: number }) {
  const bg = ['bg-ph-a', 'bg-ph-b', 'bg-ph-c'][tone % 3];
  return (
    <div className={`flex h-full w-full items-center justify-center ${bg}`} role={label ? 'img' : undefined} aria-label={label}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-muted" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="11" r="2" />
        <path d="m21 17-5-5-7 7" />
      </svg>
    </div>
  );
}

export function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className}`}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
