import 'server-only';
import { createClient } from '../supabase/server';
import type { Tables } from '../database.types';
import { getMeetingBySlug, getMeetingsBetween, getUpcomingMeetings, type MeetingWithSpeakers, type Speaker } from './public';

// Group meetings/events (admin-run, `meetings`) and member events (`member_events`).
// The public site shows them on separate pages (/group-meetings and /events); the .ics feed and slides combine them.

export type CalendarItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  starts_at: string;
  ends_at: string;
  is_online: boolean;
  location: string | null;
  kind: 'group' | 'member';
  /** Group Networking meetings (the regular Monday meeting). */
  regular: boolean;
  /** Set when an admin cancelled a group meeting (e.g. a holiday). It stays on the schedule, marked cancelled. */
  cancelledReason: string | null;
  onlineUrl: string | null;
  imagePath: string | null;
  hostId: string | null;
  hostName: string | null;
  hostSlug: string | null;
  speakers: Speaker[];
  tags: string[];
  organizerId: string | null;
};

type HostedEvent = Tables<'member_events'> & { host: { first_name: string; last_name: string; slug: string } | null };
const EVENT_FIELDS = '*, host:profiles!member_events_host_id_fkey(first_name, last_name, slug)';

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}${error ? `: ${error.message}` : ''}`);
}

export function fromMeeting(m: MeetingWithSpeakers): CalendarItem {
  return {
    id: m.id,
    slug: m.slug,
    title: m.title,
    description: m.description,
    category: m.category,
    starts_at: m.starts_at,
    ends_at: m.ends_at,
    is_online: m.is_online,
    location: m.location,
    kind: 'group',
    regular: m.category === 'Networking',
    cancelledReason: m.cancelled_reason,
    onlineUrl: null,
    imagePath: null,
    hostId: null,
    hostName: null,
    hostSlug: null,
    speakers: m.meeting_speakers,
    tags: m.tags,
    organizerId: m.organizer_id,
  };
}

export function fromMemberEvent(e: HostedEvent): CalendarItem {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    category: e.category,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    is_online: e.is_online,
    location: e.location,
    kind: 'member',
    regular: false,
    cancelledReason: null,
    onlineUrl: e.online_url,
    imagePath: e.image_path,
    hostId: e.host_id,
    hostName: e.host ? `${e.host.first_name} ${e.host.last_name}` : null,
    hostSlug: e.host?.slug ?? null,
    speakers: [],
    tags: [],
    organizerId: null,
  };
}

const byStart = (a: CalendarItem, b: CalendarItem) => a.starts_at.localeCompare(b.starts_at);

export async function getUpcomingMemberEvents(limit = 20): Promise<CalendarItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('member_events').select(EVENT_FIELDS).gt('ends_at', new Date().toISOString()).order('starts_at').limit(limit);
  if (error) fail('member events', error);
  return (data as HostedEvent[]).map(fromMemberEvent);
}

/** 'group' = meetings run by the group; 'member' = events hosted by members; omitted = both. */
export type CalendarKind = CalendarItem['kind'];

/** Upcoming items, soonest first. The public site lists group meetings and member events on separate pages. */
export async function getUpcomingCalendar(limit = 12, kind?: CalendarKind): Promise<CalendarItem[]> {
  const [meetings, events] = await Promise.all([kind === 'member' ? [] : getUpcomingMeetings(limit), kind === 'group' ? [] : getUpcomingMemberEvents(limit)]);
  return [...meetings.map(fromMeeting), ...events].sort(byStart).slice(0, limit);
}

export async function getCalendarBetween(fromIso: string, toIso: string, kind?: CalendarKind): Promise<CalendarItem[]> {
  const supabase = await createClient();
  const [meetings, eventsRes] = await Promise.all([
    kind === 'member' ? [] : getMeetingsBetween(fromIso, toIso),
    kind === 'group'
      ? { data: [], error: null }
      : supabase.from('member_events').select(EVENT_FIELDS).gte('starts_at', fromIso).lt('starts_at', toIso).order('starts_at'),
  ]);
  if (eventsRes.error) fail('member events', eventsRes.error);
  return [...meetings.map(fromMeeting), ...(eventsRes.data as HostedEvent[]).map(fromMemberEvent)].sort(byStart);
}

/** The public list page an item belongs to. */
export const listPathFor = (kind: CalendarKind) => (kind === 'group' ? '/group-meetings' : '/events');

export async function getMemberEventBySlug(slug: string): Promise<CalendarItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('member_events').select(EVENT_FIELDS).eq('slug', slug).maybeSingle();
  if (error) fail('the event', error);
  return data ? fromMemberEvent(data as HostedEvent) : null;
}

/** A group meeting/event or a member event by its link. */
export async function getCalendarItemBySlug(slug: string): Promise<CalendarItem | null> {
  const m = await getMeetingBySlug(slug);
  return m ? fromMeeting(m) : getMemberEventBySlug(slug);
}
