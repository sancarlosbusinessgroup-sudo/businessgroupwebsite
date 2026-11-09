import { expect, test } from '@playwright/test';
import { STACK, expectAccessible, login, serviceKey, users } from './support';

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

// The meeting recap as members receive it, previewed for admins at /admin/recap (owner, 2026-10-24). Nothing is sent.
test.describe.configure({ mode: 'serial' });

test.describe('meeting recap preview', () => {
  test('admins see the recap exactly as it reads, with the visitor and presenter; members cannot open it', async ({ page }) => {
    // A regular meeting that ended a minute ago, with a presenter and a visitor invited by Morgan.
    const slug = `recap-preview-${Date.now()}`;
    const [m] = await rest('meetings', 'POST', {
      slug,
      title: 'Recap preview test',
      category: 'Networking',
      starts_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      ends_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const meetingId = m?.id as string;
    try {
      await rest('meeting_speakers', 'POST', {
        meeting_id: meetingId,
        slot: 'presentation',
        display_name: 'Pia Presenter',
        business: 'Pia Co',
        topic: 'Growing referrals',
      });
      const [morgan] = await rest('profiles?select=id&first_name=eq.Morgan&last_name=eq.Member', 'GET');
      const [guest] = await rest('guest_requests', 'POST', {
        first_name: 'Vera',
        last_name: 'Visitor',
        email: `vera.preview.${Date.now()}@example.org`,
        business_name: 'Vera Dental',
        phone: '650-555-0100',
        meeting_id: meetingId,
      });
      await rest(`guest_requests?id=eq.${guest?.id}`, 'PATCH', { status: 'visited', referrer_id: morgan?.id });

      await login(page, users.admin, undefined, '/admin/recap');
      await expect(page.getByRole('heading', { name: 'Member recap', exact: true })).toBeVisible();
      await expect(page.getByText('Recap preview test', { exact: false }).first()).toBeVisible();
      const frame = page.frameLocator('iframe[title="Recap email preview"]');
      await expect(frame.getByText('Vera Visitor')).toBeVisible();
      await expect(frame.getByText('Pia Presenter')).toBeVisible();
      await page.getByText('Plain-text version').click();
      await expect(page.locator('pre').filter({ hasText: 'Vera Visitor' })).toBeVisible();
      await expectAccessible(page, ['iframe[title="Recap email preview"]']);
    } finally {
      await rest(`meetings?id=eq.${meetingId}`, 'DELETE');
    }
  });

  test('members are kept out of the preview', async ({ page }) => {
    await login(page, users.member, undefined, '/dashboard');
    await page.goto('/admin/recap');
    await expect(page.getByRole('heading', { name: 'Member recap', exact: true })).toHaveCount(0);
  });

  test('the jobs never send the recap; there is no on/off switch any more (owner, 2026-11-10)', async ({ page, request }) => {
    const [m] = await rest('meetings', 'POST', {
      slug: `recap-nosend-${Date.now()}`,
      title: 'Recap no-auto test',
      category: 'Networking',
      starts_at: '2027-04-05T15:15:00Z',
      ends_at: '2027-04-05T16:30:00Z',
    });
    const auth = { authorization: 'Bearer local-cron-secret' };
    try {
      const after = await (await request.get('/api/cron/after-meeting?now=2027-04-05T19:00:00Z', { headers: auth })).json();
      expect(after.ok).toBe(true);
      expect(after.meetingRecaps).toBeUndefined();
      const daily = await (await request.get('/api/cron/daily?now=2027-04-06T15:00:00Z', { headers: auth })).json();
      expect(daily.meetingRecaps).toBe(0);
      expect(await rest(`email_log?dedupe_key=eq.${m?.id}&kind=eq.meeting_recap`, 'GET')).toEqual([]);
      await login(page, users.admin, undefined, '/admin/recap');
      await expect(page.getByRole('button', { name: /Turn (off|on) recap email/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Send recap' })).toBeVisible();
    } finally {
      await rest(`meetings?id=eq.${m?.id}`, 'DELETE');
    }
  });
});
