'use server';

// BARP Champion of the month: admins confirm the automatic pick or choose someone else with a reason (owner, 2026-10-23).

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { monthRange } from '@/lib/champion';
import { getChampionRanking } from '@/lib/data/champion';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from '@/lib/validation';

const schema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  profileId: z.uuid({ error: 'Choose the champion' }),
  reason: z.string().trim().max(1000, 'Keep the reason to 1000 characters').optional(),
});

function refresh() {
  for (const p of ['/admin/champion', '/members', '/present', '/dashboard']) revalidatePath(p, p === '/present' || p === '/members' ? 'layout' : 'page');
}

export async function saveChampion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { status: 'error', errors: { profileId: 'Choose the champion' }, values };
  const { month, profileId } = parsed.data;
  const reason = parsed.data.reason || null;
  const { rows, auto } = await getChampionRanking(month);
  // Choosing someone other than the automatic pick needs a reason.
  if (profileId !== auto?.id && (!reason || reason.length < 5))
    return { status: 'error', errors: { reason: 'Please explain why this member is the champion (the automatic pick is someone else).' }, values };
  const row = rows.find((r) => r.id === profileId);
  const supabase = await createClient();
  const { error } = await supabase.from('champion_awards').upsert({
    month: monthRange(month).key,
    profile_id: profileId,
    auto_profile_id: auto?.id ?? null,
    reason,
    points: row ? { ...row } : {},
    chosen_by: viewer.userId,
    chosen_at: new Date().toISOString(),
  });
  if (error) return { status: 'error', message: 'Could not save the champion. Please try again.', values };
  refresh();
  return { status: 'success', message: 'Champion saved.' };
}

export async function removeChampion(formData: FormData): Promise<void> {
  await requireAdmin();
  const month = z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .safeParse(formData.get('month'));
  if (!month.success) return;
  const supabase = await createClient();
  await supabase.from('champion_awards').delete().eq('month', monthRange(month.data).key);
  refresh();
}
