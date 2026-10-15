import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { Tables } from './database.types';

export type Viewer = {
  userId: string;
  email: string | null;
  profile: Tables<'profiles'> | null;
};

/** The signed-in user and their profile (cached per request). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return { userId: user.id, email: user.email ?? null, profile };
});

export const isApproved = (v: Viewer | null) => v?.profile?.status === 'approved';
export const isAdmin = (v: Viewer | null) => isApproved(v) && v?.profile?.role === 'admin';

/** For member pages: signed in AND approved, otherwise redirect. */
export async function requireMember(next: string): Promise<Viewer & { profile: Tables<'profiles'> }> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!viewer.profile || viewer.profile.status !== 'approved') redirect('/pending');
  return viewer as Viewer & { profile: Tables<'profiles'> };
}

export async function requireAdmin(): Promise<Viewer & { profile: Tables<'profiles'> }> {
  const viewer = await requireMember('/admin');
  if (viewer.profile.role !== 'admin') redirect('/dashboard');
  return viewer;
}

/** Only allow same-site relative redirect targets. */
export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  return next;
}
