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
import { adminDeleteGalleryPhoto } from '../../actions/admin-edit';
import { PhotoForm } from './PhotoForm';

export const metadata: Metadata = { title: 'Gallery' };

/** Admin → Gallery: change any caption, album or date, or remove a photo (owner, 2026-10-27). */
export default async function AdminGalleryPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: photos, error } = await supabase
    .from('gallery_photos')
    .select('id, caption, album, taken_on, thumb_path, created_at, uploaded_by, uploader:profiles(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error('Could not load the gallery');

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Gallery</h1>
        <AdminNav current="/admin/gallery" />
        <HowThisWorks tab="/admin/gallery">
          Every photo members have uploaded, newest first. Fix a caption, move a photo to another album, or remove it. Members upload photos on the{' '}
          <Link href="/gallery">Gallery page</Link>.
        </HowThisWorks>
        {photos.length === 0 ? (
          <EmptyState title="No photos yet" />
        ) : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 p-0">
            {photos.map((p) => (
              <li key={p.id} id={`photo-${p.id}`} className="card flex flex-col gap-3 p-4">
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
