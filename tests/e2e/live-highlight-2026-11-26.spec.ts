import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { STACK, login, serviceKey, trackConsole, users } from './support';

// Live highlight (owner, 2026-11-26): when a member reports, the changed numbers on open screens (Leaderboard page,
// dashboard box, Statistics and Leaderboards slides) count up and glow in BARP teal with a "+1", and the "Live" line says
// when it last updated. Changing the period filter swaps the numbers without any highlight.

test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString(36);
let n = 0;

async function session(browser: Browser, email: string, path: string, opts: Parameters<Browser['newContext']>[0] = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await login(page, email, undefined, path);
  await page.goto(path);
  return { ctx, page };
}
const live = (page: Page) => expect(page.locator('[data-live-activity="live"]').first()).toBeAttached({ timeout: 20_000 });
const num = async (l: Locator) => Number(((await l.textContent()) ?? '').replace(/[^0-9]/g, '') || '0');

/** A group totals tile (dashboard / Leaderboard page) and its number. */
const totalsTile = (page: Page, label: string) =>
  page.locator('dl[aria-label^="Group totals"] > div.live-tile').filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) });
/** A Statistics slide tile in a row. */
const slideTile = (page: Page, row: string, label: string) =>
  page
    .locator(`[role="group"][aria-label^="Statistics (slide "] ul[aria-label^="${row}"] li.live-tile`)
    .filter({ has: page.locator('span.sr-only', { hasText: new RegExp(`^${label.replace(/[()$]/g, '\\$&')}$`) }) });

async function fileReferral(page: Page, to = 'Riley Second · Second Test Bakery') {
  await page.goto('/referrals');
  const form = page.locator('form[aria-labelledby="send-ref-h"]');
  await form.getByLabel('Refer to member').selectOption({ label: to });
  await form.getByLabel('Prospect name').fill(`Highlight ${stamp} ${++n}`);
  await form.getByRole('button', { name: 'Send referral slip' }).click();
  await expect(page.getByText('Referral slip sent.')).toBeVisible();
}

/** The tile glows in BARP teal (#00c2cb ring) while highlighted. */
async function expectTealGlow(tile: Locator) {
  await expect(tile.locator('[data-live-flash]')).toBeAttached();
  const shadow = await tile.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).toContain('rgb(0, 194, 203)');
}

let watcher: { ctx: BrowserContext; page: Page };
let member: { ctx: BrowserContext; page: Page };

test.beforeAll(async ({ browser }) => {
  watcher = await session(browser, users.member2, '/leaderboard');
  member = await session(browser, users.member, '/referrals');
});
test.afterAll(async () => {
  await Promise.all([watcher?.ctx.close(), member?.ctx.close()]);
  const key = await serviceKey();
  await fetch(`${STACK}/rest/v1/referrals?contact_name=ilike.*${stamp}*`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
});

test('Leaderboard page: the changed tile counts up, glows teal with "+1", then settles; "Live · updated" shows the time', async () => {
  const page = watcher.page;
  const errors = trackConsole(page);
  await live(page);
  const tile = totalsTile(page, 'Referrals');
  const before = await num(tile.locator('dd'));
  await expect(page.locator('[data-live-status]')).toHaveText('Live');
  await expect(page.locator('[data-live-flash]')).toHaveCount(0);

  await fileReferral(member.page);

  await expectTealGlow(tile);
  await expect(tile.locator('.live-delta')).toHaveText('+1');
  await expect(tile.locator('dd')).toHaveText(`${before + 1}+1`);
  // Only what changed is highlighted: one-on-ones did not change.
  await expect(totalsTile(page, 'One-on-ones').locator('[data-live-flash]')).toHaveCount(0);
  // Morgan's referrals count on the leaderboard glows too.
  await expect(page.getByRole('list', { name: 'Referrals leaders' }).locator('li', { hasText: 'Morgan Member' }).locator('[data-live-flash]')).toBeAttached();
  await expect(page.locator('[data-live-status]')).toHaveText(/^Live · updated \d{1,2}:\d{2} [AP]M$/);
  // After a few seconds the glow and the "+1" go away and the new number stays.
  await expect(tile.locator('[data-live-flash]')).toHaveCount(0, { timeout: 8_000 });
  await expect(tile.locator('dd')).toHaveText(String(before + 1));
  expect(errors).toEqual([]);
});

test('changing the period filter swaps the numbers without any highlight', async () => {
  const page = watcher.page;
  await page.getByLabel('Show numbers for').selectOption('all');
  await expect(page.getByRole('heading', { name: 'Group totals: All time' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('[data-live-flash]')).toHaveCount(0);
  await page.getByLabel('Show numbers for').selectOption('year');
  await expect(page.getByRole('heading', { name: /Group totals: \d{4} so far/ })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('[data-live-flash]')).toHaveCount(0);
});

test('dashboard box and the open slides (Statistics and Leaderboards) highlight the same change', async () => {
  const dash = await watcher.ctx.newPage();
  await dash.goto('/dashboard');
  const deck = await watcher.ctx.newPage();
  await deck.goto('/present/next');
  await live(dash);
  await live(deck);
  const dashTile = totalsTile(dash, 'Referrals');
  const dashBefore = await num(dashTile.locator('dd'));
  const statMonth = slideTile(deck, 'This month', 'Referrals');
  const statYear = slideTile(deck, 'Year so far', 'Referrals');
  const monthBefore = await num(statMonth);

  await fileReferral(member.page);

  await expectTealGlow(dashTile);
  await expect(dashTile.locator('dd')).toHaveText(`${dashBefore + 1}+1`);
  await expect(dash.locator('section[aria-labelledby="group-h"] [data-live-status]')).toHaveText(/^Live · updated /);
  // Slides: glows even on slides not on screen right now, so a slide shows it if the presenter is on it.
  await expect(statMonth.locator('[data-live-flash]')).toBeAttached();
  await expect(statYear.locator('[data-live-flash]')).toBeAttached();
  await expect(statMonth.locator('.live-delta')).toHaveText('+1');
  await expect(
    deck.locator('[role="group"][aria-label^="Leaderboards (this month) (slide "] li', { hasText: 'Morgan M.' }).first().locator('[data-live-flash]'),
  ).toBeAttached();
  await expect(deck.locator('[data-live-activity]', { hasText: /^Live · updated / })).toBeVisible();
  await expect(statMonth.locator('[data-live-flash]')).toHaveCount(0, { timeout: 8_000 });
  expect(await num(statMonth)).toBe(monthBefore + 1);
  await Promise.all([dash.close(), deck.close()]);
});

test('with motion turned off the number changes at once but still glows teal', async ({ browser }) => {
  const calm = await session(browser, users.member2, '/leaderboard', { reducedMotion: 'reduce' });
  await live(calm.page);
  const tile = totalsTile(calm.page, 'Referrals');
  const before = await num(tile.locator('dd'));
  // Record every number the tile shows while it changes: no in-between values.
  await calm.page.evaluate(() => {
    const dd = document.querySelector('dl[aria-label^="Group totals"] > div:nth-child(2) dd');
    const seen: string[] = [];
    (window as unknown as { __seen: string[] }).__seen = seen;
    new MutationObserver(() => seen.push(dd?.firstElementChild?.firstChild?.textContent ?? '')).observe(dd!, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  await fileReferral(member.page);
  await expect(tile.locator('[data-live-flash]')).toBeAttached();
  await expect(tile.locator('dd')).toHaveText(`${before + 1}+1`);
  const seen = await calm.page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
  expect(seen.filter((s) => s && s !== String(before) && s !== String(before + 1))).toEqual([]);
  await calm.ctx.close();
});
