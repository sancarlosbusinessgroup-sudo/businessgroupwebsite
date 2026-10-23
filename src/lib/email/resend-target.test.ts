import { describe, expect, it } from 'vitest';
import { resendTarget } from './resend-target';

const ID = 'ee35269a-1ca0-4084-8b2b-53f9940cc081';

describe('resendTarget', () => {
  it('maps member-action notices back to the record they were about', () => {
    expect(resendTarget('referral_received', ID)).toEqual({ event: 'referral_sent', id: ID });
    expect(resendTarget('one_on_one_confirm', ID)).toEqual({ event: 'one_on_one_reported', id: ID });
    expect(resendTarget('one_on_one_request', ID)).toEqual({ event: 'one_on_one_requested', id: ID });
    expect(resendTarget('one_on_one_answer', ID)).toEqual({ event: 'one_on_one_answered', id: ID });
    expect(resendTarget('welcome', ID)).toEqual({ event: 'welcome', id: ID });
  });

  it('all three guest notices re-run the guest request', () => {
    for (const k of ['guest_thanks', 'guest_notice_member', 'guest_notice_admin']) expect(resendTarget(k, ID)).toEqual({ event: 'guest_request', id: ID });
  });

  it('keeps the extra part of keyed notices (referral status, invite day)', () => {
    expect(resendTarget('referral_status', `${ID}:closed_deal`)).toEqual({ event: 'referral_updated', id: ID, extra: 'closed_deal' });
    expect(resendTarget('apply_invite', `${ID}:2026-10-23`)).toEqual({ event: 'apply_invite', id: ID, extra: '2026-10-23' });
  });

  it('refuses scheduled emails (a late reminder or digest is no use) and malformed keys', () => {
    for (const k of ['meeting_reminder', 'visitor_followup', 'member_followup', 'onboarding_reminder', 'admin_digest', 'meeting_recap'])
      expect(resendTarget(k, ID)).toBeNull();
    expect(resendTarget('referral_received', 'not-an-id')).toBeNull();
    expect(resendTarget('referral_status', ID)).toBeNull();
    expect(resendTarget('apply_invite', `${ID}:yesterday`)).toBeNull();
  });
});
