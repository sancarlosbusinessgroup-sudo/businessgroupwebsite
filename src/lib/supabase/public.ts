import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { env } from '../env';

let client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Anonymous Supabase client with no cookies: what a signed-out visitor sees. Used by the public data loaders so their
 * results can be cached across requests (a cookie-bound client can't be used inside a cache; audit, 2026-10-27).
 * Only for data that is the same for everyone: meetings, the directory, the gallery, categories, the management list.
 */
export function publicClient() {
  client ??= createSupabaseClient<Database>(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
