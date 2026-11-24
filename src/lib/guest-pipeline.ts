// The guest board on Admin → Guest Invites & Applications (owner, 2026-11-24): one column per step, from the invite
// request to an approved member. Cards move forward by themselves when a step is done on the website (the database
// moves them when a guest's status changes; the site when a Zoom link is sent or the interview is marked done), and
// admins can move any card by hand. Moving a card by hand never sends an email or approves anyone.

export const GUEST_STAGES = ['review', 'zoom_sent', 'send_application', 'application_done', 'interview', 'approved'] as const;
export type GuestStage = (typeof GUEST_STAGES)[number];

export const guestStageLabels: Record<GuestStage, string> = {
  review: 'Accept or Reject',
  zoom_sent: 'Zoom Link Sent',
  send_application: 'Send Application Form',
  application_done: 'Application Form Accomplished',
  interview: 'Panel Interview',
  approved: 'Membership Approved',
};

/** What happens in each column, shown under its heading. */
export const guestStageHints: Record<GuestStage, string> = {
  review: 'New requests. Check for a category conflict, then accept (sends the Zoom link) or decline.',
  zoom_sent: 'The Zoom link is on its way. Cards move on when the guest visits (Zoom report, visitor sign-in or Mark visited).',
  send_application: 'They visited. Send the application form when the Membership Committee agrees.',
  application_done: 'They filled in the application. Move them on when the panel interview is set up.',
  interview: 'Interview with the Membership Committee. Mark it done, then approve the membership.',
  approved: 'Welcome aboard: their membership is approved.',
};

export const isGuestStage = (x: unknown): x is GuestStage => typeof x === 'string' && (GUEST_STAGES as readonly string[]).includes(x);

export const stageRank = (s: GuestStage) => GUEST_STAGES.indexOf(s);

/** The later of two stages: automatic steps only ever move a card forward. */
export const laterStage = (current: GuestStage, next: GuestStage): GuestStage => (stageRank(next) > stageRank(current) ? next : current);

export const guestEventLabels = {
  status: 'Status',
  stage: 'Moved',
  accepted: 'Accepted',
  declined: 'Declined',
  reopened: 'Reopened',
  note: 'Note',
  zoom_link: 'Zoom link sent',
  apply_invite: 'Application form sent',
  interview: 'Interview',
} as const;

const statusWords: Record<string, string> = { requested: 'Requested', visited: 'Visited', applied: 'Applied', joined: 'Joined' };

/** One line of a guest's history, for people. */
export function describeGuestEvent(e: { kind: keyof typeof guestEventLabels; detail: string | null }): string {
  if (e.kind === 'status') return `Status: ${statusWords[e.detail ?? ''] ?? e.detail ?? ''}`;
  if (e.kind === 'stage') return `Moved to ${isGuestStage(e.detail) ? guestStageLabels[e.detail] : (e.detail ?? '')}`;
  return e.detail ? `${guestEventLabels[e.kind]}: ${e.detail}` : guestEventLabels[e.kind];
}

export type BoardCard<C> = C & { stage: GuestStage };

/** Cards grouped by column, newest change first within a column. */
export function groupByStage<C extends { stage: GuestStage; changedAt: string }>(cards: C[]): Record<GuestStage, C[]> {
  const out = Object.fromEntries(GUEST_STAGES.map((s) => [s, [] as C[]])) as Record<GuestStage, C[]>;
  for (const c of cards) out[c.stage].push(c);
  for (const s of GUEST_STAGES) out[s].sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  return out;
}
