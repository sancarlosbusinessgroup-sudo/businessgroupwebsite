'use server';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { onGuestRequest } from '@/lib/email/events';
import { safely } from '@/lib/email/notify';
import { type ActionState, fieldErrors, formToObject, guestRequestSchema } from '@/lib/validation';

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
