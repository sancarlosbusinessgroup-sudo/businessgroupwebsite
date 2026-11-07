'use server';

// Presenters add their own materials for their 5- or 10-minute presentation from the Meetings page (owner, 2026-11-07).
// The database decides who may (policies *_presenter_*: own upcoming slot only, until the meeting starts); these
// actions validate the input, keep files inside the member's own folder, and tell the admins by email.

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { onPresenterMaterial } from '@/lib/email/events';
import { safely } from '@/lib/email/notify';
import { PDF_MAX_PAGES, parseWebsite, parseYouTube } from '@/lib/slides';
import { type ActionState, formToObject } from '@/lib/validation';

const GENERIC = 'Something went wrong. Please try again.';
const NOT_YOURS = 'You can add materials only to your own presentation, before the meeting starts. Please refresh the page.';
const slotEnum = z.enum(['education', 'presentation']);
const afterOf = { education: 'five_minute', presentation: 'ten_minute' } as const;
const mediaTitle = z
  .string()
  .trim()
  .max(120, 'Keep the title to 120 characters or fewer')
  .transform((v) => v || null);

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function refresh() {
  revalidatePath('/meetings');
  revalidatePath('/present', 'layout');
}

const fileInput = z.object({
  meetingId: z.uuid(),
  slot: slotEnum,
  kind: z.enum(['image', 'pdf', 'powerpoint']),
  path: z.string().max(300),
  title: mediaTitle,
  pageCount: z.number().int().min(1).max(PDF_MAX_PAGES).nullable(),
});

const what = { image: 'image', pdf: 'PDF', powerpoint: 'PowerPoint', youtube: 'YouTube video', link: 'website' } as const;

/** Called after the browser uploaded the file to "<meeting id>/<member id>/<file>" in the private slide-media storage. */
export async function addMyMaterialFile(input: z.input<typeof fileInput>): Promise<ActionState> {
  const parsed = fileInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: GENERIC };
  const d = parsed.data;
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  if (!d.path.startsWith(`${d.meetingId}/${user.id}/`) || d.path.includes('..')) return { status: 'error', message: GENERIC };
  if (d.kind === 'pdf' && !d.pageCount) return { status: 'error', message: 'That PDF could not be read.' };
  const { data, error } = await supabase
    .from('meeting_slide_media')
    .insert({
      meeting_id: d.meetingId,
      kind: d.kind,
      storage_path: d.path,
      title: d.title,
      after_slide: afterOf[d.slot],
      page_count: d.kind === 'pdf' ? d.pageCount : null,
      sort: Math.floor(Date.now() / 1000) % 30000,
    })
    .select('id')
    .single();
  if (error || !data) {
    await supabase.storage.from('slide-media').remove([d.path]);
    return { status: 'error', message: NOT_YOURS };
  }
  const materialId = data.id;
  after(() =>
    safely('presenter material', () =>
      onPresenterMaterial({ materialId, meetingId: d.meetingId, slot: d.slot, profileId: user.id, what: what[d.kind], title: d.title }),
    ),
  );
  refresh();
  return {
    status: 'success',
    message:
      d.kind === 'pdf' ? `PDF added (${d.pageCount} page${d.pageCount === 1 ? '' : 's'}).` : d.kind === 'powerpoint' ? 'PowerPoint added.' : 'Image added.',
  };
}

/** A YouTube video or any https website, shown in the slides right after the member's presentation. */
export async function addMyMaterialLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formToObject(formData);
  const meeting = z.uuid().safeParse(values.meetingId);
  const slot = slotEnum.safeParse(values.slot);
  if (!meeting.success || !slot.success) return { status: 'error', message: GENERIC };
  const raw = (values.link ?? '').trim();
  const video = parseYouTube(raw);
  const site = video ? null : parseWebsite(raw);
  const title = mediaTitle.safeParse(values.title ?? '');
  const errors: Record<string, string> = {};
  if (!video && !site) errors.link = 'Paste a YouTube or website link that starts with https://';
  if (!title.success) errors.title = title.error.issues[0]?.message ?? 'Check the title';
  if (Object.keys(errors).length || !title.success) return { status: 'error', message: 'Please fix the highlighted fields.', errors, values };
  const { supabase, user } = await session();
  if (!user) return { status: 'error', message: 'Please log in again.', values };
  const sort = Math.floor(Date.now() / 1000) % 30000;
  const after_slide = afterOf[slot.data];
  const res = video
    ? await supabase
        .from('meeting_slide_media')
        .insert({ meeting_id: meeting.data, kind: 'youtube', youtube_id: video.id, start_seconds: video.start, title: title.data, after_slide, sort })
        .select('id')
        .single()
    : await supabase.from('meeting_slide_links').insert({ meeting_id: meeting.data, url: site!, title: title.data, after_slide, sort }).select('id').single();
  if (res.error || !res.data) return { status: 'error', message: NOT_YOURS, values };
  const materialId = res.data.id;
  const meetingId = meeting.data;
  const slotValue = slot.data;
  const t = title.data;
  after(() =>
    safely('presenter material', () =>
      onPresenterMaterial({ materialId, meetingId, slot: slotValue, profileId: user.id, what: video ? what.youtube : what.link, title: t }),
    ),
  );
  refresh();
  return { status: 'success', message: video ? 'Video added.' : 'Website added.' };
}

/** Remove something the member added themselves (until the meeting starts). */
export async function removeMyMaterial(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const { supabase, user } = await session();
  if (!user) return;
  if (formData.get('kind') === 'link') {
    await supabase.from('meeting_slide_links').delete().eq('id', id.data).eq('created_by', user.id);
  } else {
    const { data } = await supabase.from('meeting_slide_media').delete().eq('id', id.data).eq('created_by', user.id).select('storage_path');
    const path = data?.[0]?.storage_path;
    if (path) await supabase.storage.from('slide-media').remove([path]);
  }
  refresh();
}
