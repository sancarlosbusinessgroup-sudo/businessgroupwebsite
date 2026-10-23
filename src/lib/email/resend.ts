// Admin "Resend" for one failed email. Marks the email_log row, re-runs the action that produced it
// inside inRetryScope() (so only that one row can be sent, nobody new is emailed), then reports.
import 'server-only';

import { createAdminClient } from '../supabase/admin';
import {
  onGuestRequest,
  onMemberStatus,
  onOneOnOneAnswered,
  onOneOnOneReported,
  onOneOnOneRequested,
  onReferralSent,
  onReferralUpdated,
  sendApplyInvite,
} from './events';
import { RETRY_MARK, inRetryScope } from './notify';
import { type ResendTarget, resendTarget } from './resend-target';

export type ResendOutcome = 'sent' | 'failed' | 'not_failed' | 'not_resendable' | 'gone' | 'unavailable';

async function rerun(t: ResendTarget): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  switch (t.event) {
    case 'referral_sent':
      await onReferralSent(t.id);
      return true;
    case 'referral_updated': {
      // Only while the referral is still at the status the email was about.
      const { data } = await db.from('referrals').select('status').eq('id', t.id).maybeSingle();
      if (data?.status !== t.extra) return false;
      await onReferralUpdated(t.id);
      return true;
    }
    case 'one_on_one_reported':
      await onOneOnOneReported(t.id);
      return true;
    case 'one_on_one_requested':
      await onOneOnOneRequested(t.id);
      return true;
    case 'one_on_one_answered':
      await onOneOnOneAnswered(t.id);
      return true;
    case 'guest_request':
      await onGuestRequest(t.id);
      return true;
    case 'welcome': {
      const { data } = await db.from('profiles').select('status').eq('id', t.id).maybeSingle();
      if (data?.status !== 'approved') return false;
      await onMemberStatus(t.id, 'approved');
      return true;
    }
    case 'apply_invite':
      return (await sendApplyInvite(t.id, t.extra ?? '')) !== 'not_found';
  }
}

export async function resendFailedEmail(logId: number): Promise<{ outcome: ResendOutcome; error?: string }> {
  const db = createAdminClient();
  if (!db) return { outcome: 'unavailable' };
  const { data: row } = await db.from('email_log').select('id, kind, dedupe_key, status, error').eq('id', logId).maybeSingle();
  if (!row) return { outcome: 'gone' };
  if (row.status !== 'failed') return { outcome: 'not_failed' };
  const target = resendTarget(row.kind, row.dedupe_key);
  if (!target) return { outcome: 'not_resendable' };

  const { data: marked } = await db.from('email_log').update({ error: RETRY_MARK }).eq('id', row.id).eq('status', 'failed').select('id').maybeSingle();
  if (!marked) return { outcome: 'not_failed' };

  await inRetryScope(() => rerun(target)).catch(() => false);

  const { data: after } = await db.from('email_log').select('status, error').eq('id', row.id).single();
  if (after?.status === 'sent') return { outcome: 'sent' };
  if (after?.status === 'failed' && after.error === RETRY_MARK) {
    // The action no longer leads to this email (record deleted, person opted out or no longer admin):
    // put the original error back.
    await db.from('email_log').update({ error: row.error }).eq('id', row.id).eq('error', RETRY_MARK);
    return { outcome: 'gone' };
  }
  return { outcome: 'failed', error: after?.error ?? undefined };
}
