'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { type ActionState, fieldErrors, memberEventSchema } from '@/lib/validation';

// Member events. RLS enforces: approved members post as themselves; host or admin edits/deletes.

const GENERIC = 'Something went wrong. Please try again.';
const imagePath = z
  .string()
  .max(200)
  .optional()
  .transform((v) => (v ? v : null));

export type EventFormResult = ActionState & { slug?: string };

export async function saveMemberEvent(input: Record<string, string>): Promise<EventFormResult> {
  const parsed = memberEventSchema().safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error), values: input };
  const image = imagePath.safeParse(input.imagePath);
  const id = input.id ? z.uuid().safeParse(input.id) : null;
  if (!image.success || (id && !id.success)) return { status: 'error', message: GENERIC, values: input };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Please log in again.' };
  if (image.data && !image.data.startsWith(`${user.id}/`)) return { status: 'error', message: GENERIC, values: input };

  const d = parsed.data;
  const row = {
    title: d.title,
    description: d.description,
    category: d.category,
    starts_at: d.startsAt,
    ends_at: d.endsAt,
    is_online: d.isOnline,
    online_url: d.onlineUrl,
    location: d.location,
    ...(image.data ? { image_path: image.data } : {}),
  };
  const res = id?.success
    ? await supabase.from('member_events').update(row).eq('id', id.data).select('slug').maybeSingle()
    : await supabase
        .from('member_events')
        .insert({ ...row, host_id: user.id })
        .select('slug')
        .single();
  if (res.error || !res.data) {
    const limit = res.error && /event limit/.test(res.error.message);
    return { status: 'error', message: limit ? 'You can post up to 10 events in 30 days. Please try again later.' : GENERIC, values: input };
  }
  revalidatePath('/events');
  revalidatePath('/');
  return { status: 'success', slug: res.data.slug };
}

export async function deleteMemberEvent(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('member_events').delete().eq('id', id.data);
  revalidatePath('/events');
  revalidatePath('/');
  revalidatePath('/admin/activity');
  if (formData.get('back') === '/admin/activity') redirect('/admin/activity');
  redirect('/events?deleted=1');
}
