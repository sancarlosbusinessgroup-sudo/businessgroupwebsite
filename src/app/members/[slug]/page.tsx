import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProfileView } from '@/components/ProfileView';
import { getViewer, isApproved } from '@/lib/auth';
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

  return (
    <div className="container-site flex flex-col gap-4 py-8">
      <nav aria-label="Breadcrumb" className="text-ink-muted text-sm">
        <Link href="/">Home</Link> / <Link href="/members">Members</Link> / <span aria-current="page">{profile.business_name}</span>
      </nav>
      <ProfileView profile={profile} contact={{ email, phone, membersOnly: !member }} viewerIsMember={member} isSelf={viewer?.userId === profile.id} />
    </div>
  );
}
