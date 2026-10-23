'use server';

import { redirect } from 'next/navigation';
import { safeNext } from '@/lib/auth';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { removeFromList } from '@/lib/email/brevo';
import { deliver, loadAdmins, siteUrl } from '@/lib/email/notify';
import { accountDeletedEmail } from '@/lib/email/templates';
import { createClient } from '@/lib/supabase/server';
import {
  type ActionState,
  changePasswordSchema,
  emailOnlySchema,
  fieldErrors,
  formToObject,
  joinSchema,
  loginSchema,
  newPasswordSchema,
  otpSchema,
} from '@/lib/validation';

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

/** Where to go after logging in: members with a temporary password choose their own first. */
function afterLogin(user: { app_metadata?: Record<string, unknown> } | null, next: string | undefined) {
  const target = safeNext(next);
  if (user?.app_metadata?.must_change_password !== true) return target;
  return target === '/dashboard' ? '/choose-password' : `/choose-password?next=${encodeURIComponent(target)}`;
}

export async function signInWithPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values: withoutSecrets(values) };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const unconfirmed = /confirm/i.test(error.message);
    return {
      status: 'error',
      message: unconfirmed ? 'Please confirm your email first. Check your inbox for the link.' : 'That email and password don’t match our records.',
      values: withoutSecrets(values),
    };
  }
  redirect(afterLogin(data.user, values.next));
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
  const { data, error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.code, type: 'email' });
  if (error) {
    return { status: 'error', errors: { code: 'That code is wrong or has expired' }, values: withoutSecrets(values) };
  }
  redirect(afterLogin(data.user, values.next));
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
  await clearTemporaryPassword(user.id, user.app_metadata?.must_change_password === true).catch(() => undefined);
  redirect('/dashboard');
}

/** Clears the "choose your own password" flag once a member has set a password of their own. */
async function clearTemporaryPassword(userId: string, flagged: boolean) {
  if (!flagged) return;
  const admin = createAdminClient();
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is needed to clear the temporary-password flag');
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: { must_change_password: false } });
  if (error) throw new Error('Could not clear the temporary-password flag');
}

/** First login with a temporary password: the member chooses their own (owner, 2026-10-23). */
export async function chooseOwnPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = newPasswordSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: 'error', message: 'We could not save that password. Please try a different one.' };
  try {
    await clearTemporaryPassword(user.id, user.app_metadata?.must_change_password === true);
  } catch {
    return { status: 'error', message: 'Your password was saved, but something went wrong. Please try again.' };
  }
  redirect(safeNext(values.next));
}

/** My profile → Delete my account (owner chose "Option A", 2026-10-23): the person and their personal data are deleted;
 *  referral slips and one-on-ones shared with others stay as "Former member". */
export async function deleteMyAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (String(formData.get('confirm') ?? '').trim() !== 'DELETE') return { status: 'error', errors: { confirm: 'Type DELETE in capitals to confirm' } };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  const admin = createAdminClient();
  if (!admin) return { status: 'error', message: 'Account deletion is not available right now. Please contact Support.' };
  const { data: me } = await admin.from('profiles').select('first_name, last_name, business_name, role, status').eq('id', user.id).maybeSingle();
  if (me?.role === 'admin' && me.status === 'approved') {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('status', 'approved');
    if ((count ?? 0) <= 1) return { status: 'error', message: 'You are the only admin. Make someone else an admin first, then delete your account.' };
  }
  const admins = (await loadAdmins()).filter((a) => a.id !== user.id);
  // Free any upcoming presentation slots; past ones keep the name for the meeting history.
  const { data: future } = await admin.from('meetings').select('id').gte('starts_at', new Date().toISOString());
  if (future?.length)
    await admin
      .from('meeting_speakers')
      .delete()
      .eq('profile_id', user.id)
      .in(
        'meeting_id',
        future.map((m) => m.id),
      );
  // Photos and logo they uploaded.
  const { data: files } = await admin.storage.from('profile-media').list(user.id, { limit: 100 });
  if (files?.length) await admin.storage.from('profile-media').remove(files.map((f) => `${user.id}/${f.name}`));
  if (user.email) await removeFromList(user.email).catch(() => undefined);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { status: 'error', message: 'Your account could not be deleted. Please try again or contact Support.' };
  await supabase.auth.signOut().catch(() => undefined);
  const name = me ? `${me.first_name} ${me.last_name}` : 'A member';
  for (const a of admins)
    await deliver({
      kind: 'account_deleted',
      dedupeKey: user.id,
      to: { email: a.email, name: `${a.firstName} ${a.lastName}`, profileId: a.id },
      email: accountDeletedEmail({ siteUrl: siteUrl(), toFirstName: a.firstName, name, business: me?.business_name ?? '' }),
    });
  redirect('/?account=deleted');
}

/** My profile → Change password. Checks the current password first. */
export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = changePasswordSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { status: 'error', message: 'Please log in again.' };
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.current });
  if (check.error) return { status: 'error', errors: { current: 'That isn’t your current password.' } };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: 'error', message: 'We could not change your password. Please try a different one.' };
  await clearTemporaryPassword(user.id, user.app_metadata?.must_change_password === true).catch(() => undefined);
  return { status: 'success', message: 'Your password has been changed.' };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
