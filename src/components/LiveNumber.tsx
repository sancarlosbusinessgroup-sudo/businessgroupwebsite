'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { formatMoney } from '@/lib/dates';
import { liveDelta, LIVE_COUNT_MS, LIVE_FLASH_MS, tweenValue } from '@/lib/live-activity';

// Live highlight (owner, 2026-11-26): when members' activity changes a number on an open page or slide, the number counts
// up to its new value and glows in BARP teal for a few seconds, with a small "+1". Only changes that come from new
// activity are highlighted (the page's activity total went up); picking another month or period just swaps the numbers.

type Scope = { bumped: boolean; updatedAt: Date | null };
const LiveScopeContext = createContext<Scope>({ bumped: false, updatedAt: null });

/**
 * Wraps the part of a page whose numbers should be highlighted. `version` is the activity total the page was rendered
 * with: when it goes up after a live reload, the numbers that changed in that same render are highlighted.
 * `updatedAt` (from useLiveActivity) feeds LiveStatus.
 */
export function LiveScope({ version, updatedAt = null, children }: { version: number | null; updatedAt?: Date | null; children: ReactNode }) {
  const [state, setState] = useState({ version, bumped: false });
  // "This render brought new activity", derived from the version prop (React's "adjust state when a prop changes").
  if (version !== state.version) {
    setState({ version, bumped: version !== null && state.version !== null && version > state.version });
  }
  // Children's effects run before this one, so they see `bumped` for exactly the render that brought the change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the one-render flag once children have used it
    if (state.bumped) setState((s) => ({ ...s, bumped: false }));
  }, [state.bumped]);
  return <LiveScopeContext.Provider value={{ bumped: state.bumped, updatedAt }}>{children}</LiveScopeContext.Provider>;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that highlights itself when live activity changes it. Put `live-tile` on the card around it to make the whole
 * card glow (CSS `:has(.live-flash)`). `isNew`: also highlight it when it first appears during a live update (a member
 * who has just joined a leaderboard). People who turned motion off get the glow without the counting.
 */
export function LiveNumber({ value, format = 'count', isNew = false }: { value: number; format?: 'count' | 'money'; isNew?: boolean }) {
  const { bumped } = useContext(LiveScopeContext);
  const prev = useRef(value);
  const mounted = useRef(false);
  const timers = useRef<{ raf?: number; off?: ReturnType<typeof setTimeout> }>({});
  const [counting, setCounting] = useState<number | null>(null);
  const [delta, setDelta] = useState(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    const from = prev.current;
    prev.current = value;
    if (!bumped || (first ? !isNew : from === value)) return;
    const t = timers.current;
    if (t.raf) cancelAnimationFrame(t.raf);
    clearTimeout(t.off);
    setDelta(first ? 0 : liveDelta(from, value));
    setFlash(true);
    t.off = setTimeout(() => setFlash(false), LIVE_FLASH_MS);
    if (!first && !reducedMotion()) {
      const start = performance.now();
      const step = (now: number) => {
        const p = (now - start) / LIVE_COUNT_MS;
        setCounting(p < 1 ? tweenValue(from, value, p) : null);
        if (p < 1) t.raf = requestAnimationFrame(step);
      };
      t.raf = requestAnimationFrame(step);
    }
  }, [value, bumped, isNew]);

  useEffect(() => {
    const t = timers.current;
    return () => {
      if (t.raf) cancelAnimationFrame(t.raf);
      clearTimeout(t.off);
    };
  }, []);

  const show = (n: number) => (format === 'money' ? formatMoney(n) : String(n));
  const deltaText = delta === 0 ? '' : `${delta > 0 ? '+' : '−'}${show(Math.abs(delta))}`;
  return (
    <span className={flash ? 'live-flash' : undefined} data-live-flash={flash ? '' : undefined}>
      {show(counting ?? value)}
      {flash && deltaText ? (
        <span className="live-delta" aria-hidden="true">
          {deltaText}
        </span>
      ) : null}
    </span>
  );
}

/** "Live · updated 2:14 PM" (owner, 2026-11-26): dot and "Live" until the first update arrives. */
export function LiveStatus({ className = '' }: { className?: string }) {
  const { updatedAt } = useContext(LiveScopeContext);
  return <LiveStatusText updatedAt={updatedAt} className={className} />;
}

export function LiveStatusText({ updatedAt, className = '' }: { updatedAt: Date | null; className?: string }) {
  return (
    <span className={`live-status ${className}`.trim()} data-live-status>
      <span aria-hidden="true" className="live-dot" />
      Live
      {updatedAt ? ` · updated ${updatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
    </span>
  );
}
