import { expect, test } from '@playwright/test';
import { login, users } from './support';

// Owner report 2026-10-24: on phones some pages looked squeezed into a narrow column. Cause: wide tables made the page
// wider than the screen (screen-reader-only text inside them escaped their scroll box), so the browser zoomed out.
// No page may be wider than a phone screen; wide tables scroll inside their own box.
test.use({ viewport: { width: 375, height: 800 } });

test('no page is wider than a phone screen (members and admins)', async ({ page }) => {
  await login(page, users.admin, undefined, '/dashboard');
  const wide: string[] = [];
  for (const path of [
    '/',
    '/dashboard',
    '/meetings',
    '/referrals',
    '/closed-business',
    '/one-on-ones',
    '/profile',
    '/profile?tab=edit',
    '/members',
    '/events',
    '/group-meetings',
    '/about',
    '/visit',
    '/bylaws',
    '/support',
    '/invite-guest',
    '/gallery',
    '/admin',
    '/admin/stats',
    '/admin/attendance',
    '/admin/champion',
    '/admin/activity',
    '/admin/leadership',
  ]) {
    await page.goto(path);
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    if (scroll > client) wide.push(`${path}: ${scroll}px`);
  }
  expect(wide).toEqual([]);
});

test('on a phone the login box comes before the introduction text', async ({ page }) => {
  await page.goto('/login');
  const box = await page.getByRole('heading', { name: 'Welcome back' }).boundingBox();
  const intro = await page.getByRole('heading', { level: 1, name: /More than networking/ }).boundingBox();
  expect(box && intro && box.y < intro.y).toBe(true);
  // The password box is on the first screen, no scrolling needed.
  const pw = await page.getByRole('textbox', { name: 'Password', exact: true }).boundingBox();
  expect(pw && pw.y + pw.height < 800).toBe(true);
});

test('on a wide screen the introduction stays on the left of the login box', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/login');
  const box = await page.getByRole('heading', { name: 'Welcome back' }).boundingBox();
  const intro = await page.getByRole('heading', { level: 1, name: /More than networking/ }).boundingBox();
  expect(box && intro && intro.x < box.x).toBe(true);
});
