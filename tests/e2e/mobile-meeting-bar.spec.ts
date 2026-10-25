import { expect, test } from '@playwright/test';
import { expectAccessible, login, users } from './support';

// Phones: a bar fixed to the bottom of every page with the next meeting's date and the Zoom link (owner, 2026-10-24).

test.describe('next-meeting bar on phones', () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test('logged out: the date and "Log In"; logged in: the date, "Join in Zoom", and Referrals / One-on-ones below; not on the slides (owner, 2026-10-24)', async ({
    page,
  }) => {
    await page.goto('/');
    const bar = page.getByRole('complementary', { name: 'Next meeting' });
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \w{3} \d{1,2} · \d{1,2}:\d{2} [AP]M PT/);
    await expect(bar.getByRole('link', { name: 'Log In' })).toHaveAttribute('href', '/login');
    await expect(bar.getByRole('link', { name: 'Request an invite' })).toHaveCount(0);
    await expect(bar.getByRole('link', { name: 'Referrals' })).toHaveCount(0);
    // Fixed to the bottom of the screen.
    const box = await bar.boundingBox();
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(740);
    await expectAccessible(page);

    await login(page, users.member, undefined, '/dashboard');
    await expect(bar).toContainText(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \w{3} \d{1,2} · \d{1,2}:\d{2} [AP]M PT/);
    await expect(bar.getByRole('button', { name: 'Join in Zoom' })).toBeVisible();
    await expect(bar.getByRole('link', { name: 'Log In' })).toHaveCount(0);
    const zoom = await bar.getByRole('button', { name: 'Join in Zoom' }).boundingBox();
    const referrals = bar.getByRole('link', { name: 'Referrals' });
    await expect(referrals).toHaveAttribute('href', '/referrals');
    await expect(bar.getByRole('link', { name: 'One-on-ones' })).toHaveAttribute('href', '/one-on-ones');
    // The two buttons sit on a second row below the date and Zoom button, still fixed to the bottom.
    const ref = await referrals.boundingBox();
    expect((ref?.y ?? 0) > (zoom?.y ?? 0) + (zoom?.height ?? 0) - 1).toBe(true);
    const memberBox = await bar.boundingBox();
    expect(Math.round((memberBox?.y ?? 0) + (memberBox?.height ?? 0))).toBe(740);
    // Page content can scroll clear of the taller bar.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = await page.getByRole('contentinfo').boundingBox();
    expect((footer?.y ?? 0) + (footer?.height ?? 0)).toBeLessThanOrEqual((memberBox?.y ?? 0) + 1);
    await expectAccessible(page);
    await referrals.click();
    await expect(page).toHaveURL(/\/referrals/);
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
