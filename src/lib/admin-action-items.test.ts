import { describe, expect, it } from 'vitest';
import { buildActionItems, type ActionInput } from './admin-action-items';

const now = new Date('2026-11-24T20:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

const quiet: ActionInput = {
  now,
  lastMeeting: { id: 'm1', starts_at: hoursAgo(50), ends_at: hoursAgo(48) },
  lastAttendanceTaken: true,
  lastZoomToReview: 0,
  lastMemberRecapSent: 30,
  lastManagementRecapSent: 12,
  managementRecapEnabled: true,
  nextMeeting: { id: 'm2', starts_at: inDays(5), ends_at: inDays(5), hasZoomLink: true, bookedSlots: ['education', 'presentation'] },
  atAbsenceLimit: [],
  openCorrections: 0,
  pendingApplications: [],
  guests: [],
  failedEmails: 0,
  onboardingOverdue: [],
};
const guest = (over: Partial<ActionInput['guests'][number]>): ActionInput['guests'][number] => ({
  id: 'g1',
  name: 'Gina Guest',
  email: 'gina@example.test',
  status: 'requested',
  created_at: daysAgo(3),
  one_on_ones_done_at: null,
  zoomSentAt: null,
  applyInviteAt: null,
  meetingEnded: false,
  ...over,
});
const keys = (d: Partial<ActionInput>) => buildActionItems({ ...quiet, ...d }).map((i) => i.key);

describe('Items that Need Immediate Action (owner, 2026-11-24)', () => {
  it('lists nothing when everything is done', () => {
    expect(buildActionItems(quiet)).toEqual([]);
  });

  it('asks for attendance, Zoom names and the Member recap for the last meeting; urgent after 20 hours', () => {
    const items = buildActionItems({ ...quiet, lastAttendanceTaken: false, lastZoomToReview: 3, lastMemberRecapSent: 0 });
    expect(items.map((i) => i.key)).toEqual(['attendance', 'zoom-review', 'member-recap']);
    expect(items[0]).toMatchObject({ tone: 'red', href: '/admin/attendance?m=m1' });
    expect(items[1]!.title).toMatch(/^Match 3 Zoom names/);
    expect(items[2]!.detail).toMatch(/Take attendance first/);
    const fresh = buildActionItems({ ...quiet, lastMeeting: { id: 'm1', starts_at: hoursAgo(3), ends_at: hoursAgo(1) }, lastAttendanceTaken: false });
    expect(fresh.find((i) => i.key === 'attendance')!.tone).toBe('amber');
  });

  it('stops nagging about a meeting two weeks after it', () => {
    expect(keys({ lastMeeting: { id: 'm1', starts_at: daysAgo(16), ends_at: daysAgo(16) }, lastAttendanceTaken: false, lastMemberRecapSent: 0 })).toEqual([]);
  });

  it('flags a Management recap that did not go out after a day, and a switched-off recap', () => {
    expect(keys({ lastManagementRecapSent: 0 })).toEqual(['management-recap']);
    expect(keys({ lastManagementRecapSent: 0, lastMeeting: { id: 'm1', starts_at: hoursAgo(12), ends_at: hoursAgo(10) } })).toEqual([]);
    expect(keys({ lastManagementRecapSent: 0, managementRecapEnabled: false })).toEqual(['management-recap-off']);
  });

  it('walks each guest through the stages', () => {
    const one = (g: Partial<ActionInput['guests'][number]>, apps: ActionInput['pendingApplications'] = []) =>
      buildActionItems({ ...quiet, guests: [guest(g)], pendingApplications: apps })[0];
    expect(one({})).toMatchObject({ title: 'Accept or reject Gina Guest', tone: 'amber' });
    expect(one({ zoomSentAt: daysAgo(2) })).toBeUndefined();
    expect(one({ zoomSentAt: daysAgo(2), meetingEnded: true })!.title).toBe('Did Gina Guest visit?');
    expect(one({ status: 'visited', zoomSentAt: daysAgo(9) })!.title).toBe('Invite Gina Guest to apply');
    expect(one({ status: 'visited', applyInviteAt: daysAgo(1) })).toBeUndefined();
    const app = [{ id: 'p1', name: 'Gina Guest', email: 'GINA@example.test', created_at: daysAgo(1) }];
    expect(one({ status: 'applied' }, app)!.title).toBe('Finish Gina Guest’s one-on-ones');
    expect(one({ status: 'applied', one_on_ones_done_at: daysAgo(0) }, app)).toMatchObject({
      title: 'Approve Gina Guest’s application',
      href: '/admin/guests#application-p1',
    });
    expect(one({ status: 'joined' })).toBeUndefined();
  });

  it('lists applications that have no guest request on their own', () => {
    const items = buildActionItems({ ...quiet, pendingApplications: [{ id: 'p9', name: 'Ann Apply', email: null, created_at: daysAgo(2) }] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: 'Review Ann Apply’s application', href: '/admin/guests#application-p9' });
  });

  it('checks the next meeting’s Zoom link and open slots only when it is within two weeks', () => {
    const next = { id: 'm2', starts_at: inDays(5), ends_at: inDays(5), hasZoomLink: false, bookedSlots: ['education'] };
    const items = buildActionItems({ ...quiet, nextMeeting: next });
    expect(items.map((i) => i.key)).toEqual(['zoom-link', 'slots']);
    expect(items[1]!.title).toMatch(/^10-minute presentation slot is open on/);
    expect(keys({ nextMeeting: { ...next, starts_at: inDays(20) } })).toEqual([]);
  });

  it('puts urgent items first and covers absences, corrections, onboarding and failed emails', () => {
    const items = buildActionItems({
      ...quiet,
      failedEmails: 2,
      openCorrections: 1,
      onboardingOverdue: ['Nina New'],
      atAbsenceLimit: ['Al Absent'],
    });
    expect(items.map((i) => i.key)).toEqual(['absences', 'corrections', 'emails', 'onboarding']);
    expect(items.find((i) => i.key === 'emails')!.href).toBe('/admin/history#email-logs');
    expect(items.find((i) => i.key === 'corrections')!.title).toBe('1 attendance correction request to look at');
  });
});
