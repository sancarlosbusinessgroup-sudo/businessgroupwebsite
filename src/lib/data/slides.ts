import 'server-only';
import { createClient } from '../supabase/server';
import { localDateKey } from '../dates';
import { periodRange } from '../periods';
import { resolveSlides, type SlideKey } from '../slides';
import { getUpcomingMemberEvents, type CalendarItem, fromMeeting } from './events';
import { getGroupTotals, getLeaderboard, type GroupTotals, type LeaderRow } from './member';
import { getCategorySeats, getMeetingBySlug, getUpcomingMeetings, type MeetingWithSpeakers, type Speaker } from './public';

// Everything the meeting slide deck shows, loaded as the signed-in member (RLS applies).

export type SpeakerCard = Speaker & { avatar_path: string | null };

export type DeckData = {
  meeting: MeetingWithSpeakers;
  number: number;
  slides: SlideKey[];
  saved: boolean;
  openCategories: string[];
  newMembers: { first_name: string; last_name: string; business_name: string }[];
  visitors: { display_name: string; business_name: string | null; invited_by: string | null }[];
  asks: { first_name: string; last_name: string; business_name: string; weekly_ask: string }[];
  five: SpeakerCard | null;
  ten: SpeakerCard | null;
  totals: { label: string; t: GroupTotals }[];
  leaders: LeaderRow[];
  events: CalendarItem[];
  next: (MeetingWithSpeakers & { five: Speaker | null; ten: Speaker | null }) | null;
};

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}${error ? `: ${error.message}` : ''}`);
}

export async function getDeckData(slug: string): Promise<DeckData | null> {
  const meeting = await getMeetingBySlug(slug);
  if (!meeting) return null;
  const supabase = await createClient();
  const start = meeting.starts_at;

  const [settingsRes, prevRes, countRes, nextRes] = await Promise.all([
    supabase.from('meeting_slide_settings').select('slides').eq('meeting_id', meeting.id).maybeSingle(),
    supabase
      .from('meetings')
      .select('starts_at')
      .eq('category', 'Networking')
      .lt('starts_at', start)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('meetings').select('id', { count: 'exact', head: true }).eq('category', 'Networking').lte('starts_at', start),
    supabase
      .from('meetings')
      .select('*, meeting_speakers(slot, display_name, business, profile_id, topic, topic_description)')
      .eq('category', 'Networking')
      .gt('starts_at', start)
      .order('starts_at')
      .limit(1)
      .maybeSingle(),
  ]);
  if (settingsRes.error || prevRes.error || countRes.error || nextRes.error) fail('the slides', settingsRes.error ?? prevRes.error ?? countRes.error);

  const prevStart = prevRes.data?.starts_at ?? new Date(Date.parse(start) - 14 * 86400000).toISOString();
  const meetingDay = localDateKey(new Date(start));
  const cycle = { from: localDateKey(new Date(prevStart)), to: meetingDay };

  const speakerIds = meeting.meeting_speakers.map((s) => s.profile_id).filter((x): x is string => !!x);
  const [visitorsRes, newRes, asksRes, avatarsRes, seats, cycleT, monthT, yearT, leaders, groupEvents, memberEvents] = await Promise.all([
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
    getGroupTotals(cycle),
    getGroupTotals(periodRange({ period: 'month' })),
    getGroupTotals(periodRange({ period: 'year' })),
    getLeaderboard(periodRange({ period: 'month' })),
    getUpcomingMeetings(12),
    getUpcomingMemberEvents(12),
  ]);
  if (visitorsRes.error || newRes.error || asksRes.error || avatarsRes.error) fail('the slides', visitorsRes.error ?? newRes.error ?? asksRes.error);

  const avatar = new Map((avatarsRes.data ?? []).map((a) => [a.id, a.avatar_path]));
  const card = (slot: 'education' | 'presentation'): SpeakerCard | null => {
    const s = meeting.meeting_speakers.find((x) => x.slot === slot);
    return s ? { ...s, avatar_path: s.profile_id ? (avatar.get(s.profile_id) ?? null) : null } : null;
  };
  const horizon = Date.parse(start) + 45 * 86400000;
  const events = [...groupEvents.filter((m) => m.category !== 'Networking').map(fromMeeting), ...memberEvents]
    .filter((e) => Date.parse(e.ends_at) > Date.now() && Date.parse(e.starts_at) < horizon)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 6);
  const next = nextRes.data as MeetingWithSpeakers | null;

  return {
    meeting,
    number: countRes.count ?? 1,
    slides: resolveSlides(settingsRes.data?.slides),
    saved: !!settingsRes.data,
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
    next: next
      ? {
          ...next,
          five: next.meeting_speakers.find((s) => s.slot === 'education') ?? null,
          ten: next.meeting_speakers.find((s) => s.slot === 'presentation') ?? null,
        }
      : null,
  };
}
