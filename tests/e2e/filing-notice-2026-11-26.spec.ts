import { expect, test, type Page } from '@playwright/test';
import { STACK, expectAccessible, login, serviceKey, trackConsole, users } from './support';

// Pop-up after filing (owner, 2026-11-26): after a referral, one-on-one, closed business or visitor is filed, a pop-up
// says whether it already counts in the stats, leaderboards and slides, or waits for the other member's confirmation.

test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString(36);
const notice = (page: Page) => page.getByRole('dialog');

async function expectNotice(page: Page, badge: string, title: RegExp) {
  const d = notice(page);
  await expect(d).toBeVisible();
  await expect(d.getByText(badge, { exact: true })).toBeVisible();
  await expect(d.getByRole('heading', { name: title })).toBeVisible();
  await expect(d.getByRole('button', { name: 'Got it' })).toBeFocused();
}
async function gotIt(page: Page) {
  await notice(page).getByRole('button', { name: 'Got it' }).click();
  await expect(notice(page)).toBeHidden();
}

test.afterAll(async () => {
  const key = await serviceKey();
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  await fetch(`${STACK}/rest/v1/referrals?contact_name=ilike.*${stamp}*`, { method: 'DELETE', headers: h });
  await fetch(`${STACK}/rest/v1/guest_requests?email=ilike.*${stamp}*`, { method: 'DELETE', headers: h });
});

test('referral: "Counted now" pop-up, accessible, and it opens again for the next one @responsive', async ({ page }) => {
  const errors = trackConsole(page);
  await login(page, users.member, undefined, '/referrals');
  await page.goto('/referrals');
  const form = page.locator('form[aria-labelledby="send-ref-h"]');
  await expect(notice(page)).toBeHidden();
  for (const i of [1, 2]) {
    await form.getByLabel('Refer to member').selectOption({ label: 'Riley Second · Second Test Bakery' });
    await form.getByLabel('Prospect name').fill(`Notice ${stamp} ${i}`);
    await form.getByRole('button', { name: 'Send referral slip' }).click();
    await expectNotice(page, 'Counted now', /^Your referral is confirmed!$/);
    await expect(notice(page)).toContainText('the leaderboards and the meeting slides.');
    if (i === 1) await expectAccessible(page);
    // Escape closes it too; the page's own message stays.
    if (i === 1) await gotIt(page);
    else {
      await page.keyboard.press('Escape');
      await expect(notice(page)).toBeHidden();
    }
    await expect(page.getByText('Referral slip sent.')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('one-on-one: "Waiting for confirmation"; the other member reporting it too gets "Counted now"', async ({ browser }) => {
  // Use a past date nobody else in the tests uses for this pair.
  const day = new Date(Date.now() - 9 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const a = await browser.newContext();
  const pa = await a.newPage();
  await login(pa, users.member, undefined, '/one-on-ones');
  await pa.goto('/one-on-ones');
  const fa = pa.locator('form[aria-labelledby="report-h"]');
  await fa.getByLabel('Who did you meet with?').selectOption({ label: 'Riley Second · Second Test Bakery' });
  await fa.getByLabel('Activity date').fill(day);
  await fa.getByRole('button', { name: 'Report one-on-one' }).click();
  await expectNotice(pa, 'Waiting for confirmation', /^Almost there: one more step$/);
  await expect(notice(pa)).toContainText('as soon as the other member confirms it');
  await gotIt(pa);

  const b = await browser.newContext();
  const pb = await b.newPage();
  await login(pb, users.member2, undefined, '/one-on-ones');
  await pb.goto('/one-on-ones');
  const fb = pb.locator('form[aria-labelledby="report-h"]');
  await fb.getByLabel('Who did you meet with?').selectOption({ label: 'Morgan Member · Test Member Studio' });
  await fb.getByLabel('Activity date').fill(day);
  await fb.getByRole('button', { name: 'Report one-on-one' }).click();
  await expectNotice(pb, 'Counted now', /^Your one-on-one is confirmed!$/);
  await gotIt(pb);

  // Clean up: remove this pair's one-on-one on that day.
  const key = await serviceKey();
  await fetch(`${STACK}/rest/v1/one_on_ones?met_on=eq.${day}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
  await Promise.all([a.close(), b.close()]);
});

test('closed business: filing one, and marking a received referral as closed, both say "Counted now"', async ({ browser }) => {
  // Riley files a closed business for a referral Morgan... (giver = Riley, receiver = Morgan).
  const r = await browser.newContext();
  const pr = await r.newPage();
  await login(pr, users.member2, undefined, '/closed-business');
  await pr.goto('/closed-business');
  const form = pr.getByRole('form', { name: 'File a closed business' });
  await form.getByLabel('Referred to member').selectOption({ label: 'Morgan Member · Test Member Studio' });
  await form.getByLabel('Name of referral').fill(`Filed deal ${stamp}`);
  await form.getByLabel('Value of the business ($)').fill('900');
  await form.getByRole('button', { name: 'File closed business' }).click();
  await expectNotice(pr, 'Counted now', /^Your closed business is confirmed!$/);
  await expect(notice(pr)).toContainText('group total only');
  await gotIt(pr);
  await r.close();

  // Morgan marks a referral received from Riley (Notice … 1, from the first test) as closed business.
  const m = await browser.newContext();
  const pm = await m.newPage();
  await login(pm, users.member2, undefined, '/referrals');
  // Riley received the "Notice" slips from Morgan: Riley marks one closed.
  await pm.goto('/closed-business');
  const upd = pm.locator(`form[aria-label="Update referral: Notice ${stamp} 1"]`);
  await upd.getByLabel('Status').selectOption({ label: 'Closed business' });
  await upd.getByLabel('Value ($)').fill('1200');
  await upd.getByRole('button', { name: 'Save' }).click();
  await expectNotice(pm, 'Counted now', /^Thank you! This closed business is confirmed$/);
  await expect(notice(pm)).toContainText('credited to the member who referred it');
  await gotIt(pm);
  await m.close();
});

test('changing the value of a slip that is already closed business does not open the pop-up', async ({ page }) => {
  await login(page, users.member2, undefined, '/referrals');
  await page.goto('/referrals');
  const upd = page.locator(`form[aria-label="Update referral: Notice ${stamp} 1"]`);
  await upd.getByLabel('Value ($)').fill('1300');
  await upd.getByRole('button', { name: 'Save' }).click();
  await expect(upd.getByText('Saved')).toBeVisible();
  await expect(notice(page)).toBeHidden();
});

test('visitor brought: "Counted now"', async ({ page }) => {
  await login(page, users.member, undefined, '/visitors-brought');
  await page.goto('/visitors-brought');
  const form = page.locator('form[aria-labelledby="log-visitor-h"]');
  await form.getByLabel('Visitor first name').fill('Nora');
  await form.getByLabel('Visitor last name').fill(`Notice ${stamp}`);
  await form.getByLabel('Visitor email').fill(`nora.${stamp}@example.org`);
  await form.getByRole('button', { name: 'Log visitor' }).click();
  await expectNotice(page, 'Counted now', /^Your visitor is confirmed$/);
  await gotIt(page);
  await expect(page.getByText(/is logged as your visitor/)).toBeVisible();
});

test('a refused filing (duplicate slip) shows its error and no pop-up', async ({ page }) => {
  await login(page, users.member, undefined, '/referrals');
  await page.goto('/referrals');
  const form = page.locator('form[aria-labelledby="send-ref-h"]');
  await form.getByLabel('Refer to member').selectOption({ label: 'Riley Second · Second Test Bakery' });
  await form.getByLabel('Prospect name').fill(`Notice ${stamp} 2`);
  await form.getByRole('button', { name: 'Send referral slip' }).click();
  await expect(page.getByText(/This referral slip is already filed/)).toBeVisible();
  await expect(notice(page)).toBeHidden();
});
