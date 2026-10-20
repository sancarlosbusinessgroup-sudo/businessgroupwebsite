'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Interactive pieces used inside slides: a speaking timer, a YouTube player and a PDF page.
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

/** Countdown for timed agenda items (infomercials, presentations, questions). "T" starts or pauses the timer on screen. */
export function SlideTimer({ seconds, label }: { seconds: number; label: string }) {
  const { ref, visible } = useVisible<HTMLDivElement>();
  const [left, setLeft] = useState(seconds);
  const [on, setOn] = useState(false);
  const running = on && left > 0;
  const toggle = useCallback(() => {
    if (left === 0) {
      setLeft(seconds);
      setOn(true);
    } else setOn(!running);
  }, [left, running, seconds]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

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
  return (
    <div ref={ref} className="flex flex-col items-center gap-[0.8cqw]">
      <div className="relative h-[15cqw] w-[15cqw]">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e0f4f4" strokeWidth="7" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={done ? '#b42318' : '#0c7b74'}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - left / seconds)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span
          className={`font-display absolute inset-0 flex items-center justify-center text-[4cqw] font-extrabold tabular-nums ${done ? 'text-[#b42318]' : 'text-on-band'}`}
          role="timer"
          aria-live={done ? 'assertive' : 'off'}
          aria-label={`${label}: ${done ? 'time is up' : `${fmt(left)} left`}`}
        >
          {done ? 'Time!' : fmt(left)}
        </span>
      </div>
      <div className="flex gap-[0.6cqw]">
        <button type="button" onClick={toggle} className="btn btn-primary min-h-0 px-[1.6cqw] py-[0.6cqw] text-[1.35cqw]">
          {running ? 'Pause' : done ? 'Restart' : left === seconds ? 'Start timer' : 'Resume'}
          <span className="sr-only"> ({label})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setOn(false);
            setLeft(seconds);
          }}
          className="btn btn-outline min-h-0 px-[1.6cqw] py-[0.6cqw] text-[1.35cqw]"
          disabled={left === seconds && !running}
        >
          Reset<span className="sr-only"> {label}</span>
        </button>
      </div>
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
