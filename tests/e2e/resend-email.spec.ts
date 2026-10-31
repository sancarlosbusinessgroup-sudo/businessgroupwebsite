import { expect, test } from '@playwright/test';
import { db, expectAccessible, login, users } from './support';

// Admin "Resend" for a failed email (2026-10-24: a bad Brevo key made every notice fail, and failed
// emails could never be sent again). The Brevo stand-in can refuse the next email like a bad key.

const BREVO = 'http://127.0.0.1:54327';

async function emailsTo(to: string, subject: RegExp, waitMs: number): Promise<unknown[]> {
  const end = Date.now() + waitMs;
  for (;;) {
    const all = (await (await fetch(`${BREVO}/emails?to=${encodeURIComponent(to)}`)).json()) as { subject: string }[];
    const hits = all.filter((e) => subject.test(e.subject));
    if (hits.length || Date.now() > end) return hits;
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function logRow(prospect: string) {
  const end = Date.now() + 10_000;
  for (;;) {
    const rows = await db<{ status: string; error: string | null }>(
      `email_log?select=status,error&kind=eq.referral_received&subject=like.*${encodeURIComponent(prospect)}*`,
    );
    if ((rows[0] && rows[0].error !== 'sending') || Date.now() > end) return rows;
    await new Promise((r) => setTimeout(r, 250));
  }
}

test('a failed notice can be resent from Admin, once, to the original recipient only', async ({ page }) => {
  await fetch(`${BREVO}/reset`, { method: 'POST' });
  await fetch(`${BREVO}/fail`, { method: 'POST', body: JSON.stringify({ count: 1 }) });

  await login(page, users.admin, undefined, '/referrals');
  await page.getByLabel('Refer to member').selectOption({ label: 'Morgan Member · Test Member Studio' });
  const prospect = `Resend prospect ${Date.now()}`;
  await page.getByLabel('Prospect name').fill(prospect);
  await page.getByRole('button', { name: 'Send referral slip' }).click();
  await expect(page.getByText('Referral slip sent.')).toBeVisible();

  const [failed] = await logRow(prospect);
  expect(failed?.status).toBe('failed');
  expect(failed?.error).toContain('Key not found');
  expect(await emailsTo(users.member, new RegExp(prospect), 500)).toHaveLength(0);

  await page.goto('/admin');
  const row = page.getByRole('region', { name: 'Recent emails table' }).getByRole('row').filter({ hasText: prospect });
  await expect(row).toContainText('Failed');
  await expectAccessible(page);
  await row.getByRole('button', { name: `Resend email to ${users.member}` }).click();
  await expect(row.getByRole('status')).toHaveText('Sent.');

  expect(await emailsTo(users.member, new RegExp(prospect), 5000)).toHaveLength(1);
  const [after] = await logRow(prospect);
  expect(after).toEqual({ status: 'sent', error: null });

  await page.reload();
  const fresh = page.getByRole('region', { name: 'Recent emails table' }).getByRole('row').filter({ hasText: prospect });
  await expect(fresh).toContainText('Sent');
  await expect(fresh.getByRole('button', { name: /Resend/ })).toHaveCount(0);
  // Nobody else got a copy.
  const all = (await (await fetch(`${BREVO}/emails`)).json()) as { subject: string }[];
  expect(all.filter((e) => e.subject.includes(prospect))).toHaveLength(1);
});

test('resending one email of a guest request reaches only that person, not the admins', async ({ page }) => {
  await fetch(`${BREVO}/reset`, { method: 'POST' });
  await fetch(`${BREVO}/fail`, { method: 'POST', body: JSON.stringify({ count: 50 }) });
  const email = `guest.resend.${Date.now()}@example.org`;
  await page.goto('/visit');
  await page.getByLabel('First name').fill('Rhea');
  await page.getByLabel('Last name').fill('Resend');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Phone').fill('650-555-0124');
  await page.getByLabel('Tell us about your business').fill('Residential mortgage lending.');
  await page.getByRole('button', { name: 'Send my invite request' }).click();
  await expect(page.getByText("You're on the list, Rhea!")).toBeVisible();

  const end = Date.now() + 10_000;
  let rows: { recipient: string; status: string }[] = [];
  while (Date.now() < end) {
    rows = await db(`email_log?select=recipient,status&dedupe_key=in.(${(await db<{ id: string }>(`guest_requests?select=id&email=eq.${email}`))[0]?.id})`);
    if (rows.length > 1 && rows.every((r) => r.status === 'failed')) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  // Let the last notices finish failing before Brevo is switched back on.
  await page.waitForTimeout(1500);
  expect(rows.length).toBeGreaterThan(1);
  expect(rows.every((r) => r.status === 'failed')).toBe(true);
  await fetch(`${BREVO}/fail`, { method: 'POST', body: JSON.stringify({ count: 0 }) });

  await login(page, users.admin, undefined, '/admin');
  const row = page.getByRole('region', { name: 'Recent emails table' }).getByRole('row').filter({ hasText: email });
  await row.getByRole('button', { name: `Resend email to ${email}` }).click();
  await expect(row.getByRole('status')).toHaveText('Sent.');

  expect(await emailsTo(email, /^Thanks for your interest/, 5000)).toHaveLength(1);
  const all = (await (await fetch(`${BREVO}/emails`)).json()) as unknown[];
  expect(all).toHaveLength(1);
  const after = await db<{ status: string }>(
    `email_log?select=status&recipient=neq.${email}&subject=eq.${encodeURIComponent('New guest request: Rhea Resend')}`,
  );
  expect(after.length).toBeGreaterThan(0);
  expect(after.every((r) => r.status === 'failed')).toBe(true);
});
