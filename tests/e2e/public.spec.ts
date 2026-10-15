import { expect, test } from '@playwright/test';
import { db, expectAccessible, trackConsole } from './support';

const pages = [
  { path: '/', heading: 'Local businesses, growing through real referrals.' },
  { path: '/about', heading: 'About [New Name]' },
  { path: '/events', heading: 'Business networking events' },
  { path: '/members', heading: 'Our [New Name] members' },
  { path: '/members/harbor-lane-realty', heading: 'Avery Lindqvist' },
  { path: '/visit', heading: 'Come visit [New Name]' },
  { path: '/gallery', heading: 'Gallery' },
  { path: '/join', heading: 'Join [New Name]' },
  { path: '/login', heading: 'More than networking. A system for business growth.' },
  { path: '/forgot-password', heading: 'Reset your password' },
  { path: '/terms', heading: 'Terms of use' },
  { path: '/privacy', heading: 'Privacy statement' },
];

test.describe('public pages', () => {
  for (const p of pages) {
    test(`${p.path} renders, has no console errors and passes axe @responsive`, async ({ page }) => {
      const errors = trackConsole(page);
      await page.goto(p.path);
      await expect(page.getByRole('heading', { level: 1, name: p.heading })).toBeVisible();
      await expectAccessible(page);
      expect(errors).toEqual([]);
    });
  }

  test('dark mode pages pass axe colour contrast', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const path of ['/', '/members', '/visit', '/login']) {
      await page.goto(path);
      await expectAccessible(page);
    }
  });

  test('unknown pages show a 404', async ({ page }) => {
    const res = await page.goto('/no-such-page');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});

test.describe('navigation', () => {
  test('header links reach every public page', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const [label, path] of [
      ['About', '/about'],
      ['Events', '/events'],
      ['Members', '/members'],
      ['Visit', '/visit'],
      ['Gallery', '/gallery'],
      ['Home', '/'],
    ] as const) {
      await nav.getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(path);
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('mobile menu opens and closes @responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Menu' });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Events' }).click();
    await expect(page).toHaveURL('/events');
    // no horizontal scroll at phone width
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test('member pages redirect signed-out visitors to login', async ({ page }) => {
    for (const path of ['/dashboard', '/meetings', '/referrals', '/one-on-ones', '/profile', '/admin']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
    }
  });
});

test.describe('data-backed public views', () => {
  test('home shows the next meeting countdown and upcoming events from the database', async ({ page }) => {
    await page.goto('/');
    const timer = page.getByRole('timer', { name: 'Time until the next meeting' });
    await expect(timer).toBeVisible();
    const first = await timer.textContent();
    await page.waitForTimeout(1200);
    expect(await timer.textContent()).not.toEqual(first);
    const [count] = await db<{ count: number }>('profiles?select=count&status=eq.approved');
    await expect(page.getByLabel('At a glance').getByText(String(count?.count), { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Events & meetings' })).toBeVisible();
  });

  test('members directory search, category filter and clear', async ({ page }) => {
    await page.goto('/members');
    await page.getByLabel('Keyword').fill('hearing');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('link', { name: /ClearTone Hearing/ })).toBeVisible();
    await expect(page.getByText(/Showing\s+1\s+of/)).toBeVisible();
    await page.getByLabel('Keyword').fill('zzzz-no-match');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('No members match your search')).toBeVisible();
    await page.getByRole('link', { name: 'Clear', exact: true }).click();
    await page.getByLabel('Category').selectOption('Real Estate');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('link', { name: /Harbor Lane Realty/ })).toBeVisible();
  });

  test('public profile hides email and phone from visitors unless the member opted in', async ({ page }) => {
    await page.goto('/members/harbor-lane-realty');
    await expect(page.getByText('Email and phone are visible to')).toBeVisible();
    await expect(page.getByRole('link', { name: /@example\.com/ })).toHaveCount(0);
  });

  test('events list/calendar toggle, month navigation, category filter and detail page', async ({ page }) => {
    await page.goto('/events');
    await page.getByRole('link', { name: 'Calendar', exact: true }).click();
    await expect(page).toHaveURL(/view=month/);
    const title = page.getByRole('heading', { level: 3 }).first();
    const before = await title.textContent();
    await page.getByRole('link', { name: 'Next month' }).click();
    await expect(title).not.toHaveText(before ?? '');
    await page.getByRole('link', { name: 'List', exact: true }).click();
    await expect(page).toHaveURL('/events');
    await page.getByRole('link', { name: /Social · / }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Fall Mixer in Belmont' })).toBeVisible();
    await page.getByRole('link', { name: /View details for Fall Mixer/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Fall Mixer in Belmont' })).toBeVisible();
    const ics = await page.request.get('/events/fall-mixer-belmont/calendar.ics');
    expect(await ics.text()).toContain('SUMMARY:Fall Mixer in Belmont');
  });

  test('gallery album filter and keyboard-operable lightbox', async ({ page }) => {
    await page.goto('/gallery');
    await page.getByRole('button', { name: 'Mixers' }).click();
    await expect(page.getByRole('button', { name: /Open photo/ })).toHaveCount(2);
    await page.getByRole('button', { name: /Open photo: Holiday party/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Photo viewer' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByText('Fall mixer group photo')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

test.describe('guest invite form', () => {
  test('shows inline errors for invalid input', async ({ page }) => {
    await page.goto('/visit');
    await page.getByRole('button', { name: 'Send my invite request' }).click();
    await expect(page.getByText('First name is required')).toBeVisible();
    await expect(page.getByText('Last name is required')).toBeVisible();
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Send my invite request' }).click();
    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    await expect(page.getByLabel('First name')).toBeFocused();
  });

  test('saves a valid request and credits the referrer from ?ref=', async ({ page }) => {
    const email = `guest.${Date.now()}@example.org`;
    await page.goto('/visit?ref=AVER-001');
    await expect(page.getByLabel('Who invited you?')).toHaveValue(/Avery Lindqvist/);
    await page.getByLabel('First name').fill('Gina');
    await page.getByLabel('Last name').fill('Guest');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Business name').fill('Guest Co');
    await page.getByRole('button', { name: 'Send my invite request' }).click();
    await expect(page.getByText("You're on the list, Gina!")).toBeVisible();
    const rows = await db<{ referrer_id: string; status: string }>(`guest_requests?email=eq.${encodeURIComponent(email)}&select=referrer_id,status`);
    expect(rows).toEqual([{ referrer_id: '00000000-0000-4000-8000-000000000001', status: 'requested' }]);
  });
});
