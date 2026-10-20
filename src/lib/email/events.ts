// What happens (email-wise) after each member action. Called from server actions inside after(),
// so they run once the response is sent. All lookups use the service-role client.
import 'server-only';

import { referralStatusLabels } from '../content';
import { formatMeetingDate, formatMeetingTime, formatMoney, formatShortDate } from '../dates';
import { createAdminClient } from '../supabase/admin';
import { removeFromList, upsertContact } from './brevo';
import { deliver, loadAdmins, loadOptOuts, loadRecipients, notifyMembers, siteUrl } from './notify';
import * as T from './templates';

const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;
const day = (iso: string) => formatShortDate(new Date(`${iso}T12:00:00Z`));

/** Admin changed a member's status. Approval: welcome email, onboarding row, newsletter list. */
export async function onMemberStatus(profileId: string, status: string): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  const people = await loadRecipients([profileId]);
  const r = people.get(profileId);
  if (!r) return;
  const { data: p } = await db.from('profiles').select('business_name').eq('id', profileId).single();
  if (status === 'approved') {
    await db.from('member_onboarding').upsert({ profile_id: profileId }, { onConflict: 'profile_id', ignoreDuplicates: true });
    await deliver({
      kind: 'welcome',
      dedupeKey: profileId,
      to: { email: r.email, name: `${r.firstName} ${r.lastName}`, profileId },
      email: T.welcomeEmail({ siteUrl: siteUrl(), firstName: r.firstName }),
    });
    await upsertContact({ email: r.email, firstName: r.firstName, lastName: r.lastName, business: p?.business_name });
  } else if (status === 'inactive' || status === 'declined') {
    await removeFromList(r.email);
  }
}

export async function onReferralSent(referralId: string): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  const { data: ref } = await db
    .from('referrals')
    .select('id, from_id, to_id, contact_name, prospect_phone, prospect_email, amount, notes')
    .eq('id', referralId)
    .single();
  if (!ref) return;
  const { data: from } = await db.from('profiles').select('first_name, last_name').eq('id', ref.from_id).single();
  if (!from) return;
  await notifyMembers([ref.to_id], {
    kind: 'referral_received',
    dedupeKey: ref.id,
    pref: 'referrals',
    build: (r) =>
      T.referralReceivedEmail({
        siteUrl: siteUrl(),
        toFirstName: r.firstName,
        fromName: fullName(from),
        prospect: ref.contact_name,
        phone: ref.prospect_phone,
        email: ref.prospect_email,
        amount: ref.amount != null ? formatMoney(Number(ref.amount)) : null,
        notes: ref.notes,
      }),
  });
}

export async function onReferralUpdated(referralId: string): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  const { data: ref } = await db.from('referrals').select('id, from_id, to_id, contact_name, status, amount').eq('id', referralId).single();
  if (!ref) return;
  const { data: to } = await db.from('profiles').select('first_name, last_name').eq('id', ref.to_id).single();
  if (!to) return;
  const status = referralStatusLabels[ref.status] ?? ref.status;
  await notifyMembers([ref.from_id], {
    kind: 'referral_status',
    // One email per status a referral reaches (saving the amount alone does not re-send).
    dedupeKey: `${ref.id}:${ref.status}`,
    pref: 'referrals',
    build: (r) =>
      T.referralStatusEmail({
        siteUrl: siteUrl(),
        toFirstName: r.firstName,
        receiverName: fullName(to),
        prospect: ref.contact_name,
        status,
        amount: ref.amount != null ? formatMoney(Number(ref.amount)) : null,
      }),
  });
}

export async function onOneOnOneReported(id: string): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  const { data: o } = await db.from('one_on_ones').select('id, reporter_id, partner_id, met_on, confirmed_at').eq('id', id).single();
  if (!o || o.confirmed_at) return;
  const { data: rep } = await db.from('profiles').select('first_name, last_name').eq('id', o.reporter_id).single();
  if (!rep) return;
  await notifyMembers([o.partner_id], {
    kind: 'one_on_one_confirm',
    dedupeKey: o.id,
    pref: 'one_on_ones',
    build: (r) => T.oneOnOneConfirmEmail({ siteUrl: siteUrl(), toFirstName: r.firstName, reporterName: fullName(rep), date: day(o.met_on) }),
  });
}

export async function onOneOnOneRequested(id: string): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  const { data: q } = await db.from('one_on_one_requests').select('id, requester_id, invitee_id, proposed_on, message').eq('id', id).single();
  if (!q) return;
  const { data: req } = await db.from('profiles').select('first_name, last_name, business_name').eq('id', q.requester_id).single();
  if (!req) return;
  await notifyMembers([q.invitee_id], {
    kind: 'one_on_one_request',
    dedupeKey: q.id,
    pref: 'one_on_ones',
    build: (r) =>
      T.oneOnOneRequestEmail({
        siteUrl: siteUrl(),
        toFirstName: r.firstName,
        requesterName: fullName(req),
        business: req.business_name,
        date: q.proposed_on ? day(q.proposed_on) : null,
        message: q.message,
      }),
  });
}

export async function onOneOnOneAnswered(id: string): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  const { data: q } = await db.from('one_on_one_requests').select('id, requester_id, invitee_id, status').eq('id', id).single();
  if (!q || (q.status !== 'accepted' && q.status !== 'declined')) return;
  const { data: inv } = await db.from('profiles').select('first_name, last_name').eq('id', q.invitee_id).single();
  if (!inv) return;
  await notifyMembers([q.requester_id], {
    kind: 'one_on_one_answer',
    dedupeKey: q.id,
    pref: 'one_on_ones',
    build: (r) => T.oneOnOneAnswerEmail({ siteUrl: siteUrl(), toFirstName: r.firstName, inviteeName: fullName(inv), accepted: q.status === 'accepted' }),
  });
}

/** A visitor asked to come: thank the visitor, tell the inviting member (if any) and the admins. */
export async function onGuestRequest(guestId: string): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  const { data: g } = await db
    .from('guest_requests')
    .select('id, first_name, last_name, email, business_name, invited_by_text, referrer_id, meeting_id')
    .eq('id', guestId)
    .single();
  if (!g) return;
  let meeting: string | null = null;
  if (g.meeting_id) {
    const { data: m } = await db.from('meetings').select('starts_at').eq('id', g.meeting_id).single();
    if (m) meeting = `${formatMeetingDate(new Date(m.starts_at))} at ${formatMeetingTime(new Date(m.starts_at))}`;
  }
  const guestName = `${g.first_name} ${g.last_name}`;
  await deliver({
    kind: 'guest_thanks',
    dedupeKey: g.id,
    to: { email: g.email, name: guestName },
    email: T.guestThanksEmail({ siteUrl: siteUrl(), firstName: g.first_name, meeting }),
  });
  let invitedBy = g.invited_by_text;
  if (g.referrer_id) {
    const { data: ref } = await db.from('profiles').select('first_name, last_name').eq('id', g.referrer_id).single();
    if (ref) invitedBy = fullName(ref);
    await notifyMembers([g.referrer_id], {
      kind: 'guest_notice_member',
      dedupeKey: g.id,
      pref: 'visitors',
      build: (r) =>
        T.guestNoticeEmail({ siteUrl: siteUrl(), toFirstName: r.firstName, forAdmins: false, guestName, guestEmail: g.email, business: g.business_name, meeting }),
    });
  }
  const admins = await loadAdmins();
  const off = await loadOptOuts(admins.map((a) => a.id), 'visitors');
  for (const a of admins) {
    if (off.has(a.id)) continue;
    await deliver({
      kind: 'guest_notice_admin',
      dedupeKey: g.id,
      to: { email: a.email, name: `${a.firstName} ${a.lastName}`, profileId: a.id },
      email: T.guestNoticeEmail({
        siteUrl: siteUrl(),
        toFirstName: a.firstName,
        forAdmins: true,
        guestName,
        guestEmail: g.email,
        business: g.business_name,
        invitedBy,
        meeting,
      }),
    });
  }
}

/** Admin "Sync newsletter list": every approved member with an email goes into the Brevo list. */
export async function syncNewsletterList(): Promise<{ synced: number; failed: number; skipped: boolean }> {
  const db = createAdminClient();
  if (!db) return { synced: 0, failed: 0, skipped: true };
  const { data } = await db.from('profiles').select('id, business_name').eq('status', 'approved');
  const people = await loadRecipients((data ?? []).map((p) => p.id));
  let synced = 0;
  let failed = 0;
  for (const p of data ?? []) {
    const r = people.get(p.id);
    if (!r) continue;
    const res = await upsertContact({ email: r.email, firstName: r.firstName, lastName: r.lastName, business: p.business_name });
    if (res.status === 'skipped') return { synced, failed, skipped: true };
    if (res.status === 'sent') synced++;
    else failed++;
  }
  return { synced, failed, skipped: false };
}
