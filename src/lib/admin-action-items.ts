// "Items that Need Immediate Action" on Admin → Overview (owner, 2026-11-24): things waiting on an admin, pulled from
// the other tabs. Pure: the loader in lib/data/admin-action-items.ts gathers the rows, this decides what to list.

import { formatShortDate } from './dates';

export type ActionTone = 'red' | 'amber' | 'teal';

export type ActionItem = {
  key: string;
  /** Short headline, e.g. "Send Jane Doe the Zoom link". */
  title: string;
  /** Where things stand (the guest's stage, the meeting, …). */
  detail: string;
  /** The tab that fixes it, shown as a label and used for the button. */
  tab: string;
  href: string;
  tone: ActionTone;
};

export type ActionMeeting = { id: string; starts_at: string; ends_at: string };

export type ActionInput = {
  now: Date;
  /** The most recent regular meeting that has ended (not cancelled). */
  lastMeeting: ActionMeeting | null;
  /** Its attendance has been taken (Zoom read or saved by hand). */
  lastAttendanceTaken: boolean;
  /** Zoom names from that meeting still to match to a member or visitor. */
  lastZoomToReview: number;
  /** How many Member recap emails went out for that meeting. */
  lastMemberRecapSent: number;
  /** How many Management recap emails went out for that meeting. */
  lastManagementRecapSent: number;
  managementRecapEnabled: boolean;
  /** The next regular meeting (not cancelled, not hidden). */
  nextMeeting: (ActionMeeting & { hasZoomLink: boolean; bookedSlots: string[] }) | null;
  /** Members at the absence limit. */
  atAbsenceLimit: string[];
  openCorrections: number;
  pendingApplications: { id: string; name: string; email: string | null; created_at: string }[];
  /** Guest invite requests not yet joined (recent ones only). */
  guests: {
    id: string;
    name: string;
    email: string;
    status: 'requested' | 'visited' | 'applied' | 'joined';
    created_at: string;
    one_on_ones_done_at: string | null;
    /** When the Zoom link was last sent, if ever. */
    zoomSentAt: string | null;
    /** When they were last invited to apply, if ever. */
    applyInviteAt: string | null;
    /** The meeting they asked to visit has ended. */
    meetingEnded: boolean;
  }[];
  /** Emails that failed in the past 7 days. */
  failedEmails: number;
  /** Approved members who were reminded but still haven't finished onboarding. */
  onboardingOverdue: string[];
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const short = (iso: string) => formatShortDate(new Date(iso));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const names = (list: string[], max = 6) => (list.length > max ? `${list.slice(0, max).join(', ')} and ${list.length - max} more` : list.join(', '));
const toneOrder: Record<ActionTone, number> = { red: 0, amber: 1, teal: 2 };

export function buildActionItems(d: ActionInput): ActionItem[] {
  const items: ActionItem[] = [];
  const now = d.now.getTime();

  // Attendance and the recaps for the most recent meeting (for two weeks after it).
  const last = d.lastMeeting;
  if (last && now - new Date(last.ends_at).getTime() <= 14 * DAY) {
    const when = short(last.starts_at);
    const since = now - new Date(last.ends_at).getTime();
    const attendanceHref = `/admin/attendance?m=${last.id}`;
    if (!d.lastAttendanceTaken) {
      items.push({
        key: 'attendance',
        title: `Take attendance for the ${when} meeting`,
        detail:
          'Attendance hasn’t been taken yet. Zoom attendance is read around noon Pacific on meeting days; if it isn’t there, take it by hand. The Management recap goes out once it is taken.',
        tab: 'Attendance',
        href: attendanceHref,
        tone: since > 20 * HOUR ? 'red' : 'amber',
      });
    }
    if (d.lastZoomToReview > 0) {
      items.push({
        key: 'zoom-review',
        title: `Match ${plural(d.lastZoomToReview, 'Zoom name')} from the ${when} meeting`,
        detail: 'Link each name to a member or mark it as a visitor (and who invited them), so attendance and the recaps are right.',
        tab: 'Attendance',
        href: attendanceHref,
        tone: 'amber',
      });
    }
    if (d.lastMemberRecapSent === 0) {
      items.push({
        key: 'member-recap',
        title: `Send the Member recap for the ${when} meeting`,
        detail: d.lastAttendanceTaken
          ? 'It is never sent automatically. Check the preview, then press Send recap.'
          : 'It is never sent automatically. Take attendance first so the day’s visitors are included, then check the preview and send it.',
        tab: 'Member Recap',
        href: '/admin/recap',
        tone: 'amber',
      });
    }
    if (d.managementRecapEnabled && d.lastManagementRecapSent === 0 && since > 24 * HOUR) {
      items.push({
        key: 'management-recap',
        title: `The Management recap for the ${when} meeting hasn’t gone out`,
        detail:
          since > 36 * HOUR
            ? 'It is only sent automatically in the 36 hours after a meeting. Preview it on the Management Recap tab.'
            : 'It goes out automatically at the next run. Make sure the attendance is taken.',
        tab: 'Management Recap',
        href: '/admin/management-recap',
        tone: 'amber',
      });
    }
  }
  if (!d.managementRecapEnabled) {
    items.push({
      key: 'management-recap-off',
      title: 'The Management recap is switched off',
      detail: 'No admin gets the attendance email after meetings until it is switched back on.',
      tab: 'Management Recap',
      href: '/admin/management-recap',
      tone: 'teal',
    });
  }
  if (d.atAbsenceLimit.length) {
    items.push({
      key: 'absences',
      title: `${plural(d.atAbsenceLimit.length, 'member has', 'members have')} reached the absence limit`,
      detail: names(d.atAbsenceLimit),
      tab: 'Attendance',
      href: '/admin/attendance',
      tone: 'red',
    });
  }
  if (d.openCorrections > 0) {
    items.push({
      key: 'corrections',
      title: `${plural(d.openCorrections, 'attendance correction request')} to look at`,
      detail: 'Fix the attendance, then mark each request resolved.',
      tab: 'Attendance',
      href: '/admin/attendance#corrections',
      tone: 'amber',
    });
  }

  // Applications and guests on the way to membership.
  const pendingByEmail = new Map(d.pendingApplications.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p]));
  const handled = new Set<string>();
  for (const g of d.guests) {
    if (g.status === 'joined') continue;
    const app = pendingByEmail.get(g.email.toLowerCase());
    const base = { tab: 'Guest Invites & Applications', href: '/admin/guests#guests' };
    if (app) {
      handled.add(app.id);
      items.push(
        g.one_on_ones_done_at
          ? {
              ...base,
              key: `guest-${g.id}`,
              title: `Approve ${g.name}’s application`,
              detail: `Stage: applied ${short(app.created_at)}, one-on-ones with the Membership Committee done. Approve (or decline) the application.`,
              href: `/admin/guests#application-${app.id}`,
              tone: 'amber',
            }
          : {
              ...base,
              key: `guest-${g.id}`,
              title: `Finish ${g.name}’s one-on-ones`,
              detail: `Stage: applied ${short(app.created_at)}. Mark the Membership Committee one-on-ones done when they are complete, then approve.`,
              tone: 'teal',
            },
      );
      continue;
    }
    if (g.status === 'requested' && !g.zoomSentAt) {
      items.push({
        ...base,
        key: `guest-${g.id}`,
        title: `Send ${g.name} the Zoom link`,
        detail: `Stage: asked for an invite ${short(g.created_at)}. No Zoom link sent yet.`,
        tone: 'amber',
      });
    } else if (g.status === 'requested' && g.zoomSentAt && (g.meetingEnded || now - new Date(g.zoomSentAt).getTime() > 7 * DAY)) {
      items.push({
        ...base,
        key: `guest-${g.id}`,
        title: `Did ${g.name} visit?`,
        detail: `Stage: Zoom link sent ${short(g.zoomSentAt)}, not marked as visited. Mark them visited if they came (the Zoom report does it when it recognizes them).`,
        tone: 'teal',
      });
    } else if (g.status === 'visited' && !g.applyInviteAt) {
      items.push({
        ...base,
        key: `guest-${g.id}`,
        title: `Invite ${g.name} to apply`,
        detail: 'Stage: visited. When the Membership Committee agrees, send them the application form.',
        tone: 'teal',
      });
    }
  }
  for (const p of d.pendingApplications) {
    if (handled.has(p.id)) continue;
    items.push({
      key: `application-${p.id}`,
      title: `Review ${p.name}’s application`,
      detail: `Applied ${short(p.created_at)}. Read their answers and references, then approve or decline.`,
      tab: 'Guest Invites & Applications',
      href: `/admin/guests#application-${p.id}`,
      tone: 'amber',
    });
  }
  if (d.onboardingOverdue.length) {
    items.push({
      key: 'onboarding',
      title: `${plural(d.onboardingOverdue.length, 'new member hasn’t', 'new members haven’t')} finished onboarding`,
      detail: `${names(d.onboardingOverdue)}. They were reminded by email; a personal nudge may help.`,
      tab: 'Guest Invites & Applications',
      href: '/admin/guests#onboarding',
      tone: 'teal',
    });
  }

  // The next meeting (in the coming two weeks).
  const next = d.nextMeeting;
  if (next && new Date(next.starts_at).getTime() - now <= 14 * DAY) {
    const when = short(next.starts_at);
    if (!next.hasZoomLink) {
      items.push({
        key: 'zoom-link',
        title: `Add the Zoom link for the ${when} meeting`,
        detail: 'Members, the meeting-day reminder and “Send Zoom link” to guests all need it.',
        tab: 'Meetings',
        href: `/admin/meetings/${next.id}`,
        tone: 'red',
      });
    }
    const open = [!next.bookedSlots.includes('education') ? '5-minute' : null, !next.bookedSlots.includes('presentation') ? '10-minute' : null].filter(
      (x): x is string => !!x,
    );
    if (open.length) {
      items.push({
        key: 'slots',
        title: `${open.join(' and ')} presentation ${open.length === 1 ? 'slot is' : 'slots are'} open on ${when}`,
        detail: 'Assign a presenter, or ask a member to claim it on the Meetings page.',
        tab: 'Meetings',
        href: `/admin/meetings/${next.id}`,
        tone: 'teal',
      });
    }
  }

  if (d.failedEmails > 0) {
    items.push({
      key: 'emails',
      title: `${plural(d.failedEmails, 'email')} failed to send this week`,
      detail: 'See which ones in the Email Logs and resend them.',
      tab: 'Change History',
      href: '/admin/history#email-logs',
      tone: 'amber',
    });
  }

  // Most urgent first; the order above is kept within the same urgency.
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => toneOrder[a.it.tone] - toneOrder[b.it.tone] || a.i - b.i)
    .map(({ it }) => it);
}
