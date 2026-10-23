'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

// Interactive pieces used inside slides: a speaking timer, a YouTube player, a website and a PDF page.
// Slides that are not on screen are `hidden`, so each widget only does work once it is visible.

function useVisible<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// --- Shared timers --------------------------------------------------------------------------------
// Timers are kept per name (e.g. the 5-minute presentation), so the same countdown shows on the
// presentation slide and on every slide the presenter added after it, and keeps running between them.

type TimerState = { seconds: number; left: number; on: boolean };
const timers = new Map<string, TimerState>();
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;
const emit = () => listeners.forEach((l) => l());

function ensureTicker() {
  if (ticker) return;
  ticker = setInterval(() => {
    let any = false;
    for (const [id, t] of timers)
      if (t.on && t.left > 0) {
        any = true;
        const left = t.left - 1;
        timers.set(id, { ...t, left, on: left > 0 });
      }
    if (any) emit();
    else if (ticker && ![...timers.values()].some((t) => t.on)) {
      clearInterval(ticker);
      ticker = null;
    }
  }, 1000);
}

function getTimer(id: string, seconds: number): TimerState {
  let t = timers.get(id);
  if (!t) {
    t = { seconds, left: seconds, on: false };
    timers.set(id, t);
  }
  return t;
}

function useTimer(id: string, seconds: number) {
  const initial = useMemo(() => ({ seconds, left: seconds, on: false }), [seconds]);
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => getTimer(id, seconds),
    () => initial,
  );
  const toggle = useCallback(() => {
    const t = getTimer(id, seconds);
    timers.set(id, t.left === 0 ? { ...t, left: t.seconds, on: true } : { ...t, on: !t.on });
    ensureTicker();
    emit();
  }, [id, seconds]);
  const reset = useCallback(() => {
    const t = getTimer(id, seconds);
    timers.set(id, { ...t, left: t.seconds, on: false });
    emit();
  }, [id, seconds]);
  return { left: state.left, running: state.on && state.left > 0, toggle, reset };
}

/** Countdown for timed agenda items (infomercials, presentations, questions). "T" starts or pauses the timer on screen.
 *  `id` shares one countdown between slides; `compact` is the small version shown above an added slide. */
export function SlideTimer({ seconds, label, id, compact = false }: { seconds: number; label: string; id?: string; compact?: boolean }) {
  const { ref, visible } = useVisible<HTMLDivElement>();
  const { left, running, toggle, reset } = useTimer(id ?? label, seconds);

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.key !== 't' && e.key !== 'T')) return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      e.preventDefault();
      toggle();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, toggle]);

  const done = left === 0;
  const r = 44;
  const c = 2 * Math.PI * r;
  const ring = (
    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e3eefb" strokeWidth={compact ? 11 : 7} />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={done ? '#b42318' : '#1f7fd0'}
        strokeWidth={compact ? 11 : 7}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - left / seconds)}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  );
  const time = (
    <span
      className={`font-display font-extrabold tabular-nums ${done ? 'text-[#b42318]' : 'text-on-band'} ${compact ? 'text-[1.9cqw]' : 'absolute inset-0 flex items-center justify-center text-[4cqw]'}`}
      role="timer"
      aria-live={done ? 'assertive' : 'off'}
      aria-label={`${label}: ${done ? 'time is up' : `${fmt(left)} left`}`}
    >
      {done ? 'Time!' : fmt(left)}
    </span>
  );
  const btn = compact ? 'btn min-h-0 px-[1cqw] py-[0.35cqw] text-[1.1cqw]' : 'btn min-h-0 px-[1.6cqw] py-[0.6cqw] text-[1.35cqw]';
  const buttons = (
    <div className="flex gap-[0.6cqw]">
      <button type="button" onClick={toggle} className={`${btn} btn-primary`}>
        {running ? 'Pause' : done ? 'Restart' : left === seconds ? (compact ? 'Start' : 'Start timer') : 'Resume'}
        <span className="sr-only"> ({label})</span>
      </button>
      <button type="button" onClick={reset} className={`${btn} btn-outline`} disabled={left === seconds && !running}>
        Reset<span className="sr-only"> {label}</span>
      </button>
    </div>
  );
  if (compact)
    return (
      <div
        ref={ref}
        className="flex items-center gap-[0.9cqw] rounded-full bg-white/95 py-[0.4cqw] pr-[0.6cqw] pl-[0.5cqw] shadow-[0_0.2cqw_0.8cqw_rgba(0,0,0,0.12)]"
      >
        <span className="relative h-[3.2cqw] w-[3.2cqw]">{ring}</span>
        {time}
        {buttons}
      </div>
    );
  return (
    <div ref={ref} className="flex flex-col items-center gap-[0.8cqw]">
      <div className="relative h-[15cqw] w-[15cqw]">
        {ring}
        {time}
      </div>
      {buttons}
    </div>
  );
}

/** A website shown inside the slide. Many sites refuse to be shown inside another page, so it loads only
 *  when asked, and "Open in a new window" is always there as the fallback. */
export function WebsiteSlide({ url, title }: { url: string; title: string }) {
  const [show, setShow] = useState(false);
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {}
  const open = () => window.open(url, '_blank', 'noopener,noreferrer');
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1cqw] border border-[#c9eef0] bg-[#f7fdfd]">
      {show ? (
        <>
          <iframe
            src={url}
            title={title}
            className="absolute inset-0 h-full w-full border-0 bg-white"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <button
            type="button"
            onClick={open}
            className="btn btn-light absolute right-[1cqw] bottom-[1cqw] min-h-0 px-[1.2cqw] py-[0.5cqw] text-[1.2cqw] shadow"
          >
            Open in a new window<span className="sr-only"> ({title})</span>
          </button>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-[1.6cqw] p-[3cqw] text-center">
          <p className="font-display m-0 text-[2.6cqw] font-extrabold text-[#0e7c74]">{title}</p>
          <p className="m-0 text-[1.6cqw] text-[#355856]">{host}</p>
          <div className="flex gap-[1.2cqw]">
            <button type="button" onClick={() => setShow(true)} className="btn btn-primary min-h-0 px-[2cqw] py-[0.8cqw] text-[1.6cqw]">
              Show the website here<span className="sr-only"> ({title})</span>
            </button>
            <button type="button" onClick={open} className="btn btn-outline min-h-0 px-[2cqw] py-[0.8cqw] text-[1.6cqw]">
              Open in a new window<span className="sr-only"> ({title})</span>
            </button>
          </div>
          <p className="m-0 max-w-[60cqw] text-[1.3cqw] text-[#4f6464]">
            If the page stays blank, the website doesn’t allow being shown inside other pages. Use “Open in a new window” instead.
          </p>
        </div>
      )}
    </div>
  );
}

/** YouTube video: shows the thumbnail first (nothing loads from YouTube until Play), then the player. */
export function YouTubeSlide({ id, start, title }: { id: string; start: number; title: string }) {
  const [play, setPlay] = useState(false);
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1${start ? `&start=${start}` : ''}`;
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1cqw] bg-black">
      {play ? (
        <iframe
          src={src}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0 h-full w-full cursor-pointer border-0 p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
          <span className="absolute top-1/2 left-1/2 flex h-[9cqw] w-[13cqw] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2.4cqw] bg-[#e62117] shadow-lg transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="ml-[0.4cqw] h-[4.5cqw] w-[4.5cqw] fill-white" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="sr-only">Play video: {title}</span>
        </button>
      )}
    </div>
  );
}

type PdfDoc = { getPage: (n: number) => Promise<PdfPage> };
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
};
const docs = new Map<string, Promise<PdfDoc>>();

async function loadPdf(url: string): Promise<PdfDoc> {
  let p = docs.get(url);
  if (!p) {
    p = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs';
      return pdfjs.getDocument({ url, isEvalSupported: false }).promise as unknown as Promise<PdfDoc>;
    });
    docs.set(url, p);
  }
  return p;
}

/** Count the pages of a PDF file in the browser (used before uploading). */
export async function countPdfPages(file: File): Promise<number> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const n = doc.numPages;
  await doc.destroy();
  return n;
}

/** One page of an uploaded PDF, drawn sharp at presentation size the first time it is shown. */
export function PdfPageSlide({ url, page, title }: { url: string; page: number; title: string }) {
  const { ref, visible } = useVisible<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  useEffect(() => {
    if (!visible || state !== 'idle') return;
    let cancelled = false;
    (async () => {
      try {
        const doc = await loadPdf(url);
        const p = await doc.getPage(page);
        const base = p.getViewport({ scale: 1 });
        const scale = Math.min(3, 1920 / base.width);
        const viewport = p.getViewport({ scale });
        const c = canvas.current;
        const ctx = c?.getContext('2d');
        if (!c || !ctx || cancelled) return;
        c.width = Math.round(viewport.width);
        c.height = Math.round(viewport.height);
        await p.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setState('done');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, state, url, page]);
  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      <canvas ref={canvas} role="img" aria-label={`${title}, page ${page}`} className="max-h-full max-w-full object-contain shadow-sm" />
      {state === 'idle' ? <span className="text-on-band-muted absolute text-[1.8cqw]">Loading page {page}…</span> : null}
      {state === 'error' ? <span className="text-on-band-muted absolute text-[1.8cqw]">This page could not be shown.</span> : null}
    </div>
  );
}

// --- Fireworks on the BARP Champion slide (owner, 2026-10-23) ------------------------------------

/** Fireworks over the slide for a few seconds each time it comes on screen. Still for people who prefer reduced motion. */
export function Fireworks({ seconds = 7 }: { seconds?: number }) {
  const { ref, visible } = useVisible<HTMLCanvasElement>();
  useEffect(() => {
    const canvas = ref.current;
    if (!visible || !canvas) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const colors = ['#5ce1e6', '#1f7fd0', '#fbbf24', '#f472b6', '#34d399', '#ffffff', '#f59e0b'];
    type P = { x: number; y: number; vx: number; vy: number; life: number; color: string };
    let parts: P[] = [];
    let raf = 0;
    let last = 0;
    const end = performance.now() + seconds * 1000;
    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    };
    resize();
    const burst = () => {
      const x = canvas.width * (0.15 + Math.random() * 0.7);
      const y = canvas.height * (0.12 + Math.random() * 0.4);
      const color = colors[Math.floor(Math.random() * colors.length)] ?? '#fbbf24';
      const n = 70;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const v = (1.5 + Math.random() * 3) * devicePixelRatio;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color });
      }
    };
    const tick = (t: number) => {
      if (t - last > 550 && t < end) {
        burst();
        last = t;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045 * devicePixelRatio;
        p.vx *= 0.985;
        p.life -= 0.012;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.4 * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
      }
      if (t < end || parts.length) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [visible, seconds, ref]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true" data-testid="fireworks" />;
}
