import 'server-only';
import { createClient } from '../supabase/server';
import { ACTIVITY_KINDS, activitySignature, type ActivityKind } from '../live-activity';

/**
 * The activity total a page is rendered with (see lib/live-activity.ts). Call it BEFORE loading the page's data: if a
 * report lands in between, the page is then one step behind and reloads, instead of looking up to date while missing
 * it. Null when it can't be read (signed out, or the table isn't there yet): live reloads then still work from 0.
 */
export async function getActivityVersion(kinds: readonly ActivityKind[] = ACTIVITY_KINDS): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('activity_versions').select('kind, version');
    if (error || !data) return null;
    return activitySignature(data, kinds);
  } catch {
    return null;
  }
}
