'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui';
import { albums } from '@/lib/content';

export type GalleryItem = { id: string; caption: string; album: string; date: string | null; thumb: string; full: string };

export function GalleryGrid({ photos }: { photos: GalleryItem[] }) {
  const [album, setAlbum] = useState<string>('all');
  const [open, setOpen] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);

  const shown = album === 'all' ? photos : photos.filter((p) => p.album === album);
  const current = open !== null ? shown[open] : undefined;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  const close = () => {
    setOpen(null);
    lastTrigger.current?.focus();
  };
  const step = (dir: 1 | -1) => setOpen((o) => (o === null ? o : (o + dir + shown.length) % shown.length));

  const chip = (active: boolean) =>
    `min-h-11 cursor-pointer rounded-full px-[18px] font-display text-sm font-bold ${
      active ? 'border border-heading bg-heading text-surface' : 'border border-line-strong bg-surface text-ink-soft'
    }`;

  return (
    <>
      <div role="group" aria-label="Albums" className="flex flex-wrap gap-2">
        <button type="button" className={chip(album === 'all')} aria-pressed={album === 'all'} onClick={() => setAlbum('all')}>
          All
        </button>
        {albums.map((a) => (
          <button key={a.value} type="button" className={chip(album === a.value)} aria-pressed={album === a.value} onClick={() => setAlbum(a.value)}>
            {a.label}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {shown.length} photos shown
      </p>
      {shown.length === 0 ? (
        <EmptyState title="No photos in this album yet" />
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 p-0">
          {shown.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className="group flex w-full cursor-pointer flex-col gap-2 border-0 bg-transparent p-0 text-left"
                onClick={(e) => {
                  lastTrigger.current = e.currentTarget;
                  setOpen(i);
                }}
              >
                <span className="bg-ph-a group-hover:outline-teal relative block aspect-[4/3] w-full overflow-hidden rounded-[14px] group-hover:outline-3">
                  <Image src={p.thumb} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                </span>
                <span className="flex justify-between gap-2 text-[15px]">
                  <span className="text-heading font-semibold">
                    <span className="sr-only">Open photo: </span>
                    {p.caption}
                  </span>
                  {p.date ? <span className="text-ink-muted flex-none">{p.date}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        aria-label="Photo viewer"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') step(1);
          if (e.key === 'ArrowLeft') step(-1);
        }}
        className="m-auto w-[min(960px,calc(100%-32px))] max-w-none border-0 bg-transparent p-0 backdrop:bg-black/85"
      >
        {current ? (
          <div className="flex flex-col gap-3.5">
            <div className="bg-ph-a relative aspect-[3/2] w-full overflow-hidden rounded-2xl">
              <Image src={current.full} alt={current.caption} fill sizes="960px" className="object-contain" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-white">
              <div>
                <p className="font-display m-0 text-lg font-bold">{current.caption}</p>
                <p className="m-0 text-[15px] text-white/80">
                  {[current.date, albums.find((a) => a.value === current.album)?.label].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-sm bg-band-2 text-on-band" onClick={() => step(-1)}>
                  ‹ Previous
                </button>
                <button type="button" className="btn btn-sm bg-band-2 text-on-band" onClick={() => step(1)}>
                  Next ›
                </button>
                <button type="button" className="btn btn-sm btn-light" onClick={close} autoFocus>
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
