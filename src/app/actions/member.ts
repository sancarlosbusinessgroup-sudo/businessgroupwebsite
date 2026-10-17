'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  type ActionState,
  correctionSchema,
  fieldErrors,
  formToObject,
  galleryMetaSchema,
  oneOnOneRequestSchema,
  oneOnOneRequestStatuses,
  oneOnOneSchema,
  profileSchema,
  referralSchema,
  referralUpdateSchema,
  speakerTopicSchema,
  weeklyAskSchema,
} from '@/lib/validation';

const uuid = z.uuid();
const GENERIC = 'Something went wrong. Please try again.';

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// --- Meetings ---------------------------------------------------------------

/** Records self check-in (during the meeting window) and sends the member to Zoom. */
export async function joinMeeting(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('meetingId'));
  if (!id.success) redirect('/meetings?error=join');
  const { supabase, user } = await session();
  if (!user) redirect('/login?next=/meetings');
  const { data, error } = await supabase.rpc('join_meeting', { p_meeting: id.data });
  if (error || !data || !/^https:\/\//i.test(data)) redirect('/meetings?error=join');
  revalidatePath('/meetings');
  revalidatePath('/dashboard');
  redirect(data);
}

export async function toggleRsvp(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('meetingId'));
  const going = formData.get('going') === 'true';
  if (!id.success) return;
  const { supabase, user } = await session();
  if (!user) return;
  if (going) await supabase.from('rsvps').delete().eq('meeting_id', id.data).eq('profile_id', user.id);
  else await supabase.from('rsvps').insert({ meeting_id: id.data, profile_id: user.id });
  revalidatePath('/meetings');
  revalidatePath('/dashboard');
}

export async function claimSpeakerSlot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const id = uuid.safeParse(values.meetingId);
  const slot = z.enum(['education', 'presentation']).safeParse(values.slot);
  const topic = speakerTopicSchema.safeParse(values);
  if (!id.success || !slot.success) return { status: 'error', message: GENERIC };
  if (!topic.success) return { status: 'error', errors: fieldErrors(topic.error), values };
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  const { data: me } = await supabase.from('profiles').select('first_name, last_name, business_name').eq('id', user.id).single();
  if (!me) return { status: 'error', message: GENERIC };
  const { error } = await supabase.from('meeting_speakers').insert({
    meeting_id: id.data,
    slot: slot.data,
    profile_id: user.id,
    display_name: `${me.first_name} ${me.last_name}`,
    business: me.business_name,
    topic: topic.data.topic,
    topic_description: topic.data.topicDescription,
  });
  if (error) return { status: 'error', message: 'Someone may have just claimed this slot. Please refresh the page.', values };
  revalidatePath('/meetings');
  revalidatePath('/events');
  revalidatePath('/group-meetings');
  revalidatePath('/dashboard');
  return { status: 'success' };
}

export async function releaseSpeakerSlot(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('meetingId'));
  const slot = z.enum(['education', 'presentation']).safeParse(formData.get('slot'));
  if (!id.success || !slot.success) return;
  const { supabase, user } = await session();
  if (!user) return;
  await supabase.from('meeting_speakers').delete().eq('meeting_id', id.data).eq('slot', slot.data).eq('profile_id', user.id);
  revalidatePath('/meetings');
}

export async function requestCorrection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = correctionSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  const { error } = await supabase
    .from('attendance_corrections')
    .insert({ profile_id: user.id, meeting_id: parsed.data.meetingId ?? null, note: parsed.data.note });
  if (error) return { status: 'error', message: GENERIC, values };
  return { status: 'success' };
}

// --- Referrals --------------------------------------------------------------

export async function sendReferral(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = referralSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values };
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  if (parsed.data.toId === user.id) return { status: 'error', errors: { toId: 'Choose another member' }, values };
  const d = parsed.data;
  const { error } = await supabase.from('referrals').insert({
    from_id: user.id,
    to_id: d.toId,
    contact_name: d.contactName,
    prospect_phone: d.prospectPhone ?? null,
    prospect_email: d.prospectEmail ?? null,
    amount: d.amount ?? null,
    notes: d.notes ?? null,
  });
  if (error) return { status: 'error', message: GENERIC, values };
  revalidatePath('/referrals');
  revalidatePath('/dashboard');
  return { status: 'success', message: 'Referral slip sent.' };
}

export async function updateReferral(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = referralUpdateSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  const { data, error } = await supabase
    .from('referrals')
    .update({ status: parsed.data.status, amount: parsed.data.amount ?? null })
    .eq('id', parsed.data.id)
    .eq('to_id', user.id)
    .select('id');
  if (error || !data?.length) return { status: 'error', message: 'Only the member who received a referral can update it.' };
  revalidatePath('/referrals');
  revalidatePath('/dashboard');
  return { status: 'success', message: 'Saved.' };
}

// --- One-on-ones ------------------------------------------------------------

export async function reportOneOnOne(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = oneOnOneSchema().safeParse(values);
  if (!parsed.success) return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values };
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  if (parsed.data.partnerId === user.id) return { status: 'error', errors: { partnerId: 'Choose another member' }, values };
  const { data, error } = await supabase
    .from('one_on_ones')
    .insert({ reporter_id: user.id, partner_id: parsed.data.partnerId, met_on: parsed.data.metOn })
    .select('id')
    .single();
  if (error || !data) return { status: 'error', message: GENERIC, values };
  if (parsed.data.note) {
    await supabase.from('one_on_one_feedback').insert({ one_on_one_id: data.id, author_id: user.id, note: parsed.data.note });
  }
  revalidatePath('/one-on-ones');
  revalidatePath('/dashboard');
  return { status: 'success', message: 'One-on-one reported. Thanks for keeping your activity current!' };
}

export async function confirmOneOnOne(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return;
  const { supabase, user } = await session();
  if (!user) return;
  await supabase.rpc('confirm_one_on_one', { p_id: id.data });
  revalidatePath('/one-on-ones');
  revalidatePath('/dashboard');
}

// --- Profile ----------------------------------------------------------------

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values };
  const d = parsed.data;
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  const { error } = await supabase
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
    })
    .eq('id', user.id);
  if (error) {
    const taken = /category is full/.test(error.message);
    return {
      status: 'error',
      message: taken ? 'That category is full. Choose another or ask an admin.' : GENERIC,
      errors: taken ? { categoryId: 'This category is full' } : undefined,
      values,
    };
  }
  await supabase
    .from('member_contacts')
    .update({ phone: d.phone ?? null })
    .eq('profile_id', user.id);
  revalidatePath('/profile');
  revalidatePath('/members');
  return { status: 'success', message: 'Profile saved.' };
}

export async function saveWeeklyAsk(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = weeklyAskSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  const { error } = await supabase.from('profiles').update({ weekly_ask: parsed.data.weeklyAsk }).eq('id', user.id);
  if (error) return { status: 'error', message: GENERIC, values };
  revalidatePath('/dashboard');
  revalidatePath('/members');
  return { status: 'success', message: parsed.data.weeklyAsk ? 'Your ask is saved.' : 'Your ask is cleared.' };
}

const mediaSchema = z.object({ kind: z.enum(['avatar', 'logo']), path: z.string().max(200) });

export async function setProfileMedia(input: { kind: 'avatar' | 'logo'; path: string }): Promise<ActionState> {
  const parsed = mediaSchema.safeParse(input);
  const { supabase, user } = await session();
  if (!user || !parsed.success || !parsed.data.path.startsWith(`${user.id}/`)) return { status: 'error', message: GENERIC };
  const column = parsed.data.kind === 'avatar' ? { avatar_path: parsed.data.path } : { logo_path: parsed.data.path };
  const { error } = await supabase.from('profiles').update(column).eq('id', user.id);
  if (error) return { status: 'error', message: GENERIC };
  revalidatePath('/profile');
  return { status: 'success' };
}

// --- Gallery ----------------------------------------------------------------

const galleryInput = galleryMetaSchema.extend({ imagePath: z.string().max(200), thumbPath: z.string().max(200) });

export async function addGalleryPhoto(input: z.input<typeof galleryInput>): Promise<ActionState> {
  const parsed = galleryInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Please check the photo details.' };
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  const d = parsed.data;
  if (!d.imagePath.startsWith(`${user.id}/`) || !d.thumbPath.startsWith(`${user.id}/`)) return { status: 'error', message: GENERIC };
  const { error } = await supabase.from('gallery_photos').insert({
    album: d.album,
    caption: d.caption,
    taken_on: d.takenOn ?? null,
    image_path: d.imagePath,
    thumb_path: d.thumbPath,
    uploaded_by: user.id,
  });
  if (error) return { status: 'error', message: GENERIC };
  revalidatePath('/gallery');
  revalidatePath('/');
  return { status: 'success' };
}

// --- One-on-one requests ------------------------------------------------------

export async function requestOneOnOne(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = oneOnOneRequestSchema().safeParse(values);
  if (!parsed.success) return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values };
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  if (parsed.data.inviteeId === user.id) return { status: 'error', errors: { inviteeId: 'Choose another member' }, values };
  const { error } = await supabase.from('one_on_one_requests').insert({
    requester_id: user.id,
    invitee_id: parsed.data.inviteeId,
    proposed_on: parsed.data.proposedOn ?? null,
    message: parsed.data.message ?? null,
  });
  if (error) {
    const message = /already have an open request/.test(error.message)
      ? 'You already have an open request with this member.'
      : /too many open requests/.test(error.message)
        ? 'You have 10 open requests. Wait for answers or cancel one first.'
        : GENERIC;
    return { status: 'error', message, values };
  }
  revalidatePath('/one-on-ones');
  return { status: 'success', message: 'Request sent. They will see it on their One-on-ones page.' };
}

export async function respondOneOnOneRequest(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('id'));
  const status = z.enum(oneOnOneRequestStatuses).safeParse(formData.get('status'));
  if (!id.success || !status.success) return;
  const { supabase, user } = await session();
  if (!user) return;
  await supabase.rpc('respond_one_on_one_request', { p_id: id.data, p_status: status.data });
  revalidatePath('/one-on-ones');
}
