import { expect, test } from '@playwright/test';
import { STACK, expectAccessible, login, serviceKey, users } from './support';

// "Start meeting as host" (owner, 2026-10-23): admins start the next BARP Zoom meeting from the Admin page.
// The site asks Zoom (the local mock) for a fresh host link and sends the admin to it.

const ZOOM = 'http://127.0.0.1:54328';
const ZOOM_ID = '83818742413';

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

test.describe.configure({ mode: 'serial' });

test.describe('Start the Zoom meeting as host', () => {
  test.beforeAll(async () => {
    // Give the next regular meeting the group's Zoom link.
    const [next] = await rest(
      `meetings?category=eq.Networking&cancelled_reason=is.null&ends_at=gt.${new Date().toISOString()}&order=starts_at&limit=1&select=id`,
    );
    await rest('meeting_links?on_conflict=meeting_id', 'POST', { meeting_id: next?.id, join_url: `https://us02web.zoom.us/j/${ZOOM_ID}?pwd=test` }).catch(
      async () => rest(`meeting_links?meeting_id=eq.${next?.id}`, 'PATCH', { join_url: `https://us02web.zoom.us/j/${ZOOM_ID}?pwd=test` }),
    );
  });

  test.afterAll(async () => {
    await fetch(`${ZOOM}/reset`, { method: 'POST' });
  });

  test('an admin presses the button and lands on Zoom as host', async ({ page }) => {
    await fetch(`${ZOOM}/mock/meetings`, { method: 'POST', body: JSON.stringify({ meetingId: ZOOM_ID, instances: [] }) });
    await login(page, users.admin, undefined, '/admin');
    const panel = page.getByRole('region', { name: 'Zoom' });
    await expect(panel).toContainText('Next meeting:');
    await expect(panel).toContainText('Zoom meeting 838 1874 2413');
    await expect(panel).toContainText('Make co-host');
    await expectAccessible(page);
    await panel.getByRole('link', { name: 'Start meeting as host' }).click();
    await expect(page).toHaveURL(`${ZOOM}/mock/start/${ZOOM_ID}?zak=mock`);
    await expect(page.getByRole('heading', { name: `Mock Zoom: starting meeting ${ZOOM_ID} as host` })).toBeVisible();
  });

  test('a missing Zoom permission is explained on the Admin page', async ({ page }) => {
    await fetch(`${ZOOM}/mock/meetings`, { method: 'POST', body: JSON.stringify({ meetingId: ZOOM_ID, instances: [], noReadScope: true }) });
    await login(page, users.admin, undefined, '/admin');
    await page.getByRole('link', { name: 'Start meeting as host' }).click();
    await expect(page).toHaveURL(/\/admin\?zoomError=/);
    await expect(page.getByRole('region', { name: 'Zoom' })).toContainText('meeting:read:meeting:admin');
  });

  test('a meeting Zoom does not know is explained too', async ({ page }) => {
    await fetch(`${ZOOM}/reset`, { method: 'POST' });
    await login(page, users.admin, undefined, '/admin');
    await page.getByRole('link', { name: 'Start meeting as host' }).click();
    await expect(page.getByRole('region', { name: 'Zoom' })).toContainText('Zoom can’t find this meeting');
  });

  test('members cannot use the host link', async ({ page }) => {
    await fetch(`${ZOOM}/mock/meetings`, { method: 'POST', body: JSON.stringify({ meetingId: ZOOM_ID, instances: [] }) });
    await login(page, users.member, undefined, '/dashboard');
    await page.goto('/admin/zoom/start');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Mock Zoom')).toHaveCount(0);
  });
});
