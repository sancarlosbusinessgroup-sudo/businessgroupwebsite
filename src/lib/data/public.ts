import 'server-only';
import { revalidateTag, unstable_cache } from 'next/cache';
import { cache } from 'react';
import { createAdminClient } from '../supabase/admin';
import { publicClient } from '../supabase/public';
import type { Tables } from '../database.types';
import { formatMeetingDate } from '../dates';

// Public data is the same for everyone, so each loader runs as an anonymous visitor and its result is shared across
// requests for up to a minute (audit, 2026-10-27). Admin and member actions that change this data revalidate the pages
// that show it, which drops the cached entries early; the minute is the backstop. React's cache() on top deduplicates
// the calls one page makes (the layout and the page both ask for the next meeting, for example).
const MINUTE = 60;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shared = <F extends (...args: any[]) => Promise<unknown>>(name: string, tags: string[], fn: F): F =>
  cache(unstable_cache(fn, ['public', name], { revalidate: MINUTE, tags })) as unknown as F;

export type Speaker = Pick<Tables<'meeting_speakers'>, 'slot' | 'display_name' | 'business' | 'profile_id' | 'topic' | 'topic_description'>;
export type MeetingWithSpeakers = Tables<'meetings'> & { meeting_speakers: Speaker[] };

const MEETING_FIELDS = '*, meeting_speakers(slot, display_name, business, profile_id, topic, topic_description)';

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}${error ? `: ${error.message}` : ''}`);
}

/**
 * Upcoming group meetings and events for the website. Cancelled meetings and meetings an admin hid are left out
 * (the owner's rule: don't show them). Pass `{ all: true }` for the admin schedule, which lists them so they can be
 * restored or shown again.
 */
export const getUpcomingMeetings = shared(
  'getUpcomingMeetings',
  ['meetings'],
  async (limit = 10, opts: { all?: boolean } = {}): Promise<MeetingWithSpeakers[]> => {
    const supabase = publicClient();
    let q = supabase.from('meetings').select(MEETING_FIELDS).gt('ends_at', new Date().toISOString());
    if (!opts.all) q = q.is('cancelled_reason', null).eq('hidden', false);
    const { data, error } = await q.order('starts_at').limit(limit);
    if (error) fail('meetings', error);
    return data;
  },
);

/** The next (or currently running) regular Monday meeting that isn't cancelled or hidden. */
export const getNextMeeting = shared('getNextMeeting', ['meetings'], async (): Promise<MeetingWithSpeakers | null> => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_FIELDS)
    .eq('category', 'Networking')
    .is('cancelled_reason', null)
    .eq('hidden', false)
    .gt('ends_at', new Date().toISOString())
    .order('starts_at')
    .limit(1)
    .maybeSingle();
  if (error) fail('the next meeting', error);
  return data;
});

/** Group meetings in a date range for the month view (cancelled and hidden ones left out). */
export const getMeetingsBetween = shared('getMeetingsBetween', ['meetings'], async (fromIso: string, toIso: string): Promise<MeetingWithSpeakers[]> => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_FIELDS)
    .is('cancelled_reason', null)
    .eq('hidden', false)
    .gte('starts_at', fromIso)
    .lt('starts_at', toIso)
    .order('starts_at');
  if (error) fail('meetings', error);
  return data;
});

export const getMeetingBySlug = shared('getMeetingBySlug', ['meetings'], async (slug: string): Promise<MeetingWithSpeakers | null> => {
  const supabase = publicClient();
  const { data, error } = await supabase.from('meetings').select(MEETING_FIELDS).eq('slug', slug).maybeSingle();
  if (error) fail('the event', error);
  return data;
});

export const getCategories = shared('getCategories', ['categories'], async (): Promise<Tables<'categories'>[]> => {
  const supabase = publicClient();
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) fail('categories', error);
  return data;
});

export type DirectoryMember = Pick<
  Tables<'profiles'>,
  'id' | 'slug' | 'first_name' | 'last_name' | 'business_name' | 'about' | 'logo_path' | 'avatar_path' | 'approved_at' | 'city' | 'website' | 'weekly_ask'
> & { categories: { name: string } | null };

export const getDirectory = shared('getDirectory', ['directory'], async (): Promise<DirectoryMember[]> => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, slug, first_name, last_name, business_name, about, logo_path, avatar_path, approved_at, city, website, weekly_ask, categories(name)')
    .eq('status', 'approved')
    .eq('show_in_directory', true)
    .order('business_name');
  if (error) fail('the member directory', error);
  return data;
});

// Only the columns a public profile page shows. Visitors are granted exactly these (column grants, 2026-10-28);
// a `select *` here would fail for them.
export const PUBLIC_PROFILE_COLUMNS =
  'id, slug, first_name, last_name, business_name, category_id, city, service_area, about, ideal_client, listen_for, services, website, logo_path, avatar_path, approved_at, member_since, weekly_ask, weekly_ask_updated_at, show_in_directory, show_phone_public, status, role, created_at';

export type PublicProfile = Pick<
  Tables<'profiles'>,
  | 'id'
  | 'slug'
  | 'first_name'
  | 'last_name'
  | 'business_name'
  | 'category_id'
  | 'city'
  | 'service_area'
  | 'about'
  | 'ideal_client'
  | 'listen_for'
  | 'services'
  | 'website'
  | 'logo_path'
  | 'avatar_path'
  | 'approved_at'
  | 'member_since'
  | 'weekly_ask'
  | 'weekly_ask_updated_at'
  | 'show_in_directory'
  | 'show_phone_public'
  | 'status'
  | 'role'
  | 'created_at'
> & { categories: { name: string } | null };

export const getMemberBySlug = shared('getMemberBySlug', ['directory'], async (slug: string): Promise<PublicProfile | null> => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(`${PUBLIC_PROFILE_COLUMNS}, categories(name)`)
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle();
  if (error) fail('this member', error);
  return data;
});

export const getPublicPhone = shared('getPublicPhone', ['directory'], async (slug: string): Promise<string | null> => {
  const supabase = publicClient();
  const { data, error } = await supabase.rpc('public_phone', { p_slug: slug });
  if (error) fail('contact details', error);
  return data ?? null;
});

export const getGallery = shared(
  'getGallery',
  ['gallery'],
  async (album?: Tables<'gallery_photos'>['album'], limit = 60): Promise<Tables<'gallery_photos'>[]> => {
    const supabase = publicClient();
    let q = supabase.from('gallery_photos').select('*').order('taken_on', { ascending: false, nullsFirst: false }).limit(limit);
    if (album) q = q.eq('album', album);
    const { data, error } = await q;
    if (error) fail('photos', error);
    return data;
  },
);

export const getMemberCount = shared('getMemberCount', ['directory'], async (): Promise<number> => {
  const supabase = publicClient();
  const { data, error } = await supabase.rpc('member_count');
  if (error) fail('member count', error);
  return data;
});

export type LeadershipEntry = Tables<'leadership'> & { profile: { slug: string; avatar_path: string | null; business_name: string } | null };

/** Management list for the About page (admin-editable). */
export const getLeadership = shared('getLeadership', ['leadership'], async (): Promise<LeadershipEntry[]> => {
  const supabase = publicClient();
  const { data, error } = await supabase.from('leadership').select('*, profile:profiles(slug, avatar_path, business_name)').order('sort_order').order('name');
  if (error) fail('the management list', error);
  return data as LeadershipEntry[];
});

export type CategorySeats = { id: number; name: string; seat_limit: number; taken: number; open: boolean };

/** Every category with its seat limit and how many approved members hold it. */
export const getCategorySeats = shared('getCategorySeats', ['categories'], async (): Promise<CategorySeats[]> => {
  const supabase = publicClient();
  const { data, error } = await supabase.rpc('open_categories');
  if (error) fail('categories', error);
  return data.map((c) => ({ ...c, taken: Number(c.taken), open: Number(c.taken) < c.seat_limit }));
});

/** Drop the shared public-data cache for a tag (see lib/data/public.ts) so the next visitor sees the change at once. */
export async function bustPublic(...tags: ('meetings' | 'directory' | 'gallery' | 'categories' | 'leadership')[]) {
  for (const t of tags) revalidateTag(t, 'max');
}

/**
 * The approved member behind a referral code, for "Invited by …" on the Visit and Join pages. Visitors can't read
 * `profiles.referral_code` since the 2026-10-28 column grants, so this looks it up server-side with the service role
 * (only the name leaves this function). Null when the code is unknown or email isn't configured.
 */
export async function referrerByCode(code: string | undefined): Promise<{ name: string } | null> {
  if (!code) return null;
  const db = createAdminClient();
  if (!db) return null;
  const { data } = await db.from('profiles').select('first_name, last_name').eq('referral_code', code).eq('status', 'approved').maybeSingle();
  return data ? { name: `${data.first_name} ${data.last_name}` } : null;
}

/** The next three regular Monday meetings, as choices for the guest invite forms (public and member versions). */
export async function guestMeetingOptions(): Promise<{ id: string; label: string }[]> {
  const upcoming = await getUpcomingMeetings(6);
  return upcoming
    .filter((m) => m.category === 'Networking')
    .slice(0, 3)
    .map((m) => ({ id: m.id, label: `${formatMeetingDate(new Date(m.starts_at))} · Zoom` }));
}
