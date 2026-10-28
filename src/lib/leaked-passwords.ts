import 'server-only';
import { createHash } from 'node:crypto';

export const LEAKED_MESSAGE = 'This password has appeared in a data breach. Please choose a different one.';

/**
 * Has this password appeared in a known data breach? Uses the Have I Been Pwned "range" API with k-anonymity: only the
 * first five characters of the password's SHA-1 hash are sent, and the match is made here (owner, 2026-10-28; the
 * same check Supabase offers on paid plans). Returns false when the service can't be reached, so a network problem
 * never stops someone from setting a password.
 */
export async function isLeakedPassword(password: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'bayareareferralpartners.com password check' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split(/\r?\n/).some((line) => {
      const [hashSuffix, count] = line.split(':');
      return hashSuffix === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
