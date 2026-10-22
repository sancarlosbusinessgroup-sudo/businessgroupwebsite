'use server';

// Attendance (Phase D): import from Zoom, sort out the review list, and take or correct attendance by hand.
// Admins only (requireAdmin + RLS is_admin() on every table written here).

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { type ActionState } from '@/lib/validation';
import { importZoomAttendance } from '@/lib/zoom-import';

const GENERIC = 'Something went wrong. Please try again.';

function done(meetingId: string) {
  revalidatePath('/admin/attendance');
  revalidatePath('/admin');
  revalidatePath('/meetings');
  return meetingId;
}

export async function fetchFromZoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = z.uuid().safeParse(formData.get('meetingId'));
  if (!id.success) return { status: 'error', message: GENERIC };
  const r = await importZoomAttendance(await createClient(), id.data, viewer.userId);
  done(id.data);
  if (!r.ok) return { status: 'error', message: r.error };
  const parts = [`${r.participants} ${r.participants === 1 ? 'person' : 'people'} in the Zoom report`, `${r.matched} members marked present`];
  if (r.guests) parts.push(`${r.guests} invited ${r.guests === 1 ? 'guest' : 'guests'} found`);
  if (r.pending) parts.push(`${r.pending} to review below`);
  return { status: 'success', message: `${parts.join(', ')}.` };
}

const resolveSchema = z.object({
  id: z.uuid(),
  action: z.enum(['link', 'visitor', 'ignore']),
  profileId: z.union([z.uuid(), z.literal('')]).optional(),
  remember: z.string().optional(),
});

/** One person from the review list: link to a member (and remember the name), a visitor, or ignore. */
export async function resolveParticipant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = resolveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: 'error', message: GENERIC };
  const { id, action, profileId, remember } = parsed.data;
  const supabase = await createClient();
  const { data: p } = await supabase.from('zoom_participants').select('id, meeting_id, key, joined_at, left_at, minutes').eq('id', id).maybeSingle();
  if (!p) return { status: 'error', message: GENERIC };

  if (action !== 'link') {
    const { error } = await supabase
      .from('zoom_participants')
      .update({ resolution: action === 'visitor' ? 'visitor' : 'ignored', matched_by: 'admin', profile_id: null })
      .eq('id', id);
    if (error) return { status: 'error', message: GENERIC };
    done(p.meeting_id);
    return { status: 'success', message: action === 'visitor' ? 'Marked as a visitor.' : 'Ignored.' };
  }

  if (!profileId) return { status: 'error', message: 'Choose the member first.' };
  const { error } = await supabase.from('zoom_participants').update({ resolution: 'member', matched_by: 'admin', profile_id: profileId }).eq('id', id);
  if (error) return { status: 'error', message: GENERIC };
  // Several Zoom entries can belong to one member: keep the earliest join, latest leave and add the minutes.
  const { data: theirs } = await supabase
    .from('zoom_participants')
    .select('joined_at, left_at, minutes')
    .eq('meeting_id', p.meeting_id)
    .eq('profile_id', profileId)
    .eq('resolution', 'member');
  const rows = theirs ?? [p];
  const joins = rows
    .map((r) => r.joined_at)
    .filter((x): x is string => !!x)
    .sort();
  const leaves = rows
    .map((r) => r.left_at)
    .filter((x): x is string => !!x)
    .sort();
  const { data: before } = await supabase
    .from('attendance')
    .select('checked_in_at, method')
    .eq('meeting_id', p.meeting_id)
    .eq('profile_id', profileId)
    .maybeSingle();
  const { error: attErr } = await supabase.from('attendance').upsert(
    {
      meeting_id: p.meeting_id,
      profile_id: profileId,
      status: 'present',
      zoom: true,
      joined_at: joins[0] ?? null,
      left_at: leaves.at(-1) ?? null,
      minutes: Math.min(
        1440,
        rows.reduce((n, r) => n + (r.minutes ?? 0), 0),
      ),
      checked_in_at: before?.checked_in_at ?? joins[0] ?? null,
      method: before?.method ?? 'admin',
    },
    { onConflict: 'meeting_id,profile_id' },
  );
  if (attErr) return { status: 'error', message: GENERIC };
  if (remember === 'on') await supabase.from('zoom_aliases').upsert({ key: p.key, profile_id: profileId });
  await supabase
    .from('attendance_imports')
    .update({ matched: (await countPresent(p.meeting_id)) ?? 0 })
    .eq('meeting_id', p.meeting_id);
  done(p.meeting_id);
  return { status: 'success', message: remember === 'on' ? 'Linked. This Zoom name will be matched automatically next time.' : 'Linked.' };
}

async function countPresent(meetingId: string) {
  const supabase = await createClient();
  const { count } = await supabase.from('attendance').select('profile_id', { count: 'exact', head: true }).eq('meeting_id', meetingId).eq('status', 'present');
  return count;
}

const CHOICES = ['present', 'substitute', 'excused', 'absent'] as const;

/** Take or correct attendance by hand for one meeting: one choice per member. */
export async function saveAttendance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const meetingId = z.uuid().safeParse(formData.get('meetingId'));
  if (!meetingId.success) return { status: 'error', message: GENERIC };
  const supabase = await createClient();
  const { data: existing } = await supabase.from('attendance').select('profile_id, status, substitute').eq('meeting_id', meetingId.data);
  const had = new Map((existing ?? []).map((r) => [r.profile_id, r]));
  const rows: { meeting_id: string; profile_id: string; status: 'present' | 'excused' | 'absent'; substitute: boolean }[] = [];
  for (const [k, v] of formData.entries()) {
    const m = k.match(/^s_([0-9a-f-]{36})$/);
    if (!m || typeof v !== 'string' || !(CHOICES as readonly string[]).includes(v)) continue;
    const profileId = m[1]!;
    const choice = v as (typeof CHOICES)[number];
    const prev = had.get(profileId);
    const status = choice === 'substitute' ? 'present' : choice;
    const substitute = choice === 'substitute';
    // No row and absent: nothing to store (no row already means absent).
    if (!prev && choice === 'absent') continue;
    if (prev && prev.status === status && prev.substitute === substitute) continue;
    rows.push({ meeting_id: meetingId.data, profile_id: profileId, status, substitute });
  }
  if (rows.length) {
    const { error } = await supabase.from('attendance').upsert(
      rows.map((r) => ({ ...r, method: 'admin' })),
      { onConflict: 'meeting_id,profile_id', ignoreDuplicates: false },
    );
    if (error) return { status: 'error', message: GENERIC };
  }
  // The meeting now counts as "attendance taken" (for the absence limit) if it didn't already.
  const { data: imp } = await supabase.from('attendance_imports').select('status').eq('meeting_id', meetingId.data).maybeSingle();
  if (!imp || imp.status !== 'done')
    await supabase.from('attendance_imports').upsert({
      meeting_id: meetingId.data,
      source: imp ? 'zoom' : 'manual',
      status: 'done',
      error: null,
      matched: (await countPresent(meetingId.data)) ?? 0,
      imported_by: viewer.userId,
      imported_at: new Date().toISOString(),
    });
  done(meetingId.data);
  return { status: 'success', message: rows.length ? `Saved ${rows.length} ${rows.length === 1 ? 'change' : 'changes'}.` : 'Saved. Nothing changed.' };
}
