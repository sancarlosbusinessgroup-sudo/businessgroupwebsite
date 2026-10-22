'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { PDF_MAX_PAGES, TIMER_KEYS, isSlideKey, parseWebsite, parseYouTube } from '@/lib/slides';
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
  // Timer switches (checkboxes timer_<key>): timers are off unless ticked, so only the ones switched on are stored.
  const timers = Object.fromEntries(TIMER_KEYS.filter((k) => values[`timer_${k}`] === 'on').map((k) => [k, true]));
  const supabase = await createClient();
  const { error } = await supabase.from('meeting_slide_settings').upsert({ meeting_id: meeting.data, slides: slides.data, notes: notes.data, timers });
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

// --- Added slides (uploaded image / PDF, or a YouTube video) -------------------------------------

const afterSlide = z.string().refine((v) => isSlideKey(v), 'Choose where the slide goes');
const mediaTitle = z
  .string()
  .trim()
  .max(120, 'Keep the title to 120 characters or fewer')
  .transform((v) => v || null);

const fileInput = z.object({
  meetingId: z.uuid(),
  kind: z.enum(['image', 'pdf']),
  path: z.string().max(300),
  title: mediaTitle,
  afterSlide,
  pageCount: z.number().int().min(1).max(PDF_MAX_PAGES).nullable(),
});

/** Called after the browser has uploaded the file to the private slide-media storage. */
export async function addSlideFile(input: z.input<typeof fileInput>): Promise<ActionState> {
  const parsed = fileInput.safeParse(input);
  if (!parsed.success || !parsed.data.path.startsWith(`${parsed.data.meetingId}/`)) return { status: 'error', message: 'Something went wrong. Please try again.' };
  const d = parsed.data;
  if (d.kind === 'pdf' && !d.pageCount) return { status: 'error', message: 'That PDF could not be read.' };
  const supabase = await createClient();
  const { error } = await supabase.from('meeting_slide_media').insert({
    meeting_id: d.meetingId,
    kind: d.kind,
    storage_path: d.path,
    title: d.title,
    after_slide: d.afterSlide,
    page_count: d.kind === 'pdf' ? d.pageCount : null,
    sort: Math.floor(Date.now() / 1000) % 30000,
  });
  if (error) return { status: 'error', message: 'Only admins can change the slides.' };
  revalidatePath('/present', 'layout');
  return { status: 'success', message: d.kind === 'pdf' ? `PDF added (${d.pageCount} page${d.pageCount === 1 ? '' : 's'}).` : 'Image added.' };
}

/** Add a YouTube video (played inside the slide) or any other https website link (shown inside the slide). */
export async function addVideoOrLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const meeting = z.uuid().safeParse(values.meetingId);
  const raw = (values.link ?? '').trim();
  const video = parseYouTube(raw);
  const site = video ? null : parseWebsite(raw);
  const title = mediaTitle.safeParse(values.title ?? '');
  const after = afterSlide.safeParse(values.afterSlide);
  const errors: Record<string, string> = {};
  if (!video && !site) errors.link = 'Paste a YouTube or website link that starts with https://';
  if (!title.success) errors.title = title.error.issues[0]?.message ?? 'Check the title';
  if (!after.success) errors.afterSlide = 'Choose where the slide goes';
  if (!meeting.success) return { status: 'error', message: 'Something went wrong. Please try again.' };
  if (Object.keys(errors).length || !title.success || !after.success) return { status: 'error', message: 'Please fix the highlighted fields.', errors, values };
  const supabase = await createClient();
  const sort = Math.floor(Date.now() / 1000) % 30000;
  const { error } = video
    ? await supabase.from('meeting_slide_media').insert({
        meeting_id: meeting.data,
        kind: 'youtube',
        youtube_id: video.id,
        start_seconds: video.start,
        title: title.data,
        after_slide: after.data,
        sort,
      })
    : await supabase.from('meeting_slide_links').insert({ meeting_id: meeting.data, url: site!, title: title.data, after_slide: after.data, sort });
  if (error) return { status: 'error', message: 'Only admins can change the slides.', values };
  revalidatePath('/present', 'layout');
  return { status: 'success', message: video ? 'Video added.' : 'Website added.' };
}

const table = (kind: FormDataEntryValue | null) => (kind === 'link' ? 'meeting_slide_links' : 'meeting_slide_media');

export async function moveSlideMedia(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  const after = afterSlide.safeParse(formData.get('afterSlide'));
  if (!id.success || !after.success) return;
  const supabase = await createClient();
  await supabase.from(table(formData.get('kind'))).update({ after_slide: after.data }).eq('id', id.data);
  revalidatePath('/present', 'layout');
}

export async function removeSlideMedia(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  if (formData.get('kind') === 'link') {
    await supabase.from('meeting_slide_links').delete().eq('id', id.data);
    revalidatePath('/present', 'layout');
    return;
  }
  const { data } = await supabase.from('meeting_slide_media').delete().eq('id', id.data).select('storage_path');
  const path = data?.[0]?.storage_path;
  if (path) await supabase.storage.from('slide-media').remove([path]);
  revalidatePath('/present', 'layout');
}
