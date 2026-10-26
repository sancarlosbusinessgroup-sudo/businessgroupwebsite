// The meeting recap email's content, built from the database. Shared by the after-meeting send job (cron.ts)
// and the admin preview (/admin/recap), so the preview shows exactly what members are sent.
import 'server-only';

import { formatMeetingDate, formatMeetingTime } from '../dates';
import type { createAdminClient } from '../supabase/admin';
import { siteUrl } from './notify';
import * as T from './templates';

export type Db = NonNullable<ReturnType<typeof createAdminClient>>;

/** Everything in the recap except the greeting name (set per member when sent). */
export type RecapContent = Omit<Parameters<typeof T.meetingRecapEmail>[0], 'siteUrl' | 'firstName'>;

type Speaker = { slot: string; display_name: string; business: string | null; topic: string | null; topic_description: string | null };
export type EndedMeeting = { id: string; slug: string; title: string; starts_at?: string; meeting_speakers: Speaker[] | null };

const DAY = 86_400_000;

/** The parts shared by every meeting's recap: member events in the next two weeks and the next regular meeting. */
export async function recapShared(db: Db, now: Date) {
  const url = siteUrl();
  const nowIso = now.toISOString();
  const [{ data: events }, { data: next }] = await Promise.all([
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
  ]);
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
  return { events: recapEvents, next: nextInfo };
}

export type RecapShared = Awaited<ReturnType<typeof recapShared>>;

/** The most recent regular meeting that has ended (any time in the past). */
export async function latestEndedMeeting(db: Db, now: Date): Promise<EndedMeeting | null> {
  const { data } = await db
    .from('meetings')
    .select('id, slug, title, starts_at, meeting_speakers(slot, display_name, business, topic, topic_description)')
    .eq('category', 'Networking')
    .is('cancelled_reason', null)
    .lte('ends_at', now.toISOString())
    .order('ends_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** The recap content for one ended meeting: its talks and materials, today's visitors and who invited them. */
export async function recapForMeeting(db: Db, m: EndedMeeting, shared: RecapShared): Promise<RecapContent> {
  const url = siteUrl();
  const speakers = m.meeting_speakers ?? [];
  const [{ data: media }, { data: links }, { data: guests }] = await Promise.all([
    db.from('meeting_slide_media').select('id, kind, title, after_slide').eq('meeting_id', m.id).in('after_slide', ['five_minute', 'ten_minute']).order('sort'),
    db.from('meeting_slide_links').select('title, url, after_slide').eq('meeting_id', m.id).in('after_slide', ['five_minute', 'ten_minute']).order('sort'),
    db
      .from('guest_requests')
      .select('first_name, last_name, business_name, email, phone, website, referrer_id, invited_by_text, created_at')
      .eq('meeting_id', m.id)
      .in('status', ['visited', 'applied', 'joined'])
      .order('created_at'),
  ]);
  const kindLabel = { pdf: 'Presentation (PDF)', powerpoint: 'Presentation (PowerPoint)', image: 'Presentation image', youtube: 'Watch the video' } as const;
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

  return {
    meetingTitle: m.title,
    slidesHref: `${url}/present/${m.slug}`,
    visitors,
    inviters,
    five,
    ten,
    events: shared.events,
    next: shared.next,
  };
}
