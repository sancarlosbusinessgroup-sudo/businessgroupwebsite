'use server';

// Guest board actions on Admin → Guest Invites & Applications (owner, 2026-11-24): accept (sends the Zoom link),
// decline (by phone or by email), reopen, move a card by hand, and notes. Admins only (requireAdmin + RLS).

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { localDateKey } from '@/lib/dates';
import { sendGuestDeclined, sendGuestZoomLink } from '@/lib/email/events';
import { guestStageLabels, isGuestStage } from '@/lib/guest-pipeline';
import { advanceGuest, logGuestEvent as log } from '@/lib/data/guest-steps';
import { createClient } from '@/lib/supabase/server';
import { type ActionState } from '@/lib/validation';

const GENERIC = 'Something went wrong. Please try again.';

function refresh() {
  revalidatePath('/admin/guests');
  revalidatePath('/admin');
}

const zoomErrors: Record<string, string> = {
  skipped: 'Email is not set up yet.',
  no_meeting: 'No upcoming meeting to send a link for.',
  no_link: 'That meeting has no Zoom link saved yet.',
  not_found: GENERIC,
  failed: 'Could not send. Try again.',
};

/** Accept: email the guest the Zoom link and move the card to "Zoom Link Sent". */
export async function acceptGuest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return { status: 'error', message: GENERIC };
  const db = await createClient();
  const r = await sendGuestZoomLink(id.data, localDateKey(new Date()));
  if (r !== 'sent' && r !== 'duplicate') return { status: 'error', message: zoomErrors[r] ?? GENERIC };
  const now = new Date().toISOString();
  await db.from('guest_requests').update({ accepted_at: now, accepted_by: viewer.userId }).eq('id', id.data).is('accepted_at', null);
  await advanceGuest(db, id.data, 'zoom_sent');
  await log(db, id.data, viewer.userId, 'accepted', 'Zoom link sent');
  refresh();
  return { status: 'success', message: r === 'sent' ? 'Accepted. Zoom link sent.' : 'Accepted. (The Zoom link was already sent today.)' };
}

const declineSchema = z.object({
  id: z.uuid(),
  method: z.enum(['phone', 'email'], { message: 'Choose how you will tell them.' }),
  note: z.string().trim().max(1000, 'Note: 1000 characters at most.').optional(),
});

/** Decline: the guest leaves the board (listed under "Declined"). By phone (the admin calls) or by the decline email. */
export async function declineGuest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = declineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? GENERIC };
  const { id, method, note } = parsed.data;
  const db = await createClient();
  const { data, error } = await db
    .from('guest_requests')
    .update({ declined_at: new Date().toISOString(), declined_by: viewer.userId, decline_method: method, decline_note: note || null })
    .eq('id', id)
    .select('id');
  if (error || !data?.length) return { status: 'error', message: GENERIC };
  let emailed = '';
  if (method === 'email') {
    const r = await sendGuestDeclined(id);
    emailed =
      r === 'sent' || r === 'duplicate'
        ? ' The email was sent.'
        : r === 'skipped'
          ? ' Email is not set up, so please call them.'
          : ' The email could not be sent, so please call them.';
  }
  await log(db, id, viewer.userId, 'declined', `${method === 'phone' ? 'by phone' : 'by email'}${note ? ` (${note})` : ''}`);
  refresh();
  return { status: 'success', message: `Declined.${method === 'phone' ? ' Remember to call them.' : emailed}` };
}

/** Undo a decline: the card goes back on the board where it was. */
export async function reopenGuest(formData: FormData): Promise<void> {
  const viewer = await requireAdmin();
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const db = await createClient();
  await db.from('guest_requests').update({ declined_at: null, declined_by: null, decline_method: null, decline_note: null }).eq('id', id.data);
  await log(db, id.data, viewer.userId, 'reopened');
  refresh();
}

/** Move a card to another column by hand (drag and drop, or the "Move to" list). No emails, no approvals. */
export async function moveGuestStage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = z.uuid().safeParse(formData.get('id'));
  const stage = formData.get('stage');
  if (!id.success || !isGuestStage(stage)) return { status: 'error', message: GENERIC };
  const db = await createClient();
  const { data: g } = await db.from('guest_requests').select('pipeline_stage').eq('id', id.data).maybeSingle();
  if (!g) return { status: 'error', message: GENERIC };
  if (g.pipeline_stage === stage) return { status: 'success', message: `Already in ${guestStageLabels[stage]}.` };
  const { error } = await db.from('guest_requests').update({ pipeline_stage: stage, stage_changed_at: new Date().toISOString() }).eq('id', id.data);
  if (error) return { status: 'error', message: GENERIC };
  await log(db, id.data, viewer.userId, 'stage', stage);
  refresh();
  return { status: 'success', message: `Moved to ${guestStageLabels[stage]}.` };
}

const noteSchema = z.object({ id: z.uuid(), note: z.string().trim().min(2, 'Write a note first.').max(1000, 'Note: 1000 characters at most.') });

export async function addGuestNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? GENERIC };
  const db = await createClient();
  const { error } = await db.from('guest_events').insert({ guest_id: parsed.data.id, actor_id: viewer.userId, kind: 'note', detail: parsed.data.note });
  if (error) return { status: 'error', message: GENERIC };
  refresh();
  return { status: 'success', message: 'Note saved.' };
}
