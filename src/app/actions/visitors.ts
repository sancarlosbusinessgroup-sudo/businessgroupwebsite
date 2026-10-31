'use server';

import { revalidatePath } from 'next/cache';
import { requireMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { type ActionState, fieldErrors, formToObject, visitorBroughtSchema } from '@/lib/validation';

/**
 * "Visitors brought" (owner meeting 2026-10-30): a member logs a guest they brought who attended a past meeting.
 * Saved as a guest request marked Visiting at that meeting and credited to the member, so it counts on the
 * leaderboard, Member stats and the BARP Champion points. Guest requests can only be marked visited server-side
 * (the insert trigger always stores "requested" with no referrer), so this uses the service role after checking
 * that the signed-in member is approved and the meeting is a real past group meeting.
 */
export async function logVisitorBrought(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const viewer = await requireMember('/visitors-brought');
  const me = viewer.profile;
  if (me.status !== 'approved') return { status: 'error', message: 'Only approved members can log visitors.', values };

  const parsed = visitorBroughtSchema.safeParse(values);
  if (!parsed.success) {
    return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values };
  }
  const d = parsed.data;
  const admin = createAdminClient();
  if (!admin) return { status: 'error', message: 'Logging visitors isn’t available right now. Please tell the support team.', values };

  const supabase = await createClient();
  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, starts_at')
    .eq('id', d.meetingId)
    .eq('category', 'Networking')
    .lte('starts_at', new Date().toISOString())
    .maybeSingle();
  if (!meeting) return { status: 'error', message: 'Please fix the highlighted fields.', errors: { meetingId: 'Choose a past meeting from the list' }, values };

  const name = `${me.first_name} ${me.last_name}`.trim();
  // Already on the guest list (an invite request, or a visitor sign-in)? Update that one instead of adding a duplicate.
  const { data: existing } = await admin
    .from('guest_requests')
    .select('id, status, referrer_id, business_name, phone, invited_by_text')
    .ilike('email', d.email.replace(/[\\%_]/g, '\\$&'))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    if (existing.referrer_id && existing.referrer_id !== me.id) {
      return { status: 'error', message: 'This visitor is already credited to another member. Please ask an admin if that’s wrong.', values };
    }
    const { error } = await admin
      .from('guest_requests')
      .update({
        status: existing.status === 'requested' ? 'visited' : existing.status,
        meeting_id: meeting.id,
        referrer_id: me.id,
        invited_by_text: existing.invited_by_text ?? name,
        business_name: existing.business_name ?? d.businessName ?? null,
        phone: existing.phone ?? d.phone ?? null,
      })
      .eq('id', existing.id);
    if (error) return { status: 'error', message: 'Something went wrong saving the visitor. Please try again.', values };
  } else {
    const id = crypto.randomUUID();
    const { error } = await admin.from('guest_requests').insert({
      id,
      first_name: d.firstName,
      last_name: d.lastName,
      email: d.email,
      business_name: d.businessName ?? null,
      phone: d.phone ?? null,
      invited_by_text: name,
      meeting_id: meeting.id,
    });
    if (error) return { status: 'error', message: 'Something went wrong saving the visitor. Please try again.', values };
    // The insert trigger stores "requested" and no referrer; mark the visit and credit the member.
    const { error: markErr } = await admin.from('guest_requests').update({ status: 'visited', referrer_id: me.id }).eq('id', id);
    if (markErr) return { status: 'error', message: 'Something went wrong saving the visitor. Please try again.', values };
  }

  for (const p of ['/visitors-brought', '/dashboard', '/admin', '/admin/stats', '/admin/champion']) revalidatePath(p);
  return { status: 'success', message: `${d.firstName} ${d.lastName} is logged as your visitor. Thank you!` };
}
