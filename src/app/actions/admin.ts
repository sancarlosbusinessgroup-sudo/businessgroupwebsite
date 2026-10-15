'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// Every write here is also restricted to admins by RLS (is_admin()).

export async function setMemberStatus(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  const status = z.enum(['approved', 'declined', 'inactive', 'pending']).safeParse(formData.get('status'));
  if (!id.success || !status.success) return;
  const supabase = await createClient();
  await supabase.from('profiles').update({ status: status.data }).eq('id', id.data);
  revalidatePath('/admin');
  revalidatePath('/members');
}

export async function setGuestStatus(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  const status = z.enum(['requested', 'visited', 'applied', 'joined']).safeParse(formData.get('status'));
  if (!id.success || !status.success) return;
  const supabase = await createClient();
  await supabase.from('guest_requests').update({ status: status.data }).eq('id', id.data);
  revalidatePath('/admin');
}

export async function resolveCorrection(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('attendance_corrections').update({ resolved: true }).eq('id', id.data);
  revalidatePath('/admin');
}
