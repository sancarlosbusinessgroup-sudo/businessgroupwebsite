import { expect, test } from '@playwright/test';
import { STACK, expectAccessible, login, serviceKey, users } from './support';

// Owner 2026-11-24: Admin Overview reorganised (action items + a card per tab), sections moved to their tabs, new tab
// order, Gallery for Super Admins only, Support page paragraph full width.

async function rest(path: string, method = 'GET', body?: unknown) {
  const key = await serviceKey();
  const res = await fetch(`${STACK}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? [] : ((await res.json()) as Record<string, unknown>[]);
}

const tabOrder = [
  'Overview',
  'Meetings',
  'Meeting Slides',
  'Presentation Materials',
  'Attendance',
  'Member Recap',
  'Management Recap',
  'Guest Invites & Applications',
  'Members',
  'Member Activity',
  'Member Stats',
  'BARP Champion',
  'Management',
  'Gallery',
  'Change History',
];

test.describe.configure({ mode: 'serial' });

test('Overview: action items, Zoom and a card per tab; the old sections are gone', async ({ page }) => {
  const email = `walkin.${Date.now()}@example.org`;
  await rest('guest_requests', 'POST', { first_name: 'Ivan', last_name: 'Invitee', email, status: 'requested' });
  try {
    await login(page, users.admin, undefined, '/admin');
    await expect(page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link')).toHaveText(tabOrder);

    const todo = page.getByRole('region', { name: /^Items that Need Immediate Action/ });
    const item = todo.getByRole('listitem').filter({ hasText: 'Send Ivan Invitee the Zoom link' });
    await expect(item).toContainText('Stage: asked for an invite');
    await expect(item.getByRole('link', { name: /Open Guest Invites & Applications/ })).toHaveAttribute('href', '/admin/guests#guests');

    await expect(page.getByRole('heading', { level: 2, name: 'Zoom' })).toBeVisible();
    const tabs = page.getByRole('region', { name: 'Admin tabs' });
    await expect(tabs.getByRole('heading', { level: 3 })).toHaveText(tabOrder.slice(1));
    const meetings = tabs.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Meetings', exact: true }) });
    await expect(meetings.getByRole('link', { name: /Open Meetings/ })).toHaveAttribute('href', '/admin/meetings');

    for (const h of [
      /^Pending applications/,
      'Visitor sign-in link',
      'Guest invite requests',
      'Category seats',
      'Directory downloads',
      'Attendance correction requests',
    ])
      await expect(page.getByRole('heading', { level: 2, name: h })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Onboarding|Recent emails|Email Logs/ })).toHaveCount(0);
    await expectAccessible(page);
  } finally {
    await rest(`guest_requests?email=eq.${encodeURIComponent(email)}`, 'DELETE');
  }
});

test('moved sections are on their new tabs', async ({ page }) => {
  await login(page, users.admin, undefined, '/admin/activity');
  await expect(page.getByRole('heading', { level: 2, name: 'Directory downloads' })).toBeVisible();
  await page.goto('/admin/history');
  await expect(page.getByRole('heading', { level: 2, name: 'Email Logs' })).toBeVisible();
  await page.goto('/admin/guests');
  await expect(page.getByRole('heading', { level: 2, name: 'Onboarding', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync newsletter list' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Category seats' })).toBeVisible();
  await page.goto('/admin/attendance');
  await expect(page.getByRole('heading', { level: 2, name: 'Attendance correction requests' })).toBeVisible();
  await expectAccessible(page);
});

test('Gallery tab is for Super Admins only', async ({ page }) => {
  const [admin] = await rest(`profiles?select=id&first_name=eq.Ada&last_name=eq.Admin`);
  const id = admin!.id as string;
  await rest(`profiles?id=eq.${id}`, 'PATCH', { is_owner: false });
  try {
    await login(page, users.admin, undefined, '/admin');
    await expect(page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link')).toHaveText(tabOrder.filter((t) => t !== 'Gallery'));
    await expect(page.getByRole('region', { name: 'Admin tabs' }).getByRole('heading', { name: 'Gallery' })).toHaveCount(0);
    await page.locator('header').getByRole('button', { name: 'Admin', exact: true }).click();
    await expect(page.locator('header').getByRole('list', { name: 'Admin sections' }).getByRole('link', { name: 'Gallery' })).toHaveCount(0);
    await page.goto('/admin/gallery');
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/gallery');
    await expect(page.getByRole('link', { name: /Edit as admin/ })).toHaveCount(0);
  } finally {
    await rest(`profiles?id=eq.${id}`, 'PATCH', { is_owner: true });
  }
  await page.goto('/admin/gallery');
  await expect(page.getByRole('heading', { level: 1, name: 'Gallery' })).toBeVisible();
  // The title is never displayed.
  await page.goto('/admin/members');
  await expect(page.getByText(/super admin/i)).toHaveCount(0);
  await expect(page.getByText('Owner', { exact: true })).toHaveCount(0);
});

test('Support page: the team paragraph spans the full width on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, users.member, undefined, '/support');
  const para = page.getByText(/^We’re happy to be part of|^We're happy to be part of/).first();
  const list = page.getByRole('heading', { name: /Cedrick Velasco/ }).locator('xpath=ancestor::ul[1]');
  const [p, l] = [await para.boundingBox(), await list.boundingBox()];
  expect(Math.abs(p!.width - l!.width)).toBeLessThan(4);
});
