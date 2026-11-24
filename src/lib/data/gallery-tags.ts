import 'server-only';

import { mediaUrl } from '../env';
import { createClient } from '../supabase/server';

// Gallery tag approvals for the signed-in member (owner, 2026-11-24). Uses the member's own session: the database lets
// them see photos they uploaded or are tagged in, even before those photos are live.

export type TagRequest = { photoId: string; caption: string; thumb: string; full: string; uploader: string; status: 'pending' | 'approved' | 'declined' };
export type WaitingPhoto = { photoId: string; caption: string; thumb: string; tags: { name: string; status: 'pending' | 'approved' | 'declined' }[] };

type Person = { first_name: string; last_name: string } | null;
const one = <T>(x: T | T[] | null): T | null => (Array.isArray(x) ? (x[0] ?? null) : x);

/** Photos I'm tagged in that are waiting for my answer (and ones I said no to, so I can change my mind). */
export async function loadMyTagRequests(userId: string): Promise<TagRequest[]> {
  const db = await createClient();
  const { data } = await db
    .from('gallery_tags')
    .select(
      'status, photo:gallery_photos(id, caption, thumb_path, image_path, uploaded_by, uploader:profiles!gallery_photos_uploaded_by_fkey(first_name, last_name))',
    )
    .eq('profile_id', userId)
    .in('status', ['pending', 'declined'])
    .order('created_at', { ascending: false })
    .limit(30);
  return (data ?? []).flatMap((t) => {
    const p = one(t.photo as unknown) as {
      id: string;
      caption: string;
      thumb_path: string;
      image_path: string;
      uploaded_by: string | null;
      uploader: Person | Person[];
    } | null;
    if (!p || p.uploaded_by === userId) return [];
    const up = one(p.uploader);
    return [
      {
        photoId: p.id,
        caption: p.caption,
        thumb: mediaUrl('gallery', p.thumb_path) ?? '',
        full: mediaUrl('gallery', p.image_path) ?? '',
        uploader: up ? `${up.first_name} ${up.last_name}` : 'A member',
        status: t.status,
      },
    ];
  });
}

/** My uploads that aren't live yet because someone tagged hasn't approved (or said no). */
export async function loadMyWaitingPhotos(userId: string): Promise<WaitingPhoto[]> {
  const db = await createClient();
  const { data: tags } = await db
    .from('gallery_tags')
    .select(
      'photo_id, status, profile:profiles!gallery_tags_profile_id_fkey(first_name, last_name), photo:gallery_photos!inner(caption, thumb_path, uploaded_by)',
    )
    .eq('photo.uploaded_by', userId)
    .limit(300);
  const byPhoto = new Map<string, WaitingPhoto>();
  for (const t of tags ?? []) {
    const p = one(t.photo as unknown) as { caption: string; thumb_path: string } | null;
    if (!p) continue;
    const who = one(t.profile as unknown as Person | Person[]);
    const entry = byPhoto.get(t.photo_id) ?? { photoId: t.photo_id, caption: p.caption, thumb: mediaUrl('gallery', p.thumb_path) ?? '', tags: [] };
    entry.tags.push({ name: who ? `${who.first_name} ${who.last_name}` : 'A member', status: t.status });
    byPhoto.set(t.photo_id, entry);
  }
  return [...byPhoto.values()].filter((p) => p.tags.some((t) => t.status !== 'approved'));
}

/** Approved members to tag, A–Z (support staff accounts are hidden from the directory and left out). */
export async function loadTagOptions(): Promise<{ id: string; name: string }[]> {
  const db = await createClient();
  const { data } = await db
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('status', 'approved')
    .eq('show_in_directory', true)
    .order('first_name')
    .order('last_name');
  return (data ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }));
}
