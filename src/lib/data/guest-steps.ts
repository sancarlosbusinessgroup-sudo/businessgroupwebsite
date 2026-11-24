import 'server-only';

import { laterStage, type GuestStage } from '../guest-pipeline';
import { createClient } from '../supabase/server';

// Guest board bookkeeping shared by the admin actions (owner, 2026-11-24). Callers must have checked requireAdmin().

type Db = Awaited<ReturnType<typeof createClient>>;
export type GuestEventKind = 'stage' | 'accepted' | 'declined' | 'reopened' | 'note' | 'zoom_link' | 'apply_invite' | 'interview';

/** One line in the guest's history, in the admin's name. */
export async function logGuestEvent(db: Db, guestId: string, actorId: string, kind: GuestEventKind, detail?: string | null) {
  await db.from('guest_events').insert({ guest_id: guestId, actor_id: actorId, kind, detail: detail ?? null });
}

/** Moves a card forward to `stage` (never back). Used when a step is done on the website. */
export async function advanceGuest(db: Db, guestId: string, stage: GuestStage) {
  const { data: g } = await db.from('guest_requests').select('pipeline_stage').eq('id', guestId).maybeSingle();
  if (!g) return;
  const next = laterStage(g.pipeline_stage, stage);
  if (next !== g.pipeline_stage) await db.from('guest_requests').update({ pipeline_stage: next, stage_changed_at: new Date().toISOString() }).eq('id', guestId);
}
