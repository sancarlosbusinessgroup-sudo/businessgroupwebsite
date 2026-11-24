import { describe, expect, it } from 'vitest';
import { describeGuestEvent, GUEST_STAGES, groupByStage, guestStageLabels, isGuestStage, laterStage } from './guest-pipeline';

describe('guest pipeline (owner, 2026-11-24)', () => {
  it('has the six columns in the owner’s order', () => {
    expect(GUEST_STAGES.map((s) => guestStageLabels[s])).toEqual([
      'Accept or Reject',
      'Zoom Link Sent',
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
