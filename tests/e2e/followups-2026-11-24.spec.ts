import { expect, test, type Page } from '@playwright/test';
import { STACK, expectAccessible, login, serviceKey, users } from './support';

// Management meeting follow-ups (owner, 2026-11-24): attendance rules box, left-early corrections and "Excused – left
// early", the no-infomercial list (+ PDF), Support → Rules, slides keep their place on reload, the guest board (accept,
// decline, move, reopen), the admin notification bell, report cards (+ PDF) and gallery tagging with approval.

async function rest(path: string, method = 'GET', body?: unknown, prefer = 'return=representation') {
  const key = await serviceKey();
  const res = await fetch(`${STACK}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: prefer },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? [] : ((await res.json()) as Record<string, unknown>[]);
}

const profileId = async (email: string) => (await rest(`member_contacts?email=eq.${email}&select=profile_id`))[0]?.profile_id as string;

/** The next regular meeting and the last held one before it (as the no-infomercial list picks them). */
async function nextAndPrevious() {
  const now = encodeURIComponent(new Date().toISOString());
  const [next] = await rest(`meetings?category=eq.Networking&cancelled_reason=is.null&ends_at=gt.${now}&order=starts_at.asc&limit=1&select=id,slug,starts_at`);
  const [prev] = await rest(
    `meetings?category=eq.Networking&cancelled_reason=is.null&starts_at=lt.${encodeURIComponent(next!.starts_at as string)}&order=starts_at.desc&limit=1&select=id,starts_at,ends_at`,
  );
  return { next: next!, prev: prev! };
}

test.describe.configure({ mode: 'serial' });

test.describe('attendance: rules, left early, no-infomercial list', () => {
  let prevId = '';
  let memberId = '';
  let createdImport = false;

  test.beforeAll(async () => {
    const { prev } = await nextAndPrevious();
    prevId = prev.id as string;
    memberId = await profileId(users.member);
    const start = Date.parse(prev.starts_at as string);
    // Morgan joined on time and left 50 minutes in: left early.
    await rest(
      'attendance?on_conflict=meeting_id,profile_id',
      'POST',
      {
        meeting_id: prevId,
        profile_id: memberId,
        status: 'present',
        substitute: false,
        zoom: true,
        joined_at: new Date(start + 5 * 60_000).toISOString(),
        left_at: new Date(start + 50 * 60_000).toISOString(),
        left_early: null,
      },
      'resolution=merge-duplicates,return=representation',
    );
    const imp = await rest(`attendance_imports?meeting_id=eq.${prevId}&select=status`);
    if (!imp.length) {
      createdImport = true;
      await rest('attendance_imports', 'POST', { meeting_id: prevId, source: 'manual', status: 'done' });
    }
  });

  test.afterAll(async () => {
    if (!prevId || !memberId) return;
    await rest(`attendance?meeting_id=eq.${prevId}&profile_id=eq.${memberId}`, 'DELETE');
    if (createdImport) await rest(`attendance_imports?meeting_id=eq.${prevId}`, 'DELETE');
  });

  test('rules box, then excuse and un-excuse an early leaver; the list and its PDF follow', async ({ page }) => {
    await login(page, users.admin, undefined, `/admin/attendance?m=${prevId}`);
    const rules = page.getByRole('region', { name: 'Attendance rules (Bylaws & Procedures)' });
    await expect(rules.getByRole('heading', { name: 'Absences' })).toBeVisible();
    await expect(rules).toContainText('Members are only allowed to miss 2 meetings in a 6-month period.');
    await expect(rules).toContainText('If you leave before the 9:45 AM finish');

    const table = page.getByRole('form', { name: 'Attendance for this meeting' });
    const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Morgan Member' }) });
    await expect(row.getByRole('cell').first()).toContainText('Left early');
    const early = row.getByRole('combobox', { name: 'Left early: Morgan Member' });
    await expect(early).toHaveValue('auto');
    await expect(early.locator('option[value="auto"]')).toHaveText('From Zoom: left early');

    // On the list for the next meeting (Overview), and in the PDF.
    await page.goto('/admin');
    const list = page.getByRole('region', { name: /^No 60-second infomercial on/ });
    await expect(list.getByRole('listitem').filter({ hasText: 'Morgan Member' })).toBeVisible();
    const pdf = await page.request.get(`/api/admin/no-infomercial`);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

    // Emergency: excused. Off the list, shown as excused.
    await page.goto(`/admin/attendance?m=${prevId}`);
    await early.selectOption('excused');
    await table.getByRole('button', { name: 'Save attendance' }).click();
    await expect(table.getByRole('status')).toContainText('Saved 1 change');
    await expect(row.getByRole('cell').first()).toContainText('Left early · excused');
    expect((await rest(`attendance?meeting_id=eq.${prevId}&profile_id=eq.${memberId}&select=left_early`))[0]?.left_early).toBe('excused');
    await page.goto('/admin');
    await expect(
      page
        .getByRole('region', { name: /^No 60-second infomercial on/ })
        .getByRole('listitem')
        .filter({ hasText: 'Morgan Member' }),
    ).toHaveCount(0);

    // Zoom was wrong: did not leave early.
    await page.goto(`/admin/attendance?m=${prevId}`);
    await early.selectOption('no');
    await table.getByRole('button', { name: 'Save attendance' }).click();
    await expect(table.getByRole('status')).toContainText('Saved 1 change');
    await expect(row.getByRole('cell').first()).not.toContainText('Left early');
    await expectAccessible(page);
  });

  test('a visitor gets no PDF', async ({ request }) => {
    const r = await request.get('/api/admin/no-infomercial');
    expect(r.status()).toBe(403);
  });
});

test('Support → Rules: members only, the rules from the Bylaws and Procedures @responsive', async ({ page }) => {
  await page.goto('/rules');
  await expect(page).toHaveURL(/\/login/);
  await login(page, users.member, undefined, '/dashboard');
  const nav = page.getByRole('navigation', { name: /main|Main/ }).first();
  const support = page.getByRole('button', { name: 'Support' });
  if (!(await support.isVisible())) await page.getByRole('button', { name: /Menu/ }).click();
  await page.getByRole('button', { name: 'Support' }).click();
  await page.getByRole('link', { name: 'Rules', exact: true }).click();
  await expect(page).toHaveURL(/\/rules$/);
  void nav;
  await expect(page.getByRole('heading', { level: 1, name: 'Rules' })).toBeVisible();
  for (const h of ['Attendance and absences', 'Arriving late and leaving early', 'What every member does', 'Dues'])
    await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  await expect(page.getByText('If you leave before the 9:45 AM finish', { exact: false }).first()).toBeVisible();
  await expectAccessible(page);
});

test('slides: reloading the page keeps the slide', async ({ page }) => {
  const { next } = await nextAndPrevious();
  await login(page, users.admin, undefined, `/present/${next.slug}`);
  await expect(page.getByText(/^Slide 1 of \d+$/)).toBeVisible();
  await page.getByRole('button', { name: 'Next slide' }).click();
  await page.getByRole('button', { name: 'Next slide' }).click();
  await expect(page.getByText(/^Slide 3 of \d+$/)).toBeVisible();
  await expect(page).toHaveURL(/#slide-3$/);
  await page.reload();
  await expect(page.getByText(/^Slide 3 of \d+$/)).toBeVisible();
});

test.describe('guest board', () => {
  const stamp = Date.now();
  let guestId = '';
  let addedLink = false;
  let nextId = '';

  test.beforeAll(async () => {
    const [g] = await rest('guest_requests', 'POST', {
      first_name: 'Bea',
      last_name: `Board${stamp}`,
      email: `bea.board.${stamp}@example.org`,
      phone: '555-0199',
      business_name: 'Board Games Co',
      business_description: 'Board game café and events',
    });
    guestId = g!.id as string;
    const { next } = await nextAndPrevious();
    nextId = next.id as string;
    const link = await rest(`meeting_links?meeting_id=eq.${nextId}&select=join_url`);
    if (!link.length) {
      addedLink = true;
      await rest('meeting_links', 'POST', { meeting_id: nextId, join_url: 'https://us02web.zoom.us/j/86331234567?pwd=test' });
    }
  });

  test.afterAll(async () => {
    if (guestId) await rest(`guest_requests?id=eq.${guestId}`, 'DELETE');
    if (addedLink) await rest(`meeting_links?meeting_id=eq.${nextId}`, 'DELETE');
  });

  const column = (page: Page, name: string) => page.getByRole('region', { name: new RegExp(`^\\d?\\s*${name}`) });
  const card = (page: Page) => page.locator(`[data-guest-card="${guestId}"]`);

  test('six columns; decline by phone, reopen, move by hand, accept, drag; history kept', async ({ page }) => {
    await login(page, users.admin, undefined, '/admin/guests');
    const board = page.getByRole('region', { name: 'Guest board columns' });
    await expect(board.getByRole('heading', { level: 3 })).toHaveText([
      /Accept or Reject/,
      /Zoom Link Sent/,
      /Send Application Form/,
      /Application Form Accomplished/,
      /Panel Interview/,
      /Membership Approved/,
    ]);
    await expect(column(page, 'Accept or Reject').locator(`[data-guest-card="${guestId}"]`)).toBeVisible();
    await expect(card(page)).toContainText('Board Games Co');

    // Decline: I'll call them, with a note.
    await card(page)
      .getByRole('button', { name: /^Decline…/ })
      .click();
    const form = page.getByRole('form', { name: `Decline Bea Board${stamp}` });
    await expect(form.getByRole('radio', { name: 'I’ll call them' })).toBeChecked();
    await form.getByLabel('Note (only admins see it)').fill('Overlaps with an existing member');
    await form.getByRole('button', { name: 'Decline', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Declined. Remember to call them.' })).toBeVisible();
    await page.reload();
    await expect(card(page)).toHaveCount(0);
    const declined = page.locator('details').filter({ has: page.getByText(/^Declined \(\d+\)$/) });
    await declined.getByText(/^Declined \(\d+\)$/).click();
    const item = declined.getByRole('listitem').filter({ hasText: `Bea Board${stamp}` });
    await expect(item).toContainText('told by phone');
    await expect(item).toContainText('Overlaps with an existing member');

    // Reopen: back in Accept or Reject.
    await item.getByRole('button', { name: /^Reopen/ }).click();
    await expect(column(page, 'Accept or Reject').locator(`[data-guest-card="${guestId}"]`)).toBeVisible();

    // Move by hand to Panel Interview (keyboard way): no emails, history says so.
    await card(page).getByText('Details, history & move').click();
    await card(page).getByLabel(`Move Bea Board${stamp} to`).selectOption('interview');
    await card(page).getByRole('button', { name: 'Move', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Moved to Panel Interview.' })).toBeVisible();
    await page.reload();
    await expect(column(page, 'Panel Interview').locator(`[data-guest-card="${guestId}"]`)).toBeVisible();
    await card(page).getByText('Details, history & move').click();
    await expect(card(page)).toContainText('Moved to Panel Interview');
    await expect(card(page)).toContainText('Declined: by phone (Overlaps with an existing member)');
    await expect(card(page)).toContainText('Reopened');

    // Drag it back to Accept or Reject, then accept: Zoom link sent, card moves on by itself.
    await page.reload();
    // A real mouse drag (Playwright's dragTo shortcut doesn't start an HTML drag here).
    const from = (await card(page).locator('strong').first().boundingBox())!;
    const to = (await column(page, 'Accept or Reject').boundingBox())!;
    await page.mouse.move(from.x + 10, from.y + 5);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 20, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 150, { steps: 15 });
    await page.mouse.up();
    await expect(page.getByRole('status').filter({ hasText: 'Moved to Accept or Reject.' })).toBeVisible();
    await page.reload();
    await expect(column(page, 'Accept or Reject').locator(`[data-guest-card="${guestId}"]`)).toBeVisible();
    await card(page)
      .getByRole('button', { name: /^Accept .* and send the Zoom link/ })
      .click();
    await expect(page.getByRole('status').filter({ hasText: /Accepted/ })).toBeVisible();
    await page.reload();
    await expect(column(page, 'Zoom Link Sent').locator(`[data-guest-card="${guestId}"]`)).toBeVisible();
    expect((await rest(`guest_requests?id=eq.${guestId}&select=accepted_at,pipeline_stage`))[0]).toMatchObject({ pipeline_stage: 'zoom_sent' });

    // A step done elsewhere on the website (marked visited) moves the card forward.
    await card(page)
      .getByRole('button', { name: /^Mark visited/ })
      .click();
    await page.reload();
    await expect(column(page, 'Send Application Form').locator(`[data-guest-card="${guestId}"]`)).toBeVisible();
    await expectAccessible(page);
  });

  test('the bell lists what needs attention', async ({ page }) => {
    await rest(`guest_requests?id=eq.${guestId}`, 'PATCH', { status: 'requested', pipeline_stage: 'review' });
    await rest(`email_log?kind=eq.guest_zoom_link&dedupe_key=like.${guestId}*`, 'DELETE');
    await login(page, users.admin, undefined, '/dashboard');
    const bell = page.getByRole('button', { name: /^Notifications/ });
    await expect(bell).toHaveAccessibleName(/Notifications: \d+ items? needs? attention/);
    await bell.click();
    const panel = page.getByRole('list', { name: 'Items that need attention' });
    await expect(panel.getByRole('link', { name: new RegExp(`Accept or reject Bea Board${stamp}`) })).toHaveAttribute('href', '/admin/guests#board');
  });

  test('members don’t get the bell or the list', async ({ page, request }) => {
    await login(page, users.member, undefined, '/dashboard');
    await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveCount(0);
    expect((await request.get('/api/admin/action-items')).status()).toBe(403);
  });
});

test('report cards: goals, a member’s card and the PDF', async ({ page }) => {
  await login(page, users.admin, undefined, '/admin/report-cards');
  await expect(page.getByRole('heading', { level: 1, name: 'Report Cards' })).toBeVisible();
  await page.getByLabel('One-on-ones').fill('6');
  await page.getByLabel('Attendance (%)').fill('75');
  await page.getByRole('button', { name: 'Save goals' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Goals saved.' })).toBeVisible();
  const card = page.getByRole('listitem').filter({ has: page.getByText('Morgan Member', { exact: true }) });
  await card.getByText('Morgan Member', { exact: true }).click();
  const table = card.getByRole('table', { name: /Report card for Morgan Member/ });
  await expect(table.getByRole('row').filter({ hasText: 'One-on-ones (confirmed)' })).toContainText('6');
  const href = await card.getByRole('link', { name: /Download Morgan Member’s card/ }).getAttribute('href');
  const pdf = await page.request.get(href!);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await expectAccessible(page);
  await rest('report_card_goals?id=eq.1', 'PATCH', { one_on_ones: null, attendance_pct: null });
});

test('gallery: a tagged photo goes live only after the tagged member approves; it shows on their profile', async ({ page, browser }) => {
  const caption = `Tag test ${Date.now()}`;
  await login(page, users.member, undefined, '/gallery');
  await page.getByRole('button', { name: 'Upload photos' }).click();
  const form = page.getByRole('form', { name: 'Upload a photo' });
  await form.getByLabel('Photo').setInputFiles('tests/e2e/fixtures/slide-image.png');
  await form.getByLabel('Album').selectOption('meetings');
  await form.getByLabel('Caption').fill(caption);
  await form.getByLabel('Find a member to tag').fill('Riley');
  await form.getByRole('checkbox', { name: 'Riley Second' }).check();
  await expect(form.getByRole('list', { name: 'Tagged members' })).toContainText('Riley Second');
  await form.getByRole('button', { name: 'Upload photo' }).click();
  await expect(form).toContainText('It will appear in the gallery once the member you tagged approves it.');
  await expect(page.getByRole('region', { name: /Your photos waiting for approval/ })).toContainText('Riley Second: waiting');

  // Visitors don't see it yet.
  const visitor = await browser.newPage();
  await visitor.goto('/gallery');
  await expect(visitor.getByText(caption)).toHaveCount(0);

  // Riley approves (dashboard reminder → gallery).
  const riley = await browser.newPage();
  await login(riley, users.member2, undefined, '/dashboard');
  await riley.getByRole('link', { name: 'Approve or decline' }).click();
  const tagged = riley.getByRole('region', { name: /Photos you’re tagged in/ });
  const item = tagged.getByRole('listitem').filter({ hasText: caption });
  await item.getByRole('button', { name: /^Approve/ }).click();
  await expect(riley.getByRole('status').filter({ hasText: 'You approved this photo' })).toBeVisible();
  await expect(item).toHaveCount(0);

  await visitor.goto('/gallery');
  await expect(visitor.getByText(caption).first()).toBeVisible();
  const [riley2] = await rest(`profiles?id=eq.${await profileId(users.member2)}&select=slug`);
  await visitor.goto(`/members/${riley2!.slug}`);
  await expect(visitor.getByRole('heading', { name: /^Photos/ })).toBeVisible();
  await expect(visitor.getByText(caption).first()).toBeVisible();

  const [photo] = await rest(`gallery_photos?caption=eq.${encodeURIComponent(caption)}&select=id`);
  await rest(`gallery_photos?id=eq.${photo!.id}`, 'DELETE');
  await visitor.close();
  await riley.close();
});
