import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { STACK, expectAccessible, login, serviceKey, trackConsole, users } from './support';

// Report Activity → Leaderboard, period filters and month + year on the slides (owner, 2026-11-25). Members pick any
// month, this quarter, this year or all time; the numbers update by themselves as members report. A closed business
// dated earlier this year (like Viv's July deal) counts in the year, not in this month. The Statistics slide shows
// since the last meeting, this month and the year so far; the Leaderboards slides show this month and the year so far.

test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString(36);
const pacific = (o: Intl.DateTimeFormatOptions) => new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', ...o });
const thisMonth = pacific({ month: 'long', year: 'numeric' }); // "November 2026"
const year = pacific({ year: 'numeric' }); // "2026"
const monthNumber = Number(pacific({ month: 'numeric' }));
const janValue = `${year}-01`;

const num = async (l: Locator) => ((await l.count()) ? Number(((await l.first().textContent()) ?? '').replace(/[^0-9]/g, '') || '0') : 0);
/** A group total tile on the dashboard / Leaderboard page. */
const tile = (page: Page, label: string) =>
  page
    .locator('dl[aria-label^="Group totals"] > div')
    .filter({ has: page.locator('dt', { hasText: new RegExp(`^${label.replace(/[()$]/g, '\\$&')}$`) }) })
    .locator('dd');
const leader = (page: Page, board: string, who: string) =>
  page
    .getByRole('list', { name: `${board} leaders` })
    .locator('li', { hasText: who })
    .locator('strong');
async function mark(page: Page) {
  await page.evaluate(() => ((window as unknown as { __mark: number }).__mark = 1));
}
async function stillSamePage(page: Page) {
  expect(await page.evaluate(() => (window as unknown as { __mark?: number }).__mark)).toBe(1);
}
async function session(browser: Browser, email: string, path: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, email, undefined, path);
  await page.goto(path);
  return { ctx, page };
}
/** The live connection is up (Realtime on the local stack). */
const live = (page: Page) => expect(page.locator('[data-live-activity="live"]').first()).toBeAttached({ timeout: 20_000 });

test.afterAll(async () => {
  const key = await serviceKey();
  await fetch(`${STACK}/rest/v1/referrals?contact_name=ilike.*${stamp}*`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
});

test('Report Activity has "Leaderboard"; the page shows this month by default and passes axe @responsive', async ({ page }) => {
  const errors = trackConsole(page);
  await login(page, users.member);
  if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole('button', { name: 'Menu' }).click();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('button', { name: 'Report Activity' }).click();
  await nav.getByRole('link', { name: 'Leaderboard', exact: true }).click();
  await expect(page).toHaveURL('/leaderboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Leaderboard' })).toBeVisible();
  await expect(page.getByLabel('Show numbers for')).toHaveValue(new RegExp(`^${year}-\\d{2}$`));
  await expect(page.getByLabel('Show numbers for').locator('option:checked')).toHaveText(`${thisMonth} (this month)`);
  await expect(page.getByRole('heading', { name: `Group totals: ${thisMonth}` })).toBeVisible();
  await expect(page.getByRole('heading', { name: `Top members: ${thisMonth}` })).toBeVisible();
  // Closed business: a group total only, never a per-member list (owner meeting 2026-10-30).
  await expect(tile(page, 'Closed business')).toBeVisible();
  await expect(page.getByRole('list', { name: /Closed business leaders/ })).toHaveCount(0);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('signed-out visitors are sent to log in', async ({ page }) => {
  await page.goto('/leaderboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fleaderboard/);
});

test('the period filter changes the numbers in place: a past month, this year, all time', async ({ page }) => {
  await login(page, users.member, undefined, '/leaderboard');
  await page.goto('/leaderboard');
  await mark(page);
  const picker = page.getByLabel('Show numbers for');
  await picker.selectOption('year');
  await expect(page).toHaveURL(/\?p=year$/);
  await expect(page.getByRole('heading', { name: `Group totals: ${year} so far` })).toBeVisible();
  await expect(picker).toBeFocused();
  await picker.selectOption('all');
  await expect(page.getByRole('heading', { name: 'Group totals: All time' })).toBeVisible();
  await picker.selectOption(janValue);
  await expect(page.getByRole('heading', { name: `Group totals: January ${year}` })).toBeVisible();
  await expect(page.getByText(`Jan 1, ${year} – Jan 31, ${year} · Pacific time`)).toBeVisible();
  // Back to this month: no parameter in the address.
  await picker.selectOption({ label: `${thisMonth} (this month)` });
  await expect(page).toHaveURL('/leaderboard');
  await stillSamePage(page);
  // A future or nonsense month in the address shows this month.
  await page.goto('/leaderboard?p=2099-01');
  await expect(page.getByRole('heading', { name: `Group totals: ${thisMonth}` })).toBeVisible();
});

test('dashboard: the group totals box has the same filter and links to the Leaderboard', async ({ page }) => {
  await login(page, users.member);
  const box = page.locator('section[aria-labelledby="group-h"]');
  await expect(box.getByRole('heading', { name: 'Group this month' })).toBeVisible();
  await box.getByLabel('Period').selectOption('all');
  await expect(page).toHaveURL(/gt=all/);
  await expect(box.getByRole('heading', { name: 'Group totals: All time' })).toBeVisible();
  await box.getByRole('link', { name: /Full leaderboard and totals/ }).click();
  await expect(page).toHaveURL('/leaderboard');
});

test('live: a closed business dated earlier this year counts in the year (page and slides), not in this month', async ({ browser }) => {
  test.skip(monthNumber === 1, 'needs a month earlier this year');
  const watcher = await session(browser, users.member2, '/leaderboard');
  const monthPage = watcher.page;
  const yearPage = await watcher.ctx.newPage();
  await yearPage.goto('/leaderboard?p=year');
  const deck = await watcher.ctx.newPage();
  await deck.goto('/present/next');
  for (const p of [monthPage, yearPage, deck]) {
    await live(p);
    await mark(p);
  }
  const statsGroup = deck.locator('[role="group"][aria-label^="Statistics (slide "]');
  // The tile whose (hidden) label is exactly "Closed business" in a row ("This month · …", "Year so far · …").
  const slideClosed = (row: string) =>
    statsGroup
      .locator(`ul[aria-label^="${row}"] li`)
      .filter({ has: deck.locator('span.sr-only', { hasText: /^Closed business$/ }) })
      .locator('span.font-display');

  const before = {
    monthClosed: await num(tile(monthPage, 'Closed business')),
    monthRefs: await num(tile(monthPage, 'Referrals')),
    yearClosed: await num(tile(yearPage, 'Closed business')),
    yearAmount: await num(tile(yearPage, 'Closed business ($)')),
    yearRefsMorgan: await num(leader(yearPage, 'Referrals', 'Morgan Member')),
    slideMonth: await num(slideClosed('This month')),
    slideYear: await num(slideClosed('Year so far')),
  };

  const member = await session(browser, users.member, '/closed-business');
  const form = member.page.getByRole('form', { name: 'File a closed business' });
  await form.getByLabel('Referred to member').selectOption({ label: 'Riley Second · Second Test Bakery' });
  await form.getByLabel('Name of referral').fill(`January deal ${stamp}`);
  await form.getByLabel('Value of the business ($)').fill('1,234');
  await form.getByLabel('Date the business closed').fill(`${year}-01-15`);
  await form.getByRole('button', { name: 'File closed business' }).click();
  await expect(member.page.getByText('Closed business filed.')).toBeVisible();

  // The year view and the slide's "Year so far" row update by themselves…
  await expect(tile(yearPage, 'Closed business')).toHaveText(String(before.yearClosed + 1));
  await expect(tile(yearPage, 'Closed business ($)')).toHaveText(`$${(before.yearAmount + 1234).toLocaleString('en-US')}`);
  await expect(leader(yearPage, 'Referrals', 'Morgan Member')).toHaveText(String(before.yearRefsMorgan + 1));
  await expect(slideClosed('Year so far')).toHaveText(String(before.slideYear + 1));
  // …while this month's numbers stay as they were (it closed in January).
  await expect(tile(monthPage, 'Closed business')).toHaveText(String(before.monthClosed));
  await expect(tile(monthPage, 'Referrals')).toHaveText(String(before.monthRefs));
  await expect(slideClosed('This month')).toHaveText(String(before.slideMonth));
  // Picking January shows it there.
  await monthPage.getByLabel('Show numbers for').selectOption(janValue);
  await expect(tile(monthPage, 'Closed business')).not.toHaveText('0');

  // A referral filed today shows in this month's leaderboard at once.
  await monthPage.getByLabel('Show numbers for').selectOption({ label: `${thisMonth} (this month)` });
  await expect(monthPage.getByRole('heading', { name: `Group totals: ${thisMonth}` })).toBeVisible();
  const refsNow = await num(tile(monthPage, 'Referrals'));
  await member.page.goto('/referrals');
  const ref = member.page.locator('form[aria-labelledby="send-ref-h"]');
  await ref.getByLabel('Refer to member').selectOption({ label: 'Riley Second · Second Test Bakery' });
  await ref.getByLabel('Prospect name').fill(`Today prospect ${stamp}`);
  await ref.getByRole('button', { name: 'Send referral slip' }).click();
  await expect(member.page.getByText('Referral slip sent.')).toBeVisible();
  await expect(tile(monthPage, 'Referrals')).toHaveText(String(refsNow + 1));
  await expect(leader(monthPage, 'Referrals', 'Morgan Member')).toBeVisible();

  for (const p of [monthPage, yearPage, deck]) await stillSamePage(p);
  await Promise.all([watcher.ctx.close(), member.ctx.close()]);
});

test('slides: Statistics has three rows of tiles; Leaderboards has a slide for this month and one for the year', async ({ page }) => {
  await login(page, users.member, undefined, '/present/next');
  const stats = page.locator('[role="group"][aria-label^="Statistics (slide "]');
  await expect(stats.locator('ul[aria-label]')).toHaveCount(3);
  await expect(stats.locator('ul[aria-label="Since the last meeting"] li')).toHaveCount(4);
  await expect(stats.locator(`ul[aria-label="This month · ${thisMonth}"] li`)).toHaveCount(4);
  await expect(stats.locator(`ul[aria-label="Year so far · ${year}"] li`)).toHaveCount(4);
  await expect(page.locator('[role="group"][aria-label^="Leaderboards (this month) (slide "]').getByText(`This month · ${thisMonth}`)).toBeAttached();
  await expect(page.locator('[role="group"][aria-label^="Leaderboards (year so far) (slide "]').getByText(`Year so far · ${year}`)).toBeAttached();
});
