'use server';

// BARP Champion of each meeting (owner, 2026-11-23; was per month): the site records the automatic pick after the meeting;
// admins can confirm it early or choose someone else with a reason.

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { getChampionPeriods, getMeetingChampionRanking } from '@/lib/data/champion';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from '@/lib/validation';

const schema = z.object({
  meetingId: z.uuid(),
  profileId: z.uuid({ error: 'Choose the champion' }),
  reason: z.string().trim().max(1000, 'Keep the reason to 1000 characters').optional(),
});

function refresh() {
  for (const p of ['/admin/champion', '/members', '/present', '/dashboard', '/profile'])
    revalidatePath(p, p === '/present' || p === '/members' ? 'layout' : 'page');
  revalidateTag('directory', 'max');
}

export async function saveChampion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: { profileId: 'Choose the champion' }, values };
  const { meetingId, profileId } = parsed.data;
  const reason = parsed.data.reason || null;
  const period = (await getChampionPeriods()).find((p) => p.meetingId === meetingId);
  if (!period) return { status: 'error', message: 'That meeting was not found or is cancelled.', values };
  const { rows, auto } = await getMeetingChampionRanking(period);
  // Choosing someone other than the automatic pick needs a reason.
  if (profileId !== auto?.id && (!reason || reason.length < 5))
    return { status: 'error', errors: { reason: 'Please explain why this member is the champion (the automatic pick is someone else).' }, values };
  const row = rows.find((r) => r.id === profileId);
  const supabase = await createClient();
  const { error } = await supabase.from('meeting_champions').upsert({
    meeting_id: meetingId,
    profile_id: profileId,
    auto_profile_id: auto?.id ?? null,
    reason,
    points: row ? { ...row } : {},
    period_from: period.from,
    period_to: period.to,
    chosen_by: viewer.userId,
    chosen_at: new Date().toISOString(),
  });
  if (error) return { status: 'error', message: 'Could not save the champion. Please try again.', values };
  refresh();
  return { status: 'success', message: 'Champion saved.' };
}

/** Remove a meeting's recorded champion: after the meeting the automatic pick is recorded again. */
export async function removeChampion(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get('meetingId'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('meeting_champions').delete().eq('meeting_id', id.data);
  refresh();
}
