'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { type ActionState, fieldErrors, formToObject, slideNotesSchema, slideSettingsSchema } from '@/lib/validation';

// Per-meeting slide order and extra slide text. Admins only (RLS).

export async function saveSlideSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const meeting = z.uuid().safeParse(values.meetingId);
  const slides = slideSettingsSchema.safeParse(values);
  if (!meeting.success) return { status: 'error', message: 'Something went wrong. Please try again.' };
  if (!slides.success) return { status: 'error', message: 'Show at least one slide.', values };
  const notes = slideNotesSchema.safeParse(values);
  if (!notes.success) return { status: 'error', message: 'Please shorten the highlighted slide text.', errors: fieldErrors(notes.error), values };
  const supabase = await createClient();
  const { error } = await supabase.from('meeting_slide_settings').upsert({ meeting_id: meeting.data, slides: slides.data, notes: notes.data });
  if (error) return { status: 'error', message: 'Only admins can change the slides.', values };
  revalidatePath('/present', 'layout');
  return { status: 'success', message: 'Slides saved.' };
}

export async function resetSlideSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const meeting = z.uuid().safeParse(formData.get('meetingId'));
  if (!meeting.success) return { status: 'error', message: 'Something went wrong. Please try again.' };
  const supabase = await createClient();
  const { error } = await supabase.from('meeting_slide_settings').delete().eq('meeting_id', meeting.data);
  if (error) return { status: 'error', message: 'Only admins can change the slides.' };
  revalidatePath('/present', 'layout');
  return { status: 'success', message: 'Back to the standard agenda.' };
}
