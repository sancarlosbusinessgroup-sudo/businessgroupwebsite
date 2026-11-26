import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { STACK, db, login, serviceKey, trackConsole, users } from './support';

// Live activity sync (owner, 2026-11-25). Several signed-in sessions at once, as at a live meeting: one member reports
// (referrals, one-on-ones, closed business, visitors brought, edits and deletes) and, WITHOUT any reload, the admin's
// Member Activity and Member Stats, another member's dashboard leaderboard and the open meeting slides (on the slide being
// shown) update from the same database. Each watching page gets a marker that a full page reload would wipe out.

test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString(36);
const prospect = `Live Prospect ${stamp}`;

async function session(browser: Browser, email: string, path: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, email, undefined, path);
  await page.goto(path);
  return { ctx, page };
}

/** Marks the page; `stillSamePage` fails if the page was reloaded or navigated (a live update must not do that). */
async function mark(page: Page) {
  await page.evaluate(() => ((window as unknown as { __liveMark: number }).__liveMark = 1));
}
async function stillSamePage(page: Page) {
  expect(await page.evaluate(() => (window as unknown as { __liveMark?: number }).__liveMark)).toBe(1);
}

/** The page is connected for live updates ('live' = Realtime, 'polling' = fallback). */
async function expectLive(page: Page, status: 'live' | 'polling' = 'live') {
  await expect(page.locator(`[data-live-activity="${status}"]`).first()).toBeAttached({ timeout: 20_000 });
}

/** A shown number; 0 when the row isn't there (e.g. a member not on a leaderboard yet). */
const num = async (l: Locator) => ((await l.count()) ? Number(((await l.first().textContent()) ?? '').replace(/[^0-9]/g, '') || '0') : 0);

// Meeting slides helpers: go to a slide by its label, read a tile / a leader's count.
async function showSlide(page: Page, label: string) {
  const group = page.locator(`[role="group"][aria-label^="${label} (slide "]`).first();
  const n = Number((await group.getAttribute('aria-label'))?.match(/slide (\d+) of/)?.[1]);
  for (let i = 0; i < 40; i++) {
    const shown = Number((await page.getByText(/^Slide \d+ of \d+$/).textContent())?.match(/Slide (\d+)/)?.[1]);
    if (shown === n) break;
    await page.keyboard.press(shown < n ? 'ArrowRight' : 'ArrowLeft');
  }
  await expect(group).toBeVisible();
  return group;
}
const statTile = (page: Page, label: string) =>
  page
    .locator('[aria-label="Since the last meeting"] li')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('span.font-display');
const slideLeader = (page: Page, board: string, who: string) =>
  page
    .locator('[role="group"][aria-label^="Leaderboards (this month) (slide "]')
    .getByRole('heading', { name: board, exact: true })
    .locator('xpath=ancestor::div[contains(@class, "overflow-hidden")][1]')
    .locator('li', { hasText: who })
    .locator('strong');
const dashLeader = (page: Page, board: string, who: string) =>
  page
    .getByRole('list', { name: `${board} leaders` })
    .locator('li', { hasText: who })
    .locator('strong');
const statsCell = (page: Page, who: string, col: number) => page.locator('table.data-table tbody tr', { hasText: who }).locator('td').nth(col);

let admin: { ctx: BrowserContext; page: Page };
let activity: Page; // Admin → Member Activity
let stats: Page; // Admin → Member Stats (with closed business shown)
let deck: Page; // meeting slides, already open
let member2: { ctx: BrowserContext; page: Page }; // Riley: dashboard leaderboard, receives referrals
let member: { ctx: BrowserContext; page: Page }; // Morgan: reports

test.beforeAll(async ({ browser }) => {
  admin = await session(browser, users.admin, '/admin/activity');
  activity = admin.page;
  stats = await admin.ctx.newPage();
  await stats.goto('/admin/stats?period=month&closed=1');
  deck = await admin.ctx.newPage();
  await deck.goto('/present/next');
  member2 = await session(browser, users.member2, '/dashboard');
  member = await session(browser, users.member, '/referrals');
  for (const p of [activity, stats, deck, member2.page]) {
    await expectLive(p);
    await mark(p);
  }
});

/** Removes what this file filed, so later files (e.g. member.spec's one-on-one between the same two members today) start clean. */
async function remove(path: string) {
  const key = await serviceKey();
  await fetch(`${STACK}/rest/v1/${path}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
}

test.afterAll(async () => {
  await Promise.all([admin?.ctx.close(), member2?.ctx.close(), member?.ctx.close()]);
  const [morgan] = await db<{ id: string }>(`profiles?first_name=eq.Morgan&last_name=eq.Member&select=id`);
  const [riley] = await db<{ id: string }>(`profiles?first_name=eq.Riley&last_name=eq.Second&select=id`);
  if (morgan && riley) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    await remove(
      `one_on_ones?met_on=eq.${today}&or=(and(reporter_id.eq.${morgan.id},partner_id.eq.${riley.id}),and(reporter_id.eq.${riley.id},partner_id.eq.${morgan.id}))`,
    );
  }
  await remove(`referrals?contact_name=ilike.*${stamp}*`);
  await remove(`guest_requests?email=ilike.*${stamp}*`);
});

test('every watching page connects over Realtime, and the deck shows it is live', async () => {
  await expect(deck.locator('[data-live-activity="live"]', { hasText: 'Live' })).toBeVisible();
  expect(await member.page.locator('[data-live-activity]').count()).toBe(1);
});

test('a referral appears everywhere at once: Member Activity, Member Stats, the dashboard leaderboard and the open slides', async () => {
  const errors = trackConsole(deck);
  await showSlide(deck, 'Statistics');
  const slideRefs = await num(statTile(deck, 'Referrals'));
  const statsRefs = await num(statsCell(stats, 'Morgan Member', 1));
  const dashRefs = await num(dashLeader(member2.page, 'Referrals', 'Morgan'));

  const form = member.page.locator('form[aria-labelledby="send-ref-h"]');
  await form.getByLabel('Refer to member').selectOption({ label: 'Riley Second · Second Test Bakery' });
  await form.getByLabel('Prospect name').fill(prospect);
  await form.getByLabel('Referral value ($)').fill('1500');
  await form.getByRole('button', { name: 'Send referral slip' }).click();
  await expect(member.page.getByText('Referral slip sent.')).toBeVisible();

  await expect(activity.getByRole('listitem').filter({ hasText: prospect })).toBeVisible();
  await expect(statsCell(stats, 'Morgan Member', 1)).toHaveText(String(statsRefs + 1));
  await expect(dashLeader(member2.page, 'Referrals', 'Morgan')).toHaveText(String(dashRefs + 1));
  await expect(statTile(deck, 'Referrals')).toHaveText(String(slideRefs + 1));
  // The presenter stays on the Statistics slide.
  await expect(deck.locator('[role="group"][aria-label^="Statistics (slide "]')).toBeVisible();
  for (const p of [activity, stats, deck, member2.page]) await stillSamePage(p);
  expect(errors).toEqual([]);
});

test('the same referral slip twice is refused, and nothing is counted twice', async () => {
  const before = await db<{ id: string }>(`referrals?contact_name=eq.${encodeURIComponent(prospect)}&select=id`);
  expect(before).toHaveLength(1);
  const form = member.page.locator('form[aria-labelledby="send-ref-h"]');
  await form.getByLabel('Refer to member').selectOption({ label: 'Riley Second · Second Test Bakery' });
  await form.getByLabel('Prospect name').fill(prospect.toUpperCase());
  await form.getByRole('button', { name: 'Send referral slip' }).click();
  await expect(member.page.getByText(/This referral slip is already filed/)).toBeVisible();
  expect(await db(`referrals?contact_name=ilike.${encodeURIComponent(prospect)}&select=id`)).toHaveLength(1);
  await expect(activity.getByRole('listitem').filter({ hasText: prospect })).toHaveCount(1);
});

test('an edit (marked closed business with a value) updates the statistics slide, Member Stats and Member Activity', async () => {
  await showSlide(deck, 'Statistics');
  const closed = await num(statTile(deck, 'Closed business'));
  const amount = await num(statTile(deck, 'Closed business ($)'));
  const statsClosed = await num(statsCell(stats, 'Morgan Member', 3));

  await member2.page.goto('/closed-business');
  await mark(member2.page);
  const upd = member2.page.locator(`form[aria-label="Update referral: ${prospect}"]`);
  await upd.getByLabel('Status').selectOption({ label: 'Closed business' });
  await upd.getByLabel('Value ($)').fill('2500');
  await upd.getByRole('button', { name: 'Save' }).click();

  await expect(statTile(deck, 'Closed business')).toHaveText(String(closed + 1));
  await expect(statTile(deck, 'Closed business ($)')).toHaveText(`$${(amount + 2500).toLocaleString('en-US')}`);
  await expect(statsCell(stats, 'Morgan Member', 3)).toHaveText(String(statsClosed + 1));
  await expect(activity.getByRole('listitem').filter({ hasText: prospect })).toContainText('Closed business');
  await expect(activity.getByRole('listitem').filter({ hasText: prospect })).toContainText('$2,500');
  for (const p of [activity, stats, deck]) await stillSamePage(p);
});

test('one-on-ones: reported, then confirmed, then a second report of the same day confirms instead of doubling', async () => {
  await showSlide(deck, 'Statistics');
  const slideOoo = await num(statTile(deck, 'One-to-ones'));
  const statsOoo = await num(statsCell(stats, 'Morgan Member', 0));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  // Riley reports a one-on-one with Morgan: listed at once, awaiting confirmation (not counted yet).
  await member2.page.goto('/one-on-ones');
  const form = member2.page.locator('form[aria-labelledby="report-h"]');
  await form.getByLabel('Who did you meet with?').selectOption({ label: 'Morgan Member · Test Member Studio' });
  await form.getByRole('button', { name: 'Report one-on-one' }).click();
  await expect(member2.page.getByText(/One-on-one reported/)).toBeVisible();
  const row = activity.getByRole('listitem').filter({ hasText: 'Riley Second with Morgan Member' }).first();
  await expect(row).toContainText('Awaiting confirmation');

  // Morgan reports the same one-on-one (same day) instead of confirming: it confirms Riley's, counted once each.
  await member.page.goto('/one-on-ones');
  const mine = member.page.locator('form[aria-labelledby="report-h"]');
  await mine.getByLabel('Who did you meet with?').selectOption({ label: 'Riley Second · Second Test Bakery' });
  await mine.getByRole('button', { name: 'Report one-on-one' }).click();
  await expect(member.page.getByText(/had already reported this one-on-one, so we confirmed theirs/)).toBeVisible();
  await expect(row).toContainText('Confirmed');
  type Pair = { reporter: { first_name: string } | null; partner: { first_name: string } | null };
  const pairs = await db<Pair>(
    `one_on_ones?met_on=eq.${today}&select=reporter:profiles!one_on_ones_reporter_id_fkey(first_name),partner:profiles!one_on_ones_partner_id_fkey(first_name)`,
  );
  expect(pairs.filter((p) => [p.reporter?.first_name, p.partner?.first_name].sort().join() === 'Morgan,Riley')).toHaveLength(1);
  await expect(statTile(deck, 'One-to-ones')).toHaveText(String(slideOoo + 1));
  await expect(statsCell(stats, 'Morgan Member', 0)).toHaveText(String(statsOoo + 1));

  // A third report of the same day is refused.
  await mine.getByLabel('Who did you meet with?').selectOption({ label: 'Riley Second · Second Test Bakery' });
  await mine.getByRole('button', { name: 'Report one-on-one' }).click();
  await expect(member.page.getByText(/already reported for that day/)).toBeVisible();
  await expect(statTile(deck, 'One-to-ones')).toHaveText(String(slideOoo + 1));
  for (const p of [activity, stats, deck]) await stillSamePage(p);
});

test('visitors brought: logged visitor shows in Member Activity, Member Stats and the slides leaderboard', async () => {
  await showSlide(deck, 'Leaderboards (this month)');
  const slideVis = await num(slideLeader(deck, 'Visitors brought', 'Morgan'));
  const statsVis = await num(statsCell(stats, 'Morgan Member', 7));

  await member.page.goto('/visitors-brought');
  const form = member.page.locator('form[aria-labelledby="log-visitor-h"]');
  await form.getByLabel('Visitor first name').fill('Livia');
  await form.getByLabel('Visitor last name').fill(`Visitor ${stamp}`);
  await form.getByLabel('Visitor email').fill(`livia.${stamp}@example.org`);
  await form.getByRole('button', { name: 'Log visitor' }).click();
  await expect(member.page.getByText(/is logged as your visitor/)).toBeVisible();

  await expect(activity.getByRole('listitem').filter({ hasText: `Livia Visitor ${stamp}` })).toContainText('Morgan Member brought');
  await expect(statsCell(stats, 'Morgan Member', 7)).toHaveText(String(statsVis + 1));
  await expect(slideLeader(deck, 'Visitors brought', 'Morgan')).toHaveText(String(slideVis + 1));
  await expect(deck.locator('[role="group"][aria-label^="Leaderboards (this month) (slide "]')).toBeVisible();
  for (const p of [activity, stats, deck]) await stillSamePage(p);
});

test('a deleted report disappears everywhere and the counts go back', async () => {
  await showSlide(deck, 'Statistics');
  const slideRefs = await num(statTile(deck, 'Referrals'));
  const statsRefs = await num(statsCell(stats, 'Morgan Member', 1));

  await member.page.goto('/referrals');
  const del = member.page.locator(`form[aria-label="Delete referral slip for ${prospect}"]`);
  await member.page.getByRole('button', { name: `Delete referral slip for ${prospect}` }).click();
  await del.getByRole('button', { name: 'Yes, delete' }).click();

  await expect(activity.getByRole('listitem').filter({ hasText: prospect })).toHaveCount(0);
  await expect(statsCell(stats, 'Morgan Member', 1)).toHaveText(String(statsRefs - 1));
  await expect(statTile(deck, 'Referrals')).toHaveText(String(slideRefs - 1));
  for (const p of [activity, stats, deck]) await stillSamePage(p);
});

test('what a member is typing is kept: the page waits until they leave the field', async () => {
  const mine = member.page;
  await mine.goto('/referrals');
  await expectLive(mine);
  await mark(mine);
  const field = mine.locator('form[aria-labelledby="send-ref-h"]').getByLabel('Prospect name');
  await field.fill('Half typed na');
  // Someone else files a referral to Morgan meanwhile.
  await member2.page.goto('/referrals');
  const other = `From Riley ${stamp}`;
  const f2 = member2.page.locator('form[aria-labelledby="send-ref-h"]');
  await f2.getByLabel('Refer to member').selectOption({ label: 'Morgan Member · Test Member Studio' });
  await f2.getByLabel('Prospect name').fill(other);
  await f2.getByRole('button', { name: 'Send referral slip' }).click();
  await expect(member2.page.getByText('Referral slip sent.')).toBeVisible();
  await expect(field).toHaveValue('Half typed na');
  await field.blur();
  await expect(mine.getByText(other).first()).toBeVisible();
  await expect(field).toHaveValue('Half typed na');
  await stillSamePage(mine);
});

test('without Realtime (blocked websocket) pages fall back to checking every few seconds', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // A websocket that never answers: the join times out and the page polls instead.
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, () => {});
  await login(page, users.admin, undefined, '/admin/activity');
  await page.goto('/admin/activity');
  await expectLive(page, 'polling');
  await mark(page);
  const name = `Polling Prospect ${stamp}`;
  await member.page.goto('/referrals');
  const form = member.page.locator('form[aria-labelledby="send-ref-h"]');
  await form.getByLabel('Refer to member').selectOption({ label: 'Riley Second · Second Test Bakery' });
  await form.getByLabel('Prospect name').fill(name);
  await form.getByRole('button', { name: 'Send referral slip' }).click();
  await expect(member.page.getByText('Referral slip sent.')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible({ timeout: 15_000 });
  await stillSamePage(page);
  await ctx.close();
});
