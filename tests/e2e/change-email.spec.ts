import { expect, test } from '@playwright/test';
import { PASSWORD, STACK, expectAccessible, login, serviceKey } from './support';

// Members change their own login email (owner, 2026-10-27): password check → 6-digit code to the new address → confirmed.

const BREVO = 'http://127.0.0.1:54327';
type Sent = { subject: string; htmlContent: string; textContent: string };

async function emailsTo(to: string, subject: RegExp, timeoutMs = 10_000): Promise<Sent[]> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const all = (await (await fetch(`${BREVO}/emails?to=${encodeURIComponent(to)}`)).json()) as Sent[];
    const hits = all.filter((e) => subject.test(e.subject));
    if (hits.length || Date.now() > end) return hits;
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function rest(path: string, method: string, body?: unknown) {
  const key = await serviceKey();
  const res = await fetch(`${STACK}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? [] : ((await res.json()) as Record<string, unknown>[]);
}

test('a member changes their login email with a code sent to the new address', async ({ page }) => {
  const stamp = Date.now();
  const oldEmail = `e2e.oldmail.${stamp}@example.test`;
  const newEmail = `e2e.newmail.${stamp}@example.test`;
  const key = await serviceKey();
  const created = await fetch(`${STACK}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: oldEmail,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: 'Emma', last_name: 'Mailchange', business_name: 'Mailchange Co', guest_meetings_attended: '2', agreed_commitments: 'true' },
    }),
  });
  expect(created.ok).toBe(true);
  const userId = ((await created.json()) as { id: string }).id;
  await rest(`profiles?id=eq.${userId}`, 'PATCH', { status: 'approved' });

  await login(page, oldEmail, PASSWORD, '/profile?tab=edit');
  const box = page.getByRole('region', { name: 'Change email' });
  await expect(box).toContainText(`You log in with ${oldEmail}`);
  const start = box.getByRole('form', { name: 'Change your login email' });

  // Wrong password: nothing is sent.
  await start.getByLabel('New email').fill(newEmail);
  await start.getByLabel('Current password').fill('not-my-password');
  await start.getByRole('button', { name: 'Send code' }).click();
  await expect(start.getByText('That isn’t your current password.')).toBeVisible();
  expect(await emailsTo(newEmail, /Confirm your new email/, 1000)).toHaveLength(0);

  await start.getByLabel('Current password').fill(PASSWORD);
  await start.getByRole('button', { name: 'Send code' }).click();
  const confirm = box.getByRole('form', { name: 'Confirm your new email' });
  await expect(confirm).toContainText(`We sent a 6-digit code to ${newEmail}`);
  const [mail] = await emailsTo(newEmail, /^Confirm your new email/);
  const code = mail?.textContent.match(/\b(\d{6})\b/)?.[1] ?? '';
  expect(code).toMatch(/^\d{6}$/);
  expect(mail?.subject).not.toContain(code);
  await expectAccessible(page);

  // The step survives a reload; a wrong code counts down the tries.
  await page.reload();
  await confirm.getByLabel('Code from the email').fill(code === '000000' ? '111111' : '000000');
  await confirm.getByRole('button', { name: 'Confirm new email' }).click();
  await expect(confirm.getByText(/That code doesn’t match\. 4 tries left\./)).toBeVisible();

  await confirm.getByLabel('Code from the email').fill(code);
  await confirm.getByRole('button', { name: 'Confirm new email' }).click();
  await expect(box.getByRole('status')).toHaveText(`Done. You now log in with ${newEmail}.`);

  // The old address is told; the contact email (directory, group emails) moved too.
  const [notice] = await emailsTo(oldEmail, /login email was changed/);
  expect(notice?.textContent).toContain(newEmail);
  const [contact] = await rest(`member_contacts?select=email&profile_id=eq.${userId}`, 'GET');
  expect(contact?.email).toBe(newEmail);

  // Old email no longer logs in; the new one does, with the same password.
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto('/login');
  await page.getByLabel('Email').first().fill(oldEmail);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await login(page, newEmail, PASSWORD, '/profile?tab=edit');
  await expect(page.getByRole('region', { name: 'Change email' })).toContainText(`You log in with ${newEmail}`);
});

test('an email already used by another member is refused', async ({ page }) => {
  const stamp = Date.now();
  const mine = `e2e.mine.${stamp}@example.test`;
  const key = await serviceKey();
  const res = await fetch(`${STACK}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: mine,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: 'Theo', last_name: 'Taken', business_name: 'Taken Co', guest_meetings_attended: '2', agreed_commitments: 'true' },
    }),
  });
  const id = ((await res.json()) as { id: string }).id;
  await rest(`profiles?id=eq.${id}`, 'PATCH', { status: 'approved' });
  const [other] = await rest(`member_contacts?select=email&profile_id=neq.${id}&limit=1`, 'GET');

  await login(page, mine, PASSWORD, '/profile?tab=edit');
  const start = page.getByRole('form', { name: 'Change your login email' });
  await start.getByLabel('New email').fill(String(other?.email));
  await start.getByLabel('Current password').fill(PASSWORD);
  await start.getByRole('button', { name: 'Send code' }).click();
  await expect(start.getByText('Another member already uses that email.')).toBeVisible();
});
