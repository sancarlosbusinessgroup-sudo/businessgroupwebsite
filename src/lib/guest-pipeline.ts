// The guest board on Admin → Guest Invites & Applications (owner, 2026-11-24): one column per step, from the invite
// request to an approved member. Cards move forward by themselves when a step is done on the website (the database
// moves them when a guest's status changes; the site when a Zoom link is sent or the interview is marked done), and
// admins can move any card by hand. Moving a card by hand never sends an email or approves anyone.

export const GUEST_STAGES = ['review', 'zoom_sent', 'send_application', 'application_done', 'interview', 'approved'] as const;
export type GuestStage = (typeof GUEST_STAGES)[number];

export const guestStageLabels: Record<GuestStage, string> = {
  review: 'Accept or Reject',
  zoom_sent: 'Zoom Link',
  send_application: 'Send Application Form',
  application_done: 'Application Form Accomplished',
  interview: 'Panel Interview',
  approved: 'Membership Approved',
};

/** What happens in each column, shown under its heading. */
export const guestStageHints: Record<GuestStage, string> = {
  // Owner, 2026-11-25: emails never go out by themselves; each one is confirmed in a pop-up.
  review:
    'New requests. Check for membership rules compliance, or category conflict, then accept or decline. Accepting then asks you to confirm sending them the Zoom link for the next meeting.',
  zoom_sent: 'Accepted. Send the Zoom link if it hasn’t gone out, then press First Zoom Done once they have joined a meeting.',
  send_application: 'They have been to a Zoom. Send the application form when the Membership Committee agrees.',
  application_done: 'They filled in the application. Schedule the panel interview.',
  interview: 'Panel interview with three members of Management. Mark it done, then approve the membership.',
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

// --- Steps on the guest list (owner, 2026-11-25) ------------------------------------------------------------------
// The guest list shows the same journey as the board in five steps (Application Form covers "Send Application Form"
// and "Application Form Accomplished"), with a progress bar per guest. Nothing is emailed without a confirm, and every
// email that was not sent leaves a reminder in its step.

export const GUEST_STEPS = ['accept', 'zoom', 'form', 'panel', 'membership'] as const;
export type GuestStep = (typeof GUEST_STEPS)[number];

export const guestStepLabels: Record<GuestStep, string> = {
  accept: 'Accept or Reject',
  zoom: 'Zoom Link',
  form: 'Application Form',
  panel: 'Panel Interview',
  membership: 'Membership Approved',
};

const stepOfStage: Record<GuestStage, number> = { review: 0, zoom_sent: 1, send_application: 2, application_done: 2, interview: 3, approved: 4 };

/** How far along a guest is: the step they are on (0–4), and how many of the five are complete. */
export function guestProgress(stage: GuestStage): { step: number; done: number } {
  const step = stepOfStage[stage];
  return { step, done: stage === 'approved' ? 5 : stage === 'application_done' ? step + 0.5 : step };
}

/** "done", "current" or "todo" for one step of a guest. */
export function stepState(stage: GuestStage, step: GuestStep): 'done' | 'current' | 'todo' {
  const i = GUEST_STEPS.indexOf(step);
  const { step: at } = guestProgress(stage);
  if (stage === 'approved') return 'done';
  return i < at ? 'done' : i === at ? 'current' : 'todo';
}

/** The column before this one ("Undo" moves a card back one column); null in the first. */
export function previousStage(stage: GuestStage): GuestStage | null {
  const i = stageRank(stage);
  return i > 0 ? GUEST_STAGES[i - 1]! : null;
}

export type PanelAnswer = 'yes' | 'maybe' | 'no';

export type SlotTally = { id: string; startsAt: string; yes: number; maybe: number; no: number; waiting: number; allYes: boolean };

/**
 * Proposed interview times, best first: times nobody said no to, then the most "yes", then the most "maybe", then the
 * earliest. `allYes`: every panelist said yes (the time to confirm).
 */
export function rankSlots(
  slots: { id: string; startsAt: string }[],
  panelists: string[],
  answers: { slotId: string; profileId: string; answer: PanelAnswer }[],
): SlotTally[] {
  const tally = slots.map((s) => {
    const mine = answers.filter((a) => a.slotId === s.id && panelists.includes(a.profileId));
    const yes = mine.filter((a) => a.answer === 'yes').length;
    const maybe = mine.filter((a) => a.answer === 'maybe').length;
    const no = mine.filter((a) => a.answer === 'no').length;
    return {
      id: s.id,
      startsAt: s.startsAt,
      yes,
      maybe,
      no,
      waiting: panelists.length - mine.length,
      allYes: panelists.length > 0 && yes === panelists.length,
    };
  });
  return tally.sort((a, b) => Number(a.no > 0) - Number(b.no > 0) || b.yes - a.yes || b.maybe - a.maybe || a.startsAt.localeCompare(b.startsAt));
}

export type PanelSummary = {
  id: string;
  status: 'scheduling' | 'scheduled';
  /** "Tue, Dec 1, 10:00 AM" when scheduled. */
  when: string | null;
  panelists: { id: string; name: string; answered: boolean }[];
  /** The best proposed time while scheduling ("Tue, Dec 1, 10:00 AM"), and whether all three can make it. */
  best: { label: string; allYes: boolean; slotId: string } | null;
  guestEmailed: boolean;
  guestEmailDismissed: boolean;
};

/** What a guest's steps need to show their buttons, states and reminders. */
export type GuestFlow = {
  name: string;
  phone: string | null;
  stage: GuestStage;
  status: 'requested' | 'visited' | 'applied' | 'joined';
  accepted: boolean;
  declined: { called: boolean } | null;
  zoomSentOn: string | null;
  zoomDismissed: boolean;
  formSentOn: string | null;
  interviewDone: boolean;
  panel: PanelSummary | null;
  membershipDeclined: { called: boolean } | null;
  welcomeSentOn: string | null;
  welcomeDismissed: boolean;
};

export type GuestReminder = { step: GuestStep; text: string; tone: 'red' | 'amber' | 'teal' };

/** Things left to do for a guest: emails not sent, calls to make, answers to wait for. */
export function guestReminders(g: GuestFlow): GuestReminder[] {
  const out: GuestReminder[] = [];
  const phone = g.phone ? ` on ${g.phone}` : '';
  if (g.declined) {
    if (!g.declined.called) out.push({ step: 'accept', text: `Call ${g.name}${phone} to let them know (no email is sent).`, tone: 'red' });
    return out;
  }
  if (g.accepted && g.status === 'requested' && !g.zoomSentOn && !g.zoomDismissed) out.push({ step: 'zoom', text: 'Zoom link not sent yet.', tone: 'amber' });
  if (g.status === 'visited' && stageRank(g.stage) >= stageRank('send_application') && !g.formSentOn)
    out.push({ step: 'form', text: 'Application form not sent yet.', tone: 'teal' });
  const p = g.panel;
  if (p && !g.interviewDone && g.status !== 'joined') {
    if (p.status === 'scheduling') {
      const waiting = p.panelists.filter((x) => !x.answered).map((x) => x.name.split(' ')[0]);
      if (p.best?.allYes) out.push({ step: 'panel', text: `All three can make ${p.best.label}: confirm it.`, tone: 'amber' });
      else if (waiting.length) out.push({ step: 'panel', text: `Waiting for ${waiting.join(', ')} to mark their times.`, tone: 'teal' });
      else out.push({ step: 'panel', text: 'No time works for all three yet: add more times.', tone: 'amber' });
    } else if (!p.guestEmailed && !p.guestEmailDismissed) {
      out.push({ step: 'panel', text: 'Interview time not emailed to the guest yet.', tone: 'amber' });
    }
  }
  if (g.membershipDeclined) {
    if (!g.membershipDeclined.called)
      out.push({ step: 'membership', text: `Call ${g.name}${phone}: membership not approved (no email is sent).`, tone: 'red' });
  } else if (g.status === 'joined' && !g.welcomeSentOn && !g.welcomeDismissed) {
    out.push({ step: 'membership', text: 'Welcome email not sent yet.', tone: 'amber' });
  }
  return out;
}
