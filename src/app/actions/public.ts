'use server';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUpcomingMeetings } from '@/lib/data/public';
import { todaysMeeting } from '@/lib/data/visitor-sign-in';
import { onGuestRequest } from '@/lib/email/events';
import { safely } from '@/lib/email/notify';
import { type ActionState, fieldErrors, formToObject, guestRequestSchema, memberGuestInviteSchema, visitorSignInSchema } from '@/lib/validation';

/**
 * A salted hash of the visitor's network address, so the database can limit how many guest requests one
 * network sends per hour (audit, 2026-10-27) without ever storing the address itself.
 */
async function networkHash(): Promise<string | null> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? '').split(',')[0]?.trim() ?? '';
  if (!ip) return null;
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? 'barp';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 40);
}

export async function submitGuestRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = guestRequestSchema.safeParse(values);
  if (!parsed.success) {
    return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const guestId = crypto.randomUUID();
  const { error } = await supabase.from('guest_requests').insert({
    id: guestId,
    ip_hash: await networkHash(),
    first_name: d.firstName,
    last_name: d.lastName,
    email: d.email,
    business_name: d.businessName ?? null,
    business_description: d.businessDescription,
    phone: d.phone ?? null,
    website: d.website ?? null,
    invited_by_text: d.invitedBy ?? null,
    referral_code: d.referralCode ?? null,
    meeting_id: d.meetingId ?? null,
  });
  if (error) {
    const limited = /too many requests/i.test(error.message);
    const network = /from this network/i.test(error.message);
    return {
      status: 'error',
      message: network
        ? 'Too many requests from your network just now. Please try again in an hour.'
        : limited
          ? 'We already have your request. Please try again tomorrow.'
          : 'Something went wrong sending your request. Please try again.',
      values,
    };
  }
  after(() => safely('guest request', () => onGuestRequest(guestId)));
  return { status: 'success', message: d.firstName };
}

/**
 * A signed-in member invites a guest (owner, 2026-10-30): the "Invite A Guest" page, the members' version of the
 * Visit page form and the dashboard pop-up. The member fills in the guest's details; the request is credited to the
 * signed-in member (their referral code sets referrer_id in the database trigger, and their name is the "Invited by").
 */
export async function submitMemberGuestInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Please log in again to invite a guest.', values };
  const { data: me } = await supabase.from('profiles').select('first_name, last_name, referral_code, status').eq('id', user.id).maybeSingle();
  if (!me || me.status !== 'approved') return { status: 'error', message: 'Only approved members can invite guests here.', values };

  const parsed = memberGuestInviteSchema.safeParse(values);
  if (!parsed.success) {
    return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values };
  }
  const d = parsed.data;
  const guestId = crypto.randomUUID();
  // No network limit here: the member is signed in, and several members often share one office network.
  const { error } = await supabase.from('guest_requests').insert({
    id: guestId,
    first_name: d.firstName,
    last_name: d.lastName,
    email: d.email,
    business_name: d.businessName ?? null,
    business_description: d.businessDescription,
    phone: d.phone,
    website: d.website ?? null,
    invited_by_text: `${me.first_name} ${me.last_name}`.trim(),
    referral_code: me.referral_code,
    meeting_id: d.meetingId ?? null,
  });
  if (error) {
    const limited = /too many requests/i.test(error.message);
    return {
      status: 'error',
      message: limited
        ? 'This guest already has an invitation request from today. Please try again tomorrow.'
        : 'Something went wrong sending the invitation request. Please try again.',
      values,
    };
  }
  after(() => safely('member guest invite', () => onGuestRequest(guestId, { byMember: true })));
  revalidatePath('/dashboard');
  return { status: 'success', message: d.firstName };
}

/**
 * Visitor sign-in link (owner, 2026-10-30): a visitor who joined the meeting without an invite request enters their
 * details. On a meeting day they are recorded as visiting today's meeting (status "visited", marked
 * "meeting_sign_in"), with the member who invited them if they picked one; no emails go out now (the visitor and
 * that member get the usual follow-up the next morning). On any other day it is an ordinary invite request.
 */
export async function submitVisitorSignIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = visitorSignInSchema.safeParse(values);
  if (!parsed.success) {
    return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const admin = createAdminClient();
  const [meeting, inviter] = await Promise.all([
    todaysMeeting(supabase),
    d.invitedById
      ? (admin ?? supabase).from('profiles').select('id, first_name, last_name').eq('id', d.invitedById).eq('status', 'approved').maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const inviterName = inviter.data ? `${inviter.data.first_name} ${inviter.data.last_name}` : null;

  // Already on the guest list (asked for an invite before, or signed in twice)? Update that request, no duplicate.
  if (admin && meeting) {
    const { data: existing } = await admin
      .from('guest_requests')
      .select('id, status, referrer_id, phone, business_name, business_description, website, invited_by_text')
      .ilike('email', d.email.replace(/[\\%_]/g, '\\$&'))
      .in('status', ['requested', 'visited'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      await admin
        .from('guest_requests')
        .update({
          status: 'visited',
          meeting_id: meeting.id,
          phone: existing.phone ?? d.phone ?? null,
          business_name: existing.business_name ?? d.businessName ?? null,
          business_description: existing.business_description ?? d.businessDescription ?? null,
          website: existing.website ?? d.website ?? null,
          invited_by_text: existing.invited_by_text ?? inviterName ?? d.invitedBy ?? null,
          ...(!existing.referrer_id && inviter.data ? { referrer_id: inviter.data.id } : {}),
        })
        .eq('id', existing.id);
      revalidatePath('/admin');
      return { status: 'success', message: d.firstName, values: { today: 'yes' } };
    }
  }

  const next = meeting ? null : ((await getUpcomingMeetings(3)).find((m) => m.category === 'Networking') ?? null);
  const guestId = crypto.randomUUID();
  const { error } = await supabase.from('guest_requests').insert({
    id: guestId,
    ip_hash: await networkHash(),
    first_name: d.firstName,
    last_name: d.lastName,
    email: d.email,
    business_name: d.businessName ?? null,
    business_description: d.businessDescription ?? null,
    phone: d.phone ?? null,
    website: d.website ?? null,
    invited_by_text: inviterName ?? d.invitedBy ?? null,
    meeting_id: meeting?.id ?? next?.id ?? null,
  });
  if (error) {
    const limited = /too many requests/i.test(error.message);
    const network = /from this network/i.test(error.message);
    return {
      status: 'error',
      message: network
        ? 'Too many sign-ins from your network just now. Please tell the host in the Zoom chat instead.'
        : limited
          ? 'You’re already signed in. Thank you!'
          : 'Something went wrong. Please try again.',
      values,
    };
  }
  // The insert trigger always stores "requested" and no referrer; the server sets the rest.
  if (admin) {
    await admin
      .from('guest_requests')
      .update({
        source: 'meeting_sign_in',
        ...(meeting ? { status: 'visited' as const } : {}),
        ...(inviter.data ? { referrer_id: inviter.data.id } : {}),
      })
      .eq('id', guestId);
  }
  if (!meeting) after(() => safely('guest request', () => onGuestRequest(guestId)));
  revalidatePath('/admin');
  return { status: 'success', message: d.firstName, values: { today: meeting ? 'yes' : 'no' } };
}
