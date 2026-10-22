'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';

export type DeckSlide = { id: string; label: string; node: ReactNode };

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'n', 'N']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'p', 'P']);

/**
 * Full-screen 16:9 slide deck. Keyboard: ← → / ↑ ↓ / PageUp PageDown (presentation clickers) / Space,
 * Home / End, F for full screen, R to refresh the data (same slide stays on screen). Works in a Zoom screen share of the browser window.
 */
export function Deck({ title, slides, customizeHref, exitHref }: { title: string; slides: DeckSlide[]; customizeHref?: string; exitHref: string }) {
  const [i, setI] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const last = slides.length - 1;
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  // Reload the slide data from the server (new RSVPs, stats, uploads…) without leaving the current slide.
  const refresh = useCallback(() => {
    startRefresh(() => {
      router.refresh();
      setRefreshedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    });
  }, [router]);
  // Refreshed data can have fewer slides: stay within range.
  const shown = Math.min(i, last);
  const go = useCallback((n: number) => setI(Math.min(Math.max(n, 0), last)), [last]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      const onControl = t?.closest('button, a, input, select, textarea');
      if (onControl && (e.key === ' ' || e.key === 'Enter')) return;
      if (NEXT_KEYS.has(e.key)) {
        e.preventDefault();
        setI((x) => Math.min(x + 1, last));
      } else if (PREV_KEYS.has(e.key)) {
        e.preventDefault();
        setI((x) => Math.max(x - 1, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setI(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setI(last);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        refresh();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void root.current?.requestFullscreen?.();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, refresh]);

  const current = slides[shown];
  return (
    <div ref={root} className="deck-light bg-canvas text-on-band fixed inset-0 z-50 flex flex-col">
      <h1 className="sr-only">{title}</h1>
      <section aria-label="Meeting slides" className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-4">
          <div
            className="bg-band border-line @container relative aspect-video w-[min(100%,calc((100dvh-5rem)*16/9))] overflow-hidden rounded-xl border shadow-sm"
            aria-roledescription="slide"
          >
            {slides.map((s, n) => (
              <div key={s.id} hidden={n !== shown} aria-label={`${s.label} (slide ${n + 1} of ${slides.length})`} role="group" className="absolute inset-0">
                {s.node}
              </div>
            ))}
          </div>
        </div>
        <div className="border-band-line flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost-band btn-sm" onClick={() => go(shown - 1)} disabled={shown === 0} aria-label="Previous slide">
              ‹ Prev
            </button>
            <button type="button" className="btn btn-light btn-sm" onClick={() => go(shown + 1)} disabled={shown === last} aria-label="Next slide">
              Next ›
            </button>
            <p className="text-on-band-muted m-0 text-sm tabular-nums" aria-live="polite">
              {`Slide ${shown + 1} of ${slides.length}`}
            </p>
            <span className="sr-only" aria-live="polite">
              {current?.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-on-band-muted hidden md:inline">← → or clicker to move · F full screen · T timer · R refresh</span>
            <button type="button" className="btn btn-ghost-band btn-sm" onClick={refresh} disabled={refreshing} aria-describedby="deck-refreshed">
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <span id="deck-refreshed" className="sr-only" role="status">
              {refreshedAt && !refreshing ? `Slides refreshed at ${refreshedAt}` : ''}
            </span>
            <button
              type="button"
              className="btn btn-ghost-band btn-sm"
              onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void root.current?.requestFullscreen?.())}
            >
              Full screen
            </button>
            {customizeHref ? (
              <Link className="btn btn-ghost-band btn-sm" href={customizeHref}>
                Customize slides
              </Link>
            ) : null}
            <Link className="btn btn-ghost-band btn-sm" href={exitHref}>
              Exit
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
