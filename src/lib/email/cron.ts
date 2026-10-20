// The daily scheduled job (Vercel Cron → /api/cron/daily, about 7 AM Pacific).
// Every email it sends is de-duplicated in email_log, so running it twice in a day is harmless.
import 'server-only';

import { formatMeetingDate, formatMeetingTime, formatMoney, formatShortDate, localDateKey } from '../dates';
import { createAdminClient } from '../supabase/admin';
import { deliver, loadAdmins, loadOptOuts, loadRecipients, siteUrl } from './notify';
import * as T from './templates';

const DAY = 86_400_000;

export type DailyReport = {
  meetingReminders: number;
  visitorFollowups: number;
  memberFollowups: number;
  onboardingReminders: number;
  digests: number;
};

function pacificWeekday(now: Date): number {
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Los_Angeles' }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

export async function runDaily(now: Date = new Date()): Promise<DailyReport> {
  const report: DailyReport = { meetingReminders: 0, visitorFollowups: 0, memberFollowups: 0, onboardingReminders: 0, digests: 0 };
  const db = createAdminClient();
  if (!db) return report;
  const url = siteUrl();
  const today = localDateKey(now);
  const count = (s: string) => {
    if (s === 'sent') return 1;
    return 0;
  };

  // 1. Meeting-day reminder (regular meetings that are not cancelled).
  const { data: meetings } = await db
    .from('meetings')
    .select('id, title, starts_at, cancelled_reason, meeting_speakers(slot, display_name)')
    .eq('category', 'Networking')
    .is('cancelled_reason', null)
    .gte('starts_at', new Date(now.getTime() - DAY).toISOString())
    .lt('starts_at', new Date(now.getTime() + 2 * DAY).toISOString());
  const todays = (meetings ?? []).filter((m) => localDateKey(new Date(m.starts_at)) === today);
  if (todays.length) {
    const { data: members } = await db.from('profiles').select('id').eq('status', 'approved');
    const ids = (members ?? []).map((m) => m.id);
    const people = await loadRecipients(ids);
    const off = await loadOptOuts(ids, 'meeting_reminders');
    for (const m of todays) {
      const { data: link } = await db.from('meeting_links').select('join_url').eq('meeting_id', m.id).maybeSingle();
      const start = new Date(m.starts_at);
      const speakers = (m.meeting_speakers ?? []) as { slot: string; display_name: string }[];
      for (const r of people.values()) {
        if (off.has(r.id)) continue;
        const s = await deliver({
          kind: 'meeting_reminder',
          dedupeKey: m.id,
          to: { email: r.email, name: `${r.firstName} ${r.lastName}`, profileId: r.id },
          email: T.meetingReminderEmail({
            siteUrl: url,
            firstName: r.firstName,
            when: `${formatMeetingDate(start)} at ${formatMeetingTime(start)} PT`,
            title: m.title,
            joinUrl: link?.join_url ?? null,
            five: speakers.find((x) => x.slot === 'education')?.display_name ?? null,
            ten: speakers.find((x) => x.slot === 'presentation')?.display_name ?? null,
          }),
        });
        report.meetingReminders += count(s);
      }
    }
  }

  // 2. Visitor follow-ups: guests marked "visited" for a meeting in the past week (or, with no meeting, requested in the past 2 weeks).
  const { data: recentMeetings } = await db
    .from('meetings')
    .select('id')
    .gte('starts_at', new Date(now.getTime() - 7 * DAY).toISOString())
    .lt('starts_at', new Date(now.getTime() - 2 * 3_600_000).toISOString());
  const recentIds = new Set((recentMeetings ?? []).map((m) => m.id));
  const guestFields = 'id, first_name, last_name, email, referrer_id, meeting_id, created_at';
  const [atMeeting, noMeeting] = await Promise.all([
    recentIds.size
      ? db.from('guest_requests').select(guestFields).eq('status', 'visited').in('meeting_id', [...recentIds])
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; email: string; referrer_id: string | null; meeting_id: string | null; created_at: string }[] }),
    db
      .from('guest_requests')
      .select(guestFields)
      .eq('status', 'visited')
      .is('meeting_id', null)
      .gte('created_at', new Date(now.getTime() - 14 * DAY).toISOString()),
  ]);
  const followGuests = [...(atMeeting.data ?? []), ...(noMeeting.data ?? [])];
  const byReferrer = new Map<string, string[]>();
  for (const g of followGuests) {
    const s = await deliver({
      kind: 'visitor_followup',
      dedupeKey: g.id,
      to: { email: g.email, name: `${g.first_name} ${g.last_name}` },
      email: T.visitorFollowupEmail({ siteUrl: url, firstName: g.first_name }),
    });
    report.visitorFollowups += count(s);
    if (s === 'sent' && g.referrer_id) byReferrer.set(g.referrer_id, [...(byReferrer.get(g.referrer_id) ?? []), `${g.first_name} ${g.last_name}`]);
  }
  if (byReferrer.size) {
    const ids = [...byReferrer.keys()];
    const people = await loadRecipients(ids);
    const off = await loadOptOuts(ids, 'visitors');
    for (const [id, guests] of byReferrer) {
      const r = people.get(id);
      if (!r || off.has(id) || r.status !== 'approved') continue;
      const s = await deliver({
        kind: 'member_followup',
        dedupeKey: `${today}`,
        to: { email: r.email, name: `${r.firstName} ${r.lastName}`, profileId: r.id },
        email: T.memberFollowupEmail({ siteUrl: url, toFirstName: r.firstName, guests }),
      });
      report.memberFollowups += count(s);
    }
  }

  // 3. Onboarding reminder, 3 days after approval, once.
  const { data: waiting } = await db
    .from('member_onboarding')
    .select('profile_id')
    .is('completed_at', null)
    .is('reminded_at', null)
    .lte('invited_at', new Date(now.getTime() - 3 * DAY).toISOString());
  if (waiting?.length) {
    const people = await loadRecipients(waiting.map((w) => w.profile_id));
    for (const r of people.values()) {
      if (r.status !== 'approved') continue;
      const s = await deliver({
        kind: 'onboarding_reminder',
        dedupeKey: r.id,
        to: { email: r.email, name: `${r.firstName} ${r.lastName}`, profileId: r.id },
        email: T.onboardingReminderEmail({ siteUrl: url, firstName: r.firstName }),
      });
      if (s !== 'failed') await db.from('member_onboarding').update({ reminded_at: now.toISOString() }).eq('profile_id', r.id);
      report.onboardingReminders += count(s);
    }
  }

  // 4. Weekly admin digest, Monday mornings: the 7 days before.
  if (pacificWeekday(now) === 1) {
    const from = new Date(now.getTime() - 7 * DAY);
    const fromIso = from.toISOString();
    const nowIso = now.toISOString();
    const head = { count: 'exact' as const, head: true };
    const [pending, guests, referrals, ones, closed, nextRes] = await Promise.all([
      db.from('profiles').select('id', head).eq('status', 'pending'),
      db.from('guest_requests').select('id', head).gte('created_at', fromIso).lt('created_at', nowIso),
      db.from('referrals').select('id', head).gte('created_at', fromIso).lt('created_at', nowIso),
      db.from('one_on_ones').select('id', head).gte('confirmed_at', fromIso).lt('confirmed_at', nowIso),
      db.from('referrals').select('amount').eq('status', 'closed_deal').gte('closed_at', fromIso).lt('closed_at', nowIso),
      db
        .from('meetings')
        .select('starts_at, meeting_speakers(slot)')
        .eq('category', 'Networking')
        .is('cancelled_reason', null)
        .gt('starts_at', nowIso)
        .order('starts_at')
        .limit(1)
        .maybeSingle(),
    ]);
    const closedRows = closed.data ?? [];
    const closedAmount = closedRows.reduce((a, r) => a + Number(r.amount ?? 0), 0);
    const next = nextRes.data;
    const taken = new Set(((next?.meeting_speakers ?? []) as { slot: string }[]).map((s) => s.slot));
    const open = [!taken.has('education') ? '5-minute' : null, !taken.has('presentation') ? '10-minute' : null].filter(Boolean).join(', ');
    const week = `${formatShortDate(from)} – ${formatShortDate(new Date(now.getTime() - DAY))}`;
    const admins = await loadAdmins();
    const off = await loadOptOuts(
      admins.map((a) => a.id),
      'digest',
    );
    for (const a of admins) {
      if (off.has(a.id)) continue;
      const s = await deliver({
        kind: 'admin_digest',
        dedupeKey: today,
        to: { email: a.email, name: `${a.firstName} ${a.lastName}`, profileId: a.id },
        email: T.adminDigestEmail({
          siteUrl: url,
          firstName: a.firstName,
          week,
          pending: pending.count ?? 0,
          guests: guests.count ?? 0,
          referrals: referrals.count ?? 0,
          oneOnOnes: ones.count ?? 0,
          closedDeals: closedRows.length,
          closedAmount: formatMoney(closedAmount),
          nextMeeting: next ? `${formatMeetingDate(new Date(next.starts_at))} at ${formatMeetingTime(new Date(next.starts_at))}` : null,
          openSlots: next ? open || 'None, both are booked' : null,
        }),
      });
      report.digests += count(s);
    }
  }

  return report;
}
