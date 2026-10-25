import { expect, test } from '@playwright/test';
import { db, expectAccessible, login, trackConsole, users } from './support';

// Closed Businesses page under Report Activity (owner, 2026-10-25): the member's open received referrals
// with a reminder to mark them closed business, lists of closed business, and "File a closed business"
// for business that was never filed (saved as a referral already marked closed).

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

test.describe('closed businesses', () => {
  test('Report Activity has "Closed Businesses"; the page reminds members and passes axe @responsive', async ({ page }) => {
    const errors = trackConsole(page);
    await login(page, users.member);
    if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole('button', { name: 'Menu' }).click();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await nav.getByRole('button', { name: 'Report Activity' }).click();
    await nav.getByRole('link', { name: 'Closed Businesses', exact: true }).click();
    await expect(page).toHaveURL('/closed-business');
    await expect(page.getByRole('heading', { level: 1, name: 'Closed Businesses' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mark referrals as closed business' })).toBeVisible();
    await expect(page.getByText('Did a referral you received turn into business?')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'File a closed business' })).toBeVisible();
    await expectAccessible(page);
    expect(errors).toEqual([]);
  });

  test('file a closed business (invalid then valid): saved as a closed referral, emailed, shown to both members', async ({ page }) => {
    await login(page, users.member, undefined, '/closed-business');
    const form = page.getByRole('form', { name: 'File a closed business' });
    await form.getByRole('button', { name: 'File closed business' }).click();
    await expect(form.getByText('Choose a member to refer to')).toBeVisible();
    await form.getByLabel('Referred to member').selectOption({ label: 'Riley Second · Second Test Bakery' });
    await form.getByLabel('Name of referral').fill('Corporate catering contract');
    await form.getByLabel('Phone').fill('(650) 555-0142');
    await form.getByLabel('Email').fill('events@example.org');
    await form.getByLabel('Value of the business ($)').fill('4,200');
    await form.getByLabel('Notes').fill('Signed in September; forgot to file it.');
    await form.getByRole('button', { name: 'File closed business' }).click();
    await expect(page.getByText('Closed business filed.')).toBeVisible();

    const mine = page.getByRole('region', { name: 'Closed business from my referrals' }).getByRole('listitem').filter({ hasText: 'Corporate catering contract' });
    await expect(mine.locator('.pill', { hasText: 'Closed business' })).toBeVisible();
    await expect(mine.getByText('$4,200')).toBeVisible();
    const [row] = await db<{ status: string; closed_at: string | null; amount: number }>(
      'referrals?contact_name=eq.Corporate%20catering%20contract&select=status,closed_at,amount',
    );
    expect(row).toMatchObject({ status: 'closed_deal', amount: 4200 });
    expect(row?.closed_at).not.toBeNull();
    const [mail] = await emailsTo(users.member2, /^Closed business recorded from .*: Corporate catering contract$/);
    expect(mail?.textContent).toContain('/closed-business');

    // It also shows on the Referrals page as a closed slip.
    await page.goto('/referrals');
    await expect(
      page.getByRole('region', { name: 'Referrals I gave' }).getByRole('listitem').filter({ hasText: 'Corporate catering contract' }).locator('.pill', { hasText: 'Closed business' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await login(page, users.member2, undefined, '/closed-business');
    const got = page.getByRole('region', { name: 'Closed business I received' }).getByRole('listitem').filter({ hasText: 'Corporate catering contract' });
    await expect(got.getByText('$4,200')).toBeVisible();
    await expect(got.getByRole('form', { name: 'Update referral: Corporate catering contract' })).toBeVisible();
    await expectAccessible(page);
  });

  test('an open referral received is listed under the reminder; marking it closed moves it to closed business', async ({ page }) => {
    await login(page, users.member, undefined, '/referrals');
    await page.getByLabel('Refer to member').selectOption({ label: 'Riley Second · Second Test Bakery' });
    await page.getByLabel('Prospect name').fill('Birthday party lead');
    await page.getByRole('button', { name: 'Send referral slip' }).click();
    await expect(page.getByText('Referral slip sent.')).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();

    await login(page, users.member2, undefined, '/closed-business');
    const open = page.getByRole('region', { name: 'Mark referrals as closed business' });
    const slip = open.getByRole('listitem').filter({ hasText: 'Birthday party lead' });
    await expect(slip.getByText('Name of Referral:')).toBeVisible();
    const form = slip.getByRole('form', { name: 'Update referral: Birthday party lead' });
    await form.getByLabel('Status').selectOption('closed_deal');
    await form.getByLabel('Value ($)').fill('800');
    await form.getByRole('button', { name: 'Save' }).click();
    // Once saved it leaves the reminder list straight away and shows under closed business.
    await expect(open.getByRole('listitem').filter({ hasText: 'Birthday party lead' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Closed business I received' }).getByRole('listitem').filter({ hasText: 'Birthday party lead' }).getByText('$800')).toBeVisible();
    await page.reload();
    await expect(open.getByRole('listitem').filter({ hasText: 'Birthday party lead' })).toHaveCount(0);
  });
});
