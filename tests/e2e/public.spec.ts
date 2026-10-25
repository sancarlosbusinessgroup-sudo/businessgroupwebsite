import { expect, test } from '@playwright/test';
import { db, expectAccessible, trackConsole } from './support';

const pages = [
  { path: '/', heading: 'Local businesses, growing through real referrals.' },
  { path: '/about', heading: 'About Bay Area Referral Partners' },
  { path: '/group-meetings', heading: 'Meeting Schedules' },
  { path: '/events', heading: 'Member events' },
  { path: '/members', heading: 'Our Bay Area Referral Partners members' },
  { path: '/members/harbor-lane-realty', heading: 'Avery Lindqvist' },
  { path: '/visit', heading: 'Come visit Bay Area Referral Partners' },
  { path: '/gallery', heading: 'Gallery' },
  { path: '/join', heading: 'Join Bay Area Referral Partners' },
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
      ['Meetings', '/group-meetings'],
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
    await expect(page.getByRole('heading', { level: 2, name: 'Meeting Schedules' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Member events' })).toBeVisible();
  });

  test('home: header logo and the full-width hero photo behind the text and countdown', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Bay Area Referral Partners, home' })).toBeVisible();
    const hero = page.locator('section', { has: page.getByRole('heading', { level: 1 }) });
    const photo = hero.locator('img[src*="hero-bridge"]');
    await expect(photo).toBeVisible();
    await expect(hero.getByRole('timer', { name: 'Time until the next meeting' })).toBeVisible();
    const [p, vw] = await Promise.all([photo.boundingBox(), page.evaluate(() => document.documentElement.clientWidth)]);
    expect(Math.round(p?.width ?? 0)).toBeGreaterThanOrEqual(vw - 1);
  });

  test('group meetings and member events are on separate pages', async ({ page }) => {
    await page.goto('/group-meetings');
    await expect(page.getByRole('heading', { level: 3, name: /Bay Area Referral Partners Meeting/ }).first()).toBeVisible();
    await expect(page.getByText(/Member event · hosted by/)).toHaveCount(0);
    await page.goto('/events');
    await expect(page.getByText(/Member event · hosted by/).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: /Bay Area Referral Partners Meeting/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 3, name: 'Fall Mixer in Belmont' })).toHaveCount(0);
  });

  test('directory cards: the person is the link and the larger heading, the business is below', async ({ page }) => {
    await page.goto('/members?q=Harbor');
    const heading = page.getByRole('heading', { level: 2, name: 'Avery Lindqvist' });
    await expect(heading).toBeVisible();
    const business = page.getByText('Harbor Lane Realty', { exact: true });
    const [h, b] = await Promise.all([
      heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      business.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ]);
    expect(h).toBeGreaterThan(b);
  });

  test('members directory search, category filter and clear', async ({ page }) => {
    await page.goto('/members');
    await page.getByLabel('Keyword').fill('hearing');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('link', { name: 'Wesley Tran', exact: true })).toBeVisible();
    await expect(page.getByText('ClearTone Hearing')).toBeVisible();
    await expect(page.getByText(/Showing\s+1\s+of/)).toBeVisible();
    await page.getByLabel('Keyword').fill('zzzz-no-match');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('No members match your search')).toBeVisible();
    await page.getByRole('link', { name: 'Clear', exact: true }).click();
    // Wait for "Clear" to finish loading: the search form is rebuilt then, which would undo a choice made earlier.
    await expect(page).toHaveURL(/\/members$/);
    await expect(page.getByText('No members match your search')).toHaveCount(0);
    await expect(page.getByLabel('Keyword')).toHaveValue('');
    await page.getByLabel('Category').selectOption('Real Estate');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('link', { name: 'Avery Lindqvist', exact: true })).toBeVisible();
  });

  test('public profile hides email and phone from visitors unless the member opted in', async ({ page }) => {
    await page.goto('/members/harbor-lane-realty');
    await expect(page.getByText('Email and phone are visible to')).toBeVisible();
    await expect(page.getByRole('link', { name: /@example\.com/ })).toHaveCount(0);
    // No "Member since …" line on profiles (owner, 2026-10-25).
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/Member since/)).toHaveCount(0);
  });

  test('meetings list/calendar toggle, month navigation, category filter and detail page', async ({ page }) => {
    await page.goto('/group-meetings');
    await page.getByRole('link', { name: 'Calendar', exact: true }).click();
    await expect(page).toHaveURL(/view=month/);
    const title = page.getByRole('heading', { level: 3 }).first();
    const before = await title.textContent();
    await page.getByRole('link', { name: 'Next month' }).click();
    await expect(title).not.toHaveText(before ?? '');
    await page.getByRole('link', { name: 'List', exact: true }).click();
    await expect(page).toHaveURL('/group-meetings');
    await page.getByRole('link', { name: /Social · / }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Fall Mixer in Belmont' })).toBeVisible();
    await page.getByRole('link', { name: /View details for Fall Mixer/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Fall Mixer in Belmont' })).toBeVisible();
    await page.getByRole('link', { name: '← All meetings' }).click();
    await expect(page).toHaveURL('/group-meetings');
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
    await expect(page.getByText('Phone is required')).toBeVisible();
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
    await page.getByLabel('Phone').fill('650-555-0123');
    await page.getByLabel('Business name').fill('Guest Co');
    await page.getByRole('button', { name: 'Send my invite request' }).click();
    await expect(page.getByText("You're on the list, Gina!")).toBeVisible();
    const rows = await db<{ referrer_id: string; status: string }>(`guest_requests?email=eq.${encodeURIComponent(email)}&select=referrer_id,status`);
    expect(rows).toEqual([{ referrer_id: '00000000-0000-4000-8000-000000000001', status: 'requested' }]);
  });

  test('saves the phone and optional website, checks the website, and says members will see the details', async ({ page }) => {
    const email = `guest.contact.${Date.now()}@example.org`;
    await page.goto('/visit');
    await expect(page.getByText('we introduce visitors to our members by name, business and the contact details you give here')).toBeVisible();
    await page.getByLabel('First name').fill('Kenia');
    await page.getByLabel('Last name').fill('Ibarra');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Phone').fill('650-347-6972');
    await page.getByLabel('Website').fill('peninsulachemdry.example');
    await page.getByRole('button', { name: 'Send my invite request' }).click();
    await expect(page.getByText('Website must start with http:// or https://')).toBeVisible();
    await page.getByLabel('Website').fill('https://peninsulachemdry.example');
    await page.getByRole('button', { name: 'Send my invite request' }).click();
    await expect(page.getByText("You're on the list, Kenia!")).toBeVisible();
    const rows = await db<{ phone: string; website: string }>(`guest_requests?email=eq.${encodeURIComponent(email)}&select=phone,website`);
    expect(rows).toEqual([{ phone: '650-347-6972', website: 'https://peninsulachemdry.example' }]);
  });
});
