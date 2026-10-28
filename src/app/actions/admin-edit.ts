'use server';

// Admins editing what members own: profiles, contact phone, meetings and presentation slots, gallery captions,
// referrals, one-on-ones, one-on-one requests and RSVPs (owner, 2026-10-27).
// The database enforces every rule (RLS is_admin(), the owner-only role guard, the audit-log triggers); the checks
// here keep side effects (emails) from running for anyone who isn't an admin.

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { bustPublic } from '@/lib/data/public';
import { onMemberStatus, onSlotAssigned, onSlotRevoked } from '@/lib/email/events';
import { safely } from '@/lib/email/notify';
import { isoToPacificLocal, pacificLocalToIso } from '@/lib/dates';
import {
  type ActionState,
  adminOneOnOneSchema,
  adminProfileSchema,
  adminReferralSchema,
  assignSlotSchema,
  fieldErrors,
  formToObject,
  galleryMetaSchema,
  meetingSchema,
  oneOnOneRequestStatuses,
} from '@/lib/validation';

const GENERIC = 'Something went wrong. Please try again.';
const uuid = z.uuid();
const slotEnum = z.enum(['education', 'presentation']);

async function admin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  return { supabase, user, isAdmin: !!isAdmin && !!user };
}

const memberPaths = (id: string) => ['/admin', '/admin/members', `/admin/members/${id}`, '/members', '/dashboard', '/admin/activity', '/admin/stats'];
const meetingPaths = ['/admin', '/admin/meetings', '/meetings', '/events', '/group-meetings', '/dashboard', '/', '/present/next'];

// --- Member profiles ----------------------------------------------------------

/** Admin → Members → edit any member's profile fields, phone, category and status. */
export async function adminUpdateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = adminProfileSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values };
  const d = parsed.data;
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  const { data: before } = await supabase.from('profiles').select('status').eq('id', d.id).maybeSingle();
  if (!before) return { status: 'error', message: 'That member no longer exists.' };
  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_name: d.firstName,
      last_name: d.lastName,
      business_name: d.businessName,
      category_id: d.categoryId,
      website: d.website ?? null,
      city: d.city ?? null,
      service_area: d.serviceArea ?? null,
      about: d.about ?? null,
      ideal_client: d.idealClient ?? null,
      listen_for: d.listenFor ?? null,
      services: d.services,
      show_in_directory: d.showInDirectory,
      show_phone_public: d.showPhonePublic,
      status: d.status,
    })
    .eq('id', d.id)
    .select('id');
  if (error || !data?.length) {
    const full = error && /category is full/.test(error.message);
    return { status: 'error', message: full ? 'That category is full. Raise its seat limit on the Overview page or choose another.' : GENERIC, values };
  }
  const { error: cErr } = await supabase
    .from('member_contacts')
    .update({ phone: d.phone ?? null })
    .eq('profile_id', d.id);
  if (cErr) return { status: 'error', message: 'Profile saved, but the phone could not be updated.', values };
  for (const p of memberPaths(d.id)) revalidatePath(p);
  await bustPublic('directory', 'categories');
  if (before.status !== d.status) {
    const [pid, st] = [d.id, d.status];
    after(() => safely('member status', () => onMemberStatus(pid, st)));
  }
  return { status: 'success', message: 'Saved.', values };
}

/** Owners only (Viv, Ced, Rachanee, Shermaine): make someone an admin or a regular member. */
export async function setAdminRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get('id'));
  const role = z.enum(['member', 'admin']).safeParse(formData.get('role'));
  if (!id.success || !role.success) return { status: 'error', message: GENERIC };
  const { supabase, user, isAdmin } = await admin();
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  if (user?.id === id.data) return { status: 'error', message: 'You can’t change your own admin role.' };
  const { data, error } = await supabase.from('profiles').update({ role: role.data }).eq('id', id.data).select('id');
  if (error) {
    if (/only owners/.test(error.message)) return { status: 'error', message: 'Only Viv, Ced, Rachanee or Shermaine can add or remove admins.' };
    if (/owners stay admins/.test(error.message)) return { status: 'error', message: 'Owners stay admins.' };
    return { status: 'error', message: GENERIC };
  }
  if (!data?.length) return { status: 'error', message: GENERIC };
  for (const p of memberPaths(id.data)) revalidatePath(p);
  return { status: 'success', message: role.data === 'admin' ? 'They are now an admin.' : 'They are now a regular member.' };
}

/** Remove a member's photo or logo (the uploaded file is deleted too). */
export async function adminRemoveMedia(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('id'));
  const kind = z.enum(['avatar', 'logo']).safeParse(formData.get('kind'));
  if (!id.success || !kind.success) return;
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return;
  const { data: p } = await supabase.from('profiles').select('avatar_path, logo_path').eq('id', id.data).maybeSingle();
  const old = kind.data === 'avatar' ? p?.avatar_path : p?.logo_path;
  const { error } = await supabase
    .from('profiles')
    .update(kind.data === 'avatar' ? { avatar_path: null } : { logo_path: null })
    .eq('id', id.data);
  if (error) return;
  if (old && old.startsWith(`${id.data}/`)) await supabase.storage.from('profile-media').remove([old]);
  for (const p of memberPaths(id.data)) revalidatePath(p);
  await bustPublic('directory');
}

// --- Meetings and presentation slots -----------------------------------------

function meetingSlug(startsAt: string): string {
  return `group-meeting-${startsAt.slice(0, 10)}`;
}

/** Admin → Meetings → edit a meeting's date, time, title, location and Zoom link, or add a new one. */
export async function adminSaveMeeting(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = meetingSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values };
  const id = values.id ? uuid.safeParse(values.id) : null;
  if (id && !id.success) return { status: 'error', message: GENERIC, values };
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  const d = parsed.data;
  const row = {
    title: d.title,
    description: d.description ?? null,
    starts_at: d.startsAt,
    ends_at: d.endsAt,
    is_online: d.isOnline,
    location: d.location ?? (d.isOnline ? 'Online · Zoom' : null),
  };
  let meetingId: string;
  if (id?.success) {
    const { data, error } = await supabase.from('meetings').update(row).eq('id', id.data).select('id').maybeSingle();
    if (error || !data) return { status: 'error', message: GENERIC, values };
    meetingId = data.id;
  } else {
    const base = meetingSlug(d.startsAt);
    const { data: taken } = await supabase.from('meetings').select('slug').like('slug', `${base}%`);
    const slug = taken?.some((t) => t.slug === base) ? `${base}-${(taken?.length ?? 0) + 1}` : base;
    const { data, error } = await supabase
      .from('meetings')
      .insert({ ...row, slug, category: 'Networking' })
      .select('id')
      .single();
    if (error || !data) return { status: 'error', message: GENERIC, values };
    meetingId = data.id;
  }
  if (d.joinUrl) {
    const { error } = await supabase.from('meeting_links').upsert({ meeting_id: meetingId, join_url: d.joinUrl, passcode: d.passcode ?? null });
    if (error) return { status: 'error', message: 'Meeting saved, but the Zoom link could not be saved.', values };
  } else {
    await supabase.from('meeting_links').delete().eq('meeting_id', meetingId);
  }
  for (const p of [...meetingPaths, `/admin/meetings/${meetingId}`]) revalidatePath(p);
  await bustPublic('meetings');
  if (!id?.success) redirect(`/admin/meetings/${meetingId}?added=1`);
  return { status: 'success', message: 'Saved.', values };
}

/**
 * Add a meeting every other Monday after the last scheduled one, until a year from today (owner, 2026-10-28). Copies the
 * last meeting's time, length, title and location; skips dates that already have a meeting. Zoom links are added by hand.
 */
export async function adminScheduleYear(): Promise<ActionState> {
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  const { data: last } = await supabase
    .from('meetings')
    .select('title, starts_at, ends_at, location, is_online, description')
    .eq('category', 'Networking')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return { status: 'error', message: 'Add the first meeting with the form, then use this to fill in the rest.' };
  const horizon = Date.now() + 366 * 86400000;
  const { data: existing } = await supabase.from('meetings').select('slug').like('slug', 'group-meeting-%');
  const taken = new Set((existing ?? []).map((m) => m.slug));
  // Keep the Pacific wall-clock time (8:15 AM stays 8:15 AM across the daylight-saving change).
  const startLocal = isoToPacificLocal(last.starts_at);
  const endLocal = isoToPacificLocal(last.ends_at);
  const timeOf = (local: string) => local.slice(11);
  const baseTitle = last.title.replace(/:.*$/, '');
  const shortDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' });
  const rows: {
    slug: string;
    title: string;
    starts_at: string;
    ends_at: string;
    location: string | null;
    is_online: boolean;
    description: string | null;
    category: string;
  }[] = [];
  for (let day = Date.parse(`${startLocal.slice(0, 10)}T12:00:00Z`) + 14 * 86400000; day <= horizon; day += 14 * 86400000) {
    const date = new Date(day).toISOString().slice(0, 10);
    const startsAt = pacificLocalToIso(`${date}T${timeOf(startLocal)}`);
    const endsAt = pacificLocalToIso(`${date}T${timeOf(endLocal)}`);
    if (!startsAt || !endsAt) continue;
    const slug = meetingSlug(startsAt);
    if (taken.has(slug)) continue;
    rows.push({
      slug,
      title: `${baseTitle}: ${shortDate.format(new Date(startsAt))}`,
      starts_at: startsAt,
      ends_at: endsAt,
      location: last.location,
      is_online: last.is_online,
      description: last.description,
      category: 'Networking',
    });
  }
  if (rows.length === 0) return { status: 'success', message: 'The schedule already runs a year ahead. Nothing to add.' };
  const { error } = await supabase.from('meetings').insert(rows);
  if (error) return { status: 'error', message: GENERIC };
  for (const p of meetingPaths) revalidatePath(p);
  await bustPublic('meetings');
  return {
    status: 'success',
    message: `Added ${rows.length} meeting${rows.length === 1 ? '' : 's'}, through ${rows[rows.length - 1]!.starts_at.slice(0, 10)}.`,
  };
}

/** Remove a meeting from the schedule entirely (attendance, RSVPs and slots for it go with it). */
export async function adminDeleteMeeting(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return;
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return;
  await supabase.from('meetings').delete().eq('id', id.data);
  for (const p of meetingPaths) revalidatePath(p);
  await bustPublic('meetings');
  redirect('/admin/meetings?deleted=1');
}

/** Take a member off a presentation slot; they get an email. */
export async function adminRevokeSlot(formData: FormData): Promise<void> {
  const meetingId = uuid.safeParse(formData.get('meetingId'));
  const slot = slotEnum.safeParse(formData.get('slot'));
  if (!meetingId.success || !slot.success) return;
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return;
  const { data: gone } = await supabase
    .from('meeting_speakers')
    .delete()
    .eq('meeting_id', meetingId.data)
    .eq('slot', slot.data)
    .select('profile_id')
    .maybeSingle();
  for (const p of [...meetingPaths, `/admin/meetings/${meetingId.data}`]) revalidatePath(p);
  await bustPublic('meetings');
  const who = gone?.profile_id;
  if (who) {
    const [m, s] = [meetingId.data, slot.data];
    after(() => safely('slot revoked', () => onSlotRevoked(m, s, who)));
  }
}

/** Give a presentation slot to a member (replacing whoever had it); both are emailed. */
export async function adminAssignSlot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = assignSlotSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const d = parsed.data;
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  const { data: member } = await supabase.from('profiles').select('first_name, last_name, business_name, status').eq('id', d.profileId).maybeSingle();
  if (!member || member.status !== 'approved') return { status: 'error', message: 'Choose an approved member.', values };
  const { data: previous } = await supabase
    .from('meeting_speakers')
    .delete()
    .eq('meeting_id', d.meetingId)
    .eq('slot', d.slot)
    .select('profile_id')
    .maybeSingle();
  const { error } = await supabase.from('meeting_speakers').insert({
    meeting_id: d.meetingId,
    slot: d.slot,
    profile_id: d.profileId,
    display_name: `${member.first_name} ${member.last_name}`,
    business: member.business_name,
    topic: d.topic,
    topic_description: d.topicDescription,
  });
  if (error) return { status: 'error', message: GENERIC, values };
  for (const p of [...meetingPaths, `/admin/meetings/${d.meetingId}`]) revalidatePath(p);
  await bustPublic('meetings');
  const prev = previous?.profile_id;
  after(() =>
    safely('slot assigned', async () => {
      if (prev && prev !== d.profileId) await onSlotRevoked(d.meetingId, d.slot, prev);
      await onSlotAssigned(d.meetingId, d.slot, d.profileId, d.topic);
    }),
  );
  return { status: 'success', message: `Assigned to ${member.first_name} ${member.last_name}.` };
}

/** Edit the topic shown on the slides for a slot. */
export async function adminSetSlotTopic(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const meetingId = uuid.safeParse(values.meetingId);
  const slot = slotEnum.safeParse(values.slot);
  const topic = assignSlotSchema.pick({ topic: true, topicDescription: true }).safeParse(values);
  if (!meetingId.success || !slot.success) return { status: 'error', message: GENERIC };
  if (!topic.success) return { status: 'error', errors: fieldErrors(topic.error), values };
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  const { data, error } = await supabase
    .from('meeting_speakers')
    .update({ topic: topic.data.topic, topic_description: topic.data.topicDescription })
    .eq('meeting_id', meetingId.data)
    .eq('slot', slot.data)
    .select('meeting_id');
  if (error || !data?.length) return { status: 'error', message: GENERIC, values };
  for (const p of [...meetingPaths, `/admin/meetings/${meetingId.data}`]) revalidatePath(p);
  await bustPublic('meetings');
  return { status: 'success', message: 'Topic saved.', values };
}

/** Change or remove a member's RSVP for a meeting. */
export async function adminSetRsvp(formData: FormData): Promise<void> {
  const meetingId = uuid.safeParse(formData.get('meetingId'));
  const profileId = uuid.safeParse(formData.get('profileId'));
  const value = z.enum(['yes', 'no', 'none']).safeParse(formData.get('value'));
  if (!meetingId.success || !profileId.success || !value.success) return;
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return;
  if (value.data === 'none') {
    await supabase.from('rsvps').delete().eq('meeting_id', meetingId.data).eq('profile_id', profileId.data);
  } else {
    await supabase.from('rsvps').upsert({ meeting_id: meetingId.data, profile_id: profileId.data, attending: value.data === 'yes' });
  }
  revalidatePath(`/admin/meetings/${meetingId.data}`);
  revalidatePath('/admin');
}

// --- Gallery ------------------------------------------------------------------

/** Change a photo's caption, album or date. */
export async function adminUpdateGalleryPhoto(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const id = uuid.safeParse(values.id);
  const parsed = galleryMetaSchema.safeParse(values);
  if (!id.success) return { status: 'error', message: GENERIC };
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  const { data, error } = await supabase
    .from('gallery_photos')
    .update({ caption: parsed.data.caption, album: parsed.data.album, taken_on: parsed.data.takenOn ?? null })
    .eq('id', id.data)
    .select('id');
  if (error || !data?.length) return { status: 'error', message: GENERIC, values };
  revalidatePath('/gallery');
  revalidatePath('/admin/gallery');
  await bustPublic('gallery');
  return { status: 'success', message: 'Saved.', values };
}

/** Remove a photo and its files. */
export async function adminDeleteGalleryPhoto(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return;
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return;
  const { data: gone } = await supabase.from('gallery_photos').delete().eq('id', id.data).select('image_path, thumb_path').maybeSingle();
  if (gone) await supabase.storage.from('gallery').remove([gone.image_path, gone.thumb_path].filter(Boolean));
  revalidatePath('/gallery');
  revalidatePath('/admin/gallery');
  await bustPublic('gallery');
  revalidatePath('/');
}

// --- Activity records (referrals, one-on-ones, requests) ----------------------

/** Correct a referral slip: prospect name, status, amount, notes. */
export async function adminUpdateReferral(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = adminReferralSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  const d = parsed.data;
  const { data, error } = await supabase
    .from('referrals')
    .update({
      contact_name: d.contactName,
      status: d.status,
      amount: d.amount ?? null,
      notes: d.notes ?? null,
      ...(d.referredOn ? { created_at: pacificLocalToIso(`${d.referredOn}T12:00`) ?? undefined } : {}),
      ...(d.status === 'closed_deal' && d.closedOn ? { closed_at: pacificLocalToIso(`${d.closedOn}T12:00`) ?? undefined } : {}),
    })
    .eq('id', d.id)
    .select('from_id, to_id');
  if (error || !data?.length) return { status: 'error', message: GENERIC, values };
  for (const p of ['/referrals', '/closed-business', '/dashboard', '/admin/activity', '/admin/stats']) revalidatePath(p);
  for (const who of [data[0]?.from_id, data[0]?.to_id]) if (who) revalidatePath(`/admin/members/${who}`);
  return { status: 'success', message: 'Saved.', values };
}

export async function adminDeleteReferral(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return;
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return;
  const { data } = await supabase.from('referrals').delete().eq('id', id.data).select('from_id, to_id').maybeSingle();
  for (const p of ['/referrals', '/closed-business', '/dashboard', '/admin/activity', '/admin/stats']) revalidatePath(p);
  for (const who of [data?.from_id, data?.to_id]) if (who) revalidatePath(`/admin/members/${who}`);
}

/** Correct a one-on-one: the date, and whether it counts as confirmed. */
export async function adminUpdateOneOnOne(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = adminOneOnOneSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  const { data: cur } = await supabase.from('one_on_ones').select('confirmed_at').eq('id', parsed.data.id).maybeSingle();
  if (!cur) return { status: 'error', message: GENERIC };
  const confirmedAt = parsed.data.confirmed ? (cur.confirmed_at ?? new Date().toISOString()) : null;
  const { data, error } = await supabase
    .from('one_on_ones')
    .update({ met_on: parsed.data.metOn, confirmed_at: confirmedAt })
    .eq('id', parsed.data.id)
    .select('reporter_id, partner_id');
  if (error || !data?.length) {
    const dup = error && /one_on_ones_pair_day_uidx|duplicate key/.test(error.message);
    return { status: 'error', message: dup ? 'These two already have a one-on-one on that date.' : GENERIC, values };
  }
  for (const p of ['/one-on-ones', '/dashboard', '/admin/activity', '/admin/stats']) revalidatePath(p);
  for (const who of [data[0]?.reporter_id, data[0]?.partner_id]) if (who) revalidatePath(`/admin/members/${who}`);
  return { status: 'success', message: 'Saved.', values };
}

export async function adminDeleteOneOnOne(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return;
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return;
  const { data } = await supabase.from('one_on_ones').delete().eq('id', id.data).select('reporter_id, partner_id').maybeSingle();
  for (const p of ['/one-on-ones', '/dashboard', '/admin/activity', '/admin/stats']) revalidatePath(p);
  for (const who of [data?.reporter_id, data?.partner_id]) if (who) revalidatePath(`/admin/members/${who}`);
}

/** Close or reopen a one-on-one request on a member's behalf. */
export async function adminSetOneOnOneRequest(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('id'));
  const status = z.enum(['pending', ...oneOnOneRequestStatuses]).safeParse(formData.get('status'));
  if (!id.success || !status.success) return;
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return;
  const { data } = await supabase
    .from('one_on_one_requests')
    .update({ status: status.data, responded_at: status.data === 'pending' ? null : new Date().toISOString() })
    .eq('id', id.data)
    .select('requester_id, invitee_id')
    .maybeSingle();
  revalidatePath('/one-on-ones');
  for (const who of [data?.requester_id, data?.invitee_id]) if (who) revalidatePath(`/admin/members/${who}`);
}

export async function adminDeleteOneOnOneRequest(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return;
  const { supabase, isAdmin } = await admin();
  if (!isAdmin) return;
  const { data } = await supabase.from('one_on_one_requests').delete().eq('id', id.data).select('requester_id, invitee_id').maybeSingle();
  revalidatePath('/one-on-ones');
  for (const who of [data?.requester_id, data?.invitee_id]) if (who) revalidatePath(`/admin/members/${who}`);
}
