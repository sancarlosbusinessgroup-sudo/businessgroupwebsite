'use client';

import { useEffect, useState } from 'react';
import { countdownParts } from '@/lib/dates';

type Props = { target: string; tone?: 'light' | 'dark' };

const pad = (n: number) => String(n).padStart(2, '0');

export function Countdown({ target, tone = 'light' }: Props) {
  const targetDate = new Date(target);
  // Start empty so server and client markup match; the clock starts after hydration.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const p = now ? countdownParts(targetDate, now) : null;
  const dark = tone === 'dark';
  const box = dark ? 'bg-band-2' : 'bg-surface border border-line';
  const num = dark ? 'text-on-band' : 'text-heading';
  const lab = dark ? 'text-sky' : 'text-teal-text';

  if (p?.done) {
    return (
      <p className={`font-display m-0 text-lg font-bold ${num}`} role="status">
        The meeting is starting now.
      </p>
    );
  }

  const units = [
    { v: p ? String(p.days) : '–', l: 'Days' },
    { v: p ? pad(p.hours) : '––', l: 'Hours' },
    { v: p ? pad(p.minutes) : '––', l: 'Min' },
    { v: p ? pad(p.seconds) : '––', l: 'Sec' },
  ];

  return (
    <div role="timer" aria-label="Time until the next meeting" className="font-display grid grid-cols-4 gap-2.5">
      {units.map((u) => (
        <div key={u.l} className={`rounded-[14px] px-1.5 py-3.5 text-center ${box}`}>
          <div className={`text-[clamp(26px,4vw,44px)] leading-none font-extrabold tabular-nums ${num}`}>{u.v}</div>
          <div className={`mt-1.5 text-xs font-bold tracking-[0.12em] uppercase ${lab}`}>{u.l}</div>
        </div>
      ))}
    </div>
  );
}
