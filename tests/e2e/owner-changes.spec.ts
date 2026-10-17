import { expect, test } from '@playwright/test';
import { db, expectAccessible, login, trackConsole, users } from './support';

// Owner change requests of 2026-10-17.

test.describe('home and header', () => {
  test('visitors: hero has one "Request for an Invite" button and no eyebrow or dues line; header asks for an invite', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('section', { has: page.getByRole('heading', { level: 1 }) });
    await expect(hero.getByText(/Since 2016/)).toHaveCount(0);
    await expect(hero.getByText('Zero membership dues. Participation is what we ask.')).toHaveCount(0);
    await expect(hero.getByRole('link', { name: 'Become a member' })).toHaveCount(0);
    await expect(hero.getByRole('link', { name: 'Visit a meeting free' })).toHaveCount(0);
    await expect(hero.getByRole('link', { name: 'Request for an Invite' })).toHaveAttribute('href', '/visit#request');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Join us' })).toHaveCount(0);
    await header.getByRole('link', { name: 'Request for an Invite' }).click();
    await expect(page).toHaveURL(/\/visit#request$/);
    await expect(page.getByRole('heading', { name: 'Request a guest invite' })).toBeVisible();
  });

  test('members: the hero button is "Invite a friend" and opens the invite card', async ({ page }) => {
    await login(page, users.member);
    await page.goto('/');
    const hero = page.locator('section', { has: page.getByRole('heading', { level: 1 }) });
    await expect(hero.getByRole('link', { name: 'Request for an Invite' })).toHaveCount(0);
    await hero.getByRole('link', { name: 'Invite a friend' }).click();
    await expect(page).toHaveURL(/\/dashboard#invite$/);
    await expect(page.getByRole('region', { name: 'Invite a visitor' })).toBeVisible();
  });

  test('members: "Report Activity" opens a submenu with Referrals and One-on-ones @responsive', async ({ page }) => {
    await login(page, users.member);
    await page.goto('/dashboard');
    if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole('button', { name: 'Menu' }).click();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Referrals', exact: true })).toBeHidden();
    const toggle = nav.getByRole('button', { name: 'Report Activity' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expectAccessible(page);
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    await toggle.click();
    await nav.getByRole('link', { name: 'One-on-ones', exact: true }).click();
    await expect(page).toHaveURL('/one-on-ones');
    if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole('button', { name: 'Menu' }).click();
    await nav.getByRole('button', { name: 'Report Activity' }).click();
    await expect(nav.getByRole('link', { name: 'One-on-ones', exact: true })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'Referrals', exact: true }).click();
    await expect(page).toHaveURL('/referrals');
  });
});

test.describe('one-on-ones', () => {
  test('the page has a report form and a request form; a requested one-on-one is accepted by the other member', async ({ page }) => {
    const errors = trackConsole(page);
    await login(page, users.member, undefined, '/one-on-ones');
    await expect(page.getByRole('heading', { name: 'Report a one-on-one' })).toBeVisible();
    const form = page.getByRole('form', { name: 'Request a one-on-one' });
    await form.getByRole('button', { name: 'Send request' }).click();
    await expect(form.getByText('Choose who you would like to meet')).toBeVisible();
    await form.getByLabel('Who would you like to meet?').selectOption({ label: 'Riley Second · Second Test Bakery' });
    await form.getByLabel('Message').fill('Coffee next week to swap referral ideas?');
    await form.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText('Request sent.', { exact: false })).toBeVisible();
    await expect(page.getByRole('region', { name: 'My requests' }).getByText(/You asked Riley Second/)).toBeVisible();
    await expectAccessible(page);
    expect(errors).toEqual([]);

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
    await login(page, users.member2, undefined, '/one-on-ones');
    const incoming = page.getByRole('region', { name: 'One-on-one requests for you' });
    const item = incoming.getByRole('listitem').filter({ hasText: 'Morgan Member' }).first();
    await expect(item.getByText('“Coffee next week to swap referral ideas?”')).toBeVisible();
    await item.getByRole('button', { name: 'Accept' }).click();
    await expect(page.getByRole('region', { name: 'My requests' }).getByText(/ACCEPTED/).first()).toBeVisible();
    const rows = await db<{ status: string }>('one_on_one_requests?select=status&message=eq.Coffee%20next%20week%20to%20swap%20referral%20ideas%3F');
    expect(rows.map((r) => r.status)).toContain('accepted');
  });
});

test.describe('cancelled meetings and slides', () => {
  test('an admin cancels a meeting for a holiday: it stays on the schedule marked cancelled; then restores it', async ({ page }) => {
    await login(page, users.admin, undefined, '/admin');
    const schedule = page.getByRole('region', { name: 'Meeting schedule' });
    const form = schedule.getByRole('form', { name: /^Cancel / }).nth(1);
    const label = (await form.getAttribute('aria-label'))?.replace(/^Cancel /, '') ?? '';
    await form.getByRole('button', { name: 'Cancel meeting' }).click();
    await expect(form.getByText('Give a short reason')).toBeVisible();
    await form.getByLabel('Reason').fill('Thanksgiving holiday');
    await form.getByRole('button', { name: 'Cancel meeting' }).click();
    const restore = schedule.getByRole('form', { name: `Restore ${label}` });
    await expect(restore.getByText('Cancelled: Thanksgiving holiday')).toBeVisible();

    await page.goto('/group-meetings');
    const card = page.getByRole('article').filter({ hasText: label });
    await expect(card.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(card.getByText('No meeting this week: Thanksgiving holiday.')).toBeVisible();
    await expect(card.getByRole('link', { name: 'Join on Zoom' })).toHaveCount(0);
    await expectAccessible(page);

    await page.goto('/admin');
    await schedule.getByRole('form', { name: `Restore ${label}` }).getByRole('button', { name: 'Restore meeting' }).click();
    await expect(schedule.getByRole('form', { name: `Cancel ${label}` })).toBeVisible();
  });

  test('meeting pages describe the 5- and 10-minute presentations', async ({ page }) => {
    await page.goto('/group-meetings');
    await expect(page.getByText('One member shares something they’ve learned — a helpful insight, tool, or business tip.').first()).toBeVisible();
    await page.getByRole('link', { name: /^View details for Bay Area Referral Partners Meeting/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Presentations' })).toBeVisible();
    await expect(page.getByText('5-Minute Member Education')).toBeVisible();
    await expect(page.getByText('One member dives deeper into their business to teach the group how to refer them better.')).toBeVisible();
  });

  test('slides: white background, the agenda slides, presentation descriptions, and extra text added by an admin', async ({ page }) => {
    await login(page, users.admin, undefined, '/present/next');
    const deck = page.getByRole('region', { name: 'Meeting slides' });
    const stage = deck.locator('[aria-roledescription="slide"]');
    expect(await stage.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    const title = deck.getByRole('heading', { name: /Welcome to Bay Area Referral Partners/ });
    expect(await title.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(0, 128, 128)');

    const seen: string[] = [];
    for (let i = 0; i < 16; i++) {
      seen.push(((await deck.getByRole('group').filter({ visible: true }).getAttribute('aria-label')) ?? '').replace(/ \(slide.*$/, ''));
      await page.keyboard.press('ArrowRight');
    }
    for (const s of [
      'Open networking (8:15 – 8:30 AM)',
      'Introductions & leadership team',
      'Roundtable check-in (30-second spiel & Win of the Week)',
      'Activity numbers',
      '5-Minute Member Education',
      '10-Minute Presentation',
      'Events & announcements',
    ])
      expect(seen).toContain(s);

    await deck.getByRole('link', { name: 'Customize slides' }).click();
    await page.getByLabel('Extra text for “Roundtable check-in (30-second spiel & Win of the Week)”').fill('Shout-out: welcome back, Jeanie!');
    await page.getByRole('button', { name: 'Save slides' }).click();
    await expect(page.getByText('Slides saved.')).toBeVisible();
    await page.getByRole('link', { name: 'Open the slides' }).click();
    for (let i = 0; i < 16; i++) {
      if (await deck.getByRole('heading', { name: 'Your 30-second spiel & Win of the Week' }).isVisible()) break;
      await page.keyboard.press('ArrowRight');
    }
    await expect(deck.getByText('Shout-out: welcome back, Jeanie!')).toBeVisible();
    await expect(deck.getByText(/Everyone gets a moment to share their 30-second spiel/)).toBeVisible();
    await expectAccessible(page);

    await deck.getByRole('link', { name: 'Customize slides' }).click();
    await page.getByRole('button', { name: 'Reset to the standard agenda' }).click();
    await expect(page.getByText('Back to the standard agenda.')).toBeVisible();
  });
});
