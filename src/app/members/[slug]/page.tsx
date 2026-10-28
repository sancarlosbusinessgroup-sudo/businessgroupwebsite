import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProfileView } from '@/components/ProfileView';
import { getChampionAwards, getCurrentChampion } from '@/lib/data/champion';
import { getViewer, isAdmin, isApproved } from '@/lib/auth';
import { getMemberBySlug, getPublicPhone } from '@/lib/data/public';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getMemberBySlug(slug);
  return { title: p ? `${p.business_name} · ${p.first_name} ${p.last_name}` : 'Member' };
}

export default async function MemberProfilePage({ params }: Props) {
  const { slug } = await params;
  const [profile, viewer] = await Promise.all([getMemberBySlug(slug), getViewer()]);
  if (!profile) notFound();
  const member = isApproved(viewer);

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

  const [wins, current] = await Promise.all([getChampionAwards(24, profile.id), getCurrentChampion()]);
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
      <ProfileView
        profile={profile}
        contact={{ email, phone, membersOnly: !member }}
        viewerIsMember={member}
        isSelf={viewer?.userId === profile.id}
        champion={champion}
      />
    </div>
  );
}
