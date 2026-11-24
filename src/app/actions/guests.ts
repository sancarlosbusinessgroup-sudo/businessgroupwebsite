'use server';

// Guest steps on Admin → Guest Invites & Applications (owner, 2026-11-24; reworked 2026-11-25). Admins only
// (requireAdmin + RLS). Owner, 2026-11-25: no email goes out when a guest moves on. Each email is its own action, run
// only after the admin confirms it in a pop-up; an email not sent leaves a reminder in its step. Every step can be undone.

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { formatSlot, pacificLocalToIso } from '@/lib/dates';
import { onMemberStatus } from '@/lib/email/events';
import { deliver, loadRecipients, safely, siteUrl } from '@/lib/email/notify';
import * as T from '@/lib/email/templates';
import { GUEST_STAGES, guestStageLabels, isGuestStage, previousStage, type GuestStage } from '@/lib/guest-pipeline';
import { advanceGuest, logGuestEvent as log } from '@/lib/data/guest-steps';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { type ActionState } from '@/lib/validation';

const GENERIC = 'Something went wrong. Please try again.';

function refresh() {
  revalidatePath('/admin/guests');
  revalidatePath('/admin');
}

const idOf = (formData: FormData, key = 'id') => {
  const r = z.uuid().safeParse(formData.get(key));
  return r.success ? r.data : null;
};

/** Accept: the card moves to "Zoom Link". No email: the pop-up then asks whether to send the Zoom link. */
export async function acceptGuest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = idOf(formData);
  if (!id) return { status: 'error', message: GENERIC };
  const db = await createClient();
  const { data, error } = await db
    .from('guest_requests')
    .update({ accepted_at: new Date().toISOString(), accepted_by: viewer.userId })
    .eq('id', id)
    .select('id');
  if (error || !data?.length) return { status: 'error', message: GENERIC };
  await advanceGuest(db, id, 'zoom_sent');
  await log(db, id, viewer.userId, 'accepted');
  refresh();
  return { status: 'success', message: 'Accepted.', values: { ask: 'zoom' } };
}

/** The Zoom link email isn't needed (a friend sent them the link): the reminder goes away. Or bring it back. */
export async function dismissZoomEmail(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = idOf(formData);
  if (!id) return;
  const db = await createClient();
  await db
    .from('guest_requests')
    .update({ zoom_email_dismissed_at: formData.get('undo') === '1' ? null : new Date().toISOString() })
    .eq('id', id);
  refresh();
}

const declineSchema = z.object({
  id: z.uuid(),
  note: z.string().trim().max(1000, 'Note: 1000 characters at most.').optional(),
});

/** Reject: the guest leaves the board (listed under "Declined"). No email goes out: an admin calls them. */
export async function declineGuest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = declineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? GENERIC };
  const { id, note } = parsed.data;
  const db = await createClient();
  const { data, error } = await db
    .from('guest_requests')
    .update({
      declined_at: new Date().toISOString(),
      declined_by: viewer.userId,
      decline_method: 'phone',
      decline_note: note || null,
      decline_called_at: null,
    })
    .eq('id', id)
    .select('phone');
  if (error || !data?.length) return { status: 'error', message: GENERIC };
  await log(db, id, viewer.userId, 'declined', `call them${note ? ` (${note})` : ''}`);
  refresh();
  const phone = data[0]?.phone;
  return { status: 'success', message: `Rejected. No email was sent: please call them${phone ? ` on ${phone}` : ''}.` };
}

/** "Called them" on a rejected guest (or undo). */
export async function markDeclineCalled(formData: FormData): Promise<void> {
  const viewer = await requireAdmin();
  const id = idOf(formData);
  if (!id) return;
  const undo = formData.get('undo') === '1';
  const db = await createClient();
  await db
    .from('guest_requests')
    .update({ decline_called_at: undo ? null : new Date().toISOString() })
    .eq('id', id);
  if (!undo) await log(db, id, viewer.userId, 'note', 'Called them about the decision');
  refresh();
}

/** Undo a reject: the card goes back on the board where it was. */
export async function reopenGuest(formData: FormData): Promise<void> {
  const viewer = await requireAdmin();
  const id = idOf(formData);
  if (!id) return;
  const db = await createClient();
  await db
    .from('guest_requests')
    .update({ declined_at: null, declined_by: null, decline_method: null, decline_note: null, decline_called_at: null })
    .eq('id', id);
  await log(db, id, viewer.userId, 'reopened');
  refresh();
}

/** Move a card to another column by hand (drag and drop, or the "Move to" list). No emails, no approvals. */
export async function moveGuestStage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = idOf(formData);
  const stage = formData.get('stage');
  if (!id || !isGuestStage(stage)) return { status: 'error', message: GENERIC };
  const db = await createClient();
  const { data: g } = await db.from('guest_requests').select('pipeline_stage').eq('id', id).maybeSingle();
  if (!g) return { status: 'error', message: GENERIC };
  if (g.pipeline_stage === stage) return { status: 'success', message: `Already in ${guestStageLabels[stage]}.` };
  const { error } = await db.from('guest_requests').update({ pipeline_stage: stage, stage_changed_at: new Date().toISOString() }).eq('id', id);
  if (error) return { status: 'error', message: GENERIC };
  await log(db, id, viewer.userId, 'stage', stage);
  refresh();
  return { status: 'success', message: `Moved to ${guestStageLabels[stage]}.` };
}

/**
 * Undo: back to the previous column, taking back what moved the guest on (accepting, First Zoom Done, the interview
 * mark, the membership approval). A "membership not approved" is undone first, in place. No emails.
 */
export async function undoGuestStep(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = idOf(formData);
  if (!id) return { status: 'error', message: GENERIC };
  const db = await createClient();
  const { data: g } = await db.from('guest_requests').select('pipeline_stage, status, email, membership_declined_at').eq('id', id).maybeSingle();
  if (!g) return { status: 'error', message: GENERIC };
  const now = new Date().toISOString();

  // The applicant's account (matched by email), for undoing a membership decision.
  const applicant = async () => {
    const { data } = await db
      .from('member_contacts')
      .select('profile_id')
      .ilike('email', g.email.replace(/[\\%_]/g, '\\$&'))
      .limit(1)
      .maybeSingle();
    return data?.profile_id ?? null;
  };

  if (g.membership_declined_at) {
    const pid = await applicant();
    if (pid) await db.from('profiles').update({ status: 'pending' }).eq('id', pid).eq('status', 'declined');
    await db.from('guest_requests').update({ membership_declined_at: null, membership_declined_by: null, membership_called_at: null }).eq('id', id);
    await log(db, id, viewer.userId, 'reopened', 'Membership decision undone');
    refresh();
    return { status: 'success', message: 'Undone: their application is waiting for a decision again.' };
  }

  const stage = g.pipeline_stage as GuestStage;
  const back = previousStage(stage);
  if (!back) return { status: 'error', message: 'Nothing to undo: this is the first step.' };
  const update: {
    pipeline_stage: GuestStage;
    stage_changed_at: string;
    accepted_at?: null;
    accepted_by?: null;
    status?: 'requested' | 'applied';
    one_on_ones_done_at?: null;
  } = { pipeline_stage: back, stage_changed_at: now };
  if (stage === 'zoom_sent') Object.assign(update, { accepted_at: null, accepted_by: null });
  if (stage === 'send_application' && g.status === 'visited') update.status = 'requested';
  if (stage === 'interview') update.one_on_ones_done_at = null;
  if (stage === 'approved') {
    // Approving made them a member: their account goes back to "pending" (off the directory) until approved again.
    const pid = await applicant();
    if (pid) {
      const { error } = await db.from('profiles').update({ status: 'pending' }).eq('id', pid);
      if (error) return { status: 'error', message: GENERIC };
      revalidatePath('/members');
    }
    if (g.status === 'joined') update.status = 'applied';
  }
  // The status trigger only moves cards forward, so the stage set here stays.
  const { error } = await db.from('guest_requests').update(update).eq('id', id);
  if (error) return { status: 'error', message: GENERIC };
  await log(db, id, viewer.userId, 'stage', back);
  refresh();
  return { status: 'success', message: `Moved back to ${guestStageLabels[back]}.` };
}

/** First Zoom Done: the guest has been to a meeting (status "visited"; the card moves to "Send Application Form"). */
export async function markFirstZoomDone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = idOf(formData);
  if (!id) return { status: 'error', message: GENERIC };
  const db = await createClient();
  const { data, error } = await db.from('guest_requests').update({ status: 'visited' }).eq('id', id).eq('status', 'requested').select('id');
  if (error) return { status: 'error', message: GENERIC };
  if (data?.length) await log(db, id, viewer.userId, 'note', 'First Zoom done');
  await advanceGuest(db, id, 'send_application');
  refresh();
  return { status: 'success', message: 'First Zoom done.' };
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

// --- Add a guest by hand --------------------------------------------------------------------------------------------

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const addGuestSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(60),
  lastName: z.string().trim().min(1, 'Last name is required.').max(60),
  email: z.email('Enter a valid email.').max(254),
  phone: optional(40).refine((v) => !v || v.length >= 7, 'Phone: at least 7 characters.'),
  businessName: optional(120),
  businessDescription: optional(1000),
  website: optional(300).transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v)),
  invitedById: z.union([z.uuid(), z.literal('')]).optional(),
  invitedBy: optional(120),
  stage: z.enum(['review', 'zoom_sent', 'send_application', 'application_done', 'interview']),
  note: optional(1000),
});

/**
 * Add a guest by hand (owner, 2026-11-25): someone a member brought to the Zoom without asking for an invite, placed
 * straight into the step they are at (default "Send Application Form"). No email goes out.
 */
export async function addGuestByHand(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = addGuestSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { status: 'error', message: 'Please fix the highlighted fields.', errors, values };
  }
  const d = parsed.data;
  const admin = createAdminClient();
  if (!admin) return { status: 'error', message: 'This needs the server key. Please try again later.', values };
  const db = await createClient();
  const inviter = d.invitedById
    ? (await db.from('profiles').select('id, first_name, last_name').eq('id', d.invitedById).eq('status', 'approved').maybeSingle()).data
    : null;
  const id = crypto.randomUUID();
  // The insert trigger stores every new request as "requested" with no referrer; the rest is set just after.
  const { error } = await admin.from('guest_requests').insert({
    id,
    first_name: d.firstName,
    last_name: d.lastName,
    email: d.email,
    phone: d.phone,
    business_name: d.businessName,
    business_description: d.businessDescription,
    website: d.website,
    invited_by_text: inviter ? `${inviter.first_name} ${inviter.last_name}` : d.invitedBy,
  });
  if (error) {
    return {
      status: 'error',
      message: /too many requests for this email/i.test(error.message) ? 'This email was added three times today already.' : GENERIC,
      values,
    };
  }
  const now = new Date().toISOString();
  const pastReview = d.stage !== 'review';
  const visited = GUEST_STAGES.indexOf(d.stage) >= GUEST_STAGES.indexOf('send_application');
  await admin
    .from('guest_requests')
    .update({
      added_by: viewer.userId,
      pipeline_stage: d.stage,
      stage_changed_at: now,
      ...(visited ? { status: 'visited' as const } : {}),
      ...(pastReview ? { accepted_at: now, accepted_by: viewer.userId, zoom_email_dismissed_at: visited ? now : null } : {}),
      ...(inviter ? { referrer_id: inviter.id } : {}),
    })
    .eq('id', id);
  await log(db, id, viewer.userId, 'note', `Added by hand to ${guestStageLabels[d.stage]}${d.note ? `: ${d.note}` : ''}`);
  refresh();
  return { status: 'success', message: `${d.firstName} ${d.lastName} was added to ${guestStageLabels[d.stage]}. No email was sent.` };
}

// --- Panel interview ------------------------------------------------------------------------------------------------

const panelSchema = z
  .object({
    guestId: z.uuid(),
    panelists: z.array(z.uuid()).length(3, 'Choose three different people.'),
    times: z.array(z.string()).min(1, 'Add at least one time.').max(8, 'Eight times at most.'),
    minutes: z.coerce.number().int().min(10).max(180),
    format: z.enum(['zoom', 'phone', 'in_person']),
    location: optional(300),
    notify: z.boolean(),
  })
  .refine((v) => new Set(v.panelists).size === 3, { message: 'Choose three different people.', path: ['panelists'] });

async function panelNames(ids: string[]) {
  const db = await createClient();
  const { data } = await db.from('profiles').select('id, first_name, last_name').in('id', ids);
  const byId = new Map((data ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
  return ids.map((i) => byId.get(i) ?? 'Former member');
}

async function emailPanelists(interviewId: string, askedBy: string) {
  const db = createAdminClient();
  if (!db) return;
  const { data: iv } = await db
    .from('panel_interviews')
    .select('id, panelist_ids, guest:guest_requests(first_name, last_name, business_name), panel_interview_slots(starts_at)')
    .eq('id', interviewId)
    .maybeSingle();
  if (!iv) return;
  const guest = (Array.isArray(iv.guest) ? iv.guest[0] : iv.guest) as { first_name: string; last_name: string; business_name: string | null } | null;
  if (!guest) return;
  const people = await loadRecipients(iv.panelist_ids);
  const names = iv.panelist_ids
    .map((i) => people.get(i))
    .filter((r) => !!r)
    .map((r) => `${r!.firstName} ${r!.lastName}`);
  const times = [...(iv.panel_interview_slots ?? [])]
    .map((s) => s.starts_at)
    .sort()
    .map((t) => formatSlot(new Date(t)));
  for (const r of people.values()) {
    await deliver({
      kind: 'panel_availability',
      dedupeKey: `${iv.id}:${times.length}`,
      to: { email: r.email, name: `${r.firstName} ${r.lastName}`, profileId: r.id },
      email: T.panelAvailabilityEmail({
        siteUrl: siteUrl(),
        toFirstName: r.firstName,
        guestName: `${guest.first_name} ${guest.last_name}`,
        guestBusiness: guest.business_name,
        askedBy,
        panel: names.filter((n) => n !== `${r.firstName} ${r.lastName}`),
        times,
        link: `${siteUrl()}/admin/panel/${iv.id}`,
      }),
    });
  }
}

/**
 * Schedule Panel Interview: three people from Management and a few times that might work. Each panelist marks which
 * times they can make on the interview's page; the time that works for all three is then confirmed. Asking the panelists
 * by email is ticked in the pop-up (it goes to Management, never to the guest).
 */
export async function schedulePanel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const raw = {
    guestId: formData.get('guestId'),
    panelists: formData.getAll('panelist').map(String).filter(Boolean),
    times: formData.getAll('time').map(String).filter(Boolean),
    minutes: formData.get('minutes') ?? 30,
    format: formData.get('format') ?? 'zoom',
    location: String(formData.get('location') ?? ''),
    notify: formData.get('notify') === 'on',
  };
  const parsed = panelSchema.safeParse(raw);
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? GENERIC };
  const d = parsed.data;
  const isoTimes = [...new Set(d.times.map(pacificLocalToIso))];
  if (isoTimes.some((t) => !t)) return { status: 'error', message: 'One of the times is not a real date and time.' };
  if (isoTimes.some((t) => t! < new Date().toISOString())) return { status: 'error', message: 'Times must be in the future.' };
  const db = await createClient();
  const { data: existing } = await db.from('panel_interviews').select('id').eq('guest_id', d.guestId).maybeSingle();
  if (existing) return { status: 'error', message: 'This guest already has a panel interview. Open it to change the times.' };
  const { data: iv, error } = await db
    .from('panel_interviews')
    .insert({ guest_id: d.guestId, panelist_ids: d.panelists, duration_minutes: d.minutes, format: d.format, location: d.location, created_by: viewer.userId })
    .select('id')
    .single();
  if (error || !iv) return { status: 'error', message: GENERIC };
  const { error: slotErr } = await db
    .from('panel_interview_slots')
    .insert(isoTimes.map((t) => ({ interview_id: iv.id, starts_at: t!, added_by: viewer.userId })));
  if (slotErr) {
    await db.from('panel_interviews').delete().eq('id', iv.id);
    return { status: 'error', message: GENERIC };
  }
  await advanceGuest(db, d.guestId, 'interview');
  const names = await panelNames(d.panelists);
  await log(db, d.guestId, viewer.userId, 'interview', `Panel: ${names.join(', ')}; ${isoTimes.length} time${isoTimes.length === 1 ? '' : 's'} proposed`);
  const askedBy = `${viewer.profile.first_name} ${viewer.profile.last_name}`;
  if (d.notify) after(() => safely('panel availability', () => emailPanelists(iv.id, askedBy)));
  refresh();
  revalidatePath(`/admin/panel/${iv.id}`);
  return {
    status: 'success',
    message: d.notify ? 'Panel interview started. The three panelists were asked to mark their times.' : 'Panel interview started.',
    values: { interviewId: iv.id },
  };
}

/** A panelist marks whether they can make a proposed time. */
export async function answerPanelSlot(formData: FormData): Promise<void> {
  const viewer = await requireAdmin();
  const slotId = idOf(formData, 'slotId');
  const answer = z.enum(['yes', 'maybe', 'no']).safeParse(formData.get('answer'));
  if (!slotId || !answer.success) return;
  const db = await createClient();
  const { data: slot } = await db.from('panel_interview_slots').select('interview_id, panel_interviews(panelist_ids)').eq('id', slotId).maybeSingle();
  const iv = (Array.isArray(slot?.panel_interviews) ? slot?.panel_interviews[0] : slot?.panel_interviews) as { panelist_ids: string[] } | null | undefined;
  if (!slot || !iv?.panelist_ids.includes(viewer.userId)) return;
  await db
    .from('panel_interview_answers')
    .upsert({ slot_id: slotId, profile_id: viewer.userId, answer: answer.data, updated_at: new Date().toISOString() }, { onConflict: 'slot_id,profile_id' });
  revalidatePath(`/admin/panel/${slot.interview_id}`);
  refresh();
}

/** Anyone on Management adds another time to choose from (for example when none works for all three). */
export async function addPanelSlot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = idOf(formData, 'interviewId');
  const iso = pacificLocalToIso(String(formData.get('time') ?? ''));
  if (!id) return { status: 'error', message: GENERIC };
  if (!iso) return { status: 'error', message: 'Choose a date and time.' };
  if (iso < new Date().toISOString()) return { status: 'error', message: 'The time must be in the future.' };
  const db = await createClient();
  const { error } = await db.from('panel_interview_slots').insert({ interview_id: id, starts_at: iso, added_by: viewer.userId });
  if (error) return { status: 'error', message: /duplicate/i.test(error.message) ? 'That time is already on the list.' : GENERIC };
  revalidatePath(`/admin/panel/${id}`);
  refresh();
  return { status: 'success', message: `Added ${formatSlot(new Date(iso))}.` };
}

/** Remove a proposed time (and its answers). */
export async function removePanelSlot(formData: FormData): Promise<void> {
  await requireAdmin();
  const slotId = idOf(formData, 'slotId');
  const id = idOf(formData, 'interviewId');
  if (!slotId || !id) return;
  const db = await createClient();
  await db.from('panel_interview_slots').delete().eq('id', slotId).eq('interview_id', id);
  revalidatePath(`/admin/panel/${id}`);
  refresh();
}

/** Confirm a time: the interview is scheduled. No email yet: the pop-up then asks whether to email the guest. */
export async function confirmPanelSlot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = idOf(formData, 'interviewId');
  const slotId = idOf(formData, 'slotId');
  if (!id || !slotId) return { status: 'error', message: GENERIC };
  const db = await createClient();
  const { data: slot } = await db.from('panel_interview_slots').select('starts_at').eq('id', slotId).eq('interview_id', id).maybeSingle();
  if (!slot) return { status: 'error', message: GENERIC };
  const { data: iv, error } = await db
    .from('panel_interviews')
    .update({ status: 'scheduled', scheduled_at: slot.starts_at, confirmed_by: viewer.userId, guest_emailed_at: null, guest_email_dismissed_at: null })
    .eq('id', id)
    .select('guest_id')
    .single();
  if (error || !iv) return { status: 'error', message: GENERIC };
  const when = formatSlot(new Date(slot.starts_at));
  await log(db, iv.guest_id, viewer.userId, 'interview', `Set for ${when}`);
  revalidatePath(`/admin/panel/${id}`);
  refresh();
  return { status: 'success', message: `Interview set for ${when}.`, values: { ask: 'panel_email', interviewId: id } };
}

/** Change the time: back to choosing (the answers are kept). */
export async function reopenPanelScheduling(formData: FormData): Promise<void> {
  const viewer = await requireAdmin();
  const id = idOf(formData, 'interviewId');
  if (!id) return;
  const db = await createClient();
  const { data: iv } = await db
    .from('panel_interviews')
    .update({ status: 'scheduling', scheduled_at: null, confirmed_by: null, guest_emailed_at: null, guest_email_dismissed_at: null })
    .eq('id', id)
    .select('guest_id')
    .single();
  if (iv) await log(db, iv.guest_id, viewer.userId, 'interview', 'Time changed: choosing again');
  revalidatePath(`/admin/panel/${id}`);
  refresh();
}

/** Cancel the panel interview altogether (to choose other people). The guest stays in Panel Interview. */
export async function cancelPanel(formData: FormData): Promise<void> {
  const viewer = await requireAdmin();
  const id = idOf(formData, 'interviewId');
  if (!id) return;
  const db = await createClient();
  const { data: iv } = await db.from('panel_interviews').delete().eq('id', id).select('guest_id').maybeSingle();
  if (iv) await log(db, iv.guest_id, viewer.userId, 'interview', 'Panel interview cancelled');
  refresh();
  redirect('/admin/guests#board');
}

/** Email the guest their interview time (after the admin confirms), and the panelists too when ticked. */
export async function sendPanelEmails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = idOf(formData, 'interviewId');
  if (!id) return { status: 'error', message: GENERIC };
  const alsoPanel = formData.get('panelists') === 'on';
  const db = await createClient();
  const { data: iv } = await db
    .from('panel_interviews')
    .select('id, guest_id, panelist_ids, scheduled_at, duration_minutes, format, location, guest:guest_requests(first_name, last_name, email)')
    .eq('id', id)
    .maybeSingle();
  const guest = (Array.isArray(iv?.guest) ? iv?.guest[0] : iv?.guest) as { first_name: string; last_name: string; email: string } | null | undefined;
  if (!iv || !iv.scheduled_at || !guest) return { status: 'error', message: GENERIC };
  const when = formatSlot(new Date(iv.scheduled_at));
  const panel = await panelNames(iv.panelist_ids);
  const r = await deliver({
    kind: 'panel_interview',
    dedupeKey: `${iv.id}:${iv.scheduled_at}`,
    to: { email: guest.email, name: `${guest.first_name} ${guest.last_name}` },
    email: T.panelInterviewGuestEmail({
      siteUrl: siteUrl(),
      firstName: guest.first_name,
      when,
      minutes: iv.duration_minutes,
      format: iv.format,
      location: iv.location,
      panel,
    }),
  });
  if (r === 'skipped') return { status: 'error', message: 'Email is not set up yet.' };
  if (r === 'failed') return { status: 'error', message: 'Could not send. Try again.' };
  await db.from('panel_interviews').update({ guest_emailed_at: new Date().toISOString() }).eq('id', id);
  await log(db, iv.guest_id, viewer.userId, 'interview', `Time emailed to the guest (${when})`);
  if (alsoPanel) {
    const people = await loadRecipients(iv.panelist_ids);
    after(() =>
      safely('panel confirmed', async () => {
        for (const p of people.values()) {
          await deliver({
            kind: 'panel_confirmed',
            dedupeKey: `${iv.id}:${iv.scheduled_at}`,
            to: { email: p.email, name: `${p.firstName} ${p.lastName}`, profileId: p.id },
            email: T.panelConfirmedEmail({
              siteUrl: siteUrl(),
              toFirstName: p.firstName,
              guestName: `${guest.first_name} ${guest.last_name}`,
              when,
              minutes: iv.duration_minutes,
              format: iv.format,
              location: iv.location,
              panel,
              link: `${siteUrl()}/admin/panel/${iv.id}`,
            }),
          });
        }
      }),
    );
  }
  revalidatePath(`/admin/panel/${id}`);
  refresh();
  return {
    status: 'success',
    message: r === 'duplicate' ? 'Already emailed for this time.' : `Emailed ${guest.first_name}${alsoPanel ? ' and the panel' : ''}.`,
  };
}

/** "Not needed" for the interview-time email (told them by phone), or bring the reminder back. */
export async function dismissPanelEmail(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = idOf(formData, 'interviewId');
  if (!id) return;
  const db = await createClient();
  await db
    .from('panel_interviews')
    .update({ guest_email_dismissed_at: formData.get('undo') === '1' ? null : new Date().toISOString() })
    .eq('id', id);
  revalidatePath(`/admin/panel/${id}`);
  refresh();
}

/** Panel interview done (or not yet). */
export async function setPanelDone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = idOf(formData);
  if (!id) return { status: 'error', message: GENERIC };
  const done = formData.get('done') === 'true';
  const db = await createClient();
  const { error } = await db
    .from('guest_requests')
    .update({ one_on_ones_done_at: done ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) return { status: 'error', message: GENERIC };
  await log(db, id, viewer.userId, 'interview', done ? 'done' : 'not done yet');
  if (done) await advanceGuest(db, id, 'interview');
  refresh();
  return { status: 'success', message: done ? 'Panel interview done.' : 'Marked as pending.' };
}

// --- Membership -----------------------------------------------------------------------------------------------------

/** The guest's application account (matched by email) and its status. */
async function applicantOf(db: Awaited<ReturnType<typeof createClient>>, guestId: string) {
  const { data: g } = await db.from('guest_requests').select('email, first_name, last_name').eq('id', guestId).maybeSingle();
  if (!g) return null;
  const { data: c } = await db
    .from('member_contacts')
    .select('profile_id, profile:profiles(status)')
    .ilike('email', g.email.replace(/[\\%_]/g, '\\$&'))
    .limit(1)
    .maybeSingle();
  const p = (Array.isArray(c?.profile) ? c?.profile[0] : c?.profile) as { status: string } | null | undefined;
  return { guest: g, profileId: c?.profile_id ?? null, status: p?.status ?? null };
}

/** Approve the membership. No welcome email: the pop-up then asks whether to send it. */
export async function approveMembership(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = idOf(formData);
  if (!id) return { status: 'error', message: GENERIC };
  const db = await createClient();
  const a = await applicantOf(db, id);
  if (!a?.profileId) return { status: 'error', message: 'They have no application yet: send them the application form first.' };
  const { data, error } = await db.from('profiles').update({ status: 'approved' }).eq('id', a.profileId).select('id');
  if (error && /category is full/.test(error.message))
    return { status: 'error', message: 'Their category is full. Raise its seats under “Category seats”, or ask them to pick another category.' };
  if (error || !data?.length) return { status: 'error', message: GENERIC };
  await db.from('guest_requests').update({ membership_declined_at: null, membership_declined_by: null, membership_called_at: null }).eq('id', id);
  await log(db, id, viewer.userId, 'note', 'Membership approved');
  // Onboarding row and the members' newsletter list (not an email to them); the welcome email waits for the confirm.
  const admin = createAdminClient();
  if (admin) await admin.from('member_onboarding').upsert({ profile_id: a.profileId }, { onConflict: 'profile_id', ignoreDuplicates: true });
  revalidatePath('/members');
  refresh();
  return { status: 'success', message: 'Membership approved.', values: { ask: 'welcome' } };
}

/** Send the welcome email (after the admin confirms). It also adds them to the members' newsletter list. */
export async function sendWelcomeEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = idOf(formData);
  if (!id) return { status: 'error', message: GENERIC };
  const db = await createClient();
  const a = await applicantOf(db, id);
  if (!a?.profileId || a.status !== 'approved') return { status: 'error', message: 'Approve their membership first.' };
  const people = await loadRecipients([a.profileId]);
  const r = people.get(a.profileId);
  if (!r) return { status: 'error', message: GENERIC };
  const sent = await deliver({
    kind: 'welcome',
    dedupeKey: a.profileId,
    to: { email: r.email, name: `${r.firstName} ${r.lastName}`, profileId: r.id },
    email: T.welcomeEmail({ siteUrl: siteUrl(), firstName: r.firstName }),
  });
  if (sent === 'skipped') return { status: 'error', message: 'Email is not set up yet.' };
  if (sent === 'failed') return { status: 'error', message: 'Could not send. Try again.' };
  const pid = a.profileId;
  after(() => safely('member status', () => onMemberStatus(pid, 'approved')));
  await log(db, id, viewer.userId, 'note', 'Welcome email sent');
  refresh();
  return { status: 'success', message: sent === 'duplicate' ? 'The welcome email was already sent.' : 'Welcome email sent.' };
}

/** "Not needed" for the welcome email, or bring the reminder back. */
export async function dismissWelcomeEmail(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = idOf(formData);
  if (!id) return;
  const db = await createClient();
  await db
    .from('guest_requests')
    .update({ welcome_email_dismissed_at: formData.get('undo') === '1' ? null : new Date().toISOString() })
    .eq('id', id);
  refresh();
}

/** Membership not approved: no email goes out; a reminder to call them shows with their phone number. */
export async function declineMembership(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = idOf(formData);
  if (!id) return { status: 'error', message: GENERIC };
  const db = await createClient();
  const a = await applicantOf(db, id);
  if (a?.profileId && a.status === 'pending') {
    await db.from('profiles').update({ status: 'declined' }).eq('id', a.profileId);
    const pid = a.profileId;
    after(() => safely('member status', () => onMemberStatus(pid, 'declined')));
  }
  const { data, error } = await db
    .from('guest_requests')
    .update({ membership_declined_at: new Date().toISOString(), membership_declined_by: viewer.userId, membership_called_at: null })
    .eq('id', id)
    .select('phone');
  if (error || !data?.length) return { status: 'error', message: GENERIC };
  await log(db, id, viewer.userId, 'declined', 'Membership not approved: call them');
  refresh();
  const phone = data[0]?.phone;
  return { status: 'success', message: `Not approved. No email was sent: please call them${phone ? ` on ${phone}` : ''}.` };
}

/** "Called them" about the membership decision (or undo). */
export async function markMembershipCalled(formData: FormData): Promise<void> {
  const viewer = await requireAdmin();
  const id = idOf(formData);
  if (!id) return;
  const undo = formData.get('undo') === '1';
  const db = await createClient();
  await db
    .from('guest_requests')
    .update({ membership_called_at: undo ? null : new Date().toISOString() })
    .eq('id', id);
  if (!undo) await log(db, id, viewer.userId, 'note', 'Called them about the membership decision');
  refresh();
}

// --- Pending applications (owner, 2026-11-25: "Approve" asks before the welcome email too) ---------------------------

/** Approve an application from the Pending applications list. No email: the pop-up then asks about the welcome email. */
export async function approveApplicant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idOf(formData, 'profileId');
  if (!id) return { status: 'error', message: GENERIC };
  const db = await createClient();
  const { data, error } = await db.from('profiles').update({ status: 'approved' }).eq('id', id).eq('status', 'pending').select('id');
  if (error && /category is full/.test(error.message))
    return { status: 'error', message: 'Their category is full. Raise its seats under “Category seats”, or ask them to pick another category.' };
  if (error || !data?.length) return { status: 'error', message: GENERIC };
  const admin = createAdminClient();
  if (admin) await admin.from('member_onboarding').upsert({ profile_id: id }, { onConflict: 'profile_id', ignoreDuplicates: true });
  revalidatePath('/members');
  refresh();
  return { status: 'success', message: 'Membership approved.', values: { ask: 'welcome', profileId: id } };
}

/** Send the welcome email to an approved member (after the admin confirms); also adds them to the newsletter list. */
export async function sendMemberWelcome(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idOf(formData, 'profileId');
  if (!id) return { status: 'error', message: GENERIC };
  const people = await loadRecipients([id]);
  const r = people.get(id);
  if (!r || r.status !== 'approved') return { status: 'error', message: 'Approve their membership first.' };
  const sent = await deliver({
    kind: 'welcome',
    dedupeKey: id,
    to: { email: r.email, name: `${r.firstName} ${r.lastName}`, profileId: r.id },
    email: T.welcomeEmail({ siteUrl: siteUrl(), firstName: r.firstName }),
  });
  if (sent === 'skipped') return { status: 'error', message: 'Email is not set up yet.' };
  if (sent === 'failed') return { status: 'error', message: 'Could not send. Try again.' };
  after(() => safely('member status', () => onMemberStatus(id, 'approved')));
  refresh();
  return { status: 'success', message: sent === 'duplicate' ? 'The welcome email was already sent.' : 'Welcome email sent.' };
}
