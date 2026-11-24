import 'server-only';
import { createClient } from '../supabase/server';
import { localDateKey } from '../dates';
import { periodRange } from '../periods';
import { resolveNotes, resolveSlides, resolveTimers, type SlideKey, type SlideNotes, type TimerSettings } from '../slides';
import { getUpcomingMemberEvents, type CalendarItem, fromMeeting } from './events';
import { finalizeMeetingChampions, getChampionAwards, getChampionPeriods, getChampionRanking, getMeetingChampionRanking, type ChampionAward } from './champion';
import { MEETING_CHAMPION_FROM, meetingDateLabel, monthOf, monthRange, previousMonth } from '../champion';
import { getGroupTotals, getGroupTotalsWindow, getLeaderboardWindow, type GroupTotals, type LeaderRow } from './member';
import { getCategorySeats, getLeadership, getMeetingBySlug, getUpcomingMeetings, type MeetingWithSpeakers, type Speaker } from './public';

// Everything the meeting slide deck shows, loaded as the signed-in member (RLS applies).

export type SpeakerCard = Speaker & { avatar_path: string | null };

export type SlideMedia = {
  id: string;
  kind: 'image' | 'pdf' | 'youtube' | 'powerpoint' | 'link';
  title: string | null;
  url: string | null;
  youtubeId: string | null;
  start: number;
  pageCount: number;
  afterSlide: string;
  createdAt: string;
};

export type DeckData = {
  meeting: MeetingWithSpeakers;
  number: number;
  slides: SlideKey[];
  notes: SlideNotes;
  timers: TimerSettings;
  saved: boolean;
  leadership: { id: string; name: string; role: string; photo: string | null; business: string | null }[];
  media: SlideMedia[];
  openCategories: string[];
  newMembers: { first_name: string; last_name: string; business_name: string }[];
  visitors: { display_name: string; business_name: string | null; invited_by: string | null }[];
  asks: { first_name: string; last_name: string; business_name: string; weekly_ask: string }[];
  five: SpeakerCard | null;
  ten: SpeakerCard | null;
  totals: { label: string; t: GroupTotals }[];
  leaders: LeaderRow[];
  events: CalendarItem[];
  next: (MeetingWithSpeakers & { five: SpeakerCard | null; ten: SpeakerCard | null }) | null;
  /**
   * BARP Champion slide. From MEETING_CHAMPION_FROM (owner, 2026-11-23): this meeting's champion, the member with the most
   * points since the previous meeting, live until it is recorded (`since`: "the Nov 9 meeting"). Before: the monthly champion,
   * else that month's leader so far.
   */
  champion: {
    award: ChampionAward | null;
    monthLabel: string;
    leaders: { id: string; name: string; points: number; avatar: string | null }[];
    since?: string | null;
  };
  /** Members whose birthday is in the meeting's month (owner meeting 2026-10-30): a slide before the BARP Champion. */
  birthdays: { id: string; name: string; day: number; avatar: string | null }[];
};

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}${error ? `: ${error.message}` : ''}`);
}

export async function getDeckData(slug: string): Promise<DeckData | null> {
  const meeting = await getMeetingBySlug(slug);
  if (!meeting) return null;
  const supabase = await createClient();
  const start = meeting.starts_at;

  const [settingsRes, prevRes, countRes, nextRes, mediaRes, linksRes] = await Promise.all([
    supabase.from('meeting_slide_settings').select('slides, notes, timers').eq('meeting_id', meeting.id).maybeSingle(),
    // The last meeting that was actually held: a cancelled one (Nov 23) must not restart "since the last meeting".
    supabase
      .from('meetings')
      .select('starts_at, ends_at')
      .eq('category', 'Networking')
      .is('cancelled_reason', null)
      .lt('starts_at', start)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('meetings').select('id', { count: 'exact', head: true }).eq('category', 'Networking').lte('starts_at', start),
    supabase
      .from('meetings')
      .select('*, meeting_speakers(slot, display_name, business, profile_id, topic, topic_description)')
      .eq('category', 'Networking')
      .is('cancelled_reason', null)
      .eq('hidden', false)
      .gt('starts_at', start)
      .order('starts_at')
      .limit(1)
      .maybeSingle(),
    supabase.from('meeting_slide_media').select('*').eq('meeting_id', meeting.id).order('sort').order('created_at'),
    supabase.from('meeting_slide_links').select('*').eq('meeting_id', meeting.id).order('sort').order('created_at'),
  ]);
  if (settingsRes.error || prevRes.error || countRes.error || nextRes.error) fail('the slides', settingsRes.error ?? prevRes.error ?? countRes.error);

  const prevStart = prevRes.data?.starts_at ?? new Date(Date.parse(start) - 14 * 86400000).toISOString();
  const meetingDay = localDateKey(new Date(start));
  // "Since the last meeting" (owner, 2026-11-24): from the end of the last held meeting to the end of this one, so
  // one-on-ones, referrals and closed business reported before and during this meeting show after Refresh / R.
  const cycleWindow = { from: prevRes.data?.ends_at ?? prevStart, to: meeting.ends_at };

  // Photos for today's presenters and the next meeting's (shown on the closing slide).
  const nextSpeakers = ((nextRes.data as MeetingWithSpeakers | null)?.meeting_speakers ?? []) as Speaker[];
  const speakerIds = [...meeting.meeting_speakers, ...nextSpeakers].map((s) => s.profile_id).filter((x): x is string => !!x);
  const meetingMonth = Number(meetingDay.slice(5, 7));
  const [visitorsRes, newRes, asksRes, avatarsRes, seats, cycleT, monthT, yearT, leaders, groupEvents, memberEvents, leadership, birthdaysRes] =
    await Promise.all([
      supabase.rpc('meeting_visitors', { p_meeting: meeting.id }),
      supabase
        .from('profiles')
        .select('first_name, last_name, business_name')
        .eq('status', 'approved')
        .gte('approved_at', prevStart)
        .lte('approved_at', start)
        .order('first_name'),
      supabase
        .from('profiles')
        .select('first_name, last_name, business_name, weekly_ask')
        .eq('status', 'approved')
        .not('weekly_ask', 'is', null)
        .order('first_name'),
      speakerIds.length ? supabase.from('profiles').select('id, avatar_path').in('id', speakerIds) : Promise.resolve({ data: [], error: null }),
      getCategorySeats(),
      getGroupTotalsWindow(cycleWindow),
      getGroupTotals(periodRange({ period: 'month' })),
      getGroupTotals(periodRange({ period: 'year' })),
      getLeaderboardWindow(cycleWindow),
      getUpcomingMeetings(12),
      getUpcomingMemberEvents(12),
      getLeadership(),
      supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_path, birthday_day')
        .eq('status', 'approved')
        .eq('birthday_month', meetingMonth)
        .order('birthday_day'),
    ]);
  if (visitorsRes.error || newRes.error || asksRes.error || avatarsRes.error) fail('the slides', visitorsRes.error ?? newRes.error ?? asksRes.error);

  const avatar = new Map((avatarsRes.data ?? []).map((a) => [a.id, a.avatar_path]));
  const card = (slot: 'education' | 'presentation', from: Speaker[] = meeting.meeting_speakers): SpeakerCard | null => {
    const s = from.find((x) => x.slot === slot);
    return s ? { ...s, avatar_path: s.profile_id ? (avatar.get(s.profile_id) ?? null) : null } : null;
  };
  const horizon = Date.parse(start) + 45 * 86400000;
  const events = [...groupEvents.filter((m) => m.category !== 'Networking' && !m.cancelled_reason).map(fromMeeting), ...memberEvents]
    .filter((e) => Date.parse(e.ends_at) > Date.now() && Date.parse(e.starts_at) < horizon)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 6);
  const next = nextRes.data as MeetingWithSpeakers | null;

  // Uploaded slide files are private: give the deck short-lived signed links (a meeting fits in 3 hours).
  const mediaRows = mediaRes.error ? [] : (mediaRes.data ?? []);
  const paths = mediaRows.map((m) => m.storage_path).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from('slide-media').createSignedUrls(paths, 3 * 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) signed.set(d.path, d.signedUrl);
  }
  const fileMedia: SlideMedia[] = mediaRows.map((m) => ({
    id: m.id,
    kind: m.kind,
    title: m.title,
    url: m.storage_path ? (signed.get(m.storage_path) ?? null) : null,
    youtubeId: m.youtube_id,
    start: m.start_seconds,
    pageCount: m.page_count ?? 1,
    afterSlide: m.after_slide,
    createdAt: m.created_at,
  }));
  const linkMedia: SlideMedia[] = (linksRes.error ? [] : (linksRes.data ?? [])).map((l) => ({
    id: l.id,
    kind: 'link' as const,
    title: l.title,
    url: l.url,
    youtubeId: null,
    start: 0,
    pageCount: 1,
    afterSlide: l.after_slide,
    createdAt: l.created_at,
  }));
  // Files, videos and links in the order they were added.
  const media = [...fileMedia, ...linkMedia].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const champion = await loadChampionSlide(meeting.starts_at, meeting.id, settingsRes.data?.slides);

  return {
    meeting,
    number: countRes.count ?? 1,
    slides: resolveSlides(settingsRes.data?.slides),
    notes: resolveNotes(settingsRes.data?.notes),
    timers: resolveTimers(settingsRes.data?.timers),
    saved: !!settingsRes.data,
    leadership: leadership.map((l) => ({
      id: l.id,
      name: l.name,
      role: l.role,
      photo: l.photo_path ?? l.profile?.avatar_path ?? null,
      business: l.profile?.business_name ?? null,
    })),
    media,
    openCategories: seats.filter((c) => c.open && c.name !== 'Other').map((c) => c.name),
    newMembers: newRes.data,
    visitors: visitorsRes.data ?? [],
    asks: asksRes.data.filter((a): a is typeof a & { weekly_ask: string } => !!a.weekly_ask),
    five: card('education'),
    ten: card('presentation'),
    totals: [
      { label: 'Since the last meeting', t: cycleT },
      { label: 'This month', t: monthT },
      { label: 'This year', t: yearT },
    ],
    leaders,
    events,
    champion,
    birthdays: (birthdaysRes.data ?? []).map((b) => ({
      id: b.id,
      name: `${b.first_name} ${b.last_name}`,
      day: b.birthday_day ?? 1,
      avatar: b.avatar_path,
    })),
    next: next
      ? {
          ...next,
          five: card('education', next.meeting_speakers),
          ten: card('presentation', next.meeting_speakers),
        }
      : null,
  };
}

/** Data for the BARP Champion slide (owner, 2026-10-23; per meeting from 2026-11-23). Only loaded when the slide is in the deck. */
async function loadChampionSlide(startsAt: string, meetingId: string, saved: readonly string[] | null | undefined): Promise<DeckData['champion']> {
  const month = monthOf(new Date(startsAt));
  const empty = { award: null, monthLabel: monthRange(month).label, leaders: [] };
  if (!resolveSlides(saved).includes('champion')) return empty;
  try {
    const supabase = await createClient();
    const period = (await getChampionPeriods()).find((p) => p.meetingId === meetingId);
    if (period && period.to >= MEETING_CHAMPION_FROM) {
      // Per meeting: the recorded (or admin-chosen) champion of this meeting, else the live leader since the last meeting.
      // "Refresh" on the deck reloads this, so points reported during the meeting count.
      await finalizeMeetingChampions().catch(() => 0);
      const since = period.previousStart ? `the ${meetingDateLabel(period.previousStart)} meeting` : null;
      const label = `${meetingDateLabel(period.startsAt)} meeting`;
      const recorded = (await getChampionAwards(10)).find((a) => a.kind === 'meeting' && a.key === meetingId) ?? null;
      if (recorded) return { ...empty, award: recorded, since };
      const { auto } = await getMeetingChampionRanking(period);
      if (!auto) return { ...empty, since };
      const { data: p } = await supabase.from('profiles').select('business_name, slug, avatar_path').eq('id', auto.id).maybeSingle();
      return {
        ...empty,
        since,
        award: {
          key: meetingId,
          kind: 'meeting',
          endsAt: period.to,
          month: '',
          label,
          profileId: auto.id,
          name: auto.name,
          business: p?.business_name ?? null,
          slug: p?.slug ?? null,
          avatar: p?.avatar_path ?? null,
          reason: null,
          points: { ...auto },
          overridden: false,
        },
      };
    }
    // Before per-meeting champions: a champion chosen by an admin always wins: this month's if one is already chosen,
    // otherwise last month's (the reigning champion). Only when neither exists does the slide show this month's leader.
    const awards = (await getChampionAwards(6)).filter((a) => a.kind === 'month');
    const award = awards.find((a) => a.month === monthRange(month).key) ?? awards.find((a) => a.month === monthRange(previousMonth(month)).key) ?? null;
    if (award) return { ...empty, award };
    const { rows } = await getChampionRanking(month);
    // Only the top scorer is shown (owner, 2026-10-25).
    const top = rows.filter((r) => r.eligible).slice(0, 1);
    const { data: pics } = top.length
      ? await supabase
          .from('profiles')
          .select('id, avatar_path')
          .in(
            'id',
            top.map((t) => t.id),
          )
      : { data: [] };
    const pic = new Map((pics ?? []).map((p) => [p.id, p.avatar_path]));
    return { ...empty, leaders: top.map((t) => ({ id: t.id, name: t.name, points: t.points, avatar: pic.get(t.id) ?? null })) };
  } catch {
    return empty;
  }
}
