import { expect, test } from '@playwright/test';
import { STACK, expectAccessible, login, serviceKey, users } from './support';

// Phase D (owner, 2026-10-23): attendance from the Zoom participant report, the admin review list,
// attendance by hand (substitutes / excused), late and early flags, the absence count and the after-meeting job.

const ZOOM = 'http://127.0.0.1:54328';
const ZOOM_ID = '81234567890';

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

async function mockZoom(instances: unknown[]) {
  await fetch(`${ZOOM}/mock/meetings`, { method: 'POST', body: JSON.stringify({ meetingId: ZOOM_ID, instances }) });
}

const iso = (d: Date) => d.toISOString();
const plus = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

test.describe.configure({ mode: 'serial' });

test.describe('Zoom attendance', () => {
  // A meeting two days ago, 8:15–9:30 AM Pacific (16:15–17:30 UTC in winter, 15:15–16:30 in summer: use the meeting's own times).
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 2, 15, 15));
  const end = plus(start, 75);
  let meetingId = '';
  let guestId = '';

  test.beforeAll(async () => {
    await fetch(`${ZOOM}/reset`, { method: 'POST' });
    const [m] = await rest('meetings', 'POST', {
      slug: `zoom-test-${Date.now()}`,
      title: 'Zoom attendance test meeting',
      category: 'Networking',
      starts_at: iso(start),
      ends_at: iso(end),
      is_online: true,
      location: 'Zoom',
    });
    meetingId = m?.id as string;
    await rest('meeting_links', 'POST', { meeting_id: meetingId, join_url: `https://us02web.zoom.us/j/${ZOOM_ID}?pwd=test` });
    const [g] = await rest('guest_requests', 'POST', { first_name: 'Quinn', last_name: 'Visitorson', email: `quinn.${Date.now()}@example.org` });
    guestId = g?.id as string;
    // The test member joined the group long before this meeting.
    const [me] = await rest(`member_contacts?email=eq.${users.member}&select=profile_id`);
    await rest(`profiles?id=eq.${me?.profile_id}`, 'PATCH', { approved_at: iso(plus(start, -365 * 24 * 60)) });
    await mockZoom([
      { uuid: 'older==', start_time: iso(plus(start, -14 * 24 * 60)), participants: [] },
      {
        // A UUID that starts with "/" and has "//": Zoom wants it encoded twice.
        uuid: '/abc//def==',
        start_time: iso(plus(start, -5)),
        participants: [
          { name: 'Priya R', user_email: 'priya.raman@example.com', join_time: iso(plus(start, 2)), leave_time: iso(plus(start, 30)), duration: 1680 },
          { name: 'Priya (phone)', user_email: 'PRIYA.RAMAN@example.com', join_time: iso(plus(start, 32)), leave_time: iso(end), duration: 2580 },
          { name: 'Elena Vasquez | Atelier Vasquez', user_email: '', join_time: iso(plus(start, 25)), leave_time: iso(end), duration: 3000 },
          { name: 'E2E Member', user_email: 'e2e.member@example.test', join_time: iso(plus(start, 1)), leave_time: iso(plus(start, 50)), duration: 2940 },
          { name: 'iPhone', user_email: '', join_time: iso(plus(start, 3)), leave_time: iso(end), duration: 4320 },
          { name: 'Quinn Visitorson', user_email: '', join_time: iso(plus(start, 5)), leave_time: iso(end), duration: 4200 },
        ],
      },
    ]);
  });

  test.afterAll(async () => {
    if (meetingId) await rest(`meetings?id=eq.${meetingId}`, 'DELETE');
    if (guestId) await rest(`guest_requests?id=eq.${guestId}`, 'DELETE');
    await rest(`zoom_aliases?key=eq.name:iphone`, 'DELETE');
  });

  test('admin fetches the Zoom report, sorts out the review list and corrects attendance by hand', async ({ page }) => {
    await login(page, users.admin, undefined, `/admin/attendance?m=${meetingId}`);
    await expect(page.getByRole('heading', { name: 'Attendance', level: 1 })).toBeVisible();
    await expect(page.getByText(/Attendance has not been taken for this meeting yet/)).toBeVisible();

    await page.getByRole('button', { name: 'Fetch from Zoom' }).click();
    await expect(page.getByRole('status')).toHaveText('5 people in the Zoom report, 3 members marked present, 1 invited guest found, 1 to review below.');
    await expect(page.getByText(/Attendance taken from Zoom on .*3 of \d+ members present, 5 people in the Zoom report\./)).toBeVisible();

    // Invited guest found by name → Visited, and listed with the visitors.
    expect((await rest(`guest_requests?id=eq.${guestId}&select=status,meeting_id`))[0]).toEqual({ status: 'visited', meeting_id: meetingId });
    await expect(page.getByText('Quinn Visitorson · invited guest (marked Visited)')).toBeVisible();

    // Members table: matched by email (two joins merged) and by name; late / left early flags from the Bylaws times.
    const table = page.getByRole('form', { name: 'Attendance for this meeting' });
    const row = (name: string) => table.getByRole('row').filter({ has: page.getByRole('rowheader', { name }) });
    await expect(row('Priya Raman')).toContainText('71 min');
    await expect(row('Priya Raman').getByRole('combobox')).toHaveValue('present');
    await expect(row('Elena Vasquez')).toContainText('Late');
    await expect(row('Morgan Member')).toContainText('Left early');
    await expect(row('Daniel Cho').getByRole('combobox')).toHaveValue('absent');

    // Review list: "iPhone" is Theo; remember it for next time.
    const review = page.getByRole('region', { name: /Needs review/ });
    await review.getByLabel('This is').selectOption({ label: 'Theo Marchetti' });
    await review.getByRole('button', { name: 'Link to member' }).click();
    // Once sorted out, the person leaves the review list (and the list disappears when it is empty).
    await expect(page.getByRole('region', { name: /Needs review/ })).toHaveCount(0);
    await page.reload();
    await expect(row('Theo Marchetti').getByRole('combobox')).toHaveValue('present');

    // By hand: Daniel sent a substitute, Hannah told a leader.
    await row('Daniel Cho').getByRole('combobox').selectOption('substitute');
    await row('Hannah Brooks').getByRole('combobox').selectOption('excused');
    await table.getByRole('button', { name: 'Save attendance' }).click();
    await expect(table.getByRole('status')).toHaveText('Saved 2 changes.');
    await page.reload();
    await expect(row('Daniel Cho').getByRole('combobox')).toHaveValue('substitute');
    await expect(row('Hannah Brooks').getByRole('combobox')).toHaveValue('excused');
    await expectAccessible(page);

    // Fetching again changes nothing: Theo is matched from the remembered name, Daniel keeps his substitute.
    await page.getByRole('button', { name: 'Fetch from Zoom again' }).click();
    await expect(page.getByRole('status').first()).toHaveText('5 people in the Zoom report, 4 members marked present, 1 invited guest found.');
    await page.reload();
    await expect(row('Daniel Cho').getByRole('combobox')).toHaveValue('substitute');
    await expect(row('Theo Marchetti').getByRole('combobox')).toHaveValue('present');
  });

  test('a member sees their Zoom times, flags and missed-meeting count; no access to the admin page', async ({ page }) => {
    await login(page, users.member, undefined, '/meetings');
    await expect(page.getByText('Missed · 6 months')).toBeVisible();
    const hist = page.getByRole('table', { name: /Attendance at past meetings/ });
    const r = hist.getByRole('row').filter({ hasText: 'Zoom report' }).first();
    await expect(r).toContainText('49 min');
    await expect(r).toContainText('Left early');
    await expect(r).toContainText('Present');
    await page.goto('/admin/attendance');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('the after-meeting job imports meetings that just ended; no session that day is reported to admins', async ({ page, request }) => {
    // Move the test meeting's import away, then let the job pick it up.
    await rest(`attendance_imports?meeting_id=eq.${meetingId}`, 'DELETE');
    const auth = { authorization: 'Bearer local-cron-secret' };
    const res = await (await request.get(`/api/cron/after-meeting?now=${iso(plus(end, 120))}`, { headers: auth })).json();
    expect(res.ok).toBe(true);
    expect(res.zoom.imported).toBeGreaterThanOrEqual(1);
    expect((await rest(`attendance_imports?meeting_id=eq.${meetingId}&select=status,source`))[0]).toEqual({ status: 'done', source: 'zoom' });

    // A meeting Zoom has no session for: the admin sees why.
    const day = plus(start, -7 * 24 * 60);
    const [m] = await rest('meetings', 'POST', {
      slug: `zoom-none-${Date.now()}`,
      title: 'Zoom attendance test (no session)',
      category: 'Networking',
      starts_at: iso(day),
      ends_at: iso(plus(day, 75)),
      is_online: true,
      location: 'Zoom',
    });
    try {
      await rest('meeting_links', 'POST', { meeting_id: m?.id, join_url: `https://zoom.us/j/${ZOOM_ID}` });
      await login(page, users.admin, undefined, `/admin/attendance?m=${m?.id}`);
      await page.getByRole('button', { name: 'Fetch from Zoom' }).click();
      // The message names the meeting ID and the days Zoom does have, so admins can see what went wrong.
      await expect(
        page
          .getByRole('alert')
          .filter({ hasText: /Zoom has no session of meeting 812 3456 7890 on that day\. Its most recent sessions were on \w{3} \d+, \d{4}/ })
          .first(),
      ).toBeVisible();
    } finally {
      await rest(`meetings?id=eq.${m?.id}`, 'DELETE');
    }
  });
});
