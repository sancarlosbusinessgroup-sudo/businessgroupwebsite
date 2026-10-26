import { expect, test } from '@playwright/test';
import { expectAccessible, login, users } from './support';

// Admin → Presentation materials: every file, video and website added to meeting slides, with file sizes (owner, 2026-10-27).

test.describe.configure({ mode: 'serial' });

test('admins see every added material with its size and an Open link; members are kept out', async ({ page }) => {
  await login(page, users.admin, undefined, '/present/next');
  const deck = page.getByRole('region', { name: 'Meeting slides' });
  await deck.getByRole('link', { name: 'Customize slides' }).click();
  await page.waitForURL(/\/setup$/);
  const setupUrl = page.url();
  const five = page.getByRole('form', { name: 'Upload for the 5-minute presentation' });
  await five.getByLabel('File').setInputFiles('tests/e2e/fixtures/two-pages.pdf');
  await five.getByLabel('Title (optional)').fill('Materials list deck');
  await five.getByRole('button', { name: 'Add to slides' }).click();
  await expect(five.getByText('PDF added (2 pages).')).toBeVisible();
  const ten = page.getByRole('form', { name: 'Video or website for the 10-minute presentation' });
  await ten.getByLabel('YouTube or website link').fill('https://example.org/materials-page');
  await ten.getByLabel('Title (optional)').fill('Materials list website');
  await ten.getByRole('button', { name: 'Add link' }).click();
  await expect(page.getByText('Website added.')).toBeVisible();

  try {
    await page.goto('/admin');
    await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Presentation materials' }).click();
    await expect(page.getByRole('heading', { name: 'Presentation materials', level: 1 })).toBeVisible();
    const table = page.getByRole('region', { name: 'Presentation materials table' });
    const pdfRow = table.getByRole('row').filter({ hasText: 'Materials list deck' });
    await expect(pdfRow).toContainText('PDF · 2 pages');
    await expect(pdfRow).toContainText('5-minute educational presentation');
    await expect(pdfRow).toContainText(/\d+ (B|KB)/);
    await expect(pdfRow.getByRole('link', { name: /Open Materials list deck/ })).toHaveAttribute('href', /\/present\/.+\/material\//);
    const linkRow = table.getByRole('row').filter({ hasText: 'Materials list website' });
    await expect(linkRow).toContainText('Website link');
    await expect(linkRow.getByRole('link', { name: /Open Materials list website/ })).toHaveAttribute('href', 'https://example.org/materials-page');
    const space = page.getByRole('region', { name: 'Space used' });
    await expect(space).toContainText('of the 1 GB included in the free plan');
    await expectAccessible(page);

    // The Open link serves the file to an admin (signed link redirect).
    const res = await page.request.get((await pdfRow.getByRole('link', { name: /Open/ }).getAttribute('href')) ?? '', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
  } finally {
    await page.goto(setupUrl);
    for (const name of ['Materials list deck', 'Materials list website']) {
      await page.getByRole('button', { name: `Remove ${name}` }).click();
      await expect(page.getByRole('button', { name: `Remove ${name}` })).toHaveCount(0);
    }
  }
});

test('members cannot open the materials page', async ({ page }) => {
  await login(page, users.member, undefined, '/dashboard');
  await page.goto('/admin/materials');
  await expect(page.getByRole('heading', { name: 'Presentation materials', level: 1 })).toHaveCount(0);
});
