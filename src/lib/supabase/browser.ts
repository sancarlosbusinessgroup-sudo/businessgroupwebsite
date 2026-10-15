'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../database.types';

// NEXT_PUBLIC_* values are inlined at build time; only the anon key ever reaches the browser.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  return createBrowserClient<Database>(url, key);
}
