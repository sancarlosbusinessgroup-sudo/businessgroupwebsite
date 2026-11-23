import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

export type SlotMaterial = {
  id: string;
  meetingId: string;
  kind: 'image' | 'pdf' | 'youtube' | 'powerpoint' | 'link';
  title: string | null;
  afterSlide: string;
  pageCount: number | null;
  url: string | null;
  createdBy: string | null;
  /** Who added it, when it wasn't an admin (presenters add their own). */
  by: string | null;
  at: string;
};

/**
 * The 5- and 10-minute presentation materials of some meetings (images, PDFs, PowerPoints, videos, websites), oldest
 * first. Read as the signed-in member (RLS: members see the materials of meetings, admins all).
 */
export async function getPresentationMaterials(supabase: SupabaseClient<Database>, meetingIds: string[]): Promise<SlotMaterial[]> {
  if (!meetingIds.length) return [];
  const [mediaRes, linksRes] = await Promise.all([
    supabase
      .from('meeting_slide_media')
      .select('id, meeting_id, kind, title, after_slide, page_count, created_by, created_at, creator:profiles(first_name, last_name, role)')
      .in('meeting_id', meetingIds)
      .in('after_slide', ['five_minute', 'ten_minute'])
      .order('created_at'),
    supabase
      .from('meeting_slide_links')
      .select('id, meeting_id, title, url, after_slide, created_by, created_at, creator:profiles(first_name, last_name, role)')
      .in('meeting_id', meetingIds)
      .in('after_slide', ['five_minute', 'ten_minute'])
      .order('created_at'),
  ]);
  const by = (c: unknown) => {
    const p = (Array.isArray(c) ? c[0] : c) as { first_name: string; last_name: string; role: string } | null;
    return p && p.role !== 'admin' ? `${p.first_name} ${p.last_name}` : null;
  };
  return [
    ...(mediaRes.data ?? []).map((m) => ({
      id: m.id,
      meetingId: m.meeting_id,
      kind: m.kind,
      title: m.title,
      afterSlide: m.after_slide,
      pageCount: m.page_count,
      url: null,
      createdBy: m.created_by,
      by: by(m.creator),
      at: m.created_at,
    })),
    ...(linksRes.data ?? []).map((l) => ({
      id: l.id,
      meetingId: l.meeting_id,
      kind: 'link' as const,
      title: l.title,
      afterSlide: l.after_slide,
      pageCount: null,
      url: l.url,
      createdBy: l.created_by,
      by: by(l.creator),
      at: l.created_at,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));
}
