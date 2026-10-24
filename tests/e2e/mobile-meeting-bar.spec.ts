import { expect, test } from '@playwright/test';
import { expectAccessible, login, users } from './support';

// Phones: a bar fixed to the bottom of every page with the next meeting's date and the Zoom link (owner, 2026-10-24).

test.describe('next-meeting bar on phones', () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test('visitors see the date and "Request an invite"; members get "Join on Zoom"; not on the slides', async ({ page }) => {
    await page.goto('/');
    const bar = page.getByRole('complementary', { name: 'Next meeting' });
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \w{3} \d{1,2} · \d{1,2}:\d{2} [AP]M PT/);
    await expect(bar.getByRole('link', { name: 'Request an invite' })).toHaveAttribute('href', '/visit#request');
    // Fixed to the bottom of the screen.
    const box = await bar.boundingBox();
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(740);
    await expectAccessible(page);

    await login(page, users.member, undefined, '/dashboard');
    await expect(bar.getByRole('button', { name: 'Join on Zoom' })).toBeVisible();
    await page.goto('/present/next');
    await expect(page.getByRole('region', { name: 'Meeting slides' })).toBeVisible();
    await expect(bar).toHaveCount(0);
  });

  test('not shown on wider screens', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('complementary', { name: 'Next meeting' })).toBeHidden();
  });
});
