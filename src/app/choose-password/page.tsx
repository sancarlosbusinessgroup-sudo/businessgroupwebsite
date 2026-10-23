import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewer, safeNext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ChooseForm } from './ChooseForm';

export const metadata: Metadata = { title: 'Choose your password' };

/** Shown after logging in with a temporary password (owner, 2026-10-23). */
export default async function ChoosePasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/choose-password');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.app_metadata?.must_change_password !== true) redirect(safeNext(next));
  return (
    <section className="container-site flex justify-center py-16">
      <div className="card flex w-full max-w-[480px] flex-col gap-4 p-7">
        <h1 className="font-display m-0 text-[28px] font-extrabold">Choose your password</h1>
        <p className="text-ink-soft m-0">
          Welcome{viewer.profile?.first_name ? `, ${viewer.profile.first_name}` : ''}! You logged in with a temporary password. Please choose your own password
          to continue. You&apos;ll use it from now on.
        </p>
        <ChooseForm next={safeNext(next)} />
      </div>
    </section>
  );
}
