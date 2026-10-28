import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { noticeFor } from './lib/approval';
import type { Database } from './lib/database.types';

/** Pages still open while a member must choose a new password. */
const CHOOSE_OK = ['/choose-password', '/auth', '/login', '/forgot-password', '/reset-password', '/privacy', '/terms'];

const MEMBER_PATHS = [
  '/dashboard',
  '/meetings',
  '/referrals',
  '/closed-business',
  '/one-on-ones',
  '/profile',
  '/admin',
  '/pending',
  '/present',
  '/events/new',
  '/onboarding',
];

/** Pages a signed-in account that is not approved may still open: the email links and choosing a new password. */
const NOT_APPROVED_OK = ['/auth', '/reset-password'];

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out
 * visitors away from member pages. Approval and admin checks happen on each page
 * (and are enforced again by RLS in the database).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims() checks the session token's signature locally (one network call for the signing keys, then cached)
  // instead of asking the Auth server on every request (audit, 2026-10-27); each page re-checks the user anyway.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims ? { id: claims.claims.sub, app_metadata: (claims.claims.app_metadata ?? {}) as Record<string, unknown> } : null;

  const path = request.nextUrl.pathname;
  // Only approved members can be logged in (owner, 2026-10-24): any other account is signed out and told why.
  // Only full page loads sign out: link prefetches and in-app requests (which carry Next's `next-url` / `rsc` headers or a
  // non-document fetch destination) must not end the session of someone finishing a password reset.
  const dest = request.headers.get('sec-fetch-dest');
  const background =
    request.headers.has('next-url') || request.headers.has('rsc') || request.headers.has('next-router-prefetch') || (dest !== null && dest !== 'document');
  if (user && !background && !NOT_APPROVED_OK.some((p) => path === p || path.startsWith(`${p}/`))) {
    const { data: profile } = await supabase.from('profiles').select('status').eq('id', user.id).maybeSingle();
    if (profile?.status !== 'approved') {
      await supabase.auth.signOut({ scope: 'local' });
      const login = request.nextUrl.clone();
      login.pathname = '/login';
      login.search = `?notice=${noticeFor(profile?.status)}`;
      const out = NextResponse.redirect(login);
      for (const c of response.cookies.getAll()) out.cookies.set(c);
      return out;
    }
  }
  // Members given a temporary password must choose their own before using the site (owner, 2026-10-23).
  if (user?.app_metadata?.must_change_password === true && !CHOOSE_OK.some((p) => path === p || path.startsWith(`${p}/`))) {
    const choose = request.nextUrl.clone();
    choose.pathname = '/choose-password';
    choose.search = path === '/' ? '' : `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(choose);
  }
  if (!user && MEMBER_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|images/|seed/|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)'],
};
