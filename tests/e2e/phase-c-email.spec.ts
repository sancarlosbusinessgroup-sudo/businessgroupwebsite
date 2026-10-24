import { expect, test } from '@playwright/test';
import { PASSWORD, STACK, db, expectAccessible, login, serviceKey, users } from './support';

// Phase C: emails through Brevo. The local stack points the site at a Brevo stand-in (scripts/local-stack/brevo-mock.mjs).

const BREVO = 'http://127.0.0.1:54327';
type Sent = { subject: string; htmlContent: string; textContent: string; sender: { email: string }; tags: string[] };

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

test.describe.configure({ mode: 'serial' });

test.describe('email notifications', () => {
  test('approving an applicant sends the welcome email and adds them to the newsletter list; onboarding then completes', async ({ page }) => {
    const email = `e2e.onboard.${Date.now()}@example.test`;
    const key = await serviceKey();
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    const res = await fetch(`${STACK}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: {
          first_name: 'Olive',
          last_name: 'Onboard',
          business_name: 'Onboard Test Co',
          guest_meetings_attended: '2',
          agreed_commitments: 'true',
        },
      }),
    });
    expect(res.ok).toBe(true);

    await login(page, users.admin, undefined, '/admin');
    await page.getByRole('button', { name: 'Approve Olive Onboard' }).click();
    await expect(page.getByRole('button', { name: 'Approve Olive Onboard' })).toHaveCount(0);

    const [welcome] = await emailsTo(email, /^Welcome to Bay Area Referral Partners/);
    expect(welcome?.sender.email).toBe('hello@notify.bayareareferralpartners.com');
    expect(welcome?.htmlContent).toContain('/onboarding');
    const contacts = (await (await fetch(`${BREVO}/contacts`)).json()) as { path: string; body: { email: string; listIds: number[] } }[];
    expect(contacts.some((c) => c.path === '/v3/contacts' && c.body?.email === email && c.body.listIds.includes(1))).toBe(true);

    await page.goto('/admin');
    const ob = page.getByRole('region', { name: 'Onboarding table' });
    await expect(ob.getByRole('row').filter({ hasText: 'Olive Onboard' })).toContainText('Not yet');
    await expect(page.getByRole('region', { name: 'Recent emails table' })).toContainText(email);

    await page.getByRole('button', { name: 'Log out' }).click();
    await login(page, email, PASSWORD, '/dashboard');
    await page.getByRole('link', { name: 'complete your onboarding' }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { name: '1. Your headshot and logo' })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Finish onboarding' }).click();
    await expect(page.getByText('Please tick both boxes to finish.')).toBeVisible();
    await page.getByLabel(/other members can see my email/).check();
    await page.getByLabel(/member commitments/).check();
    await page.getByRole('button', { name: 'Finish onboarding' }).click();
    await expect(page).toHaveURL(/\/dashboard\?welcome=1$/);
    await expect(page.getByText('Your onboarding is complete.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'complete your onboarding' })).toHaveCount(0);
  });

  test('a referral emails the receiver; a status change emails the giver once per status', async ({ page }) => {
    await login(page, users.admin, undefined, '/referrals');
    await page.getByLabel('Refer to member').selectOption({ label: 'Morgan Member · Test Member Studio' });
    const prospect = `Email prospect ${Date.now()}`;
    await page.getByLabel('Prospect name').fill(prospect);
    await page.getByLabel('Referral value ($)').fill('1200');
    await page.getByRole('button', { name: 'Send referral slip' }).click();
    await expect(page.getByText('Referral slip sent.')).toBeVisible();
    const [got] = await emailsTo(users.member, new RegExp(`New referral from Ada Admin: ${prospect}`));
    expect(got?.textContent).toContain('$1,200');

    await page.getByRole('button', { name: 'Log out' }).click();
    await login(page, users.member, undefined, '/referrals');
    const form = page.getByRole('form', { name: new RegExp(prospect) });
    await form.getByLabel('Status').selectOption('contacted');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByText('Saved')).toBeVisible();
    // The form keeps the saved status, so saving again does not undo it.
    await expect(form.getByLabel('Status')).toHaveValue('contacted');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByText('Saved')).toBeVisible();
    const updates = await emailsTo(users.admin, new RegExp(`Referral update: ${prospect} is now “Contacted”`));
    await page.waitForTimeout(1000);
    expect((await emailsTo(users.admin, new RegExp(`Referral update: ${prospect}`), 0)).length).toBe(updates.length);
    expect(updates).toHaveLength(1);
  });

  test('members can switch off an optional email in their profile', async ({ page }) => {
    await login(page, users.member2, undefined, '/profile?tab=edit');
    const prefs = page.getByRole('form', { name: 'Email notifications' });
    await expect(prefs.getByLabel(/Weekly admin digest/)).toHaveCount(0);
    await prefs.getByLabel(/^Referrals/).uncheck();
    await prefs.getByRole('button', { name: 'Save email settings' }).click();
    await expect(prefs.getByText('Email settings saved.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('form', { name: 'Email notifications' }).getByLabel(/^Referrals/)).not.toBeChecked();
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Log out' }).click();
    await login(page, users.admin, undefined, '/referrals');
    const prospect = `Muted prospect ${Date.now()}`;
    await page.getByLabel('Refer to member').selectOption({ label: 'Riley Second · Second Test Bakery' });
    await page.getByLabel('Prospect name').fill(prospect);
    await page.getByRole('button', { name: 'Send referral slip' }).click();
    await expect(page.getByText('Referral slip sent.')).toBeVisible();
    expect(await emailsTo(users.member2, new RegExp(prospect), 2500)).toHaveLength(0);
  });

  test('one-on-ones: a request emails the invitee, the answer emails the requester, a report asks the partner to confirm', async ({ page }) => {
    const note = `Email test coffee ${Date.now()}`;
    await login(page, users.member2, undefined, '/one-on-ones');
    const form = page.getByRole('form', { name: 'Request a one-on-one' });
    await form.getByLabel('Who would you like to meet?').selectOption({ label: 'Ada Admin · Test Admin Co' });
    await form.getByLabel('Message').fill(note);
    await form.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText('Request sent.', { exact: false })).toBeVisible();
    const [req] = await emailsTo(users.admin, /^Riley Second would like a one-on-one/);
    expect(req?.textContent).toContain(note);

    await page.getByRole('button', { name: 'Log out' }).click();
    await login(page, users.admin, undefined, '/one-on-ones');
    const item = page.getByRole('region', { name: 'One-on-one requests for you' }).getByRole('listitem').filter({ hasText: note });
    await item.getByRole('button', { name: 'Accept' }).click();
    expect(await emailsTo(users.member2, /^Ada Admin accepted your one-on-one request/)).toHaveLength(1);

    await page.getByLabel('Who did you meet with?').selectOption({ label: 'Riley Second · Second Test Bakery' });
    await page.getByRole('button', { name: 'Report one-on-one' }).click();
    await expect(page.getByText(/One-on-one reported/)).toBeVisible();
    expect(await emailsTo(users.member2, /^Please confirm your one-on-one with Ada Admin/)).not.toHaveLength(0);
  });

  test('a guest request thanks the visitor and tells the inviting member and the admins', async ({ page }) => {
    const [me] = await db<{ referral_code: string }>(`profiles?select=referral_code&first_name=eq.Morgan&last_name=eq.Member`);
    const email = `guest.mail.${Date.now()}@example.org`;
    await page.goto(`/visit?ref=${me?.referral_code}`);
    await page.getByLabel('First name').fill('Gail');
    await page.getByLabel('Last name').fill('Visitor');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Phone').fill('650-555-0124');
    await page.getByRole('button', { name: 'Send my invite request' }).click();
    await expect(page.getByText("You're on the list, Gail!")).toBeVisible();
    expect(await emailsTo(email, /^Thanks for your interest/)).toHaveLength(1);
    expect(await emailsTo(users.member, /^Your guest Gail Visitor asked to visit/)).toHaveLength(1);
    const [admin] = await emailsTo(users.admin, /^New guest request: Gail Visitor/);
    expect(admin?.textContent).toContain('Invited by: Morgan Member');
  });

  test('daily job: refuses callers without the secret; sends the meeting-day reminder, visitor follow-ups and the Monday digest once', async ({ request }) => {
    expect((await request.get('/api/cron/daily')).status()).toBe(401);
    expect((await request.get('/api/cron/daily', { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401);

    // A meeting far in the future (Monday 1 March 2027, 8:15 AM PST), run "as of" that morning.
    const [m] = await rest('meetings', 'POST', {
      slug: `email-test-${Date.now()}`,
      title: 'Email test meeting',
      category: 'Networking',
      starts_at: '2027-03-01T16:15:00Z',
      ends_at: '2027-03-01T17:30:00Z',
    });
    const meetingId = m?.id as string;
    await rest('meeting_links', 'POST', { meeting_id: meetingId, join_url: 'https://zoom.example.test/j/123' });
    const guestEmail = `guest.followup.${Date.now()}@example.org`;
    const [g] = await rest('guest_requests', 'POST', { first_name: 'Fran', last_name: 'Follow', email: guestEmail, meeting_id: meetingId });
    try {
      // Guest was at the meeting (marked visited), and the job runs the next morning.
      await rest(`guest_requests?id=eq.${g?.id}`, 'PATCH', { status: 'visited' });
      const auth = { authorization: 'Bearer local-cron-secret' };
      const day = await request.get('/api/cron/daily?now=2027-03-01T15:00:00Z', { headers: auth });
      expect(day.status()).toBe(200);
      const body = await day.json();
      expect(body.meetingReminders).toBeGreaterThan(0);
      expect(body.digests).toBeGreaterThan(0);
      const [reminder] = await emailsTo(users.member, /^Today: Email test meeting/);
      expect(reminder?.htmlContent).toContain('href="https://zoom.example.test/j/123"');
      expect(await emailsTo(users.admin, /^Weekly digest/)).not.toHaveLength(0);

      const next = await (await request.get('/api/cron/daily?now=2027-03-02T15:00:00Z', { headers: auth })).json();
      expect(next.visitorFollowups).toBe(1);
      expect(await emailsTo(guestEmail, /^Thanks for visiting/)).toHaveLength(1);

      // Running again sends nothing new.
      const again = await (await request.get('/api/cron/daily?now=2027-03-01T15:30:00Z', { headers: auth })).json();
      expect(again).toMatchObject({ meetingReminders: 0, digests: 0 });
      expect(await emailsTo(users.member, /^Today: Email test meeting/)).toHaveLength(1);
    } finally {
      await rest(`guest_requests?id=eq.${g?.id}`, 'DELETE');
      await rest(`meetings?id=eq.${meetingId}`, 'DELETE');
    }
  });

  test('after-meeting job: sends the meeting recap to members once, with visitors, presenters, their materials and slides; respects the opt-out', async ({
    request,
    page,
  }) => {
    expect((await request.get('/api/cron/after-meeting')).status()).toBe(401);
    // A regular meeting on Monday 8 March 2027 (8:15–9:30 AM PST), job run "as of" noon that day.
    const slug = `recap-test-${Date.now()}`;
    const [m] = await rest('meetings', 'POST', {
      slug,
      title: 'Recap test meeting',
      category: 'Networking',
      starts_at: '2027-03-08T16:15:00Z',
      ends_at: '2027-03-08T17:30:00Z',
    });
    const meetingId = m?.id as string;
    await rest('meeting_speakers', 'POST', {
      meeting_id: meetingId,
      slot: 'presentation',
      display_name: 'Pia Presenter',
      business: 'Pia Co',
      topic: 'Growing referrals',
    });
    // The 10-minute presenter's materials: a video and a website.
    const [video] = await rest('meeting_slide_media', 'POST', {
      meeting_id: meetingId,
      kind: 'youtube',
      youtube_id: 'dQw4w9WgXcQ',
      after_slide: 'ten_minute',
      title: 'Pia’s video',
    });
    await rest('meeting_slide_links', 'POST', { meeting_id: meetingId, url: 'https://pia.example.org/deck', after_slide: 'ten_minute', title: 'Pia’s deck' });
    // A visitor invited by Morgan, marked as visited.
    const [morgan] = await rest('profiles?select=id&first_name=eq.Morgan&last_name=eq.Member', 'GET');
    const [guest] = await rest('guest_requests', 'POST', {
      first_name: 'Vera',
      last_name: 'Visitor',
      email: `vera.${Date.now()}@example.org`,
      business_name: 'Vera Dental',
      phone: '650-555-0100',
      website: 'https://vera.example.org',
      meeting_id: meetingId,
    });
    await rest(`guest_requests?id=eq.${guest?.id}`, 'PATCH', { status: 'visited', referrer_id: morgan?.id });
    try {
      // Riley turns the recap off.
      await login(page, users.member2, undefined, '/profile?tab=edit');
      const prefs = page.getByRole('form', { name: 'Email notifications' });
      await prefs.getByLabel(/^Meeting recap after each meeting/).uncheck();
      await prefs.getByRole('button', { name: 'Save email settings' }).click();
      await expect(prefs.getByRole('status')).toBeVisible();

      const auth = { authorization: 'Bearer local-cron-secret' };
      const before = await (await request.get('/api/cron/after-meeting?now=2027-03-08T16:30:00Z', { headers: auth })).json();
      expect(before.meetingRecaps).toBe(0);
      const run = await request.get('/api/cron/after-meeting?now=2027-03-08T20:00:00Z', { headers: auth });
      expect(run.status()).toBe(200);
      expect((await run.json()).meetingRecaps).toBeGreaterThan(0);
      const [recap] = await emailsTo(users.member, /^Meeting recap: Recap test meeting/);
      expect(recap?.htmlContent).toContain(`/present/${slug}"`);
      expect(recap?.textContent).toContain('Growing referrals');
      expect(recap?.textContent).toContain('Pia Co, Pia Presenter');
      expect(recap?.textContent).toMatch(/Vera Visitor\nVera Dental\nvera\.\d+@example\.org\nhttps:\/\/vera\.example\.org\n650-555-0100/);
      expect(recap?.textContent).toContain('Thanks to Morgan for inviting our guest!');
      expect(recap?.htmlContent).toContain(`/present/${slug}/material/${video?.id}"`);
      expect(recap?.htmlContent).toContain('href="https://pia.example.org/deck"');
      expect(await emailsTo(users.member2, /^Meeting recap: Recap test meeting/, 1500)).toHaveLength(0);

      // The material link opens the video for a signed-in member.
      const material = await page.request.get(`/present/${slug}/material/${video?.id}`, { maxRedirects: 0 });
      expect(material.headers().location).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      // The next morning's daily job does not send it again.
      const daily = await (await request.get('/api/cron/daily?now=2027-03-09T15:00:00Z', { headers: auth })).json();
      expect(daily.meetingRecaps).toBe(0);
      expect(await emailsTo(users.member, /^Meeting recap: Recap test meeting/)).toHaveLength(1);
    } finally {
      await rest(`guest_requests?id=eq.${guest?.id}`, 'DELETE');
      await rest(`meetings?id=eq.${meetingId}`, 'DELETE');
      const [riley] = await rest(`profiles?select=id&first_name=eq.Riley&last_name=eq.Second`, 'GET');
      if (riley) await rest(`email_preferences?profile_id=eq.${riley.id}`, 'DELETE');
    }
  });
});
