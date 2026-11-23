import { expect, test } from '@playwright/test';
import { expectAccessible, login, users } from './support';

// Owner 2026-11-23: Admin tab "Guest Invites & Applications" with Pending applications, Visitor sign-in link and Guest
// invite requests. The same three sections stay on Overview.

const headings = [/^Pending applications \(\d+\)$/, /^Visitor sign-in link$/, /^Guest invite requests$/];

test('admin opens Guest Invites & Applications from the tabs; Overview still has the same sections', async ({ page }) => {
  await login(page, users.admin, undefined, '/admin');

  const tab = page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Guest Invites & Applications' });
  await expect(tab).toHaveAttribute('href', '/admin/guests');
  await tab.click();
  await expect(page).toHaveURL(/\/admin\/guests$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Guest Invites & Applications' })).toBeVisible();
  await expect(tab).toHaveAttribute('aria-current', 'page');
  for (const h of headings) await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  await expect(page.getByText('/visitor-sign-in').first()).toBeVisible();
  // Only these three sections on the new tab.
  await expect(page.getByRole('heading', { level: 2, name: 'Zoom' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Category seats' })).toHaveCount(0);
  await expectAccessible(page);

  await page.goto('/admin');
  for (const h of headings) await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
});

test('members cannot open Guest Invites & Applications', async ({ page }) => {
  await login(page, users.member);
  await page.goto('/admin/guests');
  await expect(page.getByRole('heading', { level: 1, name: 'Guest Invites & Applications' })).toHaveCount(0);
});
