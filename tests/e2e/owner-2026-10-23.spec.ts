import { expect, test } from '@playwright/test';
import { PASSWORD, STACK, expectAccessible, login, serviceKey, users } from './support';

// Owner requests 2026-10-23 (after Phase D): one-on-one history, referral page wording, password show/hide and change.

async function rest(path: string, method = 'GET', body?: unknown) {
  const key = await serviceKey();
  const res = await fetch(`${STACK}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : []) as Record<string, unknown>[];
}

const idOf = async (email: string) => (await rest(`member_contacts?email=eq.${email}&select=profile_id`))[0]?.profile_id as string;

test.describe.configure({ mode: 'serial' });

test('one-on-ones page lists every one-on-one I have had (history table)', async ({ page }) => {
  const me = await idOf(users.member);
  const partner = (await rest(`profiles?first_name=eq.Priya&last_name=eq.Raman&select=id`))[0]?.id as string;
  const other = (await rest(`profiles?first_name=eq.Daniel&last_name=eq.Cho&select=id`))[0]?.id as string;
  // One-on-ones can only be reported for the last 14 days, so use recent dates.
  const ago = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  const label = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
  const [d1, d2] = [ago(12), ago(10)];
  const made = [
    ...(await rest('one_on_ones', 'POST', { reporter_id: me, partner_id: partner, met_on: d1, confirmed_at: new Date().toISOString() })),
    ...(await rest('one_on_ones', 'POST', { reporter_id: other, partner_id: me, met_on: d2 })),
  ];
  try {
    await login(page, users.member, undefined, '/one-on-ones');
    const hist = page.getByRole('region', { name: 'My one-on-one history' });
    const table = hist.getByRole('table', { name: 'All my one-on-ones, newest first' });
    const r1 = table
      .getByRole('row')
      .filter({ hasText: label(d1) })
      .filter({ hasText: 'Priya Raman' });
    await expect(r1).toContainText('Priya Raman');
    await expect(r1).toContainText('You');
    await expect(r1).toContainText('Confirmed');
    const r2 = table
      .getByRole('row')
      .filter({ hasText: label(d2) })
      .filter({ hasText: 'Daniel Cho' });
    await expect(r2).toContainText('Daniel Cho');
    await expect(r2).toContainText('Awaiting confirmation');
    await expect(hist.getByText(/\d+ one-on-ones? with \d+ (member|different members)/)).toBeVisible();
    await expectAccessible(page);
  } finally {
    for (const o of made) await rest(`one_on_ones?id=eq.${o.id}`, 'DELETE');
  }
});

test('referral page: no introduction paragraph under the title', async ({ page }) => {
  await login(page, users.member, undefined, '/referrals');
  await expect(page.getByRole('heading', { level: 1, name: 'Referral tracker' })).toBeVisible();
  await expect(page.getByText(/Pass business to fellow/)).toHaveCount(0);
});

test('password fields have a show/hide eye', async ({ page }) => {
  await page.goto('/login');
  const pw = page.locator('#panel-password').getByLabel(/^Password/);
  await pw.fill('secret-123');
  await expect(pw).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(pw).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(pw).toHaveAttribute('type', 'password');
  await expectAccessible(page);
  await page.goto('/join');
  await expect(page.getByRole('button', { name: 'Show password' })).toBeVisible();
});

test('members change their password from My profile (current password checked)', async ({ page }) => {
  const next = 'a-brand-new-password-2';
  await login(page, users.member2, undefined, '/profile');
  await page.getByRole('link', { name: 'Change password' }).click();
  await expect(page).toHaveURL(/tab=edit#password/);
  const form = page.getByRole('form', { name: 'Change password' });
  await form.getByLabel(/^Current password/).fill('not-my-password');
  await form.getByLabel(/^New password/).fill(next);
  await form.getByLabel(/^Confirm new password/).fill(next);
  await form.getByRole('button', { name: 'Change password' }).click();
  await expect(form.getByText('That isn’t your current password.')).toBeVisible();

  await form.getByLabel(/^Current password/).fill(PASSWORD);
  await form.getByLabel(/^New password/).fill(next);
  await form.getByLabel(/^Confirm new password/).fill('something-else-1');
  await form.getByRole('button', { name: 'Change password' }).click();
  await expect(form.getByText('Passwords do not match')).toBeVisible();

  await form.getByLabel(/^Confirm new password/).fill(next);
  await form.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your password has been changed.' })).toBeVisible();
  await expectAccessible(page);

  // The new password works; then put the test password back for the other tests.
  await page.context().clearCookies();
  await login(page, users.member2, next, '/profile?tab=edit');
  const again = page.getByRole('form', { name: 'Change password' });
  await again.getByLabel(/^Current password/).fill(next);
  await again.getByLabel(/^New password/).fill(PASSWORD);
  await again.getByLabel(/^Confirm new password/).fill(PASSWORD);
  await again.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your password has been changed.' })).toBeVisible();
});
