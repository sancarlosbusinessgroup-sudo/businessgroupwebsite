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

// Owner 2026-11-23 (requirement change): a BARP Champion at every meeting, from the points earned since the previous
// meeting up to the end of this one, instead of one per month. The four tests below were rewritten for that rule.

const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const MIN = 60_000;

/** Press → until the BARP Champion slide shows (presses before the deck hydrates are ignored). */
async function toChampionSlide(page: import('@playwright/test').Page) {
  const deck = page.getByRole('region', { name: 'Meeting slides' });
  await expect(async () => {
    if (!(await deck.getByRole('heading', { name: 'BARP Champion' }).isVisible())) {
      await page.keyboard.press('ArrowRight');
      throw new Error('not on the champion slide yet');
    }
  }).toPass({ timeout: 20000, intervals: [200] });
  return deck.getByRole('group').filter({ visible: true });
}

test('BARP Champion: ranking since the last meeting with lifetime points, override needs a reason, badge on profile and directory', async ({ page }) => {
  const me = await idOf(users.member);
  const other = await idOf(users.member2);
  // The page opens on the meeting in progress: points since the previous meeting up to its end. Points made now count there.
  const page1 = '/admin/champion';
  // Other tests in a full run may already have given the member points, so measure first and check two referrals add 2.
  await login(page, users.admin, undefined, page1);
  const cells = () =>
    page
      .getByRole('table', { name: /Points per member/ })
      .getByRole('row')
      .filter({ hasText: 'Morgan Member' })
      .getByRole('cell');
  await expect(page.getByRole('heading', { level: 2, name: /^Ranking: / })).toBeVisible();
  const before = (await cells().count()) ? Number(await cells().nth(1).textContent()) : 0;
  await page.goto('/admin/champion?p=lifetime');
  await expect(page.getByRole('heading', { level: 2, name: 'Ranking: Lifetime points' })).toBeVisible();
  const lifetimeBefore = (await cells().count()) ? Number(await cells().nth(1).textContent()) : 0;
  const made = [
    ...(await rest('referrals', 'POST', { from_id: me, to_id: other, contact_name: 'Champion Prospect A' })),
    ...(await rest('referrals', 'POST', { from_id: me, to_id: other, contact_name: 'Champion Prospect B' })),
  ];
  let meetingId = '';
  try {
    await page.goto(page1);
    await expect(page.getByRole('heading', { level: 1, name: 'BARP Champion' })).toBeVisible();
    await expect(page.getByLabel('Meeting', { exact: true }).locator('option:checked')).toHaveText(/\(in progress\)/);
    meetingId = await page.getByLabel('Meeting', { exact: true }).inputValue();
    await expect(page.getByText(/^Points from the end of the .* meeting to the end of this meeting \(so far\)\.$/)).toBeVisible();
    // Cells: rank, Points, Lifetime points, Referrals… (the member's name is the row header).
    await expect(cells().nth(1)).toHaveText(String(before + 2));
    await expect(cells().nth(2)).toHaveText(String(lifetimeBefore + 2));
    await expectAccessible(page);

    // Lifetime view: everything ever earned.
    await page.getByLabel('Meeting', { exact: true }).selectOption('lifetime');
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Ranking: Lifetime points' })).toBeVisible();
    await expect(cells().nth(1)).toHaveText(String(lifetimeBefore + 2));

    // Choosing someone other than the automatic pick needs a reason.
    await page.goto(page1);
    const form = page.getByRole('form', { name: 'Choose the champion' });
    await form.getByLabel('Champion').selectOption(other);
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
    await expect(page.getByText(/^Current BARP Champion · .* meeting$/)).toBeVisible();
    await page.goto(`/members?q=Second+Test+Bakery`);
    await expect(page.getByRole('article').filter({ hasText: 'Riley Second' }).getByText('BARP Champion')).toBeVisible();
  } finally {
    for (const r of made) await rest(`referrals?id=eq.${r.id}`, 'DELETE');
    if (meetingId) await rest(`meeting_champions?meeting_id=eq.${meetingId}`, 'DELETE');
  }
});

test('champion slide: the leader since the last meeting, live; points reported during the meeting count after Refresh', async ({ page }) => {
  const me = await idOf(users.member);
  const other = await idOf(users.member2);
  // A meeting in progress (started 10 minutes ago).
  const [m] = await rest('meetings', 'POST', {
    slug: `champion-live-${Date.now()}`,
    title: 'Champion live meeting',
    category: 'Networking',
    starts_at: iso(-10 * MIN),
    ends_at: iso(65 * MIN),
  });
  const made: Record<string, unknown>[] = [];
  try {
    // Riley's and the leader's points for this meeting, from the admin ranking.
    await login(page, users.admin, undefined, `/admin/champion?p=${m?.id}`);
    await expect(page.getByRole('heading', { level: 2, name: /^Ranking: / })).toBeVisible();
    const table = page.getByRole('table', { name: /Points per member/ });
    const pointsOf = async (name: string) => {
      const row = table.getByRole('row').filter({ hasText: name });
      return (await row.count()) ? Number(await row.getByRole('cell').nth(1).textContent()) : 0;
    };
    const top = (await table.count()) ? Number(await table.getByRole('row').nth(1).getByRole('cell').nth(1).textContent()) : 0;
    const riley = await pointsOf('Riley Second');

    await page.goto(`/present/${m?.slug}`);
    let slide = await toChampionSlide(page);
    await expect(slide.getByText(/^BARP Champion · .* meeting$/)).toBeVisible();
    await expect(slide.getByText(/^Points since the .* meeting$/)).toBeVisible();
    // Exactly one person: the leader.
    await expect(slide.getByText(/^\d+ points?$/)).toHaveCount(top ? 1 : 0);

    // During the meeting Riley reports enough referrals to take the lead; Refresh (R) shows it.
    for (let i = 0; i <= top - riley; i++) made.push(...(await rest('referrals', 'POST', { from_id: other, to_id: me, contact_name: `Live Prospect ${i}` })));
    await page.keyboard.press('r');
    slide = await toChampionSlide(page);
    await expect(slide.getByText('Riley Second')).toBeVisible();
    await expect(slide.getByText(`${top + 1} points`)).toBeVisible();
    await expect(slide.getByTestId('fireworks')).toBeAttached();
    await expectAccessible(page);
  } finally {
    for (const r of made) await rest(`referrals?id=eq.${r.id}`, 'DELETE');
    await rest(`meetings?id=eq.${m?.id}`, 'DELETE');
  }
});

test('champion slide: a champion recorded for the meeting shows with the reason and fireworks', async ({ page }) => {
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
  await rest('meeting_champions', 'POST', {
    meeting_id: m?.id,
    profile_id: other,
    reason: 'Brought three visitors who joined',
    points: { points: 42, referrals: 3 },
    period_to: '2028-02-07T17:30:00Z',
  });
  try {
    await login(page, users.member, undefined, `/present/${m?.slug}`);
    const slide = await toChampionSlide(page);
    await expect(slide.getByText('BARP Champion · Feb 7, 2028 meeting')).toBeVisible();
    await expect(slide.getByText('Riley Second')).toBeVisible();
    await expect(slide.getByText('“Brought three visitors who joined”')).toBeVisible();
    await expect(slide.getByText('3 referrals')).toBeVisible();
    await expect(slide.getByTestId('fireworks')).toBeAttached();
  } finally {
    await rest(`meetings?id=eq.${m?.id}`, 'DELETE');
  }
});

test('after a meeting its automatic champion is recorded and stays; later points go to the next meeting', async ({ page }) => {
  const me = await idOf(users.member);
  const other = await idOf(users.member2);
  // A meeting that ended over a day ago (no attendance taken): it is recorded a day after it ended.
  const [m] = await rest('meetings', 'POST', {
    slug: `champion-done-${Date.now()}`,
    title: 'Champion finished meeting',
    category: 'Networking',
    starts_at: iso(-27 * 60 * MIN),
    ends_at: iso(-26 * 60 * MIN),
  });
  const made: Record<string, unknown>[] = [];
  try {
    await login(page, users.admin, undefined, `/admin/champion?p=${m?.id}`);
    await expect(page.getByRole('heading', { level: 2, name: /^Ranking: / })).toBeVisible();
    const [rec] = await rest(`meeting_champions?meeting_id=eq.${m?.id}&select=profile_id,auto_profile_id,chosen_by,points`);
    if (!rec) {
      // Nobody had points in its period: nothing to record.
      await expect(page.getByText(/nobody has points yet/)).toBeVisible();
      return;
    }
    expect(rec.profile_id).toBe(rec.auto_profile_id);
    expect(rec.chosen_by).toBeNull();
    const winner = (await rest(`profiles?id=eq.${rec.profile_id}&select=first_name,last_name`))[0] as { first_name: string; last_name: string };
    await expect(page.getByText(new RegExp(`${winner.first_name} ${winner.last_name}.*is the champion`))).toBeVisible();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: new RegExp(`meeting: ${winner.first_name} ${winner.last_name}`) })
        .first(),
    ).toBeVisible();

    // Points reported now belong to the next meeting: the recorded champion does not change.
    for (let i = 0; i < 5; i++)
      made.push(
        ...(await rest('referrals', 'POST', { from_id: rec.profile_id === me ? other : me, to_id: rec.profile_id, contact_name: `Later Prospect ${i}` })),
      );
    await page.reload();
    const [again] = await rest(`meeting_champions?meeting_id=eq.${m?.id}&select=profile_id`);
    expect(again?.profile_id).toBe(rec.profile_id);
  } finally {
    for (const r of made) await rest(`referrals?id=eq.${r.id}`, 'DELETE');
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
