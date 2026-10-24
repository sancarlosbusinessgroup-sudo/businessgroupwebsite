import { expect, test } from '@playwright/test';
import { PASSWORD, STACK, expectAccessible, login, serviceKey, users } from './support';

// Guest invite requests on Admin (owner, 2026-10-24): phone column, "Send Zoom link" email,
// one-on-ones "Done?" mark, and "Approved" for the guest's membership application with the welcome email.

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

async function rest(path: string, method = 'GET', body?: unknown) {
  const key = await serviceKey();
  const res = await fetch(`${STACK}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? [] : ((await res.json()) as Record<string, unknown>[]);
}

test('guest row: phone, Send Zoom link, one-on-ones Done?, then Approved sends the welcome email', async ({ page }) => {
  const stamp = Date.now();
  const email = `pipeline.${stamp}@example.org`;
  const [m] = await rest('meetings', 'POST', {
    slug: `pipeline-${stamp}`,
    title: 'Pipeline test meeting',
    category: 'Networking',
    starts_at: '2027-04-05T15:15:00Z',
    ends_at: '2027-04-05T16:30:00Z',
  });
  await rest('meeting_links', 'POST', { meeting_id: m?.id, join_url: 'https://zoom.example.test/j/777?pwd=guest', passcode: '246810' });
  const [g] = await rest('guest_requests', 'POST', {
    first_name: 'Paula',
    last_name: 'Pipeline',
    email,
    phone: '650-555-0199',
    business_name: 'Pipeline Plumbing',
    meeting_id: m?.id,
  });
  const key = await serviceKey();
  let userId: string | undefined;
  try {
    await login(page, users.admin, undefined, '/admin');
    const table = page.getByRole('table', { name: 'Guest invite requests' });
    for (const h of ['Guest', 'Email', 'Phone', 'Invited by', 'Requested', 'Zoom link', 'Status', 'Application', 'One-on-ones', 'Application approval'])
      await expect(table.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
    const row = table.getByRole('row').filter({ hasText: 'Paula Pipeline' });
    await expect(row.getByRole('cell', { name: '650-555-0199' })).toBeVisible();
    await expect(row.getByText('Waiting for their application')).toBeVisible();
    await expectAccessible(page);

    // Send Zoom link.
    await row.getByRole('button', { name: 'Send Zoom link to Paula Pipeline' }).click();
    await expect(row.getByRole('status')).toHaveText('Zoom link sent.');
    const [zoom] = await emailsTo(email, /^Your Zoom link for Bay Area Referral Partners/);
    expect(zoom?.htmlContent).toContain('href="https://zoom.example.test/j/777?pwd=guest"');
    expect(zoom?.textContent).toContain('Passcode: 246810');
    await page.reload();
    await expect(row.getByText(/^Sent /)).toBeVisible();

    // One-on-ones done, and undo.
    await row.getByRole('button', { name: 'Done? Mark one-on-ones done for Paula Pipeline' }).click();
    await expect(row.getByText('Done', { exact: true })).toBeVisible();
    expect((await rest(`guest_requests?id=eq.${g?.id}&select=one_on_ones_done_at`))[0]?.one_on_ones_done_at).toBeTruthy();
    await row.getByRole('button', { name: 'Undo one-on-ones for Paula Pipeline' }).click();
    await expect(row.getByRole('button', { name: /^Done\?/ })).toBeVisible();
    await row.getByRole('button', { name: /^Done\?/ }).click();
    await expect(row.getByText('Done', { exact: true })).toBeVisible();

    // The guest applies (a pending account with the same email); Approved approves it and emails the welcome.
    const res = await fetch(`${STACK}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { first_name: 'Paula', last_name: 'Pipeline', business_name: 'Pipeline Plumbing', agreed_commitments: 'true' },
      }),
    });
    userId = ((await res.json()) as { id: string }).id;
    await page.reload();
    await row.getByRole('button', { name: 'Approved (approve the application of Paula Pipeline)' }).click();
    await expect(row.getByText('Approved', { exact: true })).toBeVisible();
    expect((await rest(`profiles?id=eq.${userId}&select=status`))[0]?.status).toBe('approved');
    expect(await emailsTo(email, /^Welcome to Bay Area Referral Partners/)).toHaveLength(1);
  } finally {
    if (userId) await fetch(`${STACK}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
    await rest(`guest_requests?id=eq.${g?.id}`, 'DELETE');
    await rest(`meetings?id=eq.${m?.id}`, 'DELETE');
  }
});

test('the guest invite form asks for a phone number', async ({ page }) => {
  await page.goto('/visit');
  await expect(page.getByLabel('Phone')).toHaveAttribute('aria-required', 'true');
});
