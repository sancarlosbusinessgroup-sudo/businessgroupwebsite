import { expect, test } from '@playwright/test';
import { login, users } from './support';

// Owner wording changes, 2026-10-25: "no membership fees" instead of "free", "Membership Committee" instead of
// "leadership team", the meeting time on the home page, "We help you grow your business by referral".

const PUBLIC = ['/', '/visit', '/about', '/join', '/login', '/bylaws', '/support', '/group-meetings', '/events', '/members'];

async function pageText(page: import('@playwright/test').Page) {
  return (await page.locator('body').innerText()).replace(/feel free/gi, '');
}

test('no page says "free" (about cost), "leadership team" or "hybrid gatherings"', async ({ page }) => {
  const found: string[] = [];
  const check = async (path: string) => {
    await page.goto(path);
    const text = await pageText(page);
    for (const re of [/\bfree\b/i, /leadership team/i, /hybrid gatherings/i]) {
      const m = text.match(new RegExp(`.{0,40}${re.source}.{0,40}`, 'i'));
      if (m) found.push(`${path}: …${m[0]}…`);
    }
  };
  for (const p of PUBLIC) await check(p);
  await login(page, users.admin, undefined, '/dashboard');
  for (const p of ['/dashboard', '/admin', '/one-on-ones', '/referrals', '/meetings']) await check(p);
  expect(found).toEqual([]);
});

test('home page: meeting time 8:15am–9:30am, "no membership fees", and the new step title', async ({ page }) => {
  await page.goto('/');
  const glance = page.getByRole('region', { name: 'At a glance' });
  await expect(glance.getByText('Every other Monday', { exact: true })).toBeVisible();
  await expect(glance.getByText('8:15am–9:30am', { exact: true })).toBeVisible();
  await expect(glance.getByText(/hybrid gatherings/)).toHaveCount(0);
  await expect(page.getByText('Visit twice, no membership fees', { exact: true })).toBeVisible();
  await expect(page.getByText('Meet the Membership Committee', { exact: true })).toBeVisible();
  await expect(page.getByText(/One-to-ones with three Membership Committee members/)).toBeVisible();
  await expect(page.getByText('We help you grow your business by referral', { exact: true })).toBeVisible();
  await expect(page.getByText('Watch it grow')).toHaveCount(0);
});

test('Visit page: no "Open professions" section; "no membership fees" in the introduction', async ({ page }) => {
  await page.goto('/visit');
  await expect(page.getByRole('heading', { name: 'Open professions' })).toHaveCount(0);
  await expect(page.getByText('One member per profession', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/no membership fees/i).first()).toBeVisible();
});

test('Visit page and About timeline give the meeting time instead of "hybrid gatherings"', async ({ page }) => {
  await page.goto('/visit');
  await expect(page.getByText('We meet every other Monday, 8:15am–9:30am.', { exact: true })).toBeVisible();
  await page.goto('/about');
  await expect(page.getByText('Meeting every other Monday, 8:15am–9:30am', { exact: true })).toBeVisible();
});
