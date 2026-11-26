// Pop-up after filing activity (owner, 2026-11-26): tells the member whether what they just filed already counts in the
// stats, leaderboards and meeting slides, or waits for another member's confirmation first. The counting rules are
// those of the database (leaderboard_window, group_totals_window): only one-on-ones wait for the other member.

export type FilingKind = 'referral' | 'one_on_one_pending' | 'one_on_one_confirmed' | 'closed_business_filed' | 'closed_business_marked' | 'visitor';

export type FilingNotice = {
  title: string;
  /** true: already counted; false: waits for confirmation. Drives the badge. */
  counted: boolean;
  body: string;
  next?: string;
};

export const COUNTED_BADGE = 'Counted now';
export const WAITING_BADGE = 'Waiting for confirmation';

export const filingNotices: Record<FilingKind, FilingNotice> = {
  referral: {
    title: 'Your referral already counts!',
    counted: true,
    body: 'It is already included in the group’s stats, the leaderboards and the meeting slides. No confirmation needed.',
    next: 'The member you referred gets an email and will update the slip as they follow up.',
  },
  one_on_one_pending: {
    title: 'Almost there: one more step',
    counted: false,
    body: 'Your one-on-one will count in the stats and leaderboards as soon as the other member confirms it. We’ve let them know.',
    next: 'Once confirmed, it counts once for each of you. You can see its status in your one-on-one history.',
  },
  one_on_one_confirmed: {
    title: 'Your one-on-one already counts!',
    counted: true,
    body: 'The other member reported it first, so we confirmed their report instead of adding a second one. It now counts in the stats and leaderboards, once for each of you.',
  },
  closed_business_filed: {
    title: 'Your closed business already counts!',
    counted: true,
    body: 'It is now included in the group’s closed business totals and on the meeting slides. No confirmation needed.',
    next: 'Closed business is shown as a group total only, never as a ranking of members.',
  },
  closed_business_marked: {
    title: 'Thank you! This closed business already counts',
    counted: true,
    body: 'It is now included in the group’s closed business totals and on the meeting slides, credited to the member who referred it.',
    next: 'Closed business is shown as a group total only, never as a ranking of members.',
  },
  visitor: {
    title: 'Your visitor already counts!',
    counted: true,
    body: 'They are already included in your visitors brought, the group’s stats, the leaderboards and the meeting slides. No confirmation needed.',
  },
};
