import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice, PageHero } from '@/components/ui';
import { requireMember } from '@/lib/auth';
import { getCategories } from '@/lib/data/public';
import { createClient } from '@/lib/supabase/server';
import { MediaUpload } from '../profile/MediaUpload';
import { ProfileForm } from '../profile/ProfileForm';
import { OnboardingForm } from './OnboardingForm';

export const metadata: Metadata = { title: 'Onboarding' };

export default async function OnboardingPage() {
  const viewer = await requireMember('/onboarding');
  const p = viewer.profile;
  const supabase = await createClient();
  const [categories, contactRes, obRes] = await Promise.all([
    getCategories(),
    supabase.from('member_contacts').select('phone').eq('profile_id', p.id).maybeSingle(),
    supabase.from('member_onboarding').select('completed_at').eq('profile_id', p.id).maybeSingle(),
  ]);
  const done = !!obRes.data?.completed_at;

  return (
    <>
      <PageHero crumb="Members" title="Welcome aboard" lead="Three short steps so members know who you are and who to send your way. About five minutes." />
      <div className="container-site flex max-w-3xl flex-col gap-5 py-10">
        {done ? (
          <Notice tone="success">
            Your onboarding is complete. You can still update anything here or on <Link href="/profile?tab=edit">My profile</Link>.
          </Notice>
        ) : null}
        <section className="card flex flex-col gap-3 p-6" aria-labelledby="ob-photo-h">
          <h2 id="ob-photo-h" className="h3">
            1. Your headshot and logo
          </h2>
          <p className="text-ink-muted m-0 text-sm">A friendly, recent headshot helps members recognise you on Zoom and in the directory.</p>
          <div className="flex flex-wrap items-center gap-4">
            <MediaUpload userId={p.id} kind="avatar" label={p.avatar_path ? 'Change photo' : 'Upload headshot'} />
            <MediaUpload userId={p.id} kind="logo" label={p.logo_path ? 'Change logo' : 'Upload logo'} />
            {p.avatar_path ? <span className="text-green-ink text-sm font-semibold">Photo added ✓</span> : null}
          </div>
        </section>
        <section className="flex flex-col gap-3" aria-labelledby="ob-profile-h">
          <h2 id="ob-profile-h" className="h3">
            2. Confirm your details and how to refer you
          </h2>
          <p className="text-ink-muted m-0 text-sm">
            Check your contact details, then tell members about your ideal client and what to listen for. Press “Save profile” before moving on.
          </p>
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
              showPhonePublic: p.show_phone_public,
            }}
          />
        </section>
        <OnboardingForm done={done} />
      </div>
    </>
  );
}
