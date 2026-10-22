// Zoom REST API (Server-to-Server OAuth). Server-only: the credentials are Vercel environment variables
// and never reach the browser. Scopes needed on the Zoom app:
//   meeting:read:list_past_instances:admin and report:read:list_meeting_participants:admin
import 'server-only';

import type { RawParticipant } from './zoom';

const API = () => (process.env.ZOOM_API_URL || 'https://api.zoom.us/v2').replace(/\/$/, '');
const OAUTH = () => process.env.ZOOM_OAUTH_URL || 'https://zoom.us/oauth/token';

export const zoomConfigured = () => !!(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);

export class ZoomError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

let cached: { token: string; until: number } | null = null;

async function token(): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const id = process.env.ZOOM_CLIENT_ID ?? '';
  const secret = process.env.ZOOM_CLIENT_SECRET ?? '';
  const url = `${OAUTH()}?grant_type=account_credentials&account_id=${encodeURIComponent(process.env.ZOOM_ACCOUNT_ID ?? '')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}` },
    cache: 'no-store',
  });
  if (!res.ok)
    throw new ZoomError(
      res.status === 400 || res.status === 401
        ? 'Zoom rejected the app credentials. Check the three ZOOM_ values in Vercel.'
        : `Zoom sign-in failed (${res.status}).`,
      res.status,
    );
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, until: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API()}${path}`, { headers: { authorization: `Bearer ${await token()}` }, cache: 'no-store' });
  if (res.status === 404) throw new ZoomError('Zoom has no report for this meeting yet (reports appear about 30 minutes after the meeting ends).', 404);
  if (res.status === 401 || res.status === 403)
    throw new ZoomError('The Zoom app is missing a permission. Add the scopes listed in the setup steps and try again.', res.status);
  if (!res.ok) throw new ZoomError(`Zoom request failed (${res.status}).`, res.status);
  return (await res.json()) as T;
}

/** Zoom asks for UUIDs that start with "/" or contain "//" to be encoded twice. */
const encodeUuid = (uuid: string) => (uuid.startsWith('/') || uuid.includes('//') ? encodeURIComponent(encodeURIComponent(uuid)) : encodeURIComponent(uuid));

/** Past sessions of a (possibly recurring) meeting ID. */
export async function pastInstances(meetingId: string): Promise<{ uuid: string; start_time: string }[]> {
  const body = await get<{ meetings?: { uuid: string; start_time: string }[] }>(`/past_meetings/${encodeURIComponent(meetingId)}/instances`);
  return body.meetings ?? [];
}

/** Everyone in one session's participant report (all pages). */
export async function reportParticipants(uuid: string): Promise<RawParticipant[]> {
  const out: RawParticipant[] = [];
  let next = '';
  for (let i = 0; i < 20; i++) {
    const q = new URLSearchParams({ page_size: '300' });
    if (next) q.set('next_page_token', next);
    const body = await get<{ participants?: RawParticipant[]; next_page_token?: string }>(`/report/meetings/${encodeUuid(uuid)}/participants?${q}`);
    out.push(...(body.participants ?? []));
    next = body.next_page_token ?? '';
    if (!next) break;
  }
  return out;
}
