import { expect, test, type Page } from '@playwright/test';
import { STACK, db, expectAccessible, login, serviceKey, users } from './support';

// Owner 2026-10-30: members get their own version of the guest invite form ("Want to Invite A Guest?"), on an
// "Invite A Guest" tab beside Support, on the Visit page when signed in, and in a pop-up from the dashboard's
// "Invite a visitor" card. "Invited by" is the signed-in member, filled in automatically.

const BREVO = 'http://127.0.0.1:54327';
type Sent = { subject: string; textContent: string };

async function emailsTo(to: string, subject: RegExp, timeoutMs = 10_000): Promise<Sent[]> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const all = (await (await fetch(`${BREVO}/emails?to=${encodeURIComponent(to)}`)).json()) as Sent[];
    const hits = all.filter((e) => subject.test(e.subject));
    if (hits.length || Date.now() > end) return hits;
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function memberId(): Promise<string> {
  const [me] = await db<{ id: string }>(`profiles?select=id&first_name=eq.Morgan&last_name=eq.Member`);
  return me!.id;
}

async function fillGuest(scope: Page | ReturnType<Page['getByRole']>, g: { first: string; last: string; email: string; about: string }) {
  await scope.getByLabel('Guest first name').fill(g.first);
  await scope.getByLabel('Guest last name').fill(g.last);
  await scope.getByLabel('Guest email').fill(g.email);
  await scope.getByLabel('Guest phone').fill('650-555-0177');
  await scope.getByLabel('Guest business name').fill(`${g.last} Co`);
  await scope.getByLabel("Tell us about your guest's business").fill(g.about);
}

test.describe('members invite a guest', () => {
  test('"Invite A Guest" tab beside Support opens the members\' form; the request is credited to the member @responsive', async ({ page }) => {
    await login(page, users.member);
    // On phones the menu is behind the Menu button.
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    if (await menu.isVisible()) await menu.click();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Support' })).toBeVisible();
    const labels = (await nav.getByRole('link').allTextContents()).map((t) => t.trim());
    expect(labels.indexOf('Invite A Guest')).toBe(labels.indexOf('Support') - 1);
    await nav.getByRole('link', { name: 'Invite A Guest' }).click();
    await expect(page).toHaveURL(/\/invite-guest$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Want to Invite A Guest?' })).toBeVisible();
    await expect(page.getByText('Fill out the form for your guest.')).toBeVisible();
    await expect(page.getByLabel('Invited by')).toHaveValue('Morgan Member');
    await expect(page.getByLabel('Invited by')).not.toBeEditable();
    await expect(page.getByLabel('Who invited you?')).toHaveCount(0);
    await expectAccessible(page);
  });

  test('"Invite A Guest" and Support stay side by side when the menu wraps (laptop width, admin)', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await login(page, users.admin);
    const nav = page.getByRole('navigation', { name: 'Main' });
    const invite = (await nav.getByRole('link', { name: 'Invite A Guest' }).boundingBox())!;
    const support = (await nav.getByRole('link', { name: 'Support' }).boundingBox())!;
    expect(Math.round(support.y)).toBe(Math.round(invite.y));
    expect(support.x).toBeGreaterThan(invite.x);
  });

  test('members: a Home tab comes first, before Dashboard, and goes to the same page as the logo', async ({ page }) => {
    await login(page, users.member);
    const nav = page.getByRole('navigation', { name: 'Main' });
    const labels = (await nav.getByRole('link').allTextContents()).map((t) => t.trim());
    expect(labels.slice(0, 2)).toEqual(['Home', 'Dashboard']);
    const logoHref = await page.getByRole('link', { name: /, home$/ }).getAttribute('href');
    await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', logoHref!);
    await nav.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('members: account links on top (name, Admin, My profile, Log out), tabs evenly spread on a row of their own (owner, 2026-10-30)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, users.admin);
    const header = page.locator('header');
    const nav = page.getByRole('navigation', { name: 'Main' });
    expect((await nav.getByRole('link').allTextContents()).map((t) => t.trim())).not.toContain('My profile');
    const top = (await header.getByRole('link', { name: 'My profile' }).boundingBox())!;
    const logout = (await header.getByRole('button', { name: 'Log out' }).boundingBox())!;
    const admin = (await header.getByRole('button', { name: 'Admin', exact: true }).boundingBox())!;
    expect(Math.round(top.y)).toBe(Math.round(logout.y));
    expect(Math.round(admin.y)).toBe(Math.round(top.y));
    expect(admin.x).toBeLessThan(top.x);
    expect(top.x).toBeLessThan(logout.x);
    // Every tab on one row, below the account links.
    const tabs = await nav.locator('a:visible, button:visible').all();
    const ys = new Set<number>();
    for (const t of tabs) ys.add(Math.round((await t.boundingBox())!.y));
    expect(ys.size).toBe(1);
    expect([...ys][0]!).toBeGreaterThan(top.y + top.height);
    await header.getByRole('link', { name: 'My profile' }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test('admins: the header Admin dropdown lists every admin section, Meeting slides right after Overview (owner, 2026-10-30)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, users.admin);
    const header = page.locator('header');
    const toggle = header.getByRole('button', { name: 'Admin', exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = header.getByRole('list', { name: 'Admin sections' });
    await expect(menu.getByRole('link')).toHaveText([
      'Overview',
      'Meeting slides',
      'Members',
      'Meetings',
      'Attendance',
      'Member activity',
      'BARP Champion',
      'Member stats',
      'Management',
      'Member recap',
      'Management recap',
      'Presentation materials',
      'Gallery',
      'Change history',
    ]);
    await expectAccessible(page);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await menu.getByRole('link', { name: 'Members' }).click();
    await expect(page).toHaveURL(/\/admin\/members$/);
    // The admin tabs on the page use the same order.
    const tabs = page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link');
    await expect(tabs.nth(0)).toHaveText('Overview');
    await expect(tabs.nth(1)).toHaveText('Meeting slides');
  });

  test('members who are not admins have no Admin menu', async ({ page }) => {
    await login(page, users.member);
    await expect(page.locator('header').getByRole('button', { name: 'Admin', exact: true })).toHaveCount(0);
  });

  test("the header shows the member's profile photo in the round icon, initials when there is none (owner, 2026-10-30)", async ({ page }) => {
    const key = await serviceKey();
    const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    const [me] = await db<{ id: string; avatar_path: string | null }>(`profiles?select=id,avatar_path&first_name=eq.Morgan&last_name=eq.Member`);
    await login(page, users.member);
    const header = page.locator('header');
    await expect(header.getByText('MM', { exact: true })).toBeVisible();
    await fetch(`${STACK}/rest/v1/profiles?id=eq.${me!.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ avatar_path: '/members/barastone.webp' }) });
    try {
      await page.reload();
      await expect(header.locator('img[src*="barastone"]')).toHaveCount(1);
      await expect(header.getByText('MM', { exact: true })).toHaveCount(0);
    } finally {
      await fetch(`${STACK}/rest/v1/profiles?id=eq.${me!.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ avatar_path: me!.avatar_path }) });
    }
  });

  test('support staff ("Support Team") have no "How to refer me" on their profile; members do (owner, 2026-10-30)', async ({ page }) => {
    const key = await serviceKey();
    const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    const [me] = await db<{ id: string; business_name: string | null }>(`profiles?select=id,business_name&first_name=eq.Riley&last_name=eq.Second`);
    await login(page, users.member2, undefined, '/profile');
    await expect(page.getByRole('heading', { name: 'How to refer me' })).toBeVisible();
    await fetch(`${STACK}/rest/v1/profiles?id=eq.${me!.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ business_name: 'Support Team' }) });
    try {
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: 'Riley Second' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'How to refer me' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath('support-profile.png'), fullPage: true });
    } finally {
      await fetch(`${STACK}/rest/v1/profiles?id=eq.${me!.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ business_name: me!.business_name }) });
    }
  });

  test('the form checks the guest details, saves them for the member and emails the guest and admins (not the member)', async ({ page }) => {
    const email = `member.guest.${Date.now()}@example.org`;
    const last = `Invitee${String(Date.now()).slice(-6)}`;
    await login(page, users.member, undefined, '/invite-guest');
    await page.getByRole('button', { name: 'Send the invitation request' }).click();
    await expect(page.getByText('Guest first name is required')).toBeVisible();
    await expect(page.getByText("Tell us about your guest's business is required")).toBeVisible();
    await expect(page.getByLabel('Guest first name')).toBeFocused();

    await fillGuest(page, { first: 'Gwen', last, email, about: 'Bookkeeping and payroll for restaurants.' });
    await page.getByRole('button', { name: 'Send the invitation request' }).click();
    await expect(page.getByText('Invitation request sent for Gwen!')).toBeVisible();

    const rows = await db<Record<string, string>>(
      `guest_requests?email=eq.${encodeURIComponent(email)}&select=referrer_id,invited_by_text,business_description,phone,status`,
    );
    expect(rows).toEqual([
      {
        referrer_id: await memberId(),
        invited_by_text: 'Morgan Member',
        business_description: 'Bookkeeping and payroll for restaurants.',
        phone: '650-555-0177',
        status: 'requested',
      },
    ]);
    const thanks = await emailsTo(email, /invited you to visit/);
    expect(thanks).toHaveLength(1);
    expect(thanks[0]!.textContent).toContain('Morgan Member invited you to visit');
    expect(await emailsTo(users.admin, new RegExp(`New guest request: Gwen ${last}`))).toHaveLength(1);
    // The member filled it in themselves, so no "your guest asked to visit" notice.
    expect(await emailsTo(users.member, new RegExp(`Your guest Gwen ${last}`), 1500)).toHaveLength(0);

    await page.getByRole('button', { name: 'Invite another guest' }).click();
    await expect(page.getByLabel('Guest first name')).toHaveValue('');
  });

  test("the Visit page shows the members' form to members and keeps the public form for visitors", async ({ page, browser }) => {
    const visitor = await browser.newPage();
    await visitor.goto('/visit');
    await expect(visitor.getByRole('heading', { name: 'Request a guest invite' })).toBeVisible();
    await expect(visitor.getByLabel('Who invited you?')).toBeVisible();
    await expect(visitor.getByLabel('Tell us about your business')).toBeVisible();
    await visitor.close();

    await login(page, users.member, undefined, '/visit');
    await expect(page.getByRole('heading', { name: 'Want to Invite A Guest?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Request a guest invite' })).toHaveCount(0);
    await expect(page.getByLabel('Who invited you?')).toHaveCount(0);
    await expect(page.getByLabel('Invited by')).toHaveValue('Morgan Member');
    await expect(page.getByRole('link', { name: 'Invite A Guest' }).first()).toBeVisible();
  });

  test('visitors who open the Invite A Guest page are asked to log in', async ({ page }) => {
    await page.goto('/invite-guest');
    await expect(page).toHaveURL(/\/login\?next=%2Finvite-guest/);
  });

  test('dashboard: "Invite A Guest" beside "Text an Invite" opens a pop-up form; the guest shows in recent guests @responsive', async ({ page }) => {
    const stamp = Date.now();
    const email = `dialog.guest.${stamp}@example.org`;
    const last = `Dialog${String(stamp).slice(-6)}`;
    await login(page, users.member);
    const card = page.getByRole('region', { name: 'Invite a visitor' });
    await expect(card.getByRole('link', { name: 'Text an Invite' })).toBeVisible();
    const buttons = card.locator('a.btn, button.btn');
    const names = (await buttons.allTextContents()).map((t) => t.trim());
    expect(names.indexOf('Invite A Guest')).toBe(names.indexOf('Text an Invite') + 1);
    // Owner 2026-10-30: the three buttons sit on one line.
    const tops = await Promise.all(
      [
        card.getByRole('link', { name: 'Email an Invite' }),
        card.getByRole('link', { name: 'Text an Invite' }),
        card.getByRole('button', { name: 'Invite A Guest' }),
      ].map(async (b) => Math.round((await b.boundingBox())!.y)),
    );
    expect(new Set(tops).size).toBe(1);

    await card.getByRole('button', { name: 'Invite A Guest' }).click();
    const dialog = page.getByRole('dialog', { name: 'Want to Invite A Guest?' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(dialog.getByText('Fill out the form for your guest.')).toBeVisible();
    await expect(dialog.getByLabel('Invited by')).toHaveValue('Morgan Member');
    await expectAccessible(page);
    // Escape closes it; it opens again empty.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await card.getByRole('button', { name: 'Invite A Guest' }).click();
    await expect(dialog).toBeVisible();

    await fillGuest(dialog, { first: 'Dora', last, email, about: 'Wedding and event photography.' });
    await dialog.getByRole('button', { name: 'Send the invitation request' }).click();
    await expect(dialog.getByText('Invitation request sent for Dora!')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await expect(card.getByText(`Dora ${last}`)).toBeVisible();
    const rows = await db<{ referrer_id: string }>(`guest_requests?email=eq.${encodeURIComponent(email)}&select=referrer_id`);
    expect(rows).toEqual([{ referrer_id: await memberId() }]);
  });
});
