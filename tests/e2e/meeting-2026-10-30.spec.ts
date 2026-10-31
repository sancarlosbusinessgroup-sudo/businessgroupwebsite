import { expect, test } from '@playwright/test';
import { STACK, db, expectAccessible, login, serviceKey, users } from './support';

// Changes the group asked for at the website review meeting (owner meeting 2026-10-30, recordings Parts 1–3).

test.describe('public site', () => {
  test('Home: "Request an invite" everywhere, reworded steps, 12-month stats, no login prompts', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Request an invite' })).toBeVisible();
    await expect(page.getByText(/Request for an Invite/i)).toHaveCount(0);
    for (const t of ['Visit up to twice as a guest', 'Meet the Membership Committee', 'Connect with members', 'Grow your business']) {
      await expect(page.getByRole('heading', { level: 3, name: t, exact: true })).toBeVisible();
    }
    await expect(page.getByText(/welcome aboard/i)).toHaveCount(0);
    const glance = page.getByRole('region', { name: 'At a glance' });
    await expect(glance.getByText('Referrals passed in the past 12 months')).toBeVisible();
    await expect(glance.getByText('One-to-ones in the past 12 months')).toBeVisible();
    await expect(glance.getByText('$', { exact: false }).filter({ hasText: /\$\d{2,}/ })).toHaveCount(0);
    // The countdown card and meeting cards send visitors to the invite request, not the login page.
    await expect(page.getByRole('link', { name: /log in to join|Join · members/i })).toHaveCount(0);
    await expect(page.locator('main a[href^="/login?next=/meetings"]')).toHaveCount(0);
    // Section labels are bigger (were 13px).
    const size = await page
      .locator('.eyebrow')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(17);
    // Footer: the wider area, no city list.
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByText('Supporting businesses across the San Francisco Bay Area and Northern California.')).toBeVisible();
    await expect(footer.getByText(/Atherton|Palo Alto/)).toHaveCount(0);
  });

  test('About: founded wording, no COVID paragraph or timeline, new values and metrics, one "Request an invite" button', async ({ page }) => {
    await page.goto('/about');
    const main = page.getByRole('main');
    await expect(main.getByText(/was founded in 2016 as part of the San Carlos Chamber of Commerce/)).toBeVisible();
    await expect(main.getByText(/COVID/)).toHaveCount(0);
    await expect(main.getByText('Chamber closes. Members choose to keep going and move to Zoom')).toHaveCount(0);
    await expect(main.getByText('People do business with others they know, like and trust.')).toBeVisible();
    await expect(main.getByText('Members help each other grow their business by referral.')).toBeVisible();
    await expect(main.getByText(/ideal prospects, and to deepen relationships/)).toBeVisible();
    await expect(main.getByText(/When a referral turns into closed business, it's counted/)).toBeVisible();
    await expect(main.getByText(/paid work|amazing things happen/)).toHaveCount(0);
    await expect(main.getByRole('link', { name: 'Visit a meeting' })).toHaveCount(0);
    await expect(main.getByRole('link', { name: 'Request an invite' })).toHaveAttribute('href', '/visit#request');
    await expectAccessible(page);
  });

  test('Meetings (public): no hashtag topics, no "Want to speak", no calendar subscription, invite instead of login', async ({ page }) => {
    await page.goto('/group-meetings');
    const main = page.getByRole('main');
    await expect(main.getByText('Popular topics')).toHaveCount(0);
    await expect(main.getByText(/^#/)).toHaveCount(0);
    await expect(main.getByText('Want to speak at a meeting?')).toHaveCount(0);
    await expect(main.getByRole('link', { name: 'Subscribe to the calendar' })).toHaveCount(0);
    await expect(main.getByText('Presentations at every meeting')).toBeVisible();
    await expect(main.getByRole('link', { name: 'Request an invite' }).first()).toHaveAttribute('href', '/visit#request');
  });
});

test.describe('members and admins', () => {
  test('members still see "Want to speak" and the calendar subscription on Meetings', async ({ page }) => {
    await login(page, users.member);
    await page.goto('/group-meetings');
    await expect(page.getByText('Want to speak at a meeting?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Subscribe to the calendar' })).toBeVisible();
  });

  test('Visitors brought: a member logs a guest who came to a past meeting and sees them listed', async ({ page }) => {
    await login(page, users.member);
    await page.goto('/visitors-brought');
    await expect(page.getByRole('heading', { level: 1, name: 'Visitors brought' })).toBeVisible();
    const form = page.getByRole('form', { name: 'Log a visitor you brought' });
    const email = `visitor.${Date.now()}@example.test`;
    await form.getByLabel('Visitor first name').fill('Vera');
    await form.getByLabel('Visitor last name').fill('Visitor');
    await form.getByLabel('Visitor email').fill(email);
    await form.getByLabel('Visitor business name').fill('Vera Bakes');
    await form.getByRole('button', { name: 'Log visitor' }).click();
    await expect(page.getByText('Vera Visitor is logged as your visitor. Thank you!')).toBeVisible();
    await expect(page.getByRole('region', { name: /My visitors/ }).getByText('Vera Visitor')).toBeVisible();
    const rows = await db<{ status: string; referrer_id: string | null; meeting_id: string | null }>(
      `guest_requests?select=status,referrer_id,meeting_id&email=eq.${encodeURIComponent(email)}`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'visited' });
    expect(rows[0]?.referrer_id).toBeTruthy();
    expect(rows[0]?.meeting_id).toBeTruthy();
    // Linked from Report Activity.
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Report Activity' }).click();
    await expect(page.getByRole('link', { name: 'Visitors brought' })).toBeVisible();
    await expectAccessible(page);
    // Clean up: the visitor would otherwise add a BARP Champion point that other tests count.
    const key = await serviceKey();
    await fetch(`${STACK}/rest/v1/guest_requests?email=eq.${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
  });

  test('directory lists the most active first by default', async ({ page }) => {
    await page.goto('/members');
    await expect(page.getByLabel('Sort')).toHaveValue('active');
    await expect(page.getByLabel('Sort').locator('option')).toHaveText(['Most active first', 'Business name A–Z', 'Newest members']);
  });

  test('Member stats: find a member, closed business hidden until ticked; menu has Member activity next to Member stats', async ({ page }) => {
    await login(page, users.admin, undefined, '/admin/stats?period=all');
    const nav = page.getByRole('navigation', { name: 'Admin sections' });
    await expect(nav.getByRole('link', { name: 'Member stats' })).toBeVisible();
    const labels = (await nav.getByRole('link').allTextContents()).map((l) => l.trim());
    expect(labels[labels.indexOf('Member activity') + 1]).toBe('Member stats');

    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: /Closed business/ })).toHaveCount(0);
    await expect(table.getByRole('columnheader', { name: /Visitors brought/ })).toBeVisible();
    await page.getByLabel('Show closed business (confidential)').check();
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(table.getByRole('columnheader', { name: /^Closed business/ }).first()).toBeVisible();

    await page.getByLabel('Find a member').fill('zzzz-nobody');
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(page.getByText('No member matches that search')).toBeVisible();
  });
});
