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

  test('members: the hero button is "Invite a Guest" and opens the members\' guest form; the dashboard invite card keeps email and text', async ({ page }) => {
    await login(page, users.member);
    await page.goto('/');
    const hero = page.locator('section', { has: page.getByRole('heading', { level: 1 }) });
    await expect(hero.getByRole('link', { name: 'Request for an Invite' })).toHaveCount(0);
    // Owner 2026-10-30: "Invite a friend" renamed "Invite a Guest"; it opens the Invite a Guest page.
    await hero.getByRole('link', { name: 'Invite a Guest' }).click();
    await expect(page).toHaveURL(/\/invite-guest$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Want to Invite a Guest?' })).toBeVisible();
    await page.goto('/dashboard#invite');
    const invite = page.getByRole('region', { name: 'Invite a visitor' });
    await expect(invite).toBeVisible();
    // Owner 2026-10-27: email and text only, no LinkedIn share.
    await expect(invite.getByRole('link', { name: 'Email an invite' })).toBeVisible();
    await expect(invite.getByRole('link', { name: 'Text an invite' })).toBeVisible();
    await expect(invite.getByRole('link', { name: /LinkedIn/ })).toHaveCount(0);
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
    await expect(
      page
        .getByRole('region', { name: 'My requests' })
        .getByText(/ACCEPTED/)
        .first(),
    ).toBeVisible();
    const rows = await db<{ status: string }>('one_on_one_requests?select=status&message=eq.Coffee%20next%20week%20to%20swap%20referral%20ideas%3F');
    expect(rows.map((r) => r.status)).toContain('accepted');
  });
});

test.describe('cancelled meetings and slides', () => {
  test('an admin cancels a meeting for a holiday: it stays on the admin schedule marked cancelled but leaves the website; then restores it', async ({
    page,
  }) => {
    await login(page, users.admin, undefined, '/admin');
    const schedule = page.getByRole('region', { name: 'Meeting schedule' });
    const form = schedule.getByRole('form', { name: /^Cancel / }).nth(1);
    const label = (await form.getAttribute('aria-label'))?.replace(/^Cancel /, '') ?? '';
    await page.goto('/group-meetings');
    await expect(page.getByRole('article').filter({ hasText: label })).toHaveCount(1);
    await page.goto('/admin');
    await form.getByRole('button', { name: 'Cancel meeting' }).click();
    await expect(form.getByText('Give a short reason')).toBeVisible();
    await form.getByLabel('Reason').fill('Thanksgiving holiday');
    await form.getByRole('button', { name: 'Cancel meeting' }).click();
    const restore = schedule.getByRole('form', { name: `Restore ${label}` });
    await expect(restore.getByText('Cancelled: Thanksgiving holiday')).toBeVisible();

    // Owner 2026-10-27: cancelled meetings are not displayed at all (list, month view, home).
    await page.goto('/group-meetings');
    await expect(page.getByRole('article').filter({ hasText: label })).toHaveCount(0);
    await expect(page.getByText('Thanksgiving holiday')).toHaveCount(0);
    await expectAccessible(page);

    await page.goto('/admin');
    await schedule
      .getByRole('form', { name: `Restore ${label}` })
      .getByRole('button', { name: 'Restore meeting' })
      .click();
    await expect(schedule.getByRole('form', { name: `Cancel ${label}` })).toBeVisible();
    await page.goto('/group-meetings');
    await expect(page.getByRole('article').filter({ hasText: label })).toHaveCount(1);
  });

  test('an admin hides an upcoming meeting from the website and shows it again (owner 2026-10-27)', async ({ page }) => {
    await login(page, users.admin, undefined, '/admin');
    const schedule = page.getByRole('region', { name: 'Meeting schedule' });
    const hide = schedule.getByRole('form', { name: /^Hide / }).nth(2);
    const label = (await hide.getAttribute('aria-label'))?.replace(/^Hide /, '') ?? '';
    await hide.getByRole('button', { name: 'Hide from website' }).click();
    const show = schedule.getByRole('form', { name: `Show ${label}` });
    await expect(show.getByText('Hidden', { exact: true })).toBeVisible();
    await expect(show.getByText('Meeting hidden from the website.')).toBeVisible();

    // The meeting is not on the public pages, and its page is 404 for visitors and members.
    const slug = (await db<{ slug: string }>(`meetings?title=eq.${encodeURIComponent(label)}&hidden=eq.true&select=slug`))[0]?.slug;
    expect(slug).toBeTruthy();
    await page.goto('/group-meetings');
    await expect(page.getByRole('article').filter({ hasText: label })).toHaveCount(0);
    await page.goto('/meetings');
    await expect(page.getByRole('heading', { name: label })).toHaveCount(0);
    await page.context().clearCookies();
    await page.goto(`/events/${slug}`);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();

    await login(page, users.admin, undefined, '/admin');
    await schedule
      .getByRole('form', { name: `Show ${label}` })
      .getByRole('button', { name: 'Show on website' })
      .click();
    await expect(schedule.getByRole('form', { name: `Hide ${label}` })).toBeVisible();
    await page.goto('/group-meetings');
    await expect(page.getByRole('article').filter({ hasText: label })).toHaveCount(1);
  });

  test('meeting pages describe the 5- and 10-minute presentations', async ({ page }) => {
    await page.goto('/group-meetings');
    await expect(page.getByText('One member shares something they’ve learned — a helpful insight, tool, or business tip.').first()).toBeVisible();
    await page
      .getByRole('link', { name: /^View details for Bay Area Referral Partners Meeting/ })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: 'Presentations' })).toBeVisible();
    await expect(page.getByText('5-Minute Member Education')).toBeVisible();
    await expect(page.getByText('One member dives deeper into their business to teach the group how to refer them better.')).toBeVisible();
  });

  test('slides: white background, the agenda slides, presentation descriptions, and extra text added by an admin', async ({ page }) => {
    await login(page, users.admin, undefined, '/present/next');
    const deck = page.getByRole('region', { name: 'Meeting slides' });
    const stage = deck.locator('[aria-roledescription="slide"]');
    expect(await stage.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    // Slide 1 is now just the logo (owner, 2026-10-21), so check the title colour on slide 2.
    await page.keyboard.press('ArrowRight');
    const title = deck.getByRole('heading', { name: 'Welcome', exact: true });
    // Titles are navy from the logo since the 2026-10-22 redesign (were teal).
    expect(await title.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(18, 52, 110)');
    await page.keyboard.press('Home');

    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      seen.push(((await deck.getByRole('group').filter({ visible: true }).getAttribute('aria-label')) ?? '').replace(/ \(slide.*$/, ''));
      await page.keyboard.press('ArrowRight');
    }
    for (const s of [
      'Welcome (open networking)',
      'Meet the Management Team',
      '60-second infomercial and reporting',
      'Statistics',
      '5-minute educational presentation',
      '10-minute presentation',
      'Announcements',
    ])
      expect(seen).toContain(s);

    await deck.getByRole('link', { name: 'Customize slides' }).click();
    await page.getByLabel('Extra text for “8:33 · 60-second infomercial and reporting”').fill('Shout-out: welcome back, Jeanie!');
    await page.getByRole('button', { name: 'Save slides' }).click();
    await expect(page.getByText('Slides saved.')).toBeVisible();
    await page.getByRole('link', { name: 'Open the slides' }).click();
    for (let i = 0; i < 20; i++) {
      if (await deck.getByRole('heading', { name: '60-second infomercial and reporting' }).isVisible()) break;
      await page.keyboard.press('ArrowRight');
    }
    await expect(deck.getByText('Shout-out: welcome back, Jeanie!')).toBeVisible();
    await expect(deck.getByRole('heading', { name: '60-second infomercial and reporting' })).toBeVisible();
    await expectAccessible(page);

    await deck.getByRole('link', { name: 'Customize slides' }).click();
    await page.getByRole('button', { name: 'Reset to the standard agenda' }).click();
    await expect(page.getByText('Back to the standard agenda.')).toBeVisible();
  });
});

test.describe('banners, directory, profile and support (second request of the day)', () => {
  test('home hero: brighter photo, new guest wording and section titles', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('We meet every other Monday at 8:15 AM - 9:30AM on Zoom', { exact: true })).toBeVisible();
    await expect(page.getByText(/Come as a guest up to two times/)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'A system for business growth.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /More than networking/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Meeting Schedules' })).toBeVisible();
  });

  test('page title banners use the bridge photo with a light wash, keeping dark title text @responsive', async ({ page }) => {
    for (const path of ['/about', '/group-meetings', '/members', '/visit']) {
      await page.goto(path);
      const hero = page.locator('section', { has: page.getByRole('heading', { level: 1 }) }).first();
      await expect(hero.locator('img[src*="hero-bridge"]')).toBeAttached();
      const color = await hero.getByRole('heading', { level: 1 }).evaluate((el) => getComputedStyle(el).color);
      expect(color).not.toBe('rgb(255, 255, 255)');
    }
    await expectAccessible(page);
  });

  test('directory cards show a large person photo area (initials when there is no photo)', async ({ page }) => {
    await page.goto('/members?q=Harbor');
    const card = page.getByRole('article').filter({ hasText: 'Avery Lindqvist' });
    const area = card.locator('span.aspect-\\[4\\/3\\]');
    const box = await area.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(180);
    await expect(card.getByText('AL', { exact: true })).toBeVisible();
  });

  test('member profile: bridge photo banner, name in white, no one-on-one or referral buttons', async ({ page }) => {
    await page.goto('/members/harbor-lane-realty');
    const name = page.getByRole('heading', { level: 1, name: 'Avery Lindqvist' });
    expect(await name.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
    await expect(page.locator('img[src*="hero-bridge"]')).toBeAttached();
    await expect(page.getByRole('link', { name: 'Request a one-on-one' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Refer business' })).toHaveCount(0);
    await expectAccessible(page);
  });

  test('support page (members only since 2026-10-23): team, topics, FAQ and a chat button that opens (for now) a coming-soon window', async ({ page }) => {
    await page.goto('/support');
    await expect(page).toHaveURL(/\/login\?next=%2Fsupport/);
    await page.goto('/');
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Support' })).toHaveCount(0);
    await login(page, users.member, undefined, '/support');
    await expect(page).toHaveURL('/support');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page
        .locator('section', { has: page.getByRole('heading', { level: 1 }) })
        .first()
        .locator('img[src*="hero-bridge"]'),
    ).toBeAttached();
    // Photo, name and role for each person, then the team's introduction under the photos (owner, 2026-10-24).
    // Everyone's position is "Support Team" and the photo + name link to their profile (owner, 2026-10-25).
    const team = page.getByRole('region', { name: 'Your support team' });
    await expect(team.getByText('Support Team', { exact: true })).toHaveCount(3);
    for (const [n, file, slug] of [
      ['Cedrick Velasco', 'cedrick-velasco', 'cedrick-admin'],
      ['Shermaine Benolirao', 'shermaine-benolirao', 'shermaine-admin'],
      ['Rachanee Munar', 'rachanee-munar', 'rachanee-admin'],
    ] as const) {
      await expect(team.getByRole('heading', { level: 3, name: n })).toBeVisible();
      const link = team.getByRole('link').filter({ has: page.getByRole('heading', { name: n }) });
      await expect(link).toHaveAttribute('href', `/members/${slug}`);
      const frame = team.getByTestId(`support-photo-${file}`);
      await expect(link.getByTestId(`support-photo-${file}`)).toBeVisible();
      await expect(frame.locator('img')).toHaveAttribute('src', new RegExp(file));
      // Round photos at three quarters of the column width (owner, 2026-10-24).
      await expect(frame).toHaveCSS('border-radius', /^(9999px|50%|3\.35544e\+07px)$/);
      const box = await frame.boundingBox();
      const col = await team.getByRole('listitem').filter({ hasText: n }).boundingBox();
      expect(box && col && Math.abs(box.width / col.width - 0.75)).toBeLessThan(0.02);
      expect(box && Math.abs(box.width - box.height)).toBeLessThan(1);
    }
    await expect(team.getByText(/^We’re happy to be part of the Bay Area Referral Partners community!/)).toBeVisible();
    await expect(team.getByText(/one click at a time!$/)).toBeVisible();
    await expect(team.getByText(/Lorem ipsum/)).toHaveCount(0);
    await page.getByText('How do I change my photo?').click();
    await expect(page.getByText(/open My profile and choose “Change photo”/)).toBeVisible();
    await page.getByRole('button', { name: 'Chat with support' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Live chat is coming soon' });
    await expect(dialog).toBeVisible();
    await expectAccessible(page);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe('fourth request of the day', () => {
  test('home: the countdown card is a light, slightly see-through panel with dark text (also in dark mode)', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      const card = page.getByRole('region', { name: /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/ }).first();
      const bg = await card.evaluate((el) => getComputedStyle(el).backgroundImage);
      // white (rgba 255,255,255 or oklab lightness ~1) at partial opacity
      expect(bg).toMatch(/gradient\(/);
      expect(bg).toMatch(/rgba\(255, 255, 255, 0\.\d+\)|oklab\(0\.99\d* [^)]*\/ 0\.\d+\)/);
      const color = await card.getByRole('heading', { level: 2 }).evaluate((el) => getComputedStyle(el).color);
      expect(color).toBe('rgb(11, 59, 59)');
    }
    await expectAccessible(page);
  });

  test('Support is in the main menu for members too', async ({ page }) => {
    await login(page, users.member);
    await page.goto('/dashboard');
    if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Support', exact: true }).click();
    await expect(page).toHaveURL('/support');
  });

  test('visit page: the invite section describes the group', async ({ page }) => {
    await page.goto('/visit');
    const section = page.getByRole('region', { name: 'Request a guest invite' });
    await expect(section.getByText(/It's one business profession per person\./)).toBeVisible();
    await expect(section.getByText(/We'll send the Zoom link/)).toHaveCount(0);
  });
});
