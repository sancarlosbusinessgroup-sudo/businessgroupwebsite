'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { onMemberStatus, sendApplyInvite, syncNewsletterList } from '@/lib/email/events';
import { localDateKey } from '@/lib/dates';
import { safely } from '@/lib/email/notify';
import { type ActionState, fieldErrors, formToObject, leadershipSchema, seatLimitSchema } from '@/lib/validation';

// Every write here is also restricted to admins by RLS (is_admin()).

const GENERIC = 'Something went wrong. Please try again.';

export async function setMemberStatus(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  const status = z.enum(['approved', 'declined', 'inactive', 'pending']).safeParse(formData.get('status'));
  if (!id.success || !status.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ status: status.data }).eq('id', id.data);
  revalidatePath('/admin');
  revalidatePath('/members');
  if (error && /category is full/.test(error.message)) redirect('/admin?error=category_full');
  if (error) redirect('/admin?error=save');
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
  return { status: 'success', message: 'Saved' };
}

export async function removeLeader(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('leadership').delete().eq('id', id.data);
  revalidatePath('/admin/leadership');
  revalidatePath('/about');
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
  return { status: 'success', message: restoring ? 'Meeting restored.' : 'Meeting marked cancelled.' };
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
