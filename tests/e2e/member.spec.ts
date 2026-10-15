import { expect, test } from '@playwright/test';
import { db, expectAccessible, login, trackConsole, users } from './support';

test.describe('member area', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, users.member);
  });

  test('every member page renders without console errors and passes axe @responsive', async ({ page }) => {
    const errors = trackConsole(page);
    for (const [path, heading] of [
      ['/dashboard', /, Morgan$/],
      ['/meetings', 'Meetings & attendance'],
      ['/referrals', 'Referral tracker'],
      ['/referrals?tab=business', 'Referral tracker'],
      ['/one-on-ones', 'One-on-one reporting'],
      ['/profile', 'Morgan Member'],
      ['/profile?tab=edit', 'My profile'],
      ['/gallery', 'Gallery'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeAttached();
      await expectAccessible(page);
    }
    expect(errors).toEqual([]);
  });

  test('members see contact details and member navigation', async ({ page }) => {
    await page.goto('/members/harbor-lane-realty');
    await expect(page.getByRole('link', { name: 'avery.lindqvist@example.com' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  test('RSVP toggles and is saved', async ({ page }) => {
    await page.goto('/meetings');
    const first = page.getByRole('button', { name: 'RSVP' }).first();
    await first.click();
    await expect(page.getByRole('button', { name: '✓ Going' }).first()).toBeVisible();
    expect((await db('rsvps?select=meeting_id')).length).toBeGreaterThan(0);
    await page.getByRole('button', { name: '✓ Going' }).first().click();
    await expect(page.getByRole('button', { name: '✓ Going' })).toHaveCount(0);
  });

  test('claim and release a speaker slot', async ({ page }) => {
    await page.goto('/meetings');
    await page
      .getByRole('button', { name: /^Claim / })
      .first()
      .click();
    const release = page.getByRole('button', { name: /^Release my / }).first();
    await expect(release).toBeVisible();
    await release.click();
    await expect(page.getByRole('button', { name: /^Release my / })).toHaveCount(0);
  });

  test('opening the Zoom link goes to the stored join URL', async ({ page }) => {
    await page.route('https://zoom.us/**', (route) => route.fulfill({ status: 200, body: 'zoom' }));
    await page.goto('/meetings');
    const req = page.waitForRequest((r) => r.url().startsWith('https://zoom.us/'));
    await page
      .getByRole('button', { name: /Open Zoom link|Join now/ })
      .first()
      .click();
    expect((await req).url()).toContain('zoom.us/j/');
  });

  test('attendance correction request validates and saves', async ({ page }) => {
    await page.goto('/meetings');
    await page.getByRole('button', { name: 'Request an attendance correction' }).click();
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText('Tell us what needs fixing')).toBeVisible();
    await page.getByLabel('What needs fixing?').fill('I attended but joined from my phone app.');
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText('An admin will review your attendance')).toBeVisible();
  });

  test('report a one-on-one: invalid then valid, appears in my list and the partner can confirm', async ({ page }) => {
    await page.goto('/one-on-ones');
    await page.getByRole('button', { name: 'Report one-on-one' }).click();
    await expect(page.getByText('Choose who you met with')).toBeVisible();
    await page.getByLabel('Who did you meet with?').selectOption({ label: 'Riley Second · Second Test Bakery' });
    await page.getByRole('radio', { name: '5 stars' }).check();
    await page.getByLabel('Private note').fill('Great fit for catering referrals.');
    await page.getByRole('button', { name: 'Report one-on-one' }).click();
    await expect(page.getByText(/One-on-one reported/)).toBeVisible();
    await expect(page.getByText('Morgan Member had a one-on-one with Riley Second.').first()).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await login(page, users.member2, undefined, '/one-on-ones');
    const pending = page.getByRole('listitem').filter({ hasText: 'Morgan Member had a one-on-one with Riley Second' }).first();
    await pending.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText(/CONFIRMED/).first()).toBeVisible();
  });

  test('send a referral (invalid then valid); receiver marks it closed with an amount', async ({ page }) => {
    await page.goto('/referrals?tab=business');
    await page.getByRole('button', { name: 'Send referral' }).click();
    await expect(page.getByText('Choose a member to refer to')).toBeVisible();
    await page.getByLabel('Refer to member').selectOption({ label: 'Riley Second · Second Test Bakery' });
    await page.getByLabel('Contact name').fill('Wedding cake client');
    await page.getByRole('button', { name: 'Send referral' }).click();
    await expect(page.getByText('Referral sent.')).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await login(page, users.member2, undefined, '/referrals?tab=business');
    const form = page.getByRole('form', { name: 'Update referral: Wedding cake client' });
    await form.getByLabel('Status').selectOption('closed');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByText('Enter the amount of closed business')).toBeVisible();
    await form.getByLabel('Amount ($)').fill('850');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Closed · \$850/)).toBeVisible();
  });

  test('invite link is shown and copyable', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/referrals');
    const link = page.getByLabel('Your invite link');
    await expect(link).toContainText('/visit?ref=');
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByRole('button', { name: '✓ Copied' })).toBeVisible();
  });

  test('edit profile: invalid website shows an error; valid save updates the public profile', async ({ page }) => {
    await page.goto('/profile?tab=edit');
    await page.getByLabel('Website').fill('not a url');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Website must start with http:// or https://')).toBeVisible();
    await page.getByLabel('Website').fill('https://morgan.example.org');
    await page.getByLabel('About').fill('Brand strategy for local businesses.');
    await page.getByLabel('Services').fill('Branding, Websites');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible();
    await page.goto('/profile');
    await expect(page.getByText('Brand strategy for local businesses.')).toBeVisible();
    await expect(page.getByText('Websites', { exact: true })).toBeVisible();
  });
});

test.describe('admin', () => {
  test('non-admins are sent away from /admin', async ({ page }) => {
    await login(page, users.member, undefined, '/admin');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('admin can mark a guest as visited', async ({ page }) => {
    await login(page, users.admin, undefined, '/admin');
    const btn = page.getByRole('button', { name: /^Mark visited/ }).first();
    await btn.click();
    await expect(page.getByText('Visiting').first()).toBeVisible();
  });
});
