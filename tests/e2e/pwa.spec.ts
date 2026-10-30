import { expect, test } from '@playwright/test';
import { expectAccessible, login, users } from './support';

// Installable web app (owner, 2026-10-30): manifest, icons, service worker, offline page, install card.

test('manifest, icons and service worker are served; the offline page renders', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((i: { purpose?: string; sizes: string }) => i.purpose === 'maskable' && i.sizes === '512x512')).toBe(true);
  expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toEqual(['/referrals', '/one-on-ones', '/meetings']);
  for (const icon of manifest.icons as { src: string }[]) expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  const sw = await request.get('/sw.js');
  expect(sw.ok()).toBe(true);
  expect(sw.headers()['cache-control']).toContain('no-cache');
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest/);
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await page.goto('/offline');
  await expect(page.getByRole('heading', { level: 1, name: 'You’re offline' })).toBeVisible();
  await expectAccessible(page);
});

test('members see "Add BARP to your phone" on the dashboard (not when already installed)', async ({ page }) => {
  await login(page, users.member, undefined, '/dashboard');
  await expect(page.getByRole('heading', { name: 'Add BARP to your phone' })).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  const installed = await page.context().newPage();
  await installed.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (q.includes('standalone') ? ({ matches: true } as MediaQueryList) : real(q));
  });
  await installed.goto('/dashboard');
  await expect(installed.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(installed.getByRole('heading', { name: 'Add BARP to your phone' })).toHaveCount(0);
});
