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
  meetingRecaps: number;
};

function pacificWeekday(now: Date): number {
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Los_Angeles' }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

export async function runDaily(now: Date = new Date()): Promise<DailyReport> {
  const report: DailyReport = { meetingReminders: 0, visitorFollowups: 0, memberFollowups: 0, onboardingReminders: 0, digests: 0, meetingRecaps: 0 };
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
      ? db
          .from('guest_requests')
          .select(guestFields)
          .eq('status', 'visited')
          .in('meeting_id', [...recentIds])
      : Promise.resolve({
          data: [] as {
            id: string;
            first_name: string;
            last_name: string;
            email: string;
            referrer_id: string | null;
            meeting_id: string | null;
            created_at: string;
          }[],
        }),
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

  // 5. Meeting recap, as a fallback for one the after-meeting job missed.
  report.meetingRecaps = await runRecaps(now);

  return report;
}

/**
 * Meeting recap to every approved member after a regular meeting ends (Vercel Cron → /api/cron/after-meeting,
 * around noon Pacific; the daily job repeats it next morning in case that run was missed). Only meetings that
 * ended in the past 36 hours, once per member per meeting.
 */
export async function runRecaps(now: Date = new Date()): Promise<number> {
  const db = createAdminClient();
  if (!db) return 0;
  const url = siteUrl();
  const nowIso = now.toISOString();
  const { data: ended } = await db
    .from('meetings')
    .select('id, slug, title, meeting_speakers(slot, display_name, business, topic, topic_description)')
    .eq('category', 'Networking')
    .is('cancelled_reason', null)
    .lte('ends_at', nowIso)
    .gte('ends_at', new Date(now.getTime() - 36 * 3_600_000).toISOString())
    .order('starts_at');
  if (!ended?.length) return 0;

  const [{ data: events }, { data: next }, { data: members }] = await Promise.all([
    db
      .from('member_events')
      .select('slug, title, starts_at, location')
      .gte('starts_at', nowIso)
      .lt('starts_at', new Date(now.getTime() + 14 * DAY).toISOString())
      .order('starts_at')
      .limit(3),
    db
      .from('meetings')
      .select('starts_at, is_online, location, meeting_speakers(slot, display_name, business)')
      .eq('category', 'Networking')
      .is('cancelled_reason', null)
      .gt('starts_at', nowIso)
      .order('starts_at')
      .limit(1)
      .maybeSingle(),
    db.from('profiles').select('id').eq('status', 'approved'),
  ]);
  const ids = (members ?? []).map((m) => m.id);
  const people = await loadRecipients(ids);
  const off = await loadOptOuts(ids, 'meeting_recaps');
  const recapEvents: T.RecapEvent[] = (events ?? []).map((e) => {
    const d = new Date(e.starts_at);
    return { when: `${formatMeetingDate(d)} · ${formatMeetingTime(d)}`, title: e.title, href: `${url}/events/${e.slug}`, where: e.location };
  });
  type NextSp = { slot: string; display_name: string; business: string | null };
  const nextSpeakers = (next?.meeting_speakers ?? []) as NextSp[];
  const nextBy = (slot: string) => {
    const sp = nextSpeakers.find((x) => x.slot === slot);
    return sp ? T.companyAndPerson(sp.display_name, sp.business) : null;
  };
  const zoom = 'Online: Zoom (see separate calendar invite)';
  const nextInfo = next
    ? {
        date: new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', timeZone: 'America/Los_Angeles' }).format(new Date(next.starts_at)),
        location: next.is_online || !next.location ? zoom : next.location,
        five: nextBy('education'),
        ten: nextBy('presentation'),
      }
    : null;

  let sent = 0;
  for (const m of ended) {
    type Sp = { slot: string; display_name: string; business: string | null; topic: string | null; topic_description: string | null };
    const speakers = (m.meeting_speakers ?? []) as Sp[];
    const [{ data: media }, { data: links }, { data: guests }] = await Promise.all([
      db
        .from('meeting_slide_media')
        .select('id, kind, title, after_slide')
        .eq('meeting_id', m.id)
        .in('after_slide', ['five_minute', 'ten_minute'])
        .order('sort'),
      db.from('meeting_slide_links').select('title, url, after_slide').eq('meeting_id', m.id).in('after_slide', ['five_minute', 'ten_minute']).order('sort'),
      db
        .from('guest_requests')
        .select('first_name, last_name, business_name, email, phone, website, referrer_id, invited_by_text, created_at')
        .eq('meeting_id', m.id)
        .in('status', ['visited', 'applied', 'joined'])
        .order('created_at'),
    ]);
    const kindLabel = { pdf: 'Presentation (PDF)', image: 'Presentation image', youtube: 'Watch the video' } as const;
    const materialsFor = (slide: string): [string, string][] => [
      ...(media ?? [])
        .filter((x) => x.after_slide === slide)
        .map((x): [string, string] => [x.title || kindLabel[x.kind], `${url}/present/${m.slug}/material/${x.id}`]),
      ...(links ?? []).filter((x) => x.after_slide === slide).map((x): [string, string] => [x.title || x.url.replace(/^https?:\/\//i, ''), x.url]),
    ];
    const talk = (slot: string, slide: string): T.RecapTalk | null => {
      const sp = speakers.find((x) => x.slot === slot);
      return sp ? { name: sp.display_name, business: sp.business, topic: sp.topic, description: sp.topic_description, materials: materialsFor(slide) } : null;
    };
    const five = talk('education', 'five_minute');
    const ten = talk('presentation', 'ten_minute');

    // Today's visitors and the members who invited them (first names, as the group writes it).
    const visitors: T.RecapVisitor[] = (guests ?? []).map((g) => ({
      name: `${g.first_name} ${g.last_name}`,
      business: g.business_name,
      email: g.email,
      website: g.website,
      phone: g.phone,
    }));
    const referrerIds = [...new Set((guests ?? []).map((g) => g.referrer_id).filter((x): x is string => !!x))];
    const { data: referrers } = referrerIds.length
      ? await db.from('profiles').select('id, first_name').in('id', referrerIds)
      : { data: [] as { id: string; first_name: string }[] };
    const firstName = new Map((referrers ?? []).map((r) => [r.id, r.first_name]));
    const inviters = [
      ...new Set(
        (guests ?? [])
          .map((g) => (g.referrer_id ? firstName.get(g.referrer_id) : g.invited_by_text?.replace(/\s*\(via referral link\)\s*$/i, '').trim()))
          .filter((x): x is string => !!x),
      ),
    ];

    for (const r of people.values()) {
      if (off.has(r.id)) continue;
      const s = await deliver({
        kind: 'meeting_recap',
        dedupeKey: m.id,
        to: { email: r.email, name: `${r.firstName} ${r.lastName}`, profileId: r.id },
        email: T.meetingRecapEmail({
          siteUrl: url,
          firstName: r.firstName,
          meetingTitle: m.title,
          slidesHref: `${url}/present/${m.slug}`,
          visitors,
          inviters,
          five,
          ten,
          events: recapEvents,
          next: nextInfo,
        }),
      });
      if (s === 'sent') sent += 1;
    }
  }
  return sent;
}
