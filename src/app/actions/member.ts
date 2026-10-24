'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { onOneOnOneAnswered, onOneOnOneMessage, onOneOnOneReported, onOneOnOneRequested, onReferralSent, onReferralUpdated } from '@/lib/email/events';
import { safely } from '@/lib/email/notify';
import { prefKeys } from '@/lib/email/prefs';
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

/** RSVP dropdown: "yes" = can attend, "no" = can't attend, "" = clear the answer. */
export async function setRsvp(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('meetingId'));
  const answer = z.enum(['yes', 'no', '']).safeParse(formData.get('answer') ?? '');
  if (!id.success || !answer.success) return;
  const { supabase, user } = await session();
  if (!user) return;
  if (answer.data === '') await supabase.from('rsvps').delete().eq('meeting_id', id.data).eq('profile_id', user.id);
  else
    await supabase
      .from('rsvps')
      .upsert({ meeting_id: id.data, profile_id: user.id, attending: answer.data === 'yes' }, { onConflict: 'meeting_id,profile_id' });
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

/** The presenter writes or changes the title of their own presentation; the slides show it (owner, 2026-10-24). */
export async function updateSpeakerTopic(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const id = uuid.safeParse(values.meetingId);
  const slot = z.enum(['education', 'presentation']).safeParse(values.slot);
  const topic = speakerTopicSchema.safeParse(values);
  if (!id.success || !slot.success) return { status: 'error', message: GENERIC };
  if (!topic.success) return { status: 'error', errors: fieldErrors(topic.error), values };
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  const { error } = await supabase.rpc('set_speaker_topic', {
    p_meeting: id.data,
    p_slot: slot.data,
    p_topic: topic.data.topic,
    p_description: topic.data.topicDescription ?? '',
  });
  if (error) return { status: 'error', message: 'The topic could not be saved. Please refresh the page and try again.', values };
  revalidatePath('/meetings');
  revalidatePath('/events');
  revalidatePath('/group-meetings');
  revalidatePath('/dashboard');
  return { status: 'success', values };
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
  const referralId = crypto.randomUUID();
  const { error } = await supabase.from('referrals').insert({
    id: referralId,
    from_id: user.id,
    to_id: d.toId,
    contact_name: d.contactName,
    prospect_phone: d.prospectPhone ?? null,
    prospect_email: d.prospectEmail ?? null,
    amount: d.amount ?? null,
    notes: d.notes ?? null,
  });
  if (error) return { status: 'error', message: GENERIC, values };
  after(() => safely('referral sent', () => onReferralSent(referralId)));
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
  const refId = parsed.data.id;
  after(() => safely('referral updated', () => onReferralUpdated(refId)));
  revalidatePath('/referrals');
  revalidatePath('/dashboard');
  // Keep the saved values in the form (React resets forms after an action).
  return { status: 'success', message: 'Saved.', values };
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
  const oneId = data.id;
  after(() => safely('one-on-one reported', () => onOneOnOneReported(oneId)));
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

/** My profile → Remove photo / Remove logo (owner, 2026-10-23). The member's own uploaded file is deleted too. */
export async function removeProfileMedia(input: { kind: 'avatar' | 'logo' }): Promise<ActionState> {
  const kind = z.enum(['avatar', 'logo']).safeParse(input?.kind);
  const { supabase, user } = await session();
  if (!user || !kind.success) return { status: 'error', message: GENERIC };
  const { data: me } = await supabase.from('profiles').select('avatar_path, logo_path').eq('id', user.id).maybeSingle();
  const old = kind.data === 'avatar' ? me?.avatar_path : me?.logo_path;
  const column = kind.data === 'avatar' ? { avatar_path: null } : { logo_path: null };
  const { error } = await supabase.from('profiles').update(column).eq('id', user.id);
  if (error) return { status: 'error', message: GENERIC };
  // Files shipped with the site start with "/"; only the member's own upload is removed from storage.
  if (old && old.startsWith(`${user.id}/`)) await supabase.storage.from('profile-media').remove([old]);
  revalidatePath('/profile');
  revalidatePath('/members');
  revalidatePath('/dashboard');
  return { status: 'success' };
}

// --- Deleting what you filed (owner, 2026-10-23) ------------------------------
// Members delete the referral slips and one-on-ones they filed; admins delete any. The database enforces who may.

export async function deleteReferral(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const { supabase, user } = await session();
  if (!user) return;
  await supabase.from('referrals').delete().eq('id', id.data);
  for (const p of ['/referrals', '/dashboard', '/admin/activity', '/admin/stats']) revalidatePath(p);
}

export async function deleteOneOnOne(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const { supabase, user } = await session();
  if (!user) return;
  await supabase.from('one_on_ones').delete().eq('id', id.data);
  for (const p of ['/one-on-ones', '/dashboard', '/admin/activity', '/admin/stats']) revalidatePath(p);
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
  const requestId = crypto.randomUUID();
  const { error } = await supabase.from('one_on_one_requests').insert({
    id: requestId,
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
  after(() => safely('one-on-one request', () => onOneOnOneRequested(requestId)));
  revalidatePath('/one-on-ones');
  return { status: 'success', message: 'Request sent. They will see it on their One-on-ones page.' };
}

export async function respondOneOnOneRequest(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('id'));
  const status = z.enum(oneOnOneRequestStatuses).safeParse(formData.get('status'));
  if (!id.success || !status.success) return;
  const { supabase, user } = await session();
  if (!user) return;
  const { error } = await supabase.rpc('respond_one_on_one_request', { p_id: id.data, p_status: status.data });
  const reqId = id.data;
  if (!error) after(() => safely('one-on-one answer', () => onOneOnOneAnswered(reqId)));
  revalidatePath('/one-on-ones');
}

/** "Send a message" on a request I received, e.g. to explain why I need to decline (owner, 2026-10-24). */
export async function replyOneOnOneRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const id = uuid.safeParse(values.id);
  const message = z
    .string()
    .trim()
    .min(1, 'Write a message')
    .max(500, 'Keep it under 500 characters')
    .safeParse(values.message ?? '');
  if (!id.success) return { status: 'error', message: GENERIC };
  if (!message.success) return { status: 'error', errors: { message: message.error.issues[0]?.message ?? 'Write a message' }, values };
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  const { data: repliedAt, error } = await supabase.rpc('reply_one_on_one_request', { p_id: id.data, p_message: message.data });
  if (error || !repliedAt) return { status: 'error', message: 'The message could not be sent. Please refresh the page and try again.', values };
  const reqId = id.data;
  after(() => safely('one-on-one message', () => onOneOnOneMessage(reqId, repliedAt)));
  revalidatePath('/one-on-ones');
  return { status: 'success' };
}

// --- Onboarding & email preferences -------------------------------------------

export async function completeOnboarding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const share = formData.get('shareContacts') === 'on';
  const agreed = formData.get('agreed') === 'on';
  const errors: Record<string, string> = {};
  if (!share) errors.shareContacts = 'Please agree so members can reach you with referrals';
  if (!agreed) errors.agreed = 'Please agree to the member commitments';
  if (Object.keys(errors).length) return { status: 'error', message: 'Please tick both boxes to finish.', errors };
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  const { error } = await supabase.rpc('complete_onboarding', { p_share_contacts: share, p_agreed: agreed });
  if (error) return { status: 'error', message: GENERIC };
  revalidatePath('/dashboard');
  redirect('/dashboard?welcome=1');
}

export async function saveEmailPrefs(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  const prefs: Record<string, boolean> = {};
  for (const k of prefKeys) prefs[k] = formData.get(k) === 'on';
  const { error } = await supabase.from('email_preferences').upsert({ profile_id: user.id, prefs }, { onConflict: 'profile_id' });
  if (error) return { status: 'error', message: GENERIC };
  revalidatePath('/profile');
  return { status: 'success', message: 'Email settings saved.' };
}
