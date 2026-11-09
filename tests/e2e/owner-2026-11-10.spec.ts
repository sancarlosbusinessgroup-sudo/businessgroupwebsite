import { expect, test } from '@playwright/test';
import { STACK, expectAccessible, login, serviceKey, users } from './support';

// Owner 2026-11-10: a visitor who was only in the Zoom report (never filled in the guest form, like Geoff Weakley) gets
// "Invited by" on Admin → Attendance, and then shows in the Member and Management recaps with that member thanked.
// The Member recap no longer has the "Claim a spot" button or the "Is your profile pulling its weight?" section.

const ZOOM = 'http://127.0.0.1:54328';
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

const iso = (d: Date) => d.toISOString();
const plus = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

test.describe.configure({ mode: 'serial' });

test.describe('Zoom-only visitors and who invited them', () => {
  // A regular meeting that ended a minute ago, so both recap previews pick it.
  const end = new Date(Date.now() - 60_000);
  const start = plus(end, -75);
  let meetingId = '';

  test.beforeAll(async () => {
    await fetch(`${ZOOM}/reset`, { method: 'POST' });
    const [m] = await rest('meetings', 'POST', {
      slug: `zoom-visitor-${Date.now()}`,
      title: 'Zoom visitor test meeting',
      category: 'Networking',
      starts_at: iso(start),
      ends_at: iso(end),
      is_online: true,
      location: 'Zoom',
    });
    meetingId = m?.id as string;
    await rest('meeting_links', 'POST', { meeting_id: meetingId, join_url: `https://us02web.zoom.us/j/${ZOOM_ID}` });
    await fetch(`${ZOOM}/mock/meetings`, {
      method: 'POST',
      body: JSON.stringify({
        meetingId: ZOOM_ID,
        instances: [
          {
            uuid: 'visitor-test==',
            start_time: iso(plus(start, -5)),
            participants: [
              { name: 'E2E Member', user_email: 'e2e.member@example.test', join_time: iso(start), leave_time: iso(end), duration: 4500 },
              { name: 'Geoff Weakley', user_email: '', join_time: iso(plus(start, 2)), leave_time: iso(end), duration: 4380 },
            ],
          },
        ],
      }),
    });
  });

  test.afterAll(async () => {
    if (meetingId) await rest(`meetings?id=eq.${meetingId}`, 'DELETE');
  });

  test('admin marks the Zoom name as a visitor, picks who invited them, and both recaps show it', async ({ page }) => {
    await login(page, users.admin, undefined, `/admin/attendance?m=${meetingId}`);
    await page.getByRole('button', { name: 'Fetch from Zoom' }).click();
    await expect(page.getByRole('status').first()).toContainText('1 to review below');

    const review = page.getByRole('region', { name: /Needs review/ });
    await expect(review.getByText('Geoff Weakley')).toBeVisible();
    await review.getByRole('button', { name: 'Visitor' }).click();
    await expect(page.getByRole('region', { name: /Needs review/ })).toHaveCount(0);

    const visitors = page.getByRole('region', { name: /Visitors/ });
    const form = visitors.getByRole('form', { name: 'Details for Geoff Weakley' });
    await form.getByLabel('Invited by').selectOption({ label: 'Morgan Member' });
    // Management can fill in what Zoom doesn't give us (owner, 2026-11-10).
    await form.getByLabel('Email').fill('not an email');
    // The browser stops a bad address before it is sent (the server checks it too).
    expect(await form.getByLabel('Email').evaluate((e) => (e as HTMLInputElement).validity.valid)).toBe(false);
    await form.getByLabel('Company').fill('Weakley Consulting');
    await form.getByLabel('Email').fill('Geoff@Weakley.example');
    await form.getByLabel('Phone').fill('650-555-0199');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(visitors.getByRole('status')).toHaveText('Saved.');
    await page.reload();
    const saved = page.getByRole('form', { name: 'Details for Geoff Weakley' });
    await expect(saved.getByLabel('Invited by')).toHaveValue(/[0-9a-f-]{36}/);
    await expect(saved.getByLabel('Email')).toHaveValue('geoff@weakley.example');
    await expect(saved.getByLabel('Company')).toHaveValue('Weakley Consulting');
    await expectAccessible(page);

    // Fetching again keeps the visitor and their inviter.
    await page.getByRole('button', { name: 'Fetch from Zoom again' }).click();
    await expect(page.getByRole('status').first()).not.toContainText('to review');
    await page.reload();
    await expect(page.getByRole('form', { name: 'Details for Geoff Weakley' }).getByLabel('Invited by')).toHaveValue(/[0-9a-f-]{36}/);
    await expect(page.getByRole('form', { name: 'Details for Geoff Weakley' }).getByLabel('Phone')).toHaveValue('650-555-0199');

    // Member recap: Geoff is welcomed, Morgan thanked; the two removed parts are gone.
    await page.goto('/admin/recap');
    await page.getByText('Plain-text version').click();
    const text = page.locator('pre');
    await expect(text).toContainText(/Geoff Weakley\s+Weakley Consulting\s+geoff@weakley\.example\s+650-555-0199/);
    // He is on the list of people the recap goes to.
    await expect(page.getByRole('form', { name: 'Send the Member recap' })).toContainText('Geoff Weakley');
    await expect(text).toContainText('Thanks to Morgan for inviting our guest!');
    await expect(text).not.toContainText('Claim a spot for future presentations');
    await expect(text).not.toContainText('pulling its weight');

    // Management recap: listed as Zoom-only with the inviter's full name.
    await page.goto('/admin/management-recap');
    await page.getByText('Plain-text version').click();
    await expect(page.locator('pre')).toContainText(
      /In Zoom only \(not signed up on the website\)\s+Geoff Weakley\s+Weakley Consulting\s+Invited by: Morgan Member\s+geoff@weakley\.example\s+650-555-0199/,
    );
  });
});
