import { describe, expect, it } from 'vitest';
import {
  fieldErrors,
  guestRequestSchema,
  joinSchema,
  newPasswordSchema,
  oneOnOneRequestSchema,
  oneOnOneSchema,
  profileSchema,
  leadershipSchema,
  memberEventSchema,
  slideNotesSchema,
  slideSettingsSchema,
  speakerTopicSchema,
  referralSchema,
  referralUpdateSchema,
  seatLimitSchema,
  visitorSignInSchema,
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
  businessAddress: '1 Main St, San Carlos, CA',
  yearsInBusiness: '6 years',
  productService: 'Brand and web design for local businesses.',
  credentials: 'BFA, Graphic Design',
  networkingGroups: 'Chamber of Commerce',
  ref1Name: 'Lee Client',
  ref1Business: 'Client Co',
  ref1Email: 'lee@example.org',
  ref1Phone: '',
  ref1Website: '',
  ref2Name: 'Sam Partner',
  ref2Business: 'Partner LLC',
  ref2Email: '',
  ref2Phone: '(650) 555-0199',
  ref2Website: 'https://partner.example.org',
  referralCode: 'AVER-001',
  guestMeetings: '2',
  agree: 'on',
  signature: 'Ada Park',
};

describe('guestRequestSchema', () => {
  it('accepts a valid request and normalises the email', () => {
    const r = guestRequestSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      email: ' A@Example.org ',
      phone: '650-555-0100',
      businessDescription: ' Residential plumbing and water-heater repair on the Peninsula. ',
      company: '',
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.email).toBe('a@example.org');
    expect(r.success && r.data.businessDescription).toBe('Residential plumbing and water-heater repair on the Peninsula.');
  });
  it('asks the guest to describe their business, up to 1000 characters (owner, 2026-10-30)', () => {
    const base = { firstName: 'A', lastName: 'B', email: 'a@example.org', phone: '650-555-0100' };
    expect(fieldErrors(guestRequestSchema.safeParse(base).error!).businessDescription).toBe('Tell us about your business is required');
    expect(fieldErrors(guestRequestSchema.safeParse({ ...base, businessDescription: '   ' }).error!).businessDescription).toBeDefined();
    expect(guestRequestSchema.safeParse({ ...base, businessDescription: 'x'.repeat(1001) }).success).toBe(false);
    // The meeting sign-in form keeps it optional.
    expect(visitorSignInSchema.safeParse(base).success).toBe(true);
  });
  it('rejects a bad email and filled honeypot', () => {
    const r = guestRequestSchema.safeParse({ firstName: 'A', lastName: 'B', email: 'nope', company: 'bot' });
    expect(r.success).toBe(false);
    const errs = fieldErrors(r.error!);
    expect(errs.email).toBeDefined();
    expect(errs.company).toBeDefined();
  });
  it('requires a phone number and checks the optional website (owner, 2026-10-24)', () => {
    const r = guestRequestSchema.safeParse({ firstName: 'A', lastName: 'B', email: 'a@example.org', website: 'example.org' });
    const errs = fieldErrors(r.error!);
    expect(errs.phone).toBe('Phone is required');
    expect(errs.website).toBeDefined();
    expect(guestRequestSchema.safeParse({ firstName: 'A', lastName: 'B', email: 'a@example.org', phone: 'call me' }).success).toBe(false);
  });
});

describe('joinSchema', () => {
  it('accepts a complete application', () => {
    expect(joinSchema.safeParse(okJoin).success).toBe(true);
  });
  it('requires agreeing to the terms and a typed signature', () => {
    const r = joinSchema.safeParse({ ...okJoin, agree: undefined, signature: '' });
    expect(r.success).toBe(false);
    const errs = fieldErrors(r.error!);
    expect(errs.agree).toBeDefined();
    expect(errs.signature).toBeDefined();
  });
  it('requires the business questions and two references, each with an email or phone', () => {
    const r = joinSchema.safeParse({ ...okJoin, phone: '', yearsInBusiness: '', productService: '', ref2Name: '', ref1Email: '', ref1Phone: '' });
    expect(r.success).toBe(false);
    const errs = fieldErrors(r.error!);
    for (const k of ['phone', 'yearsInBusiness', 'productService', 'ref2Name', 'ref1Email']) expect(errs[k], k).toBeDefined();
  });
  it('packs the application answers for the database', () => {
    const r = joinSchema.safeParse(okJoin);
    expect(r.success && r.data.application).toEqual({
      business_phone: '(650) 555-0100',
      business_address: '1 Main St, San Carlos, CA',
      years_in_business: '6 years',
      product_service: 'Brand and web design for local businesses.',
      credentials: 'BFA, Graphic Design',
      networking_groups: 'Chamber of Commerce',
      references: [
        { name: 'Lee Client', business: 'Client Co', business_name: null, email: 'lee@example.org', phone: null, website: null },
        { name: 'Sam Partner', business: 'Partner LLC', business_name: null, email: null, phone: '(650) 555-0199', website: 'https://partner.example.org' },
      ],
      signature_name: 'Ada Park',
    });
  });
  it('rejects short passwords and non-http websites', () => {
    const r = joinSchema.safeParse({ ...okJoin, password: 'short', website: 'javascript:alert(1)' });
    expect(r.success).toBe(false);
    const errs = fieldErrors(r.error!);
    expect(errs.password).toBeDefined();
    expect(errs.website).toBeDefined();
  });
});

describe('passwords', () => {
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
  it('referral slip: optional prospect phone/email and dollar value are checked; no consent or temperature field', () => {
    const toId = '00000000-0000-4000-8000-000000000001';
    const ok = referralSchema.safeParse({
      toId,
      contactName: 'Jo Prospect',
      prospectPhone: '(650) 555-0100',
      prospectEmail: 'JO@Example.org',
      amount: '$2,500.50',
    });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.prospectEmail).toBe('jo@example.org');
    expect(ok.success && ok.data.amount).toBe(2500.5);
    expect(ok.success && 'consent' in ok.data).toBe(false);
    const bare = referralSchema.safeParse({ toId, contactName: 'Jo Prospect' });
    expect(bare.success && bare.data.amount).toBeUndefined();
    const badAmount = referralSchema.safeParse({ toId, contactName: 'Jo Prospect', amount: 'lots' });
    expect(badAmount.success).toBe(false);
    expect(fieldErrors(badAmount.error!).amount).toMatch(/dollar amount/);
    expect(referralSchema.safeParse({ toId, contactName: 'Jo Prospect', amount: '-5' }).success).toBe(false);
    const bad = referralSchema.safeParse({ toId, contactName: 'Jo', prospectPhone: 'abc', prospectEmail: 'nope' });
    expect(bad.success).toBe(false);
    const errs = fieldErrors(bad.error!);
    expect(ok.success && 'warmth' in ok.data).toBe(false);
    expect(errs.prospectPhone).toBeDefined();
    expect(errs.prospectEmail).toBeDefined();
  });
  it('referral status update takes the new statuses and an optional dollar value', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    for (const status of ['new', 'contacted', 'meeting_set', 'closed_deal', 'not_a_fit']) {
      expect(referralUpdateSchema.safeParse({ id, status }).success, status).toBe(true);
    }
    const withAmount = referralUpdateSchema.safeParse({ id, status: 'closed_deal', amount: '12,000' });
    expect(withAmount.success && withAmount.data.amount).toBe(12000);
    expect(referralUpdateSchema.safeParse({ id, status: 'closed' }).success).toBe(false);
    expect(referralUpdateSchema.safeParse({ id, status: 'sent' }).success).toBe(false);
  });
  it('one-on-one date may be any past date, not the future', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    const schema = oneOnOneSchema(now);
    const partnerId = '00000000-0000-4000-8000-000000000001';
    expect(schema.safeParse({ partnerId, metOn: '2026-10-12', rating: '4' }).success).toBe(true);
    expect(schema.safeParse({ partnerId, metOn: '2026-09-20' }).success).toBe(true);
    expect(schema.safeParse({ partnerId, metOn: '2024-01-05' }).success).toBe(true);
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

describe('phase B forms', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  const ok = {
    title: 'Coffee and connections',
    description: 'Informal networking.',
    category: 'Networking',
    startsAt: '2026-10-20T18:00',
    endsAt: '2026-10-20T19:30',
    format: 'in_person',
    location: '123 Laurel St, San Carlos',
    onlineUrl: '',
  };
  it('member event: valid in-person event converts Pacific times to UTC', () => {
    const r = memberEventSchema(now).safeParse(ok);
    expect(r.success).toBe(true);
    expect(r.success && r.data).toMatchObject({ startsAt: '2026-10-21T01:00:00.000Z', endsAt: '2026-10-21T02:30:00.000Z', isOnline: false, onlineUrl: null });
  });
  it('member event: online needs an https link; in person needs an address', () => {
    const online = memberEventSchema(now).safeParse({ ...ok, format: 'online', location: '', onlineUrl: 'http://zoom.us/j/1' });
    expect(online.success).toBe(false);
    expect(fieldErrors(online.error!).onlineUrl).toBeDefined();
    const okOnline = memberEventSchema(now).safeParse({ ...ok, format: 'online', location: '', onlineUrl: 'https://zoom.us/j/1' });
    expect(okOnline.success && okOnline.data).toMatchObject({ isOnline: true, location: null, onlineUrl: 'https://zoom.us/j/1' });
    const noAddress = memberEventSchema(now).safeParse({ ...ok, location: '' });
    expect(fieldErrors(noAddress.error!).location).toBeDefined();
  });
  it('member event: end after start, not in the past, known category, title required', () => {
    const errs = (v: object) => fieldErrors(memberEventSchema(now).safeParse({ ...ok, ...v }).error!);
    expect(errs({ endsAt: '2026-10-20T17:00' }).endsAt).toBeDefined();
    expect(errs({ startsAt: '2026-10-01T18:00', endsAt: '2026-10-01T19:00' }).startsAt).toBeDefined();
    expect(errs({ category: 'Party' }).category).toBeDefined();
    expect(errs({ title: '' }).title).toBeDefined();
  });
  it('speaker topic is required (3–120 chars); description optional', () => {
    expect(speakerTopicSchema.safeParse({ topic: '' }).success).toBe(false);
    expect(speakerTopicSchema.safeParse({ topic: 'x'.repeat(121) }).success).toBe(false);
    expect(speakerTopicSchema.safeParse({ topic: 'Pricing your services', topicDescription: '' }).data).toEqual({
      topic: 'Pricing your services',
      topicDescription: null,
    });
  });
  it('slide settings: shown slides in the chosen order, at least one', () => {
    const r = slideSettingsSchema.safeParse({ show_welcome: 'on', order_welcome: '2', show_adjourn: 'on', order_adjourn: '1', order_call_to_order: '3' });
    expect(r.success && r.data).toEqual(['adjourn', 'welcome']);
    expect(slideSettingsSchema.safeParse({ order_welcome: '1' }).success).toBe(false);
  });

  it('one-on-one request: a member is required; the suggested date is optional but not in the past', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    const schema = oneOnOneRequestSchema(now);
    const inviteeId = '00000000-0000-4000-8000-000000000001';
    expect(schema.safeParse({ inviteeId }).success).toBe(true);
    expect(schema.safeParse({ inviteeId, proposedOn: '2026-10-20', message: 'Coffee?' }).success).toBe(true);
    const past = schema.safeParse({ inviteeId, proposedOn: '2026-10-01' });
    expect(past.success).toBe(false);
    expect(fieldErrors(past.error!).proposedOn).toBe('Choose today or a later date');
    const none = schema.safeParse({ inviteeId: '' });
    expect(fieldErrors(none.error!).inviteeId).toBe('Choose who you would like to meet');
    expect(schema.safeParse({ inviteeId, message: 'x'.repeat(501) }).success).toBe(false);
  });
  it('extra slide text: trimmed per slide, empty ones dropped, 600 characters at most', () => {
    const r = slideNotesSchema.safeParse({ note_welcome: '  Happy Thanksgiving!  ', note_announcements: '', note_bogus: 'x', show_welcome: 'on' });
    expect(r.success && r.data).toEqual({ welcome: 'Happy Thanksgiving!' });
    const long = slideNotesSchema.safeParse({ note_adjourn: 'x'.repeat(601) });
    expect(long.success).toBe(false);
    expect(fieldErrors(long.error!).note_adjourn).toMatch(/600 characters/);
  });
});
