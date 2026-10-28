import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui';
import { getViewer, isAdmin, isApproved } from '@/lib/auth';
import { getGallery } from '@/lib/data/public';
import { formatShortDate } from '@/lib/dates';
import { mediaUrl } from '@/lib/env';
import { GalleryGrid } from './GalleryGrid';
import { UploadPhoto } from './UploadPhoto';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Photos from our meetings, mixers, member spotlights and community events.',
};

export default async function GalleryPage() {
  const [viewer, photos] = await Promise.all([getViewer(), getGallery(undefined, 120)]);
  const member = isApproved(viewer);
  const items = photos.map((p) => ({
    id: p.id,
    caption: p.caption,
    album: p.album,
    date: p.taken_on ? formatShortDate(new Date(p.taken_on + 'T12:00:00Z')) : null,
    thumb: mediaUrl('gallery', p.thumb_path) ?? '',
    full: mediaUrl('gallery', p.image_path) ?? '',
  }));

  return (
    <>
      <PageHero crumb="Gallery" title="Gallery" lead="Mixers, hybrid meetings, member spotlights and community events.">
        {member && viewer ? null : (
          <Link className="btn btn-primary" href="/login?next=/gallery">
            Members: upload photos
          </Link>
        )}
      </PageHero>
      <section className="container-site flex flex-col gap-6 pt-8 pb-16">
        {member && viewer ? <UploadPhoto userId={viewer.userId} /> : null}
        {isAdmin(viewer) ? (
          <p className="m-0">
            <Link href="/admin/gallery" className="btn btn-outline btn-sm">
              Edit as admin: captions, albums, remove photos
            </Link>
          </p>
        ) : null}
        <GalleryGrid photos={items} />
      </section>
    </>
  );
}
