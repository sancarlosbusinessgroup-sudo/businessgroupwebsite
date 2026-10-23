import { expect, test } from '@playwright/test';

// Owner request 2026-10-23: the application form (/join) is reached only from an admin's "Invite to apply" email.
// No link on the site points to it; the buttons that did now say "Request an invite" and go to the request form.

const pages = ['/', '/about', '/bylaws', '/login', '/visit', '/members', '/group-meetings', '/events'];

test('no page links to the application form', async ({ page }) => {
  for (const path of pages) {
    await page.goto(path);
    await expect(page.locator('a[href^="/join"]'), `${path} still links to /join`).toHaveCount(0);
  }
});

test('home, footer, about, bylaws and login offer "Request an invite"', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('section', { hasText: 'grow our businesses together' }).getByRole('link', { name: 'Request an invite' });
  await expect(cta).toHaveAttribute('href', '/visit#request');
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Request an invite' })).toHaveAttribute('href', '/visit#request');
  await expect(page.getByText('Visit or join')).toHaveCount(0);
  await expect(page.getByText('Apply to join')).toHaveCount(0);

  for (const path of ['/about', '/bylaws', '/login']) {
    await page.goto(path);
    await expect(page.getByRole('main').getByRole('link', { name: /Request an invite/ }).first(), path).toHaveAttribute('href', '/visit#request');
  }
});

test('the application form still opens from a direct link', async ({ page }) => {
  await page.goto('/join');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Join');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
