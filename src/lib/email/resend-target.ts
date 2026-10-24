// Which failed emails an admin can resend, and which original action each one came from.
// Pure (no database) so it can be unit-tested; the resend itself is in resend.ts.

export type ResendEvent =
  | 'referral_sent'
  | 'referral_updated'
  | 'one_on_one_reported'
  | 'one_on_one_requested'
  | 'one_on_one_answered'
  | 'guest_request'
  | 'welcome'
  | 'apply_invite'
  | 'guest_zoom_link';

export type ResendTarget = { event: ResendEvent; id: string; extra?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const byKind: Record<string, ResendEvent> = {
  referral_received: 'referral_sent',
  one_on_one_confirm: 'one_on_one_reported',
  one_on_one_request: 'one_on_one_requested',
  one_on_one_answer: 'one_on_one_answered',
  guest_thanks: 'guest_request',
  guest_notice_member: 'guest_request',
  guest_notice_admin: 'guest_request',
  welcome: 'welcome',
};

/**
 * Scheduled emails (meeting reminder, follow-ups, digest, recap) are not resendable: by the time
 * someone notices, they are out of date. Returns null for those and for keys that don't parse.
 */
export function resendTarget(kind: string, dedupeKey: string): ResendTarget | null {
  if (byKind[kind]) return UUID.test(dedupeKey) ? { event: byKind[kind], id: dedupeKey } : null;
  const [id, extra, ...rest] = dedupeKey.split(':');
  if (rest.length || !id || !extra || !UUID.test(id)) return null;
  if (kind === 'referral_status' && /^[a-z_]+$/.test(extra)) return { event: 'referral_updated', id, extra };
  if (kind === 'apply_invite' && /^\d{4}-\d{2}-\d{2}$/.test(extra)) return { event: 'apply_invite', id, extra };
  if (kind === 'guest_zoom_link' && /^\d{4}-\d{2}-\d{2}$/.test(extra)) return { event: 'guest_zoom_link', id, extra };
  return null;
}
