// Members change their own login email (owner, 2026-10-27): a 6-digit code goes to the new address, the member types it
// on My profile, and the server changes the login email (Supabase Auth) and the contact email together.
// Pending requests live in public.email_change_requests, which only the service role can read or write.
import 'server-only';

import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from './supabase/admin';
import { removeFromList, upsertContact } from './email/brevo';
import { deliver, safely, siteUrl } from './email/notify';
import { emailChangeCodeEmail, emailChangedNoticeEmail } from './email/templates';

export const CODE_MINUTES = 15;
export const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

const hash = (profileId: string, code: string) => createHash('sha256').update(`${profileId}:${code}`).digest('hex');

export type Pending = { newEmail: string; expiresAt: string };

/** The member's pending change, if one is still valid. */
export async function pendingEmailChange(profileId: string): Promise<Pending | null> {
  const db = createAdminClient();
  if (!db) return null;
  const { data } = await db.from('email_change_requests').select('new_email, expires_at, attempts').eq('profile_id', profileId).maybeSingle();
  if (!data || Date.parse(data.expires_at) < Date.now() || data.attempts >= MAX_ATTEMPTS) return null;
  return { newEmail: data.new_email, expiresAt: data.expires_at };
}

type StartResult = { ok: true } | { ok: false; reason: 'unavailable' | 'taken' | 'too_soon' | 'send_failed' };

/** Store a new code for `newEmail` and email it there. */
export async function startEmailChange(p: { profileId: string; firstName: string; newEmail: string }): Promise<StartResult> {
  const db = createAdminClient();
  if (!db) return { ok: false, reason: 'unavailable' };
  const newEmail = p.newEmail.trim().toLowerCase();
  const { data: clash } = await db.from('member_contacts').select('profile_id').ilike('email', newEmail).neq('profile_id', p.profileId).limit(1);
  if (clash?.length) return { ok: false, reason: 'taken' };
  const { data: prev } = await db.from('email_change_requests').select('created_at').eq('profile_id', p.profileId).maybeSingle();
  if (prev && Date.now() - Date.parse(prev.created_at) < RESEND_SECONDS * 1000) return { ok: false, reason: 'too_soon' };

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const now = new Date();
  const { error } = await db.from('email_change_requests').upsert({
    profile_id: p.profileId,
    new_email: newEmail,
    code_hash: hash(p.profileId, code),
    attempts: 0,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString(),
  });
  if (error) return { ok: false, reason: 'unavailable' };
  const sent = await deliver({
    kind: 'email_change_code',
    dedupeKey: `${p.profileId}:${now.getTime()}`,
    to: { email: newEmail, name: p.firstName, profileId: p.profileId },
    email: emailChangeCodeEmail({ siteUrl: siteUrl(), firstName: p.firstName, code }),
  });
  if (sent !== 'sent') {
    await db.from('email_change_requests').delete().eq('profile_id', p.profileId);
    return { ok: false, reason: 'send_failed' };
  }
  return { ok: true };
}

type ConfirmResult = { ok: true; newEmail: string } | { ok: false; reason: 'none' | 'expired' | 'wrong' | 'locked' | 'taken' | 'unavailable'; left?: number };

/** Check the code; when it matches, change the login and contact email and tell the old address. */
export async function confirmEmailChange(p: { profileId: string; code: string }): Promise<ConfirmResult> {
  const db = createAdminClient();
  if (!db) return { ok: false, reason: 'unavailable' };
  const { data: req } = await db.from('email_change_requests').select('*').eq('profile_id', p.profileId).maybeSingle();
  if (!req) return { ok: false, reason: 'none' };
  if (Date.parse(req.expires_at) < Date.now()) return { ok: false, reason: 'expired' };
  if (req.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'locked' };
  const given = Buffer.from(hash(p.profileId, p.code.trim()));
  const stored = Buffer.from(req.code_hash);
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
    const attempts = req.attempts + 1;
    await db.from('email_change_requests').update({ attempts }).eq('profile_id', p.profileId);
    return attempts >= MAX_ATTEMPTS ? { ok: false, reason: 'locked' } : { ok: false, reason: 'wrong', left: MAX_ATTEMPTS - attempts };
  }

  const [{ data: profile }, { data: contact }] = await Promise.all([
    db.from('profiles').select('first_name, last_name, business_name, status').eq('id', p.profileId).maybeSingle(),
    db.from('member_contacts').select('email').eq('profile_id', p.profileId).maybeSingle(),
  ]);
  const { error } = await db.auth.admin.updateUserById(p.profileId, { email: req.new_email, email_confirm: true });
  if (error) return /already|exists|registered/i.test(error.message) ? { ok: false, reason: 'taken' } : { ok: false, reason: 'unavailable' };
  await db.from('member_contacts').update({ email: req.new_email }).eq('profile_id', p.profileId);
  await db.from('email_change_requests').delete().eq('profile_id', p.profileId);

  const oldEmail = contact?.email ?? null;
  const firstName = profile?.first_name ?? 'there';
  await safely('email changed notice', async () => {
    if (oldEmail && oldEmail.toLowerCase() !== req.new_email.toLowerCase())
      await deliver({
        kind: 'email_changed_notice',
        dedupeKey: `${p.profileId}:${Date.now()}`,
        to: { email: oldEmail, name: firstName, profileId: p.profileId },
        email: emailChangedNoticeEmail({ siteUrl: siteUrl(), firstName, newEmail: req.new_email }),
      });
  });
  // Keep the newsletter list on the new address.
  await safely('newsletter email change', async () => {
    if (profile?.status !== 'approved') return;
    if (oldEmail) await removeFromList(oldEmail);
    await upsertContact({ email: req.new_email, firstName: profile.first_name, lastName: profile.last_name, business: profile.business_name });
  });
  return { ok: true, newEmail: req.new_email };
}

export async function cancelEmailChange(profileId: string): Promise<void> {
  const db = createAdminClient();
  if (db) await db.from('email_change_requests').delete().eq('profile_id', profileId);
}
