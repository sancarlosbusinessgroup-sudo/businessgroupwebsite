import { describe, expect, it } from 'vitest';
import {
  describeGuestEvent,
  GUEST_STAGES,
  GUEST_STEPS,
  groupByStage,
  guestProgress,
  guestReminders,
  guestStageHints,
  guestStageLabels,
  guestStepLabels,
  isGuestStage,
  laterStage,
  previousStage,
  rankSlots,
  stepState,
  type GuestFlow,
} from './guest-pipeline';

describe('guest pipeline (owner, 2026-11-24)', () => {
  it('has the six columns in the owner’s order', () => {
    expect(GUEST_STAGES.map((s) => guestStageLabels[s])).toEqual([
      'Accept or Reject',
      // Owner, 2026-11-25: accepting no longer sends the link by itself, so the column is "Zoom Link".
      'Zoom Link',
      'Send Application Form',
      'Application Form Accomplished',
      'Panel Interview',
      'Membership Approved',
    ]);
  });

  it('automatic steps only move a card forward', () => {
    expect(laterStage('review', 'zoom_sent')).toBe('zoom_sent');
    expect(laterStage('interview', 'zoom_sent')).toBe('interview');
    expect(laterStage('approved', 'approved')).toBe('approved');
  });

  it('checks stage names', () => {
    expect(isGuestStage('interview')).toBe(true);
    expect(isGuestStage('declined')).toBe(false);
    expect(isGuestStage(null)).toBe(false);
  });

  it('groups cards by column, most recently changed first', () => {
    const g = groupByStage([
      { id: 'a', stage: 'review' as const, changedAt: '2026-11-20T00:00:00Z' },
      { id: 'b', stage: 'review' as const, changedAt: '2026-11-22T00:00:00Z' },
      { id: 'c', stage: 'approved' as const, changedAt: '2026-11-21T00:00:00Z' },
    ]);
    expect(g.review.map((c) => c.id)).toEqual(['b', 'a']);
    expect(g.approved.map((c) => c.id)).toEqual(['c']);
    expect(g.interview).toEqual([]);
  });

  it('describes history lines', () => {
    expect(describeGuestEvent({ kind: 'stage', detail: 'interview' })).toBe('Moved to Panel Interview');
    expect(describeGuestEvent({ kind: 'status', detail: 'visited' })).toBe('Status: Visited');
    expect(describeGuestEvent({ kind: 'declined', detail: 'by phone' })).toBe('Declined: by phone');
    expect(describeGuestEvent({ kind: 'accepted', detail: null })).toBe('Accepted');
  });
});

describe('guest steps (owner, 2026-11-25)', () => {
  const flow = (o: Partial<GuestFlow> = {}): GuestFlow => ({
    name: 'Gina Guest',
    phone: '650-555-0100',
    stage: 'review',
    status: 'requested',
    accepted: false,
    declined: null,
    zoomSentOn: null,
    zoomDismissed: false,
    formSentOn: null,
    interviewDone: false,
    panel: null,
    membershipDeclined: null,
    welcomeSentOn: null,
    welcomeDismissed: false,
    ...o,
  });

  it('the guest list has the five steps of the board, in order', () => {
    expect(GUEST_STEPS.map((s) => guestStepLabels[s])).toEqual(['Accept or Reject', 'Zoom Link', 'Application Form', 'Panel Interview', 'Membership Approved']);
  });

  it('uses the owner’s wording for the first column', () => {
    expect(guestStageHints.review).toMatch(/^New requests\. Check for membership rules compliance, or category conflict, then accept or decline\./);
  });

  it('shows progress per step', () => {
    expect(guestProgress('review')).toEqual({ step: 0, done: 0 });
    expect(guestProgress('application_done')).toEqual({ step: 2, done: 2.5 });
    expect(guestProgress('approved')).toEqual({ step: 4, done: 5 });
    expect(stepState('send_application', 'zoom')).toBe('done');
    expect(stepState('send_application', 'form')).toBe('current');
    expect(stepState('send_application', 'panel')).toBe('todo');
    expect(stepState('approved', 'membership')).toBe('done');
  });

  it('undo goes back one column', () => {
    expect(previousStage('review')).toBeNull();
    expect(previousStage('zoom_sent')).toBe('review');
    expect(previousStage('approved')).toBe('interview');
  });

  it('reminds about emails that were not sent and calls to make', () => {
    expect(guestReminders(flow())).toEqual([]);
    expect(guestReminders(flow({ accepted: true, stage: 'zoom_sent' }))).toEqual([{ step: 'zoom', text: 'Zoom link not sent yet.', tone: 'amber' }]);
    expect(guestReminders(flow({ accepted: true, stage: 'zoom_sent', zoomDismissed: true }))).toEqual([]);
    expect(guestReminders(flow({ accepted: true, stage: 'zoom_sent', zoomSentOn: 'Nov 17, 2026' }))).toEqual([]);
    expect(guestReminders(flow({ declined: { called: false } }))[0]).toMatchObject({
      step: 'accept',
      tone: 'red',
      text: expect.stringContaining('650-555-0100'),
    });
    expect(guestReminders(flow({ declined: { called: true } }))).toEqual([]);
    expect(guestReminders(flow({ stage: 'send_application', status: 'visited', accepted: true, zoomSentOn: 'x' }))[0]!.step).toBe('form');
    expect(guestReminders(flow({ stage: 'approved', status: 'joined', accepted: true, zoomSentOn: 'x' }))).toEqual([
      { step: 'membership', text: 'Welcome email not sent yet.', tone: 'amber' },
    ]);
    expect(guestReminders(flow({ stage: 'interview', status: 'applied', membershipDeclined: { called: false } }))[0]).toMatchObject({
      step: 'membership',
      tone: 'red',
    });
  });

  it('panel reminders: waiting for answers, a time for all three, the guest not told', () => {
    const panel = (o: Partial<NonNullable<GuestFlow['panel']>>) => ({
      id: 'p',
      status: 'scheduling' as const,
      when: null,
      panelists: [
        { id: 'a', name: 'Ann A', answered: true },
        { id: 'b', name: 'Bob B', answered: false },
        { id: 'c', name: 'Cy C', answered: false },
      ],
      best: null,
      guestEmailed: false,
      guestEmailDismissed: false,
      ...o,
    });
    const base = { stage: 'interview' as const, status: 'applied' as const, accepted: true, zoomSentOn: 'x', formSentOn: 'y' };
    expect(guestReminders(flow({ ...base, panel: panel({}) }))[0]!.text).toBe('Waiting for Bob, Cy to mark their times.');
    expect(guestReminders(flow({ ...base, panel: panel({ best: { label: 'Tue, Dec 1, 10:00 AM', allYes: true, slotId: 's' } }) }))[0]!.text).toMatch(
      /^All three can make/,
    );
    expect(guestReminders(flow({ ...base, panel: panel({ status: 'scheduled', when: 'Tue' }) }))[0]!.text).toBe('Interview time not emailed to the guest yet.');
    expect(guestReminders(flow({ ...base, panel: panel({ status: 'scheduled', when: 'Tue', guestEmailed: true }) }))).toEqual([]);
    expect(guestReminders(flow({ ...base, interviewDone: true, panel: panel({}) }))).toEqual([]);
  });

  it('ranks proposed times: nobody says no, then most yes, then most maybe, then earliest', () => {
    const slots = [
      { id: 's1', startsAt: '2026-12-01T18:00:00Z' },
      { id: 's2', startsAt: '2026-12-02T18:00:00Z' },
      { id: 's3', startsAt: '2026-12-03T18:00:00Z' },
    ];
    const r = rankSlots(
      slots,
      ['a', 'b', 'c'],
      [
        { slotId: 's1', profileId: 'a', answer: 'yes' },
        { slotId: 's1', profileId: 'b', answer: 'no' },
        { slotId: 's2', profileId: 'a', answer: 'yes' },
        { slotId: 's2', profileId: 'b', answer: 'yes' },
        { slotId: 's2', profileId: 'c', answer: 'yes' },
        { slotId: 's3', profileId: 'a', answer: 'maybe' },
        { slotId: 's3', profileId: 'x', answer: 'yes' },
      ],
    );
    expect(r.map((t) => t.id)).toEqual(['s2', 's3', 's1']);
    expect(r[0]).toMatchObject({ allYes: true, waiting: 0 });
    expect(r[1]).toMatchObject({ yes: 0, maybe: 1, waiting: 2, allYes: false });
  });
});
