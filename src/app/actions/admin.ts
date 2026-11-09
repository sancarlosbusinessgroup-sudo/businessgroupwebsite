'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { bustPublic } from '@/lib/data/public';
import { onMemberStatus, sendApplyInvite, sendGuestZoomLink, syncNewsletterList } from '@/lib/email/events';
import { localDateKey } from '@/lib/dates';
import { resendFailedEmail } from '@/lib/email/resend';
import { safely } from '@/lib/email/notify';
import { sendMemberRecap } from '@/lib/email/cron';
import { requireAdmin } from '@/lib/auth';
import { type ActionState, fieldErrors, formToObject, leadershipSchema, seatLimitSchema } from '@/lib/validation';

// Every write here is also restricted to admins by RLS (is_admin()). Actions with side effects outside the
// database (emails, Brevo) check the caller first, so a non-admin can't trigger them (audit, 2026-10-27).

const GENERIC = 'Something went wrong. Please try again.';

/** The caller's Supabase client, or null when they are not an admin. */
async function adminClient() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  return isAdmin ? supabase : null;
}

export async function setMemberStatus(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  const status = z.enum(['approved', 'declined', 'inactive', 'pending']).safeParse(formData.get('status'));
  if (!id.success || !status.success) return;
  const supabase = await adminClient();
  if (!supabase) redirect('/dashboard');
  const { data, error } = await supabase.from('profiles').update({ status: status.data }).eq('id', id.data).select('id');
  revalidatePath('/admin');
  revalidatePath('/members');
  await bustPublic('directory', 'categories');
  if (error && /category is full/.test(error.message)) redirect('/admin?error=category_full');
  if (error || !data?.length) redirect('/admin?error=save');
  const [pid, st] = [id.data, status.data];
  after(() => safely('member status', () => onMemberStatus(pid, st)));
}

export async function setGuestStatus(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  const status = z.enum(['requested', 'visited', 'applied', 'joined']).safeParse(formData.get('status'));
  if (!id.success || !status.success) return;
  const supabase = await createClient();
  await supabase.from('guest_requests').update({ status: status.data }).eq('id', id.data);
  revalidatePath('/admin');
}

export async function resolveCorrection(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('attendance_corrections').update({ resolved: true }).eq('id', id.data);
  revalidatePath('/admin');
}

// --- Category seats (A1) -----------------------------------------------------

export async function setSeatLimit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = seatLimitSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').update({ seat_limit: parsed.data.seatLimit }).eq('id', parsed.data.id).select('id');
  if (error || !data?.length) return { status: 'error', message: GENERIC, values };
  revalidatePath('/admin');
  revalidatePath('/visit');
  revalidatePath('/join');
  await bustPublic('categories');
  return { status: 'success', message: 'Saved' };
}

// --- Management list (About page) ------------------------------------------

function leadershipRow(d: z.output<typeof leadershipSchema>) {
  return { name: d.name, role: d.role, bio: d.bio ?? null, profile_id: d.profileId, sort_order: d.sortOrder };
}

export async function addLeader(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = leadershipSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { error } = await supabase.from('leadership').insert(leadershipRow(parsed.data));
  if (error) return { status: 'error', message: GENERIC, values };
  revalidatePath('/admin/leadership');
  revalidatePath('/about');
  await bustPublic('leadership');
  return { status: 'success', message: 'Added.' };
}

export async function updateLeader(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const id = z.uuid().safeParse(values.id);
  const parsed = leadershipSchema.safeParse(values);
  if (!id.success) return { status: 'error', message: GENERIC };
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { data, error } = await supabase.from('leadership').update(leadershipRow(parsed.data)).eq('id', id.data).select('id');
  if (error || !data?.length) return { status: 'error', message: GENERIC, values };
  revalidatePath('/admin/leadership');
  revalidatePath('/about');
  await bustPublic('leadership');
  return { status: 'success', message: 'Saved' };
}

export async function removeLeader(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('leadership').delete().eq('id', id.data);
  revalidatePath('/admin/leadership');
  revalidatePath('/about');
  await bustPublic('leadership');
}

const cancelSchema = z.object({
  id: z.uuid(),
  reason: z
    .string()
    .trim()
    .max(120, 'Keep the reason to 120 characters or fewer')
    .optional()
    .transform((v) => (v ? v : undefined)),
  restore: z.string().optional(),
});

/** Cancel a meeting (it stays on the schedule, marked cancelled) or restore it. */
export async function setMeetingCancelled(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = cancelSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error), values };
  const restoring = parsed.data.restore === '1';
  if (!restoring && (!parsed.data.reason || parsed.data.reason.length < 2))
    return { status: 'error', errors: { reason: 'Give a short reason, e.g. "Thanksgiving holiday"' }, values };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('meetings')
    .update({ cancelled_reason: restoring ? null : (parsed.data.reason ?? null) })
    .eq('id', parsed.data.id)
    .select('id');
  if (error || !data?.length) return { status: 'error', message: GENERIC, values };
  for (const p of ['/admin', '/', '/group-meetings', '/meetings', '/dashboard']) revalidatePath(p);
  await bustPublic('meetings');
  return { status: 'success', message: restoring ? 'Meeting restored.' : 'Meeting marked cancelled.' };
}

const hideSchema = z.object({ id: z.uuid(), hidden: z.enum(['1', '0']) });

/** Hide an upcoming meeting from the website (lists, countdown, slides, emails) or show it again. */
export async function setMeetingHidden(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = hideSchema.safeParse(values);
  if (!parsed.success) return { status: 'error', message: GENERIC, values };
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  const hidden = parsed.data.hidden === '1';
  const { data, error } = await supabase.from('meetings').update({ hidden }).eq('id', parsed.data.id).select('id');
  if (error || !data?.length) return { status: 'error', message: GENERIC, values };
  for (const p of ['/admin', '/', '/group-meetings', '/events', '/meetings', '/dashboard', '/visit']) revalidatePath(p);
  await bustPublic('meetings');
  return { status: 'success', message: hidden ? 'Meeting hidden from the website.' : 'Meeting shown again.' };
}

/** Push every approved member into the Brevo "Members" newsletter list. */
export async function syncNewsletter(): Promise<ActionState> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  try {
    const r = await syncNewsletterList();
    if (r.skipped) return { status: 'error', message: 'Newsletter sync is not set up yet (Brevo key or list ID missing).' };
    return {
      status: r.failed ? 'error' : 'success',
      message: `${r.synced} member${r.synced === 1 ? '' : 's'} synced to the Brevo list${r.failed ? `, ${r.failed} failed` : ''}.`,
    };
  } catch {
    return { status: 'error', message: GENERIC };
  }
}

/** Admin "Resend" on a failed email in the Recent emails list. */
export async function resendEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.coerce.number().int().positive().safeParse(formData.get('id'));
  if (!id.success) return { status: 'error', message: GENERIC };
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  try {
    const r = await resendFailedEmail(id.data);
    revalidatePath('/admin');
    switch (r.outcome) {
      case 'sent':
        return { status: 'success', message: 'Sent.' };
      case 'not_failed':
        return { status: 'success', message: 'Already sent.' };
      case 'not_resendable':
        return { status: 'error', message: 'Scheduled emails can’t be resent.' };
      case 'gone':
        return { status: 'error', message: 'Can’t resend: what it was about has changed or been deleted, or the person turned these emails off.' };
      case 'unavailable':
        return { status: 'error', message: 'Email is not set up yet.' };
      default:
        return { status: 'error', message: `Still failing${r.error ? `: ${r.error.slice(0, 120)}` : '.'}` };
    }
  } catch {
    return { status: 'error', message: GENERIC };
  }
}

/** Email a guest the link to the membership application form. */
export async function inviteToApply(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return { status: 'error', message: GENERIC };
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  const r = await sendApplyInvite(id.data, localDateKey(new Date()));
  revalidatePath('/admin');
  if (r === 'sent') return { status: 'success', message: 'Invite sent.' };
  if (r === 'duplicate') return { status: 'success', message: 'Already sent today.' };
  if (r === 'skipped') return { status: 'error', message: 'Email is not set up yet.' };
  return { status: 'error', message: 'Could not send. Try again.' };
}

/** Admin "Send Zoom link" on the guest list (owner, 2026-10-24). */
export async function sendZoomLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return { status: 'error', message: GENERIC };
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  const r = await sendGuestZoomLink(id.data, localDateKey(new Date()));
  revalidatePath('/admin');
  switch (r) {
    case 'sent':
      return { status: 'success', message: 'Zoom link sent.' };
    case 'duplicate':
      return { status: 'success', message: 'Already sent today.' };
    case 'skipped':
      return { status: 'error', message: 'Email is not set up yet.' };
    case 'no_meeting':
      return { status: 'error', message: 'No upcoming meeting to send a link for.' };
    case 'no_link':
      return { status: 'error', message: 'That meeting has no Zoom link saved yet.' };
    default:
      return { status: 'error', message: 'Could not send. Try again.' };
  }
}

/** Admin "Done?" in the guest list's One-on-ones column: the guest's one-on-ones with leadership are done (or undo). */
export async function setGuestOneOnOnes(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const done = formData.get('done') === 'true';
  const supabase = await createClient();
  await supabase
    .from('guest_requests')
    .update({ one_on_ones_done_at: done ? new Date().toISOString() : null })
    .eq('id', id.data);
  revalidatePath('/admin');
}

/** The saved "also send to" list on Admin → Member recap: commas, semicolons, spaces or new lines between addresses. */
function parseRecapList(raw: string): { ok: true; emails: string[] } | { ok: false; message: string } {
  const parts = [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const bad = parts.filter((x) => !z.email().safeParse(x).success || x.length > 254);
  if (bad.length) return { ok: false, message: `Please check ${bad.length === 1 ? 'this address' : 'these addresses'}: ${bad.slice(0, 5).join(', ')}` };
  if (parts.length > 100) return { ok: false, message: 'The list can hold at most 100 addresses.' };
  return { ok: true, emails: parts };
}

async function saveRecapListFor(emails: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('email_settings')
    .update({ recap_extra_emails: emails, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('id');
  return !error && !!data?.length;
}

/** Admin → Member recap: save the "also send to" list without sending (owner, 2026-11-10). */
export async function saveRecapList(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const list = parseRecapList(String(formData.get('extraEmails') ?? ''));
  if (!list.ok) return { status: 'error', message: list.message };
  if (!(await saveRecapListFor(list.emails))) return { status: 'error', message: GENERIC };
  revalidatePath('/admin/recap');
  return { status: 'success', message: `List saved (${list.emails.length} ${list.emails.length === 1 ? 'address' : 'addresses'}).` };
}

/** Admin → Member recap: save the list, then send the checked recap now (owner, 2026-11-10: no automatic send). */
export async function sendMemberRecapNow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const meetingId = z.uuid().safeParse(formData.get('meetingId'));
  if (!meetingId.success) return { status: 'error', message: GENERIC };
  const list = parseRecapList(String(formData.get('extraEmails') ?? ''));
  if (!list.ok) return { status: 'error', message: list.message };
  if (!(await saveRecapListFor(list.emails))) return { status: 'error', message: GENERIC };
  const r = await sendMemberRecap(meetingId.data, list.emails);
  if (!r) return { status: 'error', message: GENERIC };
  revalidatePath('/admin/recap');
  const sent = r.members + r.visitors + r.extra;
  const bits = [`${r.members} ${r.members === 1 ? 'member' : 'members'}`, `${r.visitors} ${r.visitors === 1 ? 'visitor' : 'visitors'}`];
  if (r.extra) bits.push(`${r.extra} extra ${r.extra === 1 ? 'address' : 'addresses'}`);
  let msg = sent ? `Sent to ${sent}: ${bits.join(', ')}.` : 'Nothing new to send.';
  if (r.already) msg += ` ${r.already} already had this recap, so they were skipped.`;
  if (r.failed) return { status: 'error', message: `${msg} ${r.failed} could not be sent; see Admin → Overview → recent emails to resend.` };
  return { status: 'success', message: msg };
}

/** Admin → Management recap: turn the automatic Management recap email on or off. */
export async function setManagementRecapsEnabled(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const enabled = z.enum(['on', 'off']).safeParse(formData.get('recaps'));
  if (!enabled.success) return { status: 'error', message: GENERIC };
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) return { status: 'error', message: 'Admins only.' };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const on = enabled.data === 'on';
  const { data, error } = await supabase
    .from('email_settings')
    .update({ management_recaps_enabled: on, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('id');
  if (error || !data?.length) return { status: 'error', message: GENERIC };
  revalidatePath('/admin/management-recap');
  return {
    status: 'success',
    message: on ? 'Management recap is on. Admins get it after each meeting.' : 'Management recap is off. Nothing will be sent until you turn it back on.',
  };
}
