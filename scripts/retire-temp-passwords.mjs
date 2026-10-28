#!/usr/bin/env node
// Retire the shared temporary password ("BARP") on accounts that have never signed in (audit, 2026-10-27).
//
// For each approved member whose account has never been used, this:
//   1. replaces the password with a long random one nobody knows (so the shared temporary password stops working), and
//   2. sends them the normal "reset your password" email, which lands on /reset-password where they pick their own.
//
// Dry run (lists who would be affected, changes nothing):
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… node scripts/retire-temp-passwords.mjs
// Do it:
//   … node scripts/retire-temp-passwords.mjs --apply
// Only some people (comma-separated emails):
//   … node scripts/retire-temp-passwords.mjs --apply --only=a@x.com,b@y.com
//
// Tell members first: the email says "reset your password", and people who never used the site may not expect it.

import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bayareareferralpartners.com').replace(/\/$/, '');
if (!url || !serviceKey || !anonKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY first.');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const only = (process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

// Everyone approved; then keep those who have never signed in.
const { data: profiles, error } = await admin.from('profiles').select('id, first_name, last_name, role, member_contacts(email)').eq('status', 'approved');
if (error) throw error;
const targets = [];
for (const p of profiles) {
  const { data } = await admin.auth.admin.getUserById(p.id);
  const u = data?.user;
  if (!u || u.last_sign_in_at) continue;
  const contact = Array.isArray(p.member_contacts) ? p.member_contacts[0] : p.member_contacts;
  const email = (u.email ?? contact?.email ?? '').toLowerCase();
  if (!email) continue;
  if (only.length && !only.includes(email)) continue;
  targets.push({ id: p.id, name: `${p.first_name} ${p.last_name}`, role: p.role, email });
}
targets.sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));

console.log(`${targets.length} account${targets.length === 1 ? '' : 's'} never signed in${apply ? '' : ' (dry run; add --apply to change them)'}:`);
for (const t of targets) console.log(`  ${t.role.padEnd(6)} ${t.name.padEnd(24)} ${t.email}`);
if (!apply) process.exit(0);

let ok = 0;
for (const t of targets) {
  const newPassword = randomBytes(24).toString('base64url');
  const { error: e1 } = await admin.auth.admin.updateUserById(t.id, { password: newPassword });
  if (e1) {
    console.error(`  FAILED to change password for ${t.email}: ${e1.message}`);
    continue;
  }
  const { error: e2 } = await anon.auth.resetPasswordForEmail(t.email, { redirectTo: `${siteUrl}/auth/callback?next=/reset-password` });
  if (e2) {
    console.error(`  password changed but reset email FAILED for ${t.email}: ${e2.message} (they can use "Forgot password" on the login page)`);
    continue;
  }
  ok += 1;
  console.log(`  done: ${t.email}`);
  await new Promise((r) => setTimeout(r, 1200)); // stay under the auth email rate limit
}
console.log(`${ok} of ${targets.length} done.`);
