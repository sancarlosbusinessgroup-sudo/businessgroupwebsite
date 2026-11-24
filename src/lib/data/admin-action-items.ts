import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { buildActionItems, type ActionItem } from '../admin-action-items';
import { managementRecapsEnabled } from '../email/cron';
import { createAdminClient } from '../supabase/admin';
import { absencesFor, memberSince } from './attendance';

type Db = SupabaseClient<Database>;
const DAY = 86_400_000;

/**
 * Gathers what the Overview's "Items that Need Immediate Action" list needs (owner, 2026-11-24), with the signed-in
 * admin's client (RLS: admins read all of these). Callers must have checked requireAdmin().
 */
export async function loadActionItems(db: Db, now = new Date()): Promise<ActionItem[]> {
  const nowIso = now.toISOString();
  const recent = new Date(now.getTime() - 90 * DAY).toISOString();
  const [lastRes, nextRes, membersRes, corrRes, pendingRes, guestsRes, zoomSentRes, applyRes, failedRes, onboardRes] = await Promise.all([
    db
      .from('meetings')
      .select('id, starts_at, ends_at')
      .eq('category', 'Networking')
      .is('cancelled_reason', null)
      .lte('ends_at', nowIso)
      .order('ends_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('meetings')
      .select('id, starts_at, ends_at, meeting_links(join_url), meeting_speakers(slot)')
      .eq('category', 'Networking')
      .is('cancelled_reason', null)
      .eq('hidden', false)
      .gt('starts_at', nowIso)
      .order('starts_at')
      .limit(1)
      .maybeSingle(),
    db.from('profiles').select('id, first_name, last_name, approved_at, member_since, created_at').eq('status', 'approved'),
    db.from('attendance_corrections').select('id', { count: 'exact', head: true }).eq('resolved', false),
    db.from('profiles').select('id, first_name, last_name, created_at, member_contacts(email)').eq('status', 'pending').order('created_at'),
    db
      .from('guest_requests')
      .select('id, first_name, last_name, email, status, created_at, one_on_ones_done_at, meeting:meetings(ends_at)')
      .neq('status', 'joined')
      // Declined guests are done with (guest board, owner 2026-11-24).
      .is('declined_at', null)
      .gte('created_at', recent)
      .order('created_at'),
    db.from('email_log').select('dedupe_key, created_at').eq('kind', 'guest_zoom_link').eq('status', 'sent').gte('created_at', recent).limit(1000),
    db.from('email_log').select('dedupe_key, created_at').eq('kind', 'apply_invite').eq('status', 'sent').gte('created_at', recent).limit(1000),
    db
      .from('email_log')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', new Date(now.getTime() - 7 * DAY).toISOString()),
    db
      .from('member_onboarding')
      .select('reminded_at, profile:profiles!inner(first_name, last_name, status)')
      .is('completed_at', null)
      .not('reminded_at', 'is', null)
      .gte('invited_at', new Date(now.getTime() - 60 * DAY).toISOString()),
  ]);

  const last = lastRes.data ?? null;
  const [impRes, reviewRes, memberRecapRes, mgmtRecapRes] = last
    ? await Promise.all([
        db.from('attendance_imports').select('status').eq('meeting_id', last.id).maybeSingle(),
        db.from('zoom_participants').select('id', { count: 'exact', head: true }).eq('meeting_id', last.id).eq('resolution', 'pending'),
        db.from('email_log').select('id', { count: 'exact', head: true }).eq('kind', 'meeting_recap').eq('dedupe_key', last.id).eq('status', 'sent'),
        db.from('email_log').select('id', { count: 'exact', head: true }).eq('kind', 'management_recap').eq('dedupe_key', last.id).eq('status', 'sent'),
      ])
    : [null, null, null, null];

  // The on/off switch lives in email_settings, read with the service role (as on the Management Recap tab).
  const service = createAdminClient();
  const mgmtEnabled = service ? await managementRecapsEnabled(service) : true;

  const members = membersRes.data ?? [];
  const absences = await absencesFor(
    db,
    members.map((p) => ({ id: p.id, since: memberSince(p) })),
    now,
  );

  // Latest send per guest; the dedupe key starts with the guest's id.
  const latestBy = (rows: { dedupe_key: string; created_at: string }[] | null) => {
    const out = new Map<string, string>();
    for (const r of rows ?? []) {
      const id = r.dedupe_key.split(':')[0] ?? '';
      const seen = out.get(id);
      if (!seen || seen < r.created_at) out.set(id, r.created_at);
    }
    return out;
  };
  const zoomSent = latestBy(zoomSentRes.data);
  const applySent = latestBy(applyRes.data);

  const next = nextRes.data;
  const link = next ? (Array.isArray(next.meeting_links) ? next.meeting_links[0] : next.meeting_links) : null;

  return buildActionItems({
    now,
    lastMeeting: last,
    lastAttendanceTaken: impRes?.data?.status === 'done',
    lastZoomToReview: reviewRes?.count ?? 0,
    lastMemberRecapSent: memberRecapRes?.count ?? 0,
    lastManagementRecapSent: mgmtRecapRes?.count ?? 0,
    managementRecapEnabled: mgmtEnabled,
    nextMeeting: next
      ? {
          id: next.id,
          starts_at: next.starts_at,
          ends_at: next.ends_at,
          hasZoomLink: !!link?.join_url,
          bookedSlots: ((next.meeting_speakers ?? []) as { slot: string }[]).map((s) => s.slot),
        }
      : null,
    atAbsenceLimit: members.filter((p) => absences.get(p.id)?.atLimit).map((p) => `${p.first_name} ${p.last_name}`),
    openCorrections: corrRes.count ?? 0,
    pendingApplications: (pendingRes.data ?? []).map((p) => {
      const c = Array.isArray(p.member_contacts) ? p.member_contacts[0] : p.member_contacts;
      return { id: p.id, name: `${p.first_name} ${p.last_name}`, email: c?.email ?? null, created_at: p.created_at };
    }),
    guests: (guestsRes.data ?? []).map((g) => {
      const m = Array.isArray(g.meeting) ? g.meeting[0] : g.meeting;
      return {
        id: g.id,
        name: `${g.first_name} ${g.last_name}`,
        email: g.email,
        status: g.status,
        created_at: g.created_at,
        one_on_ones_done_at: g.one_on_ones_done_at,
        zoomSentAt: zoomSent.get(g.id) ?? null,
        applyInviteAt: applySent.get(g.id) ?? null,
        meetingEnded: !!m?.ends_at && new Date(m.ends_at).getTime() <= now.getTime(),
      };
    }),
    failedEmails: failedRes.count ?? 0,
    onboardingOverdue: (onboardRes.data ?? [])
      .map((o) => (Array.isArray(o.profile) ? o.profile[0] : o.profile))
      .filter((p): p is { first_name: string; last_name: string; status: Database['public']['Enums']['member_status'] } => !!p && p.status === 'approved')
      .map((p) => `${p.first_name} ${p.last_name}`),
  });
}
