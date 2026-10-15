import 'server-only';
import { createClient } from '../supabase/server';
import type { Tables } from '../database.types';

export type Speaker = Pick<Tables<'meeting_speakers'>, 'slot' | 'display_name' | 'business' | 'profile_id'>;
export type MeetingWithSpeakers = Tables<'meetings'> & { meeting_speakers: Speaker[] };

const MEETING_FIELDS = '*, meeting_speakers(slot, display_name, business, profile_id)';

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}${error ? `: ${error.message}` : ''}`);
}

export async function getUpcomingMeetings(limit = 10): Promise<MeetingWithSpeakers[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('meetings').select(MEETING_FIELDS).gt('ends_at', new Date().toISOString()).order('starts_at').limit(limit);
  if (error) fail('meetings', error);
  return data;
}

/** The next (or currently running) regular Monday meeting. */
export async function getNextMeeting(): Promise<MeetingWithSpeakers | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_FIELDS)
    .eq('category', 'Networking')
    .gt('ends_at', new Date().toISOString())
    .order('starts_at')
    .limit(1)
    .maybeSingle();
  if (error) fail('the next meeting', error);
  return data;
}

export async function getMeetingsBetween(fromIso: string, toIso: string): Promise<MeetingWithSpeakers[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('meetings').select(MEETING_FIELDS).gte('starts_at', fromIso).lt('starts_at', toIso).order('starts_at');
  if (error) fail('meetings', error);
  return data;
}

export async function getMeetingBySlug(slug: string): Promise<MeetingWithSpeakers | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('meetings').select(MEETING_FIELDS).eq('slug', slug).maybeSingle();
  if (error) fail('the event', error);
  return data;
}

export async function getCategories(): Promise<Tables<'categories'>[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) fail('categories', error);
  return data;
}

export type DirectoryMember = Pick<
  Tables<'profiles'>,
  'id' | 'slug' | 'first_name' | 'last_name' | 'business_name' | 'about' | 'logo_path' | 'avatar_path' | 'approved_at' | 'city'
> & { categories: { name: string } | null };

export async function getDirectory(): Promise<DirectoryMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, slug, first_name, last_name, business_name, about, logo_path, avatar_path, approved_at, city, categories(name)')
    .eq('status', 'approved')
    .eq('show_in_directory', true)
    .order('business_name');
  if (error) fail('the member directory', error);
  return data;
}

export type PublicProfile = Tables<'profiles'> & { categories: { name: string } | null };

export async function getMemberBySlug(slug: string): Promise<PublicProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('profiles').select('*, categories(name)').eq('slug', slug).eq('status', 'approved').maybeSingle();
  if (error) fail('this member', error);
  return data;
}

export type PublicStats = {
  attendance_pct: number | null;
  referrals_given: number;
  one_on_ones: number;
  members_invited: number;
} | null;

export async function getPublicStats(slug: string): Promise<PublicStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('public_member_stats', { p_slug: slug });
  if (error) fail('member stats', error);
  return data as PublicStats;
}

export async function getPublicPhone(slug: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('public_phone', { p_slug: slug });
  if (error) fail('contact details', error);
  return data ?? null;
}

export async function getGallery(album?: Tables<'gallery_photos'>['album'], limit = 60): Promise<Tables<'gallery_photos'>[]> {
  const supabase = await createClient();
  let q = supabase.from('gallery_photos').select('*').order('taken_on', { ascending: false, nullsFirst: false }).limit(limit);
  if (album) q = q.eq('album', album);
  const { data, error } = await q;
  if (error) fail('photos', error);
  return data;
}

export async function getMemberCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('member_count');
  if (error) fail('member count', error);
  return data;
}
