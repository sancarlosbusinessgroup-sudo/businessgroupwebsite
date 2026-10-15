import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProfileView } from '@/components/ProfileView';
import { Notice } from '@/components/ui';
import { getViewer } from '@/lib/auth';
import { getCategories, getPublicStats } from '@/lib/data/public';
import { createClient } from '@/lib/supabase/server';
import { MediaUpload } from './MediaUpload';
import { ProfileForm } from './ProfileForm';

export const metadata: Metadata = { title: 'My profile' };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/profile');
  const p = viewer.profile;
  if (!p) redirect('/pending');
  const approved = p.status === 'approved';
  const editing = tab === 'edit' || !approved;

  const supabase = await createClient();
  const [categories, contactRes, catRes] = await Promise.all([
    getCategories(),
    supabase.from('member_contacts').select('email, phone').eq('profile_id', p.id).maybeSingle(),
    p.category_id ? supabase.from('categories').select('name').eq('id', p.category_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const stats = approved && !editing ? await getPublicStats(p.slug) : null;
  const tabCls = (on: boolean) =>
    `flex min-h-11 items-center rounded-full px-5 font-display text-sm font-bold no-underline ${on ? 'bg-surface text-heading' : 'text-ink-muted'}`;

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-5 pt-6 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="sr-only">My profile</h1>
          {approved ? (
            <nav aria-label="Profile mode" className="bg-line-soft flex gap-1.5 rounded-full p-1">
              <Link href="/profile" className={tabCls(!editing)} aria-current={!editing ? 'page' : undefined}>
                Public view
              </Link>
              <Link href="/profile?tab=edit" className={tabCls(editing)} aria-current={editing ? 'page' : undefined}>
                Edit profile
              </Link>
            </nav>
          ) : (
            <Notice tone="info">You can edit your profile now. It appears in the directory once you&apos;re approved.</Notice>
          )}
          {approved ? <span className="text-ink-muted text-sm">This is how visitors see your listing in the directory.</span> : null}
        </div>

        {editing ? (
          <>
            {approved ? (
              <div className="card flex flex-wrap items-center gap-4 p-5">
                <span className="font-display text-heading font-bold">Photos</span>
                <MediaUpload userId={p.id} kind="avatar" label="Change photo" />
                <MediaUpload userId={p.id} kind="logo" label="Upload logo" />
                <span className="text-ink-muted text-sm">Images are resized in your browser before upload.</span>
              </div>
            ) : null}
            <ProfileForm
              categories={categories}
              defaults={{
                firstName: p.first_name,
                lastName: p.last_name,
                businessName: p.business_name,
                categoryId: p.category_id ? String(p.category_id) : '',
                website: p.website ?? '',
                phone: contactRes.data?.phone ?? '',
                city: p.city ?? '',
                serviceArea: p.service_area ?? '',
                about: p.about ?? '',
                idealClient: p.ideal_client ?? '',
                listenFor: p.listen_for ?? '',
                services: p.services.join(', '),
                showInDirectory: p.show_in_directory,
                showStats: p.show_stats,
                showPhonePublic: p.show_phone_public,
              }}
            />
          </>
        ) : (
          <ProfileView
            profile={{ ...p, categories: catRes.data ? { name: catRes.data.name } : null }}
            stats={stats}
            contact={{ email: contactRes.data?.email ?? null, phone: contactRes.data?.phone ?? null, membersOnly: false }}
            viewerIsMember
            isSelf
          />
        )}
      </div>
    </div>
  );
}
