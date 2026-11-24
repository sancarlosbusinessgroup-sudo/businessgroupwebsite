'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { type ActionState } from '@/lib/validation';

const goal = (max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= max), `${label}: a whole number from 0 to ${max}, or blank for no goal.`)
    .transform((v) => (v === '' ? null : Number(v)));

const goalsSchema = z.object({
  one_on_ones: goal(200, 'One-on-ones'),
  referrals: goal(200, 'Referrals'),
  visitors: goal(200, 'Visitors'),
  attendance_pct: goal(100, 'Attendance'),
});

/** Admin → Report Cards: the group's quarterly goals (owner, 2026-11-24). Blank = no goal. */
export async function saveReportCardGoals(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = goalsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Please check the goals.' };
  const db = await createClient();
  const { data, error } = await db
    .from('report_card_goals')
    .update({ ...parsed.data, updated_at: new Date().toISOString(), updated_by: viewer.userId })
    .eq('id', 1)
    .select('id');
  if (error || !data?.length) return { status: 'error', message: 'Something went wrong. Please try again.' };
  revalidatePath('/admin/report-cards');
  return { status: 'success', message: 'Goals saved.' };
}
