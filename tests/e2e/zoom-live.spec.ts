import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { STACK, expectAccessible, login, serviceKey, users } from './support';

// Live attendance (owner, 2026-11-10): Zoom sends join/leave events to /api/zoom/webhook during the meeting and the
// Management Team sees on time / late (after 8:30) / not here yet / unknown names on Admin → Attendance.

const SECRET = 'local-zoom-webhook-secret'; // .env.local ZOOM_WEBHOOK_SECRET_TOKEN (local stack only)
const ZOOM_ID = '81234567891';

async function rest(path: string, method = 'GET', body?: unknown) {
  const key = await serviceKey();
  const res = await fetch(`${STACK}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : []) as Record<string, unknown>[];
}

async function zoom(baseURL: string, payload: unknown, sign = true) {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = `v0=${createHmac('sha256', SECRET).update(`v0:${ts}:${body}`).digest('hex')}`;
  return fetch(`${baseURL}/api/zoom/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(sign ? { 'x-zm-signature': sig, 'x-zm-request-timestamp': ts } : {}) },
    body,
  });
}

const plus = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);
const joined = (name: string, at: Date, email = '') => ({
  event: 'meeting.participant_joined',
  event_ts: at.getTime(),
  payload: {
    account_id: 'x',
    object: { id: ZOOM_ID, uuid: 'u==', participant: { user_name: name, email, join_time: at.toISOString().replace(/\.\d+Z$/, 'Z') } },
  },
});

test.describe.configure({ mode: 'serial' });

test.describe('Live attendance', () => {
  // The meeting started 20 minutes ago, so its 8:30-style cutoff (start + 15) was 5 minutes ago.
  const start = plus(new Date(), -20);
  let meetingId = '';

  test.beforeAll(async () => {
    const [m] = await rest('meetings', 'POST', {
      slug: `zoom-live-${Date.now()}`,
      title: 'Live attendance test meeting',
      category: 'Networking',
      starts_at: start.toISOString(),
      ends_at: plus(start, 75).toISOString(),
      is_online: true,
      location: 'Zoom',
    });
    meetingId = m?.id as string;
    await rest('meeting_links', 'POST', { meeting_id: meetingId, join_url: `https://us02web.zoom.us/j/${ZOOM_ID}?pwd=test` });
  });

  test.afterAll(async () => {
    if (meetingId) await rest(`meetings?id=eq.${meetingId}`, 'DELETE');
    await rest(`zoom_aliases?key=eq.name:tablet`, 'DELETE');
  });

  test('the webhook only accepts Zoom-signed requests and answers Zoom’s endpoint check', async ({ baseURL }) => {
    expect((await zoom(baseURL!, joined('Sneaky', new Date()), false)).status).toBe(401);
    const res = await zoom(baseURL!, { event: 'endpoint.url_validation', payload: { plainToken: 'abc123' } }, false);
    expect(await res.json()).toEqual({ plainToken: 'abc123', encryptedToken: createHmac('sha256', SECRET).update('abc123').digest('hex') });
    // Events for another Zoom meeting are ignored.
    const other = joined('Someone', new Date());
    other.payload.object.id = '99999999999';
    expect(await (await zoom(baseURL!, other)).json()).toEqual({ ok: true, stored: false });
  });

  test('admins see on time, late, not here yet and unknown names, updating while the meeting runs', async ({ page, baseURL }) => {
    for (const p of [
      joined('Priya R', plus(start, 5), 'priya.raman@example.com'),
      joined('Elena Vasquez | Atelier Vasquez', plus(start, 25)),
      joined('Tablet', plus(start, 3)),
    ]) {
      const r = await zoom(baseURL!, p);
      expect(await r.json()).toEqual({ ok: true, stored: true });
    }
    // Zoom may send the same event twice: stored once.
    await zoom(baseURL!, joined('Tablet', plus(start, 3)));
    expect(await rest(`zoom_live_events?meeting_id=eq.${meetingId}&select=key`)).toHaveLength(3);

    await login(page, users.admin, undefined, `/admin/attendance?m=${meetingId}`);
    const live = page.getByRole('region', { name: 'Live attendance' });
    await expect(live).toBeVisible();
    await expect(live.getByRole('region', { name: /^On time/ })).toContainText('Priya Raman');
    const late = live.getByRole('region', { name: /^Late/ });
    await expect(late).toContainText('Elena Vasquez');
    await expect(late).toContainText('10 min late');
    await expect(live.getByRole('region', { name: /^Not here yet/ })).toContainText('Daniel Cho');
    await expectAccessible(page);

    // Unknown Zoom name: link it to Theo; he moves to On time and the name is remembered.
    const unknown = live.getByRole('region', { name: /^Unknown Zoom names/ });
    await unknown.getByLabel('This is').selectOption({ label: 'Theo Marchetti' });
    await unknown.getByRole('button', { name: 'Link to member' }).click();
    await expect(live.getByRole('region', { name: /^On time/ })).toContainText('Theo Marchetti');
    await expect(live.getByRole('region', { name: /^Unknown Zoom names/ })).toHaveCount(0);
    expect(await rest(`zoom_aliases?key=eq.name:tablet&select=key`)).toHaveLength(1);

    // Someone joins now (late): the panel picks it up by itself, without reloading.
    await zoom(baseURL!, joined('Daniel Cho', new Date()));
    await expect(live.getByRole('region', { name: /^Late/ })).toContainText('Daniel Cho', { timeout: 15_000 });
    await expect(live.getByRole('region', { name: /^Not here yet/ })).not.toContainText('Daniel Cho');
  });

  test('members can’t see live attendance', async ({ page, baseURL }) => {
    await login(page, users.member);
    const res = await page.request.get(`${baseURL}/api/admin/live-attendance?m=${meetingId}`);
    expect(res.status()).toBe(403);
    await page.goto(`/admin/attendance?m=${meetingId}`);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
