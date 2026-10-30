import { expect, test } from '@playwright/test';
import { STACK, expectAccessible, login, serviceKey, users } from './support';

// Owner batch 2026-10-30: wording, add-to-calendar menu, boxed stats on Home, BARP Champion points, "How This Works"
// on every admin tab, the visitor sign-in link, and the Management recap email (Member recap renamed).

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

test.describe.configure({ mode: 'serial' });

test('home: new meeting line, stats in rounded cards aligned to the top, new founded and fees wording', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('We meet every other Monday at 8:15 AM - 9:30AM on Zoom', { exact: true })).toBeVisible();
  await expect(page.getByText(/occasional in-person/)).toHaveCount(0);
  const stats = page.getByRole('region', { name: 'At a glance' });
  await expect(stats.getByText('Originally founded with the San Carlos Chamber of Commerce.')).toBeVisible();
  await expect(stats.getByText('No membership fees. We just ask for full participation.')).toBeVisible();
  const cards = stats.locator('dl > div');
  await expect(cards).toHaveCount(4);
  const tops = await cards.evaluateAll((els) =>
    els.map((el) => {
      const dd = el.querySelector('dd')!.getBoundingClientRect().top - el.getBoundingClientRect().top;
      const cs = getComputedStyle(el);
      return { dd: Math.round(dd), radius: parseFloat(cs.borderTopLeftRadius), border: cs.borderTopStyle };
    }),
  );
  for (const t of tops) {
    expect(t.radius).toBeGreaterThan(0);
    expect(t.border).toBe('solid');
  }
  // Every value starts at the same distance from its card's top edge, whatever the label length.
  expect(new Set(tops.map((t) => t.dd)).size).toBe(1);
  await expectAccessible(page);
});

test('about and visit wording', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByText('Originally founded with the San Carlos Chamber of Commerce.')).toBeVisible();
  await page.goto('/visit');
  await expect(page.getByText(/It's one business profession per person\./)).toBeVisible();
  await page.goto('/group-meetings');
  await expect(page.getByText('We meet every other Monday at 8:15 AM - 9:30AM on Zoom', { exact: true })).toBeVisible();
});

test('add to calendar: Google, Outlook, Microsoft 365, Yahoo, Apple and an .ics download', async ({ page }) => {
  await page.goto('/group-meetings');
  const first = page.getByRole('article').first();
  const menu = first.locator('details.add-to-calendar');
  await menu.locator('summary').click();
  const google = menu.getByRole('link', { name: /Google Calendar/ });
  await expect(google).toBeVisible();
  const href = (await google.getAttribute('href')) ?? '';
  const u = new URL(href);
  expect(u.host).toBe('calendar.google.com');
  expect(u.searchParams.get('dates')).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/);
  await expect(menu.getByRole('link', { name: /Outlook\.com/ })).toHaveAttribute('href', /outlook\.live\.com/);
  await expect(menu.getByRole('link', { name: /Microsoft 365/ })).toHaveAttribute('href', /outlook\.office\.com/);
  await expect(menu.getByRole('link', { name: /Yahoo Calendar/ })).toHaveAttribute('href', /calendar\.yahoo\.com/);
  await expect(menu.getByRole('link', { name: 'Apple Calendar' })).toHaveAttribute('href', /\/calendar\.ics$/);
  const ics = menu.getByRole('link', { name: 'Download .ics file' });
  await expect(ics).toHaveAttribute('download', '');
  const res = await page.request.get((await ics.getAttribute('href')) ?? '');
  expect(res.headers()['content-type']).toContain('text/calendar');
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(google).toBeHidden();
});

test('every admin tab: short description under the menu, "Read more" drops down How This Works', async ({ page }) => {
  await login(page, users.admin, undefined, '/admin');
  for (const path of [
    '/admin',
    '/admin/members',
    '/admin/meetings',
    '/admin/attendance',
    '/admin/activity',
    '/admin/champion',
    '/admin/stats',
    '/admin/leadership',
    '/admin/recap',
    '/admin/management-recap',
    '/admin/materials',
    '/admin/gallery',
    '/admin/history',
  ]) {
    await page.goto(path);
    const how = page.locator('.how-this-works');
    await expect(how, path).toHaveCount(1);
    // The short description, then "Read more" drops down the bullets.
    const more = how.getByRole('button', { name: 'Read more' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(how.getByRole('heading', { name: 'How This Works' })).toBeHidden();
    await more.click();
    await expect(how.getByRole('heading', { name: 'How This Works' })).toBeVisible();
    await expect(how.locator('li').first()).toBeVisible();
    await how.getByRole('button', { name: 'Show less' }).click();
    await expect(how.locator('li').first()).toBeHidden();
  }
  await page.goto('/admin/champion');
  await expect(page.getByText(/1 point for each referral given, 1 for each one-on-one done/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Member recap' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Management recap' })).toBeVisible();
});

test('visitor sign-in link: a walk-in visitor signs in and shows on Guest invite requests as Visiting, signed in at the meeting', async ({ page }) => {
  const stamp = Date.now();
  const email = `walkin.${stamp}@example.org`;
  // A regular meeting in progress right now.
  const [m] = await rest('meetings', 'POST', {
    slug: `signin-${stamp}`,
    title: 'Sign-in test meeting',
    category: 'Networking',
    starts_at: new Date(stamp - 5 * 60_000).toISOString(),
    ends_at: new Date(stamp + 60 * 60_000).toISOString(),
  });
  try {
    await login(page, users.admin, undefined, '/admin');
    const card = page.getByRole('region', { name: 'Visitor sign-in link' });
    await expect(card.locator('output')).toHaveText(/\/visitor-sign-in$/);
    await page.context().clearCookies();

    await page.goto('/visitor-sign-in');
    await expect(page.getByRole('heading', { level: 1, name: /Welcome to/ })).toBeVisible();
    await expect(page.getByText(/Thanks for joining today’s meeting/)).toBeVisible();
    await expectAccessible(page);
    await page.getByLabel('First name').fill('Wally');
    await page.getByLabel('Last name').fill('Walkin');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Phone').fill('650-555-0199');
    await page.getByLabel('Business name').fill('Walkin Windows');
    await page.getByLabel('Which member invited you?').selectOption({ label: 'Morgan Member · Test Member Studio' });
    await page.getByRole('button', { name: 'Sign in as a visitor' }).click();
    await expect(page.getByRole('status').getByText(/Thank you, Wally!/)).toBeVisible();

    const [g] = await rest(`guest_requests?email=eq.${encodeURIComponent(email)}&select=status,source,meeting_id,referrer_id,invited_by_text`);
    expect(g).toMatchObject({ status: 'visited', source: 'meeting_sign_in', meeting_id: m?.id, invited_by_text: 'Morgan Member' });
    expect(g?.referrer_id).toBeTruthy();

    // Signing in again does not add a second row.
    await page.goto('/visitor-sign-in');
    await page.getByLabel('First name').fill('Wally');
    await page.getByLabel('Last name').fill('Walkin');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Phone').fill('650-555-0199');
    await page.getByRole('button', { name: 'Sign in as a visitor' }).click();
    await expect(page.getByRole('status').getByText(/Thank you, Wally!/)).toBeVisible();
    expect(await rest(`guest_requests?email=eq.${encodeURIComponent(email)}&select=id`)).toHaveLength(1);

    await login(page, users.admin, undefined, '/admin');
    const row = page.getByRole('row').filter({ hasText: 'Wally Walkin' });
    await expect(row.getByText('Signed in at the meeting')).toBeVisible();
    await expect(row.getByText('Visiting')).toBeVisible();
  } finally {
    await rest(`guest_requests?email=eq.${encodeURIComponent(email)}`, 'DELETE');
    await rest(`meetings?id=eq.${m?.id}`, 'DELETE');
  }
});

test('management recap: preview for admins, sent to admins once attendance is taken, with its own switch', async ({ page, request }) => {
  const stamp = Date.now();
  const [m] = await rest('meetings', 'POST', {
    slug: `mgmt-recap-${stamp}`,
    title: 'Management recap test',
    category: 'Networking',
    starts_at: '2027-05-03T15:15:00Z',
    ends_at: '2027-05-03T16:30:00Z',
  });
  const [admin] = await rest(`profiles?select=id&first_name=eq.Ada&last_name=eq.Admin`);
  const [morgan] = await rest(`profiles?select=id&first_name=eq.Morgan&last_name=eq.Member`);
  const auth = { authorization: 'Bearer local-cron-secret' };
  try {
    // Not taken yet and only 2.5 hours after: nothing goes out.
    const early = await (await request.get('/api/cron/after-meeting?now=2027-05-03T19:00:00Z', { headers: auth })).json();
    expect(early.managementRecaps).toBe(0);

    // Attendance taken by hand: Morgan present, joined late on Zoom.
    await rest('attendance', 'POST', {
      meeting_id: m?.id,
      profile_id: morgan?.id,
      status: 'present',
      zoom: true,
      joined_at: '2027-05-03T15:40:00Z',
      left_at: '2027-05-03T16:30:00Z',
      minutes: 50,
    });
    // (The 19:00 run above tried Zoom and left an error row: replace it.)
    await rest(`attendance_imports?meeting_id=eq.${m?.id}`, 'DELETE');
    await rest('attendance_imports', 'POST', { meeting_id: m?.id, source: 'manual', status: 'done', participants: 1, matched: 1 });

    await login(page, users.admin, undefined, '/admin/management-recap');
    await expect(page.getByRole('heading', { level: 1, name: 'Management recap' })).toBeVisible();
    await expect(page.getByTestId('mgmt-recap-status')).toHaveText(/On$/);
    await page.getByRole('button', { name: 'Turn off Management recap' }).click();
    await expect(page.getByTestId('mgmt-recap-status')).toHaveText(/Off$/);
    const off = await (await request.get('/api/cron/after-meeting?now=2027-05-03T19:05:00Z', { headers: auth })).json();
    expect(off.managementRecaps).toBe(0);
    await page.getByRole('button', { name: 'Turn on Management recap' }).click();
    await expect(page.getByTestId('mgmt-recap-status')).toHaveText(/On$/);
    await expectAccessible(page, ['iframe[title="Management recap email preview"]']);

    const on = await (await request.get('/api/cron/after-meeting?now=2027-05-03T19:10:00Z', { headers: auth })).json();
    expect(on.managementRecaps).toBeGreaterThan(0);
    const mail = (await emailsTo(users.admin, /^Management recap: /)).find((e) => e.textContent.includes('Management recap test'));
    expect(mail?.textContent).toContain('Morgan Member');
    expect(mail?.textContent).toMatch(/Late \(after 8:30\): .*Morgan Member/);
    // Once per meeting.
    const again = await (await request.get('/api/cron/after-meeting?now=2027-05-03T19:15:00Z', { headers: auth })).json();
    expect(again.managementRecaps).toBe(0);
    expect(admin?.id).toBeTruthy();
  } finally {
    await rest('email_settings?id=eq.1', 'PATCH', { management_recaps_enabled: true });
    await rest(`email_log?dedupe_key=eq.${m?.id}`, 'DELETE');
    await rest(`meetings?id=eq.${m?.id}`, 'DELETE');
  }
});
