// Admin → Presentation materials (owner, 2026-10-27): every file, video and website added to a meeting's slides,
// newest meeting first, with the space each file takes in storage. Read-only.
import 'server-only';

import { createAdminClient } from '../supabase/admin';

export type Material = {
  id: string;
  meetingSlug: string;
  meetingTitle: string;
  startsAt: string;
  afterSlide: string;
  kind: 'image' | 'pdf' | 'powerpoint' | 'youtube' | 'link';
  title: string | null;
  bytes: number | null;
  pageCount: number | null;
  url: string | null;
  addedAt: string;
};

export type MaterialsReport = { materials: Material[]; fileBytes: number; fileCount: number; linkCount: number };

export async function loadMaterials(): Promise<MaterialsReport> {
  const db = createAdminClient();
  if (!db) return { materials: [], fileBytes: 0, fileCount: 0, linkCount: 0 };
  const [mediaRes, linksRes] = await Promise.all([
    db
      .from('meeting_slide_media')
      .select('id, kind, title, after_slide, storage_path, youtube_id, page_count, created_at, meetings!inner(slug, title, starts_at)'),
    db.from('meeting_slide_links').select('id, url, title, after_slide, created_at, meetings!inner(slug, title, starts_at)'),
  ]);
  const media = mediaRes.data ?? [];

  // File sizes come from storage: one listing per meeting folder (files are stored as <meeting id>/<file>).
  const sizes = new Map<string, number>();
  const folders = [...new Set(media.map((m) => m.storage_path?.split('/')[0]).filter((f): f is string => !!f))];
  await Promise.all(
    folders.map(async (folder) => {
      const { data } = await db.storage.from('slide-media').list(folder, { limit: 1000 });
      for (const f of Array.isArray(data) ? data : []) {
        const size = (f.metadata as { size?: number } | null)?.size;
        if (typeof size === 'number') sizes.set(`${folder}/${f.name}`, size);
      }
    }),
  );

  const meetingOf = (m: unknown) => {
    const x = (Array.isArray(m) ? m[0] : m) as { slug: string; title: string; starts_at: string };
    return { meetingSlug: x.slug, meetingTitle: x.title, startsAt: x.starts_at };
  };
  const materials: Material[] = [
    ...media.map((m) => ({
      id: m.id,
      ...meetingOf(m.meetings),
      afterSlide: m.after_slide,
      kind: m.kind,
      title: m.title,
      bytes: m.storage_path ? (sizes.get(m.storage_path) ?? null) : null,
      pageCount: m.page_count,
      url: m.youtube_id ? `https://www.youtube.com/watch?v=${m.youtube_id}` : null,
      addedAt: m.created_at,
    })),
    ...(linksRes.data ?? []).map((l) => ({
      id: l.id,
      ...meetingOf(l.meetings),
      afterSlide: l.after_slide,
      kind: 'link' as const,
      title: l.title,
      bytes: null,
      pageCount: null,
      url: l.url,
      addedAt: l.created_at,
    })),
  ].sort((a, b) => b.startsAt.localeCompare(a.startsAt) || a.addedAt.localeCompare(b.addedAt));
  const files = materials.filter((m) => m.bytes !== null);
  return {
    materials,
    fileBytes: files.reduce((n, m) => n + (m.bytes ?? 0), 0),
    fileCount: files.length,
    linkCount: materials.length - files.length,
  };
}
