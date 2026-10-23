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
  const pw = page.getByRole('main').getByLabel(/^Password/);
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

test('temporary password: the member must choose their own before using the site', async ({ page }) => {
  // Same as the live change: password set in the database (bcrypt via pgcrypto) and the flag in app_metadata.
  const pg = (await import('pg')).default;
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54322/postgres' });
  await db.connect();
  const setTemp = () =>
    db.query(
      `update auth.users set encrypted_password = crypt('BARP', gen_salt('bf')),
         raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"must_change_password": true}'::jsonb where email = $1`,
      [users.member2],
    );
  try {
    await db.query('create extension if not exists pgcrypto');
    await setTemp();
    await login(page, users.member2, 'BARP', '/one-on-ones');
    await expect(page).toHaveURL(/\/choose-password\?next=%2Fone-on-ones/);
    await expect(page.getByRole('heading', { level: 1, name: 'Choose your password' })).toBeVisible();
    // Every other page sends them back here until they do.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/choose-password/);
    await page.goto('/support');
    await expect(page).toHaveURL(/\/choose-password/);
    await expectAccessible(page);

    await page.getByLabel(/^New password/).fill('BARP');
    await page.getByLabel(/^Confirm new password/).fill('BARP');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByText('Use at least 8 characters')).toBeVisible();
    await page.getByLabel(/^New password/).fill('my-own-password-1');
    await page.getByLabel(/^Confirm new password/).fill('my-own-password-1');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    // They continue to the page they last asked for.
    await expect(page).toHaveURL('/support');
    const flag = (await db.query(`select raw_app_meta_data->>'must_change_password' as f from auth.users where email = $1`, [users.member2])).rows[0]?.f;
    expect(flag).toBe('false');
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // The temporary password no longer works; the new one does.
    await page.context().clearCookies();
    await page.goto('/login');
    await login(page, users.member2, 'my-own-password-1', '/dashboard');
    await expect(page).toHaveURL('/dashboard');
  } finally {
    await db.query(
      `update auth.users set encrypted_password = crypt($2, gen_salt('bf')), raw_app_meta_data = raw_app_meta_data - 'must_change_password' where email = $1`,
      [users.member2, PASSWORD],
    );
    await db.end();
  }
});

test('My profile: remove photo (with a confirm step); the uploaded file is deleted too', async ({ page }) => {
  await login(page, users.member, undefined, '/profile?tab=edit');
  await expect(page.getByRole('button', { name: 'Remove photo' })).toHaveCount(0);
  await page.getByLabel('Change photo').setInputFiles('tests/e2e/fixtures/slide-image.png');
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible({ timeout: 20_000 });
  const me = (await rest(`member_contacts?email=eq.${users.member}&select=profile_id`))[0]?.profile_id as string;
  const path = (await rest(`profiles?id=eq.${me}&select=avatar_path`))[0]?.avatar_path as string;
  expect(path).toMatch(new RegExp(`^${me}/avatar-`));

  await page.getByRole('button', { name: 'Remove photo' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect((await rest(`profiles?id=eq.${me}&select=avatar_path`))[0]?.avatar_path).toBe(path);
  await page.getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.getByText('Remove your photo?')).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Yes, remove' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Photo removed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove photo' })).toHaveCount(0);
  expect((await rest(`profiles?id=eq.${me}&select=avatar_path`))[0]?.avatar_path).toBeNull();
  const key = await serviceKey();
  const file = await fetch(`${STACK}/storage/v1/object/public/profile-media/${path}`, { headers: { apikey: key } });
  expect(file.status).not.toBe(200);
});

test('members delete referral slips and one-on-ones they filed (with a confirm step); admins delete any from Member activity', async ({ page }) => {
  const me = await idOf(users.member);
  const other = await idOf(users.member2);
  const today = new Date().toISOString().slice(0, 10);
  const [slip] = await rest('referrals', 'POST', { from_id: me, to_id: other, contact_name: 'Delete Me Prospect', status: 'contacted' });
  // A partner no other test uses, so this is the only matching row.
  const theo = (await rest(`profiles?first_name=eq.Theo&last_name=eq.Marchetti&select=id`))[0]?.id as string;
  const [ooo] = await rest('one_on_ones', 'POST', { reporter_id: me, partner_id: theo, met_on: today });
  const [theirs] = await rest('referrals', 'POST', { from_id: other, to_id: me, contact_name: 'Admin Removes This' });

  await login(page, users.member, undefined, '/referrals');
  // A slip someone else gave me has no Delete for a member.
  await expect(page.getByRole('button', { name: 'Delete referral slip for Admin Removes This' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete referral slip for Delete Me Prospect' }).click();
  await page.getByRole('form', { name: 'Delete referral slip for Delete Me Prospect' }).getByRole('button', { name: 'Cancel' }).click();
  expect(await rest(`referrals?id=eq.${slip?.id}&select=id`)).toHaveLength(1);
  await page.getByRole('button', { name: 'Delete referral slip for Delete Me Prospect' }).click();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.getByText('Delete Me Prospect')).toHaveCount(0);
  await expect.poll(async () => (await rest(`referrals?id=eq.${slip?.id}&select=id`)).length).toBe(0);

  await page.goto('/one-on-ones');
  await page.getByRole('button', { name: /^Delete one-on-one on .* with Theo Marchetti$/ }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Theo Marchetti' })).toHaveCount(0);
  await expect.poll(async () => (await rest(`one_on_ones?id=eq.${ooo?.id}&select=id`)).length).toBe(0);

  // Admin: Member activity lists everything and deletes any slip.
  await page.context().clearCookies();
  await login(page, users.admin, undefined, '/admin/activity');
  await expect(page.getByRole('heading', { level: 1, name: 'Member activity' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete referral slip for Admin Removes This' }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.getByText('Admin Removes This')).toHaveCount(0);
  await expect.poll(async () => (await rest(`referrals?id=eq.${theirs?.id}&select=id`)).length).toBe(0);
  await expectAccessible(page);
});
