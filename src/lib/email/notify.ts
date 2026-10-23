// Delivery rules for every site email: look up the recipient (service role), respect their
// email preferences, send each notice only once (email_log unique key), and never throw.
import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { createAdminClient } from '../supabase/admin';
import { env } from '../env';
import { sendEmail } from './brevo';
import type { Email } from './templates';

import type { PrefKey } from './prefs';

export type Recipient = { id: string; email: string; firstName: string; lastName: string; role: string; status: string };

export function siteUrl() {
  return env.siteUrl;
}

/** Load recipients (approved or not) with their private email. */
export async function loadRecipients(ids: string[]): Promise<Map<string, Recipient>> {
  const out = new Map<string, Recipient>();
  const db = createAdminClient();
  if (!db || ids.length === 0) return out;
  const { data } = await db.from('profiles').select('id, first_name, last_name, role, status, member_contacts(email)').in('id', ids);
  for (const p of data ?? []) {
    const c = p.member_contacts as unknown as { email: string } | { email: string }[] | null;
    const email = Array.isArray(c) ? c[0]?.email : c?.email;
    if (email) out.set(p.id, { id: p.id, email, firstName: p.first_name, lastName: p.last_name, role: p.role, status: p.status });
  }
  return out;
}

export async function loadAdmins(): Promise<Recipient[]> {
  const db = createAdminClient();
  if (!db) return [];
  const { data } = await db.from('profiles').select('id').eq('role', 'admin').eq('status', 'approved');
  const map = await loadRecipients((data ?? []).map((r) => r.id));
  return [...map.values()];
}

/** Which optional emails each profile has turned off. */
export async function loadOptOuts(ids: string[], key: PrefKey): Promise<Set<string>> {
  const off = new Set<string>();
  const db = createAdminClient();
  if (!db || ids.length === 0) return off;
  const { data } = await db.from('email_preferences').select('profile_id, prefs').in('profile_id', ids);
  for (const r of data ?? []) {
    const prefs = (r.prefs ?? {}) as Record<string, unknown>;
    if (prefs[key] === false) off.add(r.profile_id);
  }
  return off;
}

/** Marker an admin's "Resend" puts on a failed email_log row (status stays 'failed' until it is sent again). */
export const RETRY_MARK = 'retry requested';

// While an admin resend runs, deliver() sends nothing new: it only re-sends the email_log row
// marked RETRY_MARK, so re-running an event never reaches people who weren't on the original email.
const retryScope = new AsyncLocalStorage<true>();
export function inRetryScope<T>(fn: () => Promise<T>): Promise<T> {
  return retryScope.run(true, fn);
}

/**
 * Send one email once. Claims (kind, dedupeKey, recipient) in email_log first; if the row already
 * exists the email went out before (or failed) and nothing is sent. Inside inRetryScope() it instead
 * claims the existing failed row that an admin marked for resending. Returns the final status.
 */
export async function deliver(o: {
  kind: string;
  dedupeKey: string;
  to: { email: string; name?: string; profileId?: string | null };
  email: Email;
}): Promise<'sent' | 'skipped' | 'failed' | 'duplicate'> {
  try {
    const db = createAdminClient();
    if (!db) return 'skipped';
    const recipient = o.to.email.toLowerCase().slice(0, 254);
    const dedupeKey = o.dedupeKey.slice(0, 200);
    const { data: claim, error } = retryScope.getStore()
      ? await db
          .from('email_log')
          .update({ status: 'skipped', error: 'sending' })
          .eq('kind', o.kind)
          .eq('dedupe_key', dedupeKey)
          .eq('recipient', recipient)
          .eq('status', 'failed')
          .eq('error', RETRY_MARK)
          .select('id')
          .maybeSingle()
      : await db
          .from('email_log')
          .insert({
            kind: o.kind,
            dedupe_key: dedupeKey,
            recipient,
            profile_id: o.to.profileId ?? null,
            subject: o.email.subject.slice(0, 300),
            status: 'skipped',
            error: 'sending',
          })
          .select('id')
          .single();
    if (error || !claim) return 'duplicate';
    const r = await sendEmail({ to: { email: o.to.email, name: o.to.name }, subject: o.email.subject, html: o.email.html, text: o.email.text, tag: o.kind });
    await db
      .from('email_log')
      .update({ status: r.status, error: r.error?.slice(0, 500) ?? null })
      .eq('id', claim.id);
    return r.status;
  } catch (e) {
    console.error('[email] deliver failed', o.kind, e instanceof Error ? e.message : e);
    return 'failed';
  }
}

/** Send an optional (preference-controlled) notice to members by id. */
export async function notifyMembers(
  ids: (string | null | undefined)[],
  o: { kind: string; dedupeKey: string; pref: PrefKey | null; build: (r: Recipient) => Email },
): Promise<void> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (unique.length === 0) return;
  const people = await loadRecipients(unique);
  const off = o.pref ? await loadOptOuts(unique, o.pref) : new Set<string>();
  for (const r of people.values()) {
    if (off.has(r.id)) continue;
    await deliver({ kind: o.kind, dedupeKey: o.dedupeKey, to: { email: r.email, name: `${r.firstName} ${r.lastName}`, profileId: r.id }, email: o.build(r) });
  }
}

/** Run email work after the response is sent; failures are logged and never reach the user. */
export async function safely(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[email] ${label} failed`, e instanceof Error ? e.message : e);
  }
}
