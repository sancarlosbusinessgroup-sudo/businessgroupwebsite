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

/**
 * Saves a member event. A post with several dates becomes one event per date, linked by a series id (owner,
 * 2026-10-31); editing one of them edits the whole series: shared details apply to every date, changed times are
 * updated, removed dates are deleted and new dates are added.
 */
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
  const shared = {
    title: d.title,
    description: d.description,
    category: d.category,
    visibility: d.visibility,
    is_online: d.isOnline,
    online_url: d.onlineUrl,
    location: d.location,
    ...(image.data ? { image_path: image.data } : {}),
  };
  const fail = (e: { message: string } | null): EventFormResult => {
    const limit = !!e && /event limit/.test(e.message);
    return { status: 'error', message: limit ? 'You can post up to 30 event dates in 30 days. Please try again later.' : GENERIC, values: input };
  };

  // --- New post: one row per date.
  if (!id?.success) {
    const seriesId = d.dates.length > 1 ? crypto.randomUUID() : null;
    const rows = d.dates.map((x) => ({ ...shared, starts_at: x.startsAt, ends_at: x.endsAt, series_id: seriesId, host_id: user.id }));
    const res = await supabase.from('member_events').insert(rows).select('slug, starts_at');
    if (res.error || !res.data?.length) return fail(res.error);
    revalidateEvents();
    return { status: 'success', slug: [...res.data].sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]!.slug };
  }

  // --- Editing: the event being edited and the rest of its series.
  const { data: current } = await supabase.from('member_events').select('id, slug, host_id, series_id').eq('id', id.data).maybeSingle();
  if (!current) return { status: 'error', message: GENERIC, values: input };
  const { data: siblings } = current.series_id
    ? await supabase.from('member_events').select('id').eq('series_id', current.series_id)
    : { data: [{ id: current.id }] };
  const existing = new Set((siblings ?? []).map((r) => r.id));
  const kept = d.dates.filter((x) => x.id && existing.has(x.id));
  const added = d.dates.filter((x) => !x.id || !existing.has(x.id));
  const removed = [...existing].filter((e) => !kept.some((k) => k.id === e));
  const seriesId = current.series_id ?? (kept.length + added.length > 1 ? crypto.randomUUID() : null);

  for (const x of kept) {
    const r = await supabase
      .from('member_events')
      .update({ ...shared, starts_at: x.startsAt, ends_at: x.endsAt, series_id: seriesId })
      .eq('id', x.id!)
      .select('id')
      .maybeSingle();
    if (r.error || !r.data) return fail(r.error);
  }
  if (added.length) {
    // New dates belong to the event's host (only the host can add them; an admin editing gets a clear message).
    if (current.host_id !== user.id) return { status: 'error', message: 'Only the host can add new dates to this event.', values: input };
    const ins = await supabase
      .from('member_events')
      .insert(added.map((x) => ({ ...shared, starts_at: x.startsAt, ends_at: x.endsAt, series_id: seriesId, host_id: user.id })));
    if (ins.error) return fail(ins.error);
  }
  if (removed.length) await supabase.from('member_events').delete().in('id', removed);
  revalidateEvents();

  // Back to the edited date if it is still there, otherwise the first date of the series.
  if (!removed.includes(current.id)) return { status: 'success', slug: current.slug };
  const { data: first } = await supabase
    .from('member_events')
    .select('slug')
    .eq('series_id', seriesId ?? '00000000-0000-0000-0000-000000000000')
    .order('starts_at')
    .limit(1)
    .maybeSingle();
  return first ? { status: 'success', slug: first.slug } : { status: 'error', message: GENERIC, values: input };
}

function revalidateEvents() {
  revalidatePath('/events');
  revalidatePath('/dashboard');
  revalidatePath('/');
}

export async function deleteMemberEvent(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  // "all" = every date of the event's series (owner, 2026-10-31); otherwise just this date.
  const { data: ev } = formData.get('all') === '1' ? await supabase.from('member_events').select('series_id').eq('id', id.data).maybeSingle() : { data: null };
  if (ev?.series_id) await supabase.from('member_events').delete().eq('series_id', ev.series_id);
  else await supabase.from('member_events').delete().eq('id', id.data);
  revalidateEvents();
  revalidatePath('/admin/activity');
  if (formData.get('back') === '/admin/activity') redirect('/admin/activity');
  if (formData.get('back') === '/dashboard') redirect('/dashboard');
  redirect('/events?deleted=1');
}
