import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { env } from '../env';

/**
 * Service-role client. Server-only. Used to look up who to email
 * (recipients the signed-in user can't read, e.g. a visitor's inviting member), by the scheduled email jobs and by the Zoom attendance import.
 * Returns null when the key isn't configured (emails are then skipped).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabaseClient<Database>(env.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
