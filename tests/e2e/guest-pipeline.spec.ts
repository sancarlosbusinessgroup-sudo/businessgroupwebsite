import { expect, test } from '@playwright/test';
import { PASSWORD, STACK, expectAccessible, login, serviceKey, users } from './support';

// Guest invite requests on Admin (owner, 2026-10-24; reworked 2026-11-25): the five guest steps as columns, every email
// confirmed in a pop-up, the panel interview scheduler, membership approval and its undo, and adding a guest by hand.

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

// Owner, 2026-11-25: the guest list has the board's five steps as columns, contact details under the name, a progress
// bar, and every email waits for a confirm in a pop-up.
test('guest row: five steps, details under the name, each email confirmed in a pop-up, panel interview, approve, undo', async ({ page }) => {
  test.setTimeout(120_000);
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
    invited_by_text: 'Morgan Member',
    meeting_id: m?.id,
  });
  const key = await serviceKey();
  let userId: string | undefined;
  try {
    await login(page, users.admin, undefined, '/admin/guests');
    const table = page.getByRole('table', { name: 'Guest invite requests, one column per step' });
    for (const h of ['Guest', 'Accept or Reject', 'Zoom Link', 'Application Form', 'Panel Interview', 'Membership Approved'])
      await expect(table.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
    for (const h of ['Email', 'Phone', 'Invited by', 'Requested']) await expect(table.getByRole('columnheader', { name: h, exact: true })).toHaveCount(0);
    const row = table.getByRole('row').filter({ hasText: 'Paula Pipeline' });
    await expect(row.getByRole('progressbar', { name: 'Paula Pipeline: progress' })).toHaveAttribute('aria-valuetext', 'Step 1 of 5: Accept or Reject');
    await row.getByText('Details', { exact: true }).click();
    await expect(row).toContainText('Phone: 650-555-0199');
    await expect(row).toContainText('Invited by: Morgan Member');
    await expectAccessible(page);

    // Accept → pop-up → Send email: the Zoom link goes out only now.
    await row.getByRole('button', { name: 'Accept Paula Pipeline' }).click();
    await page.getByRole('dialog', { name: 'Send the Zoom link email to Paula?' }).getByRole('button', { name: 'Send email' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Zoom link sent.' })).toBeVisible();
    const [zoom] = await emailsTo(email, /^Your Zoom link for Bay Area Referral Partners/);
    expect(zoom?.htmlContent).toContain('href="https://zoom.example.test/j/777?pwd=guest"');
    await page.reload();
    await expect(row.getByText(/^Link sent /)).toBeVisible();

    // First Zoom Done, then Send Form (confirmed in a pop-up).
    await row.getByRole('button', { name: 'First Zoom Done for Paula Pipeline' }).click();
    await expect(row.getByText('Application form not sent yet.')).toBeVisible();
    await row.getByRole('button', { name: 'Send Form to Paula Pipeline' }).click();
    await page.getByRole('dialog', { name: 'Email the application form to Paula?' }).getByRole('button', { name: 'Send email' }).click();
    expect(await emailsTo(email, /^You're invited to apply/)).toHaveLength(1);
    await page.reload();
    await expect(row.getByText(/^Form sent /)).toBeVisible();

    // The guest applies (a pending account with the same email).
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
    const existing = await rest(`member_applications?profile_id=eq.${userId}&select=profile_id`);
    if (!existing.length)
      await rest('member_applications', 'POST', { profile_id: userId, product_service: 'Plumbing', signature_name: 'Paula Pipeline', years_in_business: '5' });
    await rest(`guest_requests?id=eq.${g?.id}`, 'PATCH', { status: 'applied' });
    await page.reload();
    await expect(row.getByText('Application returned')).toBeVisible();
    await row.getByRole('link', { name: 'See application of Paula Pipeline' }).click();
    await expect(page).toHaveURL(new RegExp(`#application-${userId}$`));

    // Schedule the panel interview: the test admin plus two others from Management.
    const leaders = await rest('leadership?select=profile_id&profile_id=not.is.null');
    const adminId = (await rest(`member_contacts?email=eq.${users.admin}&select=profile_id`))[0]!.profile_id as string;
    const others = leaders.map((l) => l.profile_id as string).filter((x) => x !== adminId);
    const promoted = others.slice(0, 2);
    for (const id of promoted) await rest(`profiles?id=eq.${id}`, 'PATCH', { role: 'admin' });
    const addedLeader = await rest('leadership', 'POST', { name: 'Ada Admin', role: 'Test panelist', sort_order: 99, profile_id: adminId });
    try {
      await page.reload();
      await row.getByRole('button', { name: 'Schedule Panel Interview for Paula Pipeline' }).click();
      const sched = page.getByRole('dialog', { name: 'Schedule Paula’s panel interview' });
      await sched.getByLabel('Panelist 1').selectOption(adminId);
      await sched.getByLabel('Panelist 2').selectOption(promoted[0]!);
      await sched.getByLabel('Panelist 3').selectOption(promoted[1]!);
      await sched.getByLabel('Time option 1').fill('2027-03-02T10:00');
      await sched.getByLabel('Time option 2').fill('2027-03-03T11:30');
      await sched.getByRole('button', { name: 'Remove time option 3' }).click();
      await sched.getByRole('button', { name: 'Start scheduling' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Panel interview started.' })).toBeVisible();
      await page.reload();
      await expect(row).toContainText('Choosing a time · 0 of 3 answered');
      await expect(row.getByRole('progressbar', { name: 'Paula Pipeline: progress' })).toHaveAttribute('aria-valuetext', 'Step 4 of 5: Panel Interview');

      // The interview page: answer as a panelist, confirm, then confirm the email.
      await row.getByRole('link', { name: /Open the scheduler for Paula Pipeline/ }).click();
      await expect(page.getByRole('heading', { name: 'Panel interview: Paula Pipeline' })).toBeVisible();
      await page.getByRole('group', { name: 'Can you make Tue, Mar 2, 10:00 AM?' }).getByRole('button', { name: 'Yes' }).click();
      await expect(page.getByRole('group', { name: 'Can you make Tue, Mar 2, 10:00 AM?' }).getByRole('button', { name: 'Yes' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expectAccessible(page);
      await page.getByRole('button', { name: 'Confirm this time (Tue, Mar 2, 10:00 AM)' }).click();
      const mailAsk = page.getByRole('dialog', { name: 'Email Paula the interview time?' });
      await expect(mailAsk.getByRole('checkbox', { name: 'Also email the three panelists the confirmed time' })).toBeChecked();
      await mailAsk.getByRole('button', { name: 'Not now' }).click();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Set for Tue, Mar 2, 10:00 AM' })).toBeVisible();
      expect(await emailsTo(email, /^Your membership interview/, 1500)).toHaveLength(0);
      await page.getByRole('button', { name: 'Email Paula the time' }).click();
      await page.getByRole('dialog', { name: 'Email Paula the interview time?' }).getByRole('button', { name: 'Send email' }).click();
      const [iv] = await emailsTo(email, /^Your membership interview with Bay Area Referral Partners/);
      expect(iv?.textContent).toContain('Tue, Mar 2, 10:00 AM');

      // Back on the list: interview done, then approve; the welcome email waits for its pop-up.
      await page.goto('/admin/guests#guests');
      await row.getByRole('button', { name: 'Panel interview done for Paula Pipeline' }).click();
      await expect(row.getByText('Panel interview done')).toBeVisible();
      await row.getByRole('button', { name: 'Approve membership of Paula Pipeline' }).click();
      await page.getByRole('dialog', { name: 'Send the welcome email to Paula?' }).getByRole('button', { name: 'Not now' }).click();
      await page.reload();
      expect((await rest(`profiles?id=eq.${userId}&select=status`))[0]?.status).toBe('approved');
      expect(await emailsTo(email, /^Welcome to Bay Area Referral Partners/, 1500)).toHaveLength(0);
      await expect(row.getByText('Welcome email not sent yet.')).toBeVisible();
      await expect(row.getByRole('progressbar', { name: 'Paula Pipeline: progress' })).toHaveAttribute('aria-valuetext', 'Member');

      // Undo the approval (confirmed): back to pending; approve again and send the welcome email.
      await row.getByRole('button', { name: /^↩ Undo: back to Panel Interview/ }).click();
      await page.getByRole('dialog', { name: 'Undo: take back Paula’s membership approval?' }).getByRole('button', { name: 'Undo approval' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Moved back to Panel Interview.' })).toBeVisible();
      expect((await rest(`profiles?id=eq.${userId}&select=status`))[0]?.status).toBe('pending');
      await page.reload();
      await row.getByRole('button', { name: 'Approve membership of Paula Pipeline' }).click();
      await page.getByRole('dialog', { name: 'Send the welcome email to Paula?' }).getByRole('button', { name: 'Send email' }).click();
      expect(await emailsTo(email, /^Welcome to Bay Area Referral Partners/)).toHaveLength(1);
      await page.reload();
      await expect(row.getByText(/^Welcome email sent /)).toBeVisible();
    } finally {
      for (const id of promoted) await rest(`profiles?id=eq.${id}`, 'PATCH', { role: 'member' });
      await rest(`leadership?id=eq.${addedLeader[0]!.id}`, 'DELETE');
    }
  } finally {
    if (userId) await fetch(`${STACK}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
    await rest(`guest_requests?id=eq.${g?.id}`, 'DELETE');
    await rest(`meetings?id=eq.${m?.id}`, 'DELETE');
  }
});

test('membership not approved: no email, a reminder to call with their phone number; undo', async ({ page }) => {
  const stamp = Date.now();
  const email = `notapproved.${stamp}@example.org`;
  const [g] = await rest('guest_requests', 'POST', { first_name: 'Nora', last_name: `Nope${stamp}`, email, phone: '650-555-0142' });
  await rest(`guest_requests?id=eq.${g?.id}`, 'PATCH', { pipeline_stage: 'interview', status: 'visited' });
  const key = await serviceKey();
  const res = await fetch(`${STACK}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: 'Nora', last_name: 'Nope', business_name: 'Nope Co' },
    }),
  });
  const userId = ((await res.json()) as { id: string }).id;
  try {
    await login(page, users.admin, undefined, '/admin/guests#guests');
    const row = page
      .getByRole('table', { name: 'Guest invite requests, one column per step' })
      .getByRole('row')
      .filter({ hasText: `Nora Nope${stamp}` });
    await row.getByRole('button', { name: `Reject membership of Nora Nope${stamp}` }).click();
    await page.getByRole('dialog', { name: 'Not approve Nora’s membership?' }).getByRole('button', { name: 'Not approved' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Not approved. No email was sent: please call them on 650-555-0142.' })).toBeVisible();
    await page.reload();
    await expect(row).toContainText(`Call Nora Nope${stamp} on 650-555-0142`);
    expect((await rest(`profiles?id=eq.${userId}&select=status`))[0]?.status).toBe('declined');
    await row.getByRole('button', { name: /^Undo “not approved”/ }).click();
    await expect(page.getByRole('status').filter({ hasText: /waiting for a decision again/ })).toBeVisible();
    expect((await rest(`profiles?id=eq.${userId}&select=status`))[0]?.status).toBe('pending');
  } finally {
    await fetch(`${STACK}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } });
    await rest(`guest_requests?id=eq.${g?.id}`, 'DELETE');
  }
});

test('Add a guest by hand: straight into Send Application Form, no email', async ({ page }) => {
  const stamp = Date.now();
  const email = `byhand.${stamp}@example.org`;
  await login(page, users.admin, undefined, '/admin/guests');
  await page.getByRole('button', { name: '+ Add a guest' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a guest' });
  await expect(dialog.getByRole('radio', { name: /^Send Application Form \(usual\)/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Add guest' }).click();
  await expect(dialog.getByText('First name is required.')).toBeVisible();
  await dialog.getByLabel('First name').fill('Hank');
  await dialog.getByLabel('Last name').fill(`Hand${stamp}`);
  await dialog.getByLabel('Email').fill(email);
  await dialog.getByLabel('Phone').fill('650-555-0177');
  await dialog.getByLabel('Invited by (member)').selectOption({ label: 'Morgan Member' });
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Add guest' }).click();
  await expect(dialog.getByRole('status')).toHaveText(`Hank Hand${stamp} was added to Send Application Form. No email was sent.`);
  const [g] = await rest(`guest_requests?email=eq.${email}&select=id,status,pipeline_stage,invited_by_text,added_by,referrer_id`);
  try {
    expect(g).toMatchObject({ status: 'visited', pipeline_stage: 'send_application', invited_by_text: 'Morgan Member' });
    expect(g!.added_by).toBeTruthy();
    expect(g!.referrer_id).toBeTruthy();
    await page.reload();
    await expect(page.locator(`[data-guest-card="${g!.id}"]`)).toContainText('Added by hand');
    expect(await emailsTo(email, /./, 1500)).toHaveLength(0);
  } finally {
    await rest(`guest_requests?id=eq.${g!.id}`, 'DELETE');
  }
});

test('the guest invite form asks for a phone number', async ({ page }) => {
  await page.goto('/visit');
  await expect(page.getByLabel('Phone')).toHaveAttribute('aria-required', 'true');
});
