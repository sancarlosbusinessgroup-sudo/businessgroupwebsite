import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProfileView } from '@/components/ProfileView';
import { getChampionAwards, getCurrentChampion } from '@/lib/data/champion';
import { getViewer, isAdmin, isApproved } from '@/lib/auth';
import { PUBLIC_PROFILE_COLUMNS, getMemberBySlug, getMemberPhotos, getPublicPhone, type PublicProfile } from '@/lib/data/public';
import { GalleryGrid } from '@/app/gallery/GalleryGrid';
import { formatShortDate } from '@/lib/dates';
import { mediaUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = (await getMemberBySlug(slug)) ?? (isApproved(await getViewer()) ? await hiddenProfileForMember(slug) : null);
  return { title: p ? `${p.business_name} · ${p.first_name} ${p.last_name}` : 'Member' };
}

/**
 * Accounts hidden from the public directory (the support team: Cedrick, Shermaine, Rachanee) are still visible to
 * signed-in members, so their profile opens from the Support page (owner, 2026-10-31). Visitors still get "not found".
 * The member's own session is used, so the database's member read rule decides what they may see.
 */
async function hiddenProfileForMember(slug: string): Promise<PublicProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select(`${PUBLIC_PROFILE_COLUMNS}, categories(name)`)
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle();
  return (data as PublicProfile | null) ?? null;
}

export default async function MemberProfilePage({ params }: Props) {
  const { slug } = await params;
  const [publicProfile, viewer] = await Promise.all([getMemberBySlug(slug), getViewer()]);
  const member = isApproved(viewer);
  const profile = publicProfile ?? (member ? await hiddenProfileForMember(slug) : null);
  if (!profile) notFound();

  let email: string | null = null;
  let phone: string | null = null;
  if (member) {
    const supabase = await createClient();
    const { data } = await supabase.from('member_contacts').select('email, phone').eq('profile_id', profile.id).maybeSingle();
    email = data?.email ?? null;
    phone = data?.phone ?? null;
  } else {
    phone = await getPublicPhone(slug);
  }

  const [wins, current, photos] = await Promise.all([getChampionAwards(24, profile.id), getCurrentChampion(), getMemberPhotos(profile.id)]);
  const isSelf = viewer?.userId === profile.id;
  const champion = { current: current?.profileId === profile.id ? current.label : null, past: wins.map((w) => w.label) };

  return (
    <div className="container-site flex flex-col gap-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="text-ink-muted text-sm">
          <Link href="/">Home</Link> / <Link href="/members">Members</Link> / <span aria-current="page">{profile.business_name}</span>
        </nav>
        {isAdmin(viewer) && viewer?.userId !== profile.id ? (
          <Link href={`/admin/members/${profile.id}`} className="btn btn-outline btn-sm">
            Edit as admin
          </Link>
        ) : null}
      </div>
      <ProfileView profile={profile} contact={{ email, phone, membersOnly: !member }} viewerIsMember={member} isSelf={isSelf} champion={champion} />
      {/* The member's own gallery (owner, 2026-11-24): photos they're tagged in (approved) or uploaded. */}
      {photos.length || isSelf ? (
        <section className="card flex flex-col gap-4 p-6" aria-labelledby="member-photos-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="member-photos-h" className="font-display m-0 text-xl font-extrabold">
              Photos{photos.length ? ` (${photos.length})` : ''}
            </h2>
            {isSelf ? (
              <Link href="/gallery" className="btn btn-outline btn-sm">
                Upload photos
              </Link>
            ) : null}
          </div>
          {photos.length ? (
            <GalleryGrid
              photos={photos.map((p) => ({
                id: p.id,
                caption: p.caption,
                album: p.album,
                date: p.taken_on ? formatShortDate(new Date(p.taken_on + 'T12:00:00Z')) : null,
                thumb: mediaUrl('gallery', p.thumb_path) ?? '',
                full: mediaUrl('gallery', p.image_path) ?? '',
              }))}
            />
          ) : (
            <p className="text-ink-muted m-0">No photos yet. Upload one in the Gallery and tag yourself (and anyone else in it) to show it here.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
