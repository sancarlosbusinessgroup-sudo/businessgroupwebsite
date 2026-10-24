import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { noticeFor } from '@/lib/approval';
import { safeNext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

/** Lands email links (confirm sign-up, magic link, password reset) and starts the session. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const supabase = await createClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const target = url.clone();
  target.search = '';
  // Only approved members stay signed in (owner, 2026-10-24); a password reset may still be finished.
  if (ok && type !== 'recovery' && next !== '/reset-password') {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from('profiles').select('status').eq('id', user.id).maybeSingle() : { data: null };
    if (user && profile?.status !== 'approved') {
      await supabase.auth.signOut({ scope: 'local' });
      const notice = noticeFor(profile?.status);
      target.pathname = '/login';
      target.searchParams.set('notice', (type === 'signup' || (code && !type)) && notice === 'pending' ? 'confirmed' : notice);
      return NextResponse.redirect(target);
    }
  }
  if (ok) {
    target.pathname = next;
  } else {
    target.pathname = '/login';
    target.searchParams.set('error', 'link');
  }
  return NextResponse.redirect(target);
}
