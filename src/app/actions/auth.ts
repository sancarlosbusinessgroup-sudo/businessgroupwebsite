'use server';

import { redirect } from 'next/navigation';
import { safeNext } from '@/lib/auth';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { type ActionState, emailOnlySchema, fieldErrors, formToObject, joinSchema, loginSchema, newPasswordSchema, otpSchema } from '@/lib/validation';

const callback = (next: string) => `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
const withoutSecrets = (v: Record<string, string>) => {
  const rest = { ...v };
  delete rest.password;
  delete rest.confirm;
  delete rest.code;
  return rest;
};

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = joinSchema.safeParse(values);
  if (!parsed.success) {
    return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values: withoutSecrets(values) };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      emailRedirectTo: callback('/pending'),
      data: {
        first_name: d.firstName,
        last_name: d.lastName,
        phone: d.phone,
        business_name: d.businessName,
        category_id: String(d.categoryId),
        website: d.website ?? '',
        referral_code: d.referralCode ?? '',
        guest_meetings_attended: d.guestMeetings,
        agreed_commitments: 'true',
        application: d.application,
      },
    },
  });
  if (error) {
    const taken = /registered|exists/i.test(error.message);
    return {
      status: 'error',
      message: taken ? 'An account with this email already exists. Try logging in instead.' : 'We could not create your account. Please try again.',
      errors: taken ? { email: 'This email already has an account' } : undefined,
      values: withoutSecrets(values),
    };
  }
  // Supabase returns a user with no identities when the email is already registered (to avoid account enumeration).
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return {
      status: 'error',
      message: 'An account with this email already exists. Try logging in instead.',
      errors: { email: 'This email already has an account' },
      values: withoutSecrets(values),
    };
  }
  return { status: 'success', message: data.session ? 'signed-in' : 'confirm-email', values: { email: d.email } };
}

export async function signInWithPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values: withoutSecrets(values) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const unconfirmed = /confirm/i.test(error.message);
    return {
      status: 'error',
      message: unconfirmed ? 'Please confirm your email first. Check your inbox for the link.' : 'That email and password don’t match our records.',
      values: withoutSecrets(values),
    };
  }
  redirect(safeNext(values.next));
}

export async function sendLoginCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = emailOnlySchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: callback(safeNext(values.next)) },
  });
  // Don't reveal whether an account exists; only surface rate limiting.
  if (error && /rate|seconds/i.test(error.message)) {
    return { status: 'error', message: 'Please wait a minute before asking for another code.', values };
  }
  return { status: 'success', values: { email: parsed.data.email, next: values.next ?? '' } };
}

export async function verifyLoginCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = otpSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values: withoutSecrets(values) };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.code, type: 'email' });
  if (error) {
    return { status: 'error', errors: { code: 'That code is wrong or has expired' }, values: withoutSecrets(values) };
  }
  redirect(safeNext(values.next));
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = emailOnlySchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: callback('/reset-password') });
  if (error && /rate|seconds/i.test(error.message)) {
    return { status: 'error', message: 'Please wait a minute before trying again.', values };
  }
  return { status: 'success', values: { email: parsed.data.email } };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = newPasswordSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Your reset link has expired. Please request a new one.' };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: 'error', message: 'We could not update your password. Please try a different one.' };
  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
