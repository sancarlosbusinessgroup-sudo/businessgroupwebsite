import { expect, test } from '@playwright/test';
import { PASSWORD, STACK, expectAccessible, login, serviceKey, users } from './support';

// Owner decisions 2026-10-23 (evening): private one-on-one notes shown to their author, BARP Champion, account deletion.

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
const profileBy = async (first: string, last: string) =>
  (await rest(`profiles?first_name=eq.${first}&last_name=eq.${last}&select=id,slug`))[0] as { id: string; slug: string };

test.describe.configure({ mode: 'serial' });

test('the private note on a one-on-one report is shown only to the member who wrote it', async ({ page }) => {
  await login(page, users.member, undefined, '/one-on-ones');
  await page.getByLabel('Who did you meet with?').selectOption({ label: 'Grace Nakamura · Laurel Street Chiropractic' });
  await page.getByLabel(/^Private note/).fill('Follow up about the January workshop');
  await page.getByRole('button', { name: 'Report one-on-one' }).click();
  const hist = page.getByRole('region', { name: 'My one-on-one history' });
  await expect(hist.getByText('My private note: Follow up about the January workshop')).toBeVisible();
  const me = await idOf(users.member);
  await rest(`one_on_ones?reporter_id=eq.${me}&partner_id=eq.${(await profileBy('Grace', 'Nakamura')).id}`, 'DELETE');
});

test('BARP Champion: ranking, override needs a reason, badge on profile and directory, slide with fireworks', async ({ page }) => {
  const me = await idOf(users.member);
  const other = await idOf(users.member2);
  // Give the test member points this month: two referral slips (10 points).
  const made = [
    ...(await rest('referrals', 'POST', { from_id: me, to_id: other, contact_name: 'Champion Prospect A' })),
    ...(await rest('referrals', 'POST', { from_id: me, to_id: other, contact_name: 'Champion Prospect B' })),
  ];
  const month = new Date().toLocaleString('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'America/Los_Angeles' }).slice(0, 7);
  try {
    await login(page, users.admin, undefined, `/admin/champion?m=${month}`);
    await expect(page.getByRole('heading', { level: 1, name: 'BARP Champion' })).toBeVisible();
    const ranking = page.getByRole('table', { name: /Points per member/ });
    await expect(ranking.getByRole('row').filter({ hasText: 'Morgan Member' })).toContainText('10');
    await expectAccessible(page);

    // Choosing someone other than the automatic pick needs a reason.
    const form = page.getByRole('form', { name: 'Choose the champion' });
    await form.getByLabel('Champion').selectOption({ label: 'Riley Second · 0 pts' });
    await form.getByRole('button', { name: 'Save champion' }).click();
    await expect(form.getByText(/Please explain why this member is the champion/)).toBeVisible();
    await form.getByLabel('Reason').fill('Hosted the holiday mixer for the whole group');
    await form.getByRole('button', { name: 'Save champion' }).click();
    await expect(form.getByRole('status')).toHaveText('Champion saved.');
    await page.reload();
    await expect(page.getByText(/Riley Second.*is the champion \(chosen by an admin instead of the automatic pick\)/)).toBeVisible();

    // Badge on the profile and the directory card.
    const riley = await rest(`profiles?id=eq.${other}&select=slug`);
    await page.goto(`/members/${riley[0]?.slug}`);
    await expect(page.getByText(/^BARP Champion · /)).toBeVisible();
    await page.goto(`/members?q=Second+Test+Bakery`);
    await expect(page.getByRole('article').filter({ hasText: 'Riley Second' }).getByText('BARP Champion')).toBeVisible();
  } finally {
    for (const r of made) await rest(`referrals?id=eq.${r.id}`, 'DELETE');
    await rest(`champion_awards?month=eq.${month}-01`, 'DELETE');
  }
});

test('champion slide: at the first meeting of a month it shows last month’s champion, the reason and fireworks', async ({ page }) => {
  const other = await idOf(users.member2);
  const [m] = await rest('meetings', 'POST', {
    slug: `champion-slide-${Date.now()}`,
    title: 'Champion slide test meeting',
    category: 'Networking',
    starts_at: '2028-02-07T16:15:00Z',
    ends_at: '2028-02-07T17:30:00Z',
    is_online: true,
    location: 'Zoom',
  });
  await rest('champion_awards', 'POST', {
    month: '2028-01-01',
    profile_id: other,
    reason: 'Brought three visitors who joined',
    points: { points: 42, referrals: 3 },
  });
  try {
    await login(page, users.member, undefined, `/present/${m?.slug}`);
    const deck = page.getByRole('region', { name: 'Meeting slides' });
    for (let i = 0; i < 20; i++) {
      if (await deck.getByRole('heading', { name: 'BARP Champion' }).isVisible()) break;
      await page.keyboard.press('ArrowRight');
    }
    const slide = deck.getByRole('group').filter({ visible: true });
    await expect(slide.getByText('January 2028')).toBeVisible();
    await expect(slide.getByText('Riley Second')).toBeVisible();
    await expect(slide.getByText('“Brought three visitors who joined”')).toBeVisible();
    await expect(slide.getByText('3 referrals')).toBeVisible();
    await expect(slide.getByTestId('fireworks')).toBeAttached();
  } finally {
    await rest(`champion_awards?month=eq.2028-01-01`, 'DELETE');
    await rest(`meetings?id=eq.${m?.id}`, 'DELETE');
  }
});

test('a member deletes their own account; shared referral slips stay as “Former member”', async ({ page }) => {
  const key = await serviceKey();
  const email = `leaving.${Date.now()}@example.test`;
  const res = await fetch(`${STACK}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: 'Lee', last_name: 'Leaving', business_name: 'Leaving Co', agreed_commitments: 'true' },
    }),
  });
  const { id } = (await res.json()) as { id: string };
  await rest(`profiles?id=eq.${id}`, 'PATCH', { status: 'approved' });
  const me = await idOf(users.member);
  const [slip] = await rest('referrals', 'POST', { from_id: id, to_id: me, contact_name: 'Leaving Prospect' });

  await login(page, email, PASSWORD, '/profile?tab=edit');
  await page.getByRole('button', { name: 'Delete my account…' }).click();
  const form = page.getByRole('form', { name: 'Confirm account deletion' });
  await form.getByRole('button', { name: 'Delete my account for good' }).click();
  await expect(form.getByText('Type DELETE in capitals to confirm')).toBeVisible();
  await expectAccessible(page);
  await form.getByLabel(/^Type DELETE to confirm/).fill('DELETE');
  await form.getByRole('button', { name: 'Delete my account for good' }).click();
  await expect(page).toHaveURL(/\/\?account=deleted/);
  await expect(page.getByText(/Your account has been deleted/)).toBeVisible();
  expect(await rest(`profiles?id=eq.${id}&select=id`)).toHaveLength(0);
  expect((await rest(`referrals?id=eq.${slip?.id}&select=from_id,to_id`))[0]).toEqual({ from_id: null, to_id: me });

  await page.context().clearCookies();
  await login(page, users.member, undefined, '/referrals');
  await expect(page.getByRole('listitem').filter({ hasText: 'Leaving Prospect' })).toContainText('Former member');
  await rest(`referrals?id=eq.${slip?.id}`, 'DELETE');
});
