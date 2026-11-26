import { describe, expect, it } from 'vitest';
import { filingNotices, type FilingKind } from './filing-notices';

// Pop-up after filing (owner, 2026-11-26). The "counted" flags must match the database's counting rules
// (leaderboard_window / group_totals_window): only a reported one-on-one waits for the other member.
describe('filing notices', () => {
  const kinds = Object.keys(filingNotices) as FilingKind[];
  it('covers referrals, one-on-ones (both cases), closed business (both ways) and visitors', () => {
    expect(kinds.sort()).toEqual(['closed_business_filed', 'closed_business_marked', 'one_on_one_confirmed', 'one_on_one_pending', 'referral', 'visitor']);
  });
  it('only a newly reported one-on-one waits for confirmation', () => {
    expect(kinds.filter((k) => !filingNotices[k].counted)).toEqual(['one_on_one_pending']);
    expect(filingNotices.one_on_one_pending.body).toMatch(/as soon as the other member confirms/);
    expect(filingNotices.one_on_one_pending.title).toBe('Almost there: one more step');
  });
  it('every notice says plainly where it counts', () => {
    for (const k of kinds) {
      const n = filingNotices[k];
      expect(n.title.length).toBeGreaterThan(5);
      expect(n.body).toMatch(/stats|totals/);
      if (n.counted) expect(n.title).toMatch(/already counts/);
    }
  });
});

describe('the pop-up does not repeat the page’s own saved messages word for word', () => {
  it('no title or text contains them', () => {
    const pageMessages = [
      'referral slip sent',
      'closed business filed',
      'one-on-one reported',
      'is logged as your visitor',
      'had already reported this one-on-one',
    ];
    for (const n of Object.values(filingNotices)) for (const m of pageMessages) expect(`${n.title} ${n.body} ${n.next ?? ''}`.toLowerCase()).not.toContain(m);
  });
});
