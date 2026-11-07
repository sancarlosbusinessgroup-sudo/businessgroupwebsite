import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatShortDate } from '@/lib/dates';
import { mediaUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { adminDeleteGalleryPhoto, adminMoveGalleryPhoto } from '../../actions/admin-edit';
import { PhotoForm } from './PhotoForm';

export const metadata: Metadata = { title: 'Gallery' };

/** Admin → Gallery: change any caption, album or date, or remove a photo (owner, 2026-10-27). */
export default async function AdminGalleryPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: photos, error } = await supabase
    .from('gallery_photos')
    .select('id, caption, album, taken_on, thumb_path, created_at, uploaded_by, uploader:profiles(first_name, last_name)')
    .order('sort_order', { ascending: true })
    .order('taken_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error('Could not load the gallery');

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Gallery</h1>
        <AdminNav current="/admin/gallery" />
        <HowThisWorks tab="/admin/gallery">
          Every photo members have uploaded, in the order the <Link href="/gallery">Gallery page</Link> shows them (the Home page shows the first three). Use
          the arrows or type a position to change the order. New photos appear at the top until you move them. You can also fix a caption, move a photo to
          another album, or remove it.
        </HowThisWorks>
        {photos.length === 0 ? (
          <EmptyState title="No photos yet" />
        ) : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 p-0">
            {photos.map((p, i) => (
              <li key={p.id} id={`photo-${p.id}`} className="card flex flex-col gap-3 p-4">
                <MoveControls key={`order-${i}`} id={p.id} caption={p.caption} position={i + 1} total={photos.length} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl('gallery', p.thumb_path) ?? ''} alt={p.caption} className="aspect-[4/3] w-full rounded-xl object-cover" />
                <p className="text-ink-muted m-0 text-sm">
                  {p.uploader ? (
                    <>
                      Uploaded by{' '}
                      <Link href={`/admin/members/${p.uploaded_by}`}>
                        {p.uploader.first_name} {p.uploader.last_name}
                      </Link>
                    </>
                  ) : (
                    'Uploader no longer a member'
                  )}{' '}
                  · {formatShortDate(new Date(p.created_at))}
                </p>
                <PhotoForm photo={p} />
                <ConfirmDelete action={adminDeleteGalleryPhoto} id={p.id} what={`photo ${p.caption}`} className="self-start" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const arrow = 'btn btn-outline btn-sm px-3';

/** Order controls for one photo (owner, 2026-11-07): plain buttons so they work with a keyboard and screen reader. */
function MoveControls({ id, caption, position, total }: { id: string; caption: string; position: number; total: number }) {
  const first = position === 1;
  const last = position === total;
  return (
    <form action={adminMoveGalleryPhoto} className="flex flex-wrap items-end gap-2" aria-label={`Order of photo: ${caption}`}>
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1">
        <label className="label" htmlFor={`pos-${id}`}>
          Position <span className="text-ink-muted font-normal">of {total}</span>
        </label>
        <input id={`pos-${id}`} name="position" type="number" min={1} max={total} defaultValue={position} className="field w-20 py-1.5" />
      </div>
      <button type="submit" name="to" value="position" className="btn btn-outline btn-sm">
        Move
      </button>
      <span className="flex gap-1">
        <button type="submit" name="to" value="top" className={arrow} disabled={first} title="Move to the top">
          <span aria-hidden="true">⤒</span>
          <span className="sr-only">Move {caption} to the top</span>
        </button>
        <button type="submit" name="to" value="up" className={arrow} disabled={first} title="Move one earlier">
          <span aria-hidden="true">↑</span>
          <span className="sr-only">Move {caption} one earlier</span>
        </button>
        <button type="submit" name="to" value="down" className={arrow} disabled={last} title="Move one later">
          <span aria-hidden="true">↓</span>
          <span className="sr-only">Move {caption} one later</span>
        </button>
        <button type="submit" name="to" value="bottom" className={arrow} disabled={last} title="Move to the bottom">
          <span aria-hidden="true">⤓</span>
          <span className="sr-only">Move {caption} to the bottom</span>
        </button>
      </span>
    </form>
  );
}
