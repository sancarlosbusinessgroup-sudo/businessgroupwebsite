import { expect, test } from '@playwright/test';
import { expectAccessible, login, users } from './support';

// Owner 2026-11-24: "Support" in the member menu is a dropdown: "Video Guides" (new page with the Member's Guide videos)
// and "Contact Us" (the original Support page).

test.describe('video guides (2026-11-24)', () => {
  test('Support opens a dropdown with Video Guides, Rules and Contact Us @responsive', async ({ page }) => {
    await login(page, users.member);
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    if (await menu.isVisible()) await menu.click();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await nav.getByRole('button', { name: 'Support' }).click();
    const sub = page.locator('#submenu-support');
    await expect(sub.getByRole('link')).toHaveText(['Video Guides', 'Rules', 'Contact Us']);
    await sub.getByRole('link', { name: 'Video Guides' }).click();
    await expect(page).toHaveURL(/\/video-guides$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Video Guides' })).toBeVisible();

    if (await menu.isVisible()) await menu.click();
    await nav.getByRole('button', { name: 'Support' }).click();
    await page.locator('#submenu-support').getByRole('link', { name: 'Contact Us' }).click();
    await expect(page).toHaveURL(/\/support$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Support' })).toBeVisible();
  });

  test('the Video Guides page has the full Member’s Guide and 14 chapter clips, all playable files', async ({ page, request }) => {
    await login(page, users.member, undefined, '/video-guides');
    await expect(page.getByRole('heading', { name: 'The full tour' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chapter by chapter' })).toBeVisible();
    const chapters = page.locator('section[aria-labelledby="chapters-h"] ol > li');
    await expect(chapters).toHaveCount(14);
    await expect(chapters.first().getByRole('heading')).toHaveText('1. Logging in for the first time');

    const sources = await page.locator('video source').evaluateAll((els) => els.map((e) => (e as HTMLSourceElement).getAttribute('src')));
    const posters = await page.locator('video').evaluateAll((els) => els.map((e) => (e as HTMLVideoElement).getAttribute('poster')));
    expect(sources).toHaveLength(15);
    for (const url of [...sources, ...posters]) {
      const res = await request.head(url!);
      expect(res.status(), url!).toBe(200);
    }
    await expectAccessible(page);
  });

  test('visitors are sent to log in', async ({ page }) => {
    await page.goto('/video-guides');
    await expect(page).toHaveURL(/\/login\?next=%2Fvideo-guides/);
  });
});
