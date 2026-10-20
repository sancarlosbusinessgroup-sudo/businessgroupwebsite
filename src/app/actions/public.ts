'use server';

import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { onGuestRequest } from '@/lib/email/events';
import { safely } from '@/lib/email/notify';
import { type ActionState, fieldErrors, formToObject, guestRequestSchema } from '@/lib/validation';

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
    first_name: d.firstName,
    last_name: d.lastName,
    email: d.email,
    business_name: d.businessName ?? null,
    invited_by_text: d.invitedBy ?? null,
    referral_code: d.referralCode ?? null,
    meeting_id: d.meetingId ?? null,
  });
  if (error) {
    const limited = /too many requests/i.test(error.message);
    return {
      status: 'error',
      message: limited ? 'We already have your request. Please try again tomorrow.' : 'Something went wrong sending your request. Please try again.',
      values,
    };
  }
  after(() => safely('guest request', () => onGuestRequest(guestId)));
  return { status: 'success', message: d.firstName };
}
