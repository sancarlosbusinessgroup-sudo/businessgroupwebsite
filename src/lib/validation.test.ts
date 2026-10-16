import { describe, expect, it } from 'vitest';
import {
  fieldErrors,
  guestRequestSchema,
  joinSchema,
  newPasswordSchema,
  oneOnOneSchema,
  otpSchema,
  profileSchema,
  leadershipSchema,
  referralSchema,
  referralUpdateSchema,
  seatLimitSchema,
  weeklyAskSchema,
} from './validation';

const okJoin = {
  firstName: 'Ada',
  lastName: 'Park',
  email: 'ada@example.org',
  phone: '(650) 555-0100',
  password: 'correct horse battery',
  businessName: 'Park Studio',
  categoryId: '3',
  website: 'https://park.example.org',
  serviceArea: 'Peninsula',
  idealClient: 'Small teams',
  referralCode: 'AVER-001',
  guestMeetings: '2',
  attend: 'on',
  oneOnOnes: 'on',
  report: 'on',
};

describe('guestRequestSchema', () => {
  it('accepts a valid request and normalises the email', () => {
    const r = guestRequestSchema.safeParse({ firstName: 'A', lastName: 'B', email: ' A@Example.org ', company: '' });
    expect(r.success).toBe(true);
    expect(r.success && r.data.email).toBe('a@example.org');
  });
  it('rejects a bad email and filled honeypot', () => {
    const r = guestRequestSchema.safeParse({ firstName: 'A', lastName: 'B', email: 'nope', company: 'bot' });
    expect(r.success).toBe(false);
    const errs = fieldErrors(r.error!);
    expect(errs.email).toBeDefined();
    expect(errs.company).toBeDefined();
  });
});

describe('joinSchema', () => {
  it('accepts a complete application', () => {
    expect(joinSchema.safeParse(okJoin).success).toBe(true);
  });
  it('requires all three commitments', () => {
    const r = joinSchema.safeParse({ ...okJoin, report: undefined });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!).report).toBeDefined();
  });
  it('rejects short passwords and non-http websites', () => {
    const r = joinSchema.safeParse({ ...okJoin, password: 'short', website: 'javascript:alert(1)' });
    expect(r.success).toBe(false);
    const errs = fieldErrors(r.error!);
    expect(errs.password).toBeDefined();
    expect(errs.website).toBeDefined();
  });
});

describe('otp + passwords', () => {
  it('needs a 6 digit code', () => {
    expect(otpSchema.safeParse({ email: 'a@b.co', code: '12345' }).success).toBe(false);
    expect(otpSchema.safeParse({ email: 'a@b.co', code: '123456' }).success).toBe(true);
  });
  it('new password must match confirmation', () => {
    const r = newPasswordSchema.safeParse({ password: 'abcdefgh1', confirm: 'abcdefgh2' });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!).confirm).toBeDefined();
  });
});

describe('member forms', () => {
  it('referral needs a member and a contact name', () => {
    const r = referralSchema.safeParse({ toId: 'x', contactName: '', warmth: 'warm' });
    expect(r.success).toBe(false);
    const errs = fieldErrors(r.error!);
    expect(errs.toId).toBeDefined();
    expect(errs.contactName).toBeDefined();
  });
  it('referral slip: optional prospect phone/email are checked, consent is a checkbox, no temperature field', () => {
    const toId = '00000000-0000-4000-8000-000000000001';
    const ok = referralSchema.safeParse({
      toId,
      contactName: 'Jo Prospect',
      prospectPhone: '(650) 555-0100',
      prospectEmail: 'JO@Example.org',
      consent: 'on',
    });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.prospectEmail).toBe('jo@example.org');
    expect(ok.success && ok.data.consent).toBe(true);
    const bare = referralSchema.safeParse({ toId, contactName: 'Jo Prospect' });
    expect(bare.success && bare.data.consent).toBe(false);
    const bad = referralSchema.safeParse({ toId, contactName: 'Jo', prospectPhone: 'abc', prospectEmail: 'nope' });
    expect(bad.success).toBe(false);
    const errs = fieldErrors(bad.error!);
    expect(ok.success && 'warmth' in ok.data).toBe(false);
    expect(errs.prospectPhone).toBeDefined();
    expect(errs.prospectEmail).toBeDefined();
  });
  it('referral status update takes the new statuses and no amount', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    for (const status of ['new', 'contacted', 'meeting_set', 'closed_deal', 'not_a_fit']) {
      expect(referralUpdateSchema.safeParse({ id, status }).success, status).toBe(true);
    }
    expect(referralUpdateSchema.safeParse({ id, status: 'closed' }).success).toBe(false);
    expect(referralUpdateSchema.safeParse({ id, status: 'sent' }).success).toBe(false);
  });
  it('one-on-one date must be within the last 14 days', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    const schema = oneOnOneSchema(now);
    const partnerId = '00000000-0000-4000-8000-000000000001';
    expect(schema.safeParse({ partnerId, metOn: '2026-10-12', rating: '4' }).success).toBe(true);
    expect(schema.safeParse({ partnerId, metOn: '2026-09-20' }).success).toBe(false);
    expect(schema.safeParse({ partnerId, metOn: '2026-10-20' }).success).toBe(false);
  });
  it('profile splits services into a list', () => {
    const r = profileSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      businessName: 'C',
      services: 'One, Two ,, Three',
      showInDirectory: 'on',
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.services).toEqual(['One', 'Two', 'Three']);
    expect(r.success && r.data.showInDirectory).toBe(true);
  });
  it('weekly ask is optional and at most 160 characters', () => {
    expect(weeklyAskSchema.safeParse({ weeklyAsk: '' }).success).toBe(true);
    expect(weeklyAskSchema.safeParse({ weeklyAsk: '' }).data?.weeklyAsk).toBeNull();
    expect(weeklyAskSchema.safeParse({ weeklyAsk: '  An intro to a property manager  ' }).data?.weeklyAsk).toBe('An intro to a property manager');
    expect(weeklyAskSchema.safeParse({ weeklyAsk: 'x'.repeat(161) }).success).toBe(false);
  });
});

describe('admin forms', () => {
  it('leadership needs a name and role; member link and sort order are optional', () => {
    const r = leadershipSchema.safeParse({ name: '', role: '' });
    expect(r.success).toBe(false);
    expect(Object.keys(fieldErrors(r.error!))).toEqual(expect.arrayContaining(['name', 'role']));
    const ok = leadershipSchema.safeParse({ name: 'Ada Park', role: 'President', profileId: '', sortOrder: '' });
    expect(ok.success && ok.data).toMatchObject({ name: 'Ada Park', role: 'President', profileId: null, sortOrder: 0 });
    expect(leadershipSchema.safeParse({ name: 'A', role: 'B', profileId: 'not-a-uuid' }).success).toBe(false);
  });
  it('category seat limit is a whole number from 1 to 99', () => {
    expect(seatLimitSchema.safeParse({ id: '3', seatLimit: '2' }).data).toEqual({ id: 3, seatLimit: 2 });
    expect(seatLimitSchema.safeParse({ id: '3', seatLimit: '0' }).success).toBe(false);
    expect(seatLimitSchema.safeParse({ id: '3', seatLimit: '1.5' }).success).toBe(false);
    expect(seatLimitSchema.safeParse({ id: '3', seatLimit: '100' }).success).toBe(false);
  });
});
