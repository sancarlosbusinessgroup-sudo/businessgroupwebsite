import { describe, expect, it } from 'vitest';
import {
  fieldErrors,
  guestRequestSchema,
  joinSchema,
  newPasswordSchema,
  oneOnOneSchema,
  otpSchema,
  profileSchema,
  referralSchema,
  referralUpdateSchema,
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
  it('closing a referral requires an amount', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(referralUpdateSchema.safeParse({ id, status: 'closed' }).success).toBe(false);
    expect(referralUpdateSchema.safeParse({ id, status: 'closed', closedAmount: '1200' }).success).toBe(true);
    expect(referralUpdateSchema.safeParse({ id, status: 'contacted' }).success).toBe(true);
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
    expect(r.success && r.data.showStats).toBe(false);
  });
});
