import { expect, test } from '@playwright/test';
import { STACK, db, expectAccessible, login, serviceKey, users } from './support';

// Follow-ups from the website review meeting that need the 20261101000001 migration (owner asked 2026-11-01):
// second business name, birthdays + birthday slide, guest survey page.

const BREVO = 'http://127.0.0.1:54327';
type Sent = { subject: string; textContent: string };

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

async function emailsTo(to: string, subject: RegExp, timeoutMs = 10_000): Promise<Sent[]> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const all = (await (await fetch(`${BREVO}/emails?to=${encodeURIComponent(to)}`)).json()) as Sent[];
    const hits = all.filter((e) => subject.test(e.subject));
    if (hits.length || Date.now() > end) return hits;
    await new Promise((r) => setTimeout(r, 250));
  }
}

test('a member adds a second business and a birthday; the business shows on the profile and directory, the birthday only on the slide', async ({ page }) => {
  const [me] = await db<{ id: string; slug: string; business_name: string }>('profiles?select=id,slug,business_name&first_name=eq.Morgan&last_name=eq.Member');
  try {
    await login(page, users.member, undefined, '/profile?tab=edit');
    const form = page.getByRole('form', { name: 'Edit profile' });
    await form.getByLabel('Second business name (optional)').fill('Fedora Fiduciary');
    await form.getByLabel('Month').selectOption({ label: 'February' });
    await form.getByLabel('Day').fill('30');
    await form.getByRole('button', { name: 'Save profile' }).click();
    await expect(form.getByText('That month doesn’t have that many days')).toBeVisible();
    // The chosen month stays chosen after the error.
    await expect(form.getByLabel('Month')).toHaveValue('2');
    await form.getByLabel('Day').fill('14');
    await form.getByRole('button', { name: 'Save profile' }).click();
    await expect(form.getByText('Profile saved.')).toBeVisible();

    // Public profiles are cached; after a save the next visit may still be the old copy while it refreshes.
    await page.goto(`/members/${me?.slug}`);
    await expect(async () => {
      await page.reload();
      await expect(page.getByText(`${me?.business_name} | Fedora Fiduciary`)).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 20000 });
    await expect(page.getByText(/February 14|Feb 14/)).toHaveCount(0);

    // Birthday slide: a meeting in February shows "Happy birthday!" just before the BARP Champion slide.
    const [m] = await rest('meetings', 'POST', {
      slug: `birthday-slide-${Date.now()}`,
      title: 'Birthday slide meeting',
      category: 'Networking',
      starts_at: '2027-02-08T16:15:00Z',
      ends_at: '2027-02-08T17:30:00Z',
    });
    try {
      await page.goto(`/present/${m?.slug}`);
      const deck = page.getByRole('region', { name: 'Meeting slides' });
      await expect(async () => {
        if (!(await deck.getByRole('heading', { name: 'Happy birthday!' }).isVisible())) {
          await page.keyboard.press('ArrowRight');
          throw new Error('not on the birthday slide yet');
        }
      }).toPass({ timeout: 20000, intervals: [200] });
      await expect(deck.getByText('Morgan Member')).toBeVisible();
      await expect(deck.getByText('Feb 14')).toBeVisible();
      await page.keyboard.press('ArrowRight');
      await expect(deck.getByRole('heading', { name: /BARP Champion/ })).toBeVisible();
    } finally {
      await rest(`meetings?id=eq.${m?.id}`, 'DELETE');
    }
  } finally {
    await rest(`profiles?id=eq.${me?.id}`, 'PATCH', { second_business_name: null, birthday_month: null, birthday_day: null });
  }
});

test('guest survey: the emailed link opens a short form; answers reach the admins and the inviting member and show on the guest list', async ({
  page,
  browser,
}) => {
  const email = `survey.guest.${Date.now()}@example.org`;
  const last = `Surveyed${String(Date.now()).slice(-6)}`;
  const [me] = await db<{ id: string }>('profiles?select=id&first_name=eq.Morgan&last_name=eq.Member');
  const [g] = await rest('guest_requests', 'POST', { first_name: 'Sue', last_name: last, email });
  await rest(`guest_requests?id=eq.${g?.id}`, 'PATCH', { status: 'visited', referrer_id: me?.id });
  const token = `t${Date.now()}`.padEnd(40, 'x');
  await rest('guest_surveys', 'POST', { guest_id: g?.id, token });
  try {
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/guest-survey/${token}`);
    await expect(visitor.getByRole('heading', { level: 1, name: 'Thanks for visiting, Sue' })).toBeVisible();
    await visitor.getByRole('button', { name: 'Send my answers' }).click();
    await expect(visitor.getByText('Please answer the first two questions.')).toBeVisible();
    await visitor
      .getByRole('group', { name: /Are you coming back/ })
      .getByLabel('Yes')
      .check();
    await visitor
      .getByRole('group', { name: /interested in joining/ })
      .getByLabel('Maybe')
      .check();
    await visitor.getByLabel('What was the most interesting part of the meeting?').fill('The 10-minute presentation');
    await visitor.getByLabel('Who would you like to have a one-on-one with?').fill('Morgan Member');
    await expectAccessible(visitor);
    await visitor.getByRole('button', { name: 'Send my answers' }).click();
    await expect(visitor.getByText('Thank you, Sue! Your answers have been sent to the group.')).toBeVisible();
    // A second visit shows the thank-you, not the form.
    await visitor.reload();
    await expect(visitor.getByText('We already have your answers. Thank you!')).toBeVisible();
    await visitor.close();

    const [toAdmin] = await emailsTo(users.admin, new RegExp(`^Survey answers from Sue ${last}`));
    expect(toAdmin?.textContent).toContain('The 10-minute presentation');
    expect(await emailsTo(users.member, new RegExp(`^Survey answers from Sue ${last}`))).toHaveLength(1);

    await login(page, users.admin, undefined, '/admin');
    const row = page.getByRole('row').filter({ hasText: `Sue ${last}` });
    await row.locator('summary', { hasText: 'Survey answers' }).first().click();
    await expect(row.getByText('The 10-minute presentation')).toBeVisible();

    // An unknown link is a 404.
    await page.goto(`/guest-survey/${'z'.repeat(40)}`);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  } finally {
    await rest(`guest_requests?id=eq.${g?.id}`, 'DELETE');
  }
});

test('directory: the "Current BARP Champion" section is for logged-in members only, photo on the left and text on the right (owner, 2026-11-01)', async ({
  page,
  browser,
}) => {
  const [me] = await db<{ id: string }>('profiles?select=id&first_name=eq.Morgan&last_name=eq.Member');
  const month = '2099-01-01';
  await rest('champion_awards', 'POST', { month, profile_id: me?.id, reason: 'E2E champion section' });
  try {
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto('/members');
    await expect(visitor.getByRole('heading', { level: 2, name: /^Current BARP Champion · / })).toHaveCount(0);
    // Visitors still see the champion's card in the list, with the badge.
    await expect(visitor.getByRole('article').filter({ hasText: 'Morgan Member' })).toBeVisible();
    await visitor.close();

    await login(page, users.member, undefined, '/members');
    const section = page.getByRole('region', { name: /^Current BARP Champion · / });
    await expect(section).toBeVisible();
    const card = section.getByRole('article');
    const photo = await card.locator('span').first().boundingBox();
    const name = await card.getByRole('heading', { name: 'Morgan Member' }).boundingBox();
    expect(photo && name && name.x > photo.x + photo.width - 1).toBe(true);
  } finally {
    await rest(`champion_awards?month=eq.${month}`, 'DELETE');
  }
});
