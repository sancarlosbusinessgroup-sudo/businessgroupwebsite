'use server';

import { after } from 'next/server';
import { deliver, loadAdmins, loadRecipients, safely, siteUrl } from '@/lib/email/notify';
import * as T from '@/lib/email/templates';
import { createAdminClient } from '@/lib/supabase/admin';
import { type ActionState, fieldErrors, formToObject, guestSurveySchema } from '@/lib/validation';

/**
 * A guest answers the follow-up survey (owner meeting 2026-10-30). No login: the random token in the emailed link
 * identifies the survey. Answers are saved once; admins and the member who invited the guest get them by email.
 */
export async function submitGuestSurvey(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const parsed = guestSurveySchema.safeParse(values);
  if (!parsed.success) {
    return { status: 'error', message: 'Please answer the first two questions.', errors: fieldErrors(parsed.error), values };
  }
  const d = parsed.data;
  const db = createAdminClient();
  if (!db) return { status: 'error', message: 'The survey isn’t available right now. Please try again later.', values };

  const { data: survey } = await db.from('guest_surveys').select('id, guest_id, answered_at').eq('token', d.token).maybeSingle();
  if (!survey) return { status: 'error', message: 'This survey link isn’t valid.', values };
  if (survey.answered_at) return { status: 'success', message: 'already' };

  const { error } = await db
    .from('guest_surveys')
    .update({
      answered_at: new Date().toISOString(),
      coming_back: d.comingBack,
      interested_in_joining: d.interestedInJoining,
      most_interesting: d.mostInteresting ?? null,
      one_on_one_with: d.oneOnOneWith ?? null,
      comments: d.comments ?? null,
    })
    .eq('id', survey.id)
    .is('answered_at', null);
  if (error) return { status: 'error', message: 'Something went wrong saving your answers. Please try again.', values };

  after(() => safely('guest survey answers', () => notifySurveyAnswered(survey.guest_id)));
  return { status: 'success', message: 'thanks' };
}

async function notifySurveyAnswered(guestId: string) {
  const db = createAdminClient();
  if (!db) return;
  const [{ data: g }, { data: s }] = await Promise.all([
    db.from('guest_requests').select('first_name, last_name, business_name, referrer_id').eq('id', guestId).maybeSingle(),
    db.from('guest_surveys').select('coming_back, interested_in_joining, most_interesting, one_on_one_with, comments').eq('guest_id', guestId).maybeSingle(),
  ]);
  if (!g || !s) return;
  const admins = await loadAdmins();
  const inviter = g.referrer_id ? (await loadRecipients([g.referrer_id])).get(g.referrer_id) : undefined;
  const people = [...admins, ...(inviter && inviter.status === 'approved' && !admins.some((a) => a.id === inviter.id) ? [inviter] : [])];
  const url = siteUrl();
  for (const r of people) {
    await deliver({
      kind: 'guest_survey_answer',
      dedupeKey: guestId,
      to: { email: r.email, name: `${r.firstName} ${r.lastName}`, profileId: r.id },
      email: T.guestSurveyAnswerEmail({
        siteUrl: url,
        toFirstName: r.firstName,
        guestName: `${g.first_name} ${g.last_name}`,
        guestBusiness: g.business_name,
        comingBack: s.coming_back,
        interestedInJoining: s.interested_in_joining,
        mostInteresting: s.most_interesting,
        oneOnOneWith: s.one_on_one_with,
        comments: s.comments,
      }),
    });
  }
}
