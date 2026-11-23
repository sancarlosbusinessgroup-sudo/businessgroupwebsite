import { expect, test } from '@playwright/test';
import { STACK, db, expectAccessible, login, serviceKey, users } from './support';

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

// Owner 2026-11-23: Admin tab "Guest Invites & Applications" with Pending applications, Visitor sign-in link and Guest
// invite requests. The same three sections stay on Overview.

const headings = [/^Pending applications \(\d+\)$/, /^Visitor sign-in link$/, /^Guest invite requests$/];

test('admin opens Guest Invites & Applications from the tabs; Overview still has the same sections', async ({ page }) => {
  await login(page, users.admin, undefined, '/admin');

  const tab = page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Guest Invites & Applications' });
  await expect(tab).toHaveAttribute('href', '/admin/guests');
  await tab.click();
  await expect(page).toHaveURL(/\/admin\/guests$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Guest Invites & Applications' })).toBeVisible();
  await expect(tab).toHaveAttribute('aria-current', 'page');
  for (const h of headings) await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  await expect(page.getByText('/visitor-sign-in').first()).toBeVisible();
  // Only these three sections on the new tab.
  await expect(page.getByRole('heading', { level: 2, name: 'Zoom' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Category seats' })).toHaveCount(0);
  await expectAccessible(page);

  await page.goto('/admin');
  for (const h of headings) await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
});

test('members cannot open Guest Invites & Applications', async ({ page }) => {
  await login(page, users.member);
  await page.goto('/admin/guests');
  await expect(page.getByRole('heading', { level: 1, name: 'Guest Invites & Applications' })).toHaveCount(0);
});

// Owner 2026-11-23: "My Presentations" tab beside Edit profile (dates, name, upload), and presentation materials on
// Admin → Meetings → a meeting.

test('My Presentations: a presenter names their talk and adds a PDF and a website; admins see and add to it on Admin → Meetings', async ({ page }) => {
  const [me] = await db<{ profile_id: string }>(`member_contacts?email=eq.${users.member}&select=profile_id`);
  const stamp = Date.now();
  const startsAt = new Date(stamp + 9 * 86400000);
  startsAt.setUTCHours(16, 15, 0, 0);
  const [m] = await rest('meetings', 'POST', {
    slug: `my-presentations-${stamp}`,
    title: 'My Presentations test meeting',
    category: 'Networking',
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + 75 * 60000).toISOString(),
  });
  await rest('meeting_speakers', 'POST', { meeting_id: m?.id, slot: 'presentation', profile_id: me?.profile_id, display_name: 'Morgan Member' });
  try {
    await login(page, users.member, undefined, '/profile');
    const tabs = page.getByRole('navigation', { name: 'Profile mode' });
    await tabs.getByRole('link', { name: 'My Presentations' }).click();
    await expect(page).toHaveURL(/\/profile\?tab=presentations$/);
    await expect(tabs.getByRole('link', { name: 'My Presentations' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 2, name: 'My Presentations' })).toBeVisible();

    const card = page.getByRole('listitem', { name: /^10-Minute Presentation on / }).filter({ hasText: 'My Presentations test meeting' });
    await expect(card).toBeVisible();
    // The presentation's name.
    const topic = card.getByRole('form', { name: /^Topic of my 10-minute presentation/ });
    await topic.getByLabel(/^Topic/).fill('How to refer a bookkeeper');
    await topic.getByRole('button', { name: 'Save topic' }).click();
    await expect(topic.getByRole('status')).toHaveText('Topic saved.');
    // The upload area is open straight away: a PDF and a website.
    const upload = card.getByRole('form', { name: /^Upload for my 10-minute presentation/ });
    await upload.getByLabel('File').setInputFiles('tests/e2e/fixtures/two-pages.pdf');
    await upload.getByLabel('Title (optional)').fill('Bookkeeper deck');
    await upload.getByRole('button', { name: 'Add to slides' }).click();
    await expect(upload.getByText('PDF added (2 pages).')).toBeVisible();
    const link = card.getByRole('form', { name: /^Video or website for my 10-minute presentation/ });
    await link.getByLabel('YouTube or website link').fill('https://example.com/bookkeeper');
    await link.getByLabel('Title (optional)').fill('Bookkeeper site');
    await link.getByRole('button', { name: 'Add link' }).click();
    await expect(page.getByText('Website added.')).toBeVisible();
    const list = card.getByRole('list', { name: /^Added for my 10-minute presentation/ });
    await expect(list).toContainText('Bookkeeper deck');
    await expect(list).toContainText('Bookkeeper site');
    await expectAccessible(page);
    const [sp] = await db<{ topic: string }>(`meeting_speakers?meeting_id=eq.${m?.id}&slot=eq.presentation&select=topic`);
    expect(sp?.topic).toBe('How to refer a bookkeeper');

    // Admin → Meetings → this meeting: the presenter's items, and the admin adds a video.
    await page.context().clearCookies();
    await login(page, users.admin, undefined, `/admin/meetings/${m?.id}`);
    const panel = page.getByRole('group', { name: 'Materials for the 10-minute presentation' });
    const items = panel.getByRole('list', { name: 'Materials for the 10-minute presentation' });
    await expect(items).toContainText('Bookkeeper deck');
    await expect(items).toContainText('added by Morgan Member');
    const adminLink = panel.getByRole('form', { name: 'Video or website for the 10-minute presentation' });
    await adminLink.getByLabel('YouTube or website link').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await adminLink.getByLabel('Title (optional)').fill('Intro video');
    await adminLink.getByRole('button', { name: 'Add link' }).click();
    await expect(items).toContainText('Intro video');
    await expect(page.getByRole('group', { name: 'Materials for the 5-minute presentation' })).toContainText('Nothing added yet.');
    await expectAccessible(page);
  } finally {
    await rest(`meetings?id=eq.${m?.id}`, 'DELETE');
  }
});

test('My Presentations with nothing booked points to the Meetings page', async ({ page }) => {
  await login(page, users.member2, undefined, '/profile?tab=presentations');
  await expect(page.getByRole('heading', { level: 2, name: 'My Presentations' })).toBeVisible();
  // Riley may hold a slot from other tests; either a list or the empty state with a link to Meetings.
  await expect(page.getByRole('link', { name: 'Meetings page' }).first()).toHaveAttribute('href', '/meetings');
});

// Owner 2026-11-24: "Upload presentation" beside the 5- and 10-minute presenter on the Meetings page opens a pop-up.
test('Meetings page: "Upload presentation" pop-up for the presenter and for admins, not for other members', async ({ page }) => {
  // Leftovers from an interrupted earlier run.
  await rest(`meeting_speakers?topic=eq.${encodeURIComponent('Pop-up upload test')}`, 'DELETE');
  await login(page, users.member, undefined, '/meetings');
  const claim = page.getByRole('form', { name: /^Claim the 10-minute slot/ }).first();
  const when = ((await claim.getAttribute('aria-label')) ?? '').replace('Claim the 10-minute slot on ', '');
  await claim.getByLabel('Topic').fill('Pop-up upload test');
  await claim.getByRole('button', { name: 'Claim' }).click();
  try {
    const link = page.getByRole('button', { name: `Upload presentation for the 10-Minute Presentation on ${when}` });
    await expect(link).toBeVisible();
    await link.click();
    const dialog = page.getByRole('dialog', { name: 'Upload presentation' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(`10-Minute Presentation · ${when} · Morgan Member`)).toBeVisible();
    const form = dialog.getByRole('form', { name: /^Video or website for my 10-minute presentation/ });
    await form.getByLabel('YouTube or website link').fill('https://example.com/popup-test');
    await form.getByLabel('Title (optional)').fill('Pop-up site');
    await form.getByRole('button', { name: 'Add link' }).click();
    await expect(dialog.getByText('Website added.')).toBeVisible();
    await expect(dialog.getByRole('list', { name: /^Added for my 10-minute presentation/ })).toContainText('Pop-up site');
    await expectAccessible(page);
    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await expect(dialog).toBeHidden();
    await expect(link).toContainText('(1 added)');

    // Other members see the presenter but no upload link.
    await page.context().clearCookies();
    await login(page, users.member2, undefined, '/meetings');
    await expect(page.getByText('“Pop-up upload test”')).toBeVisible();
    await expect(page.getByRole('button', { name: `Upload presentation for the 10-Minute Presentation on ${when}` })).toHaveCount(0);

    // Admins can open it for the presenter and add to it.
    await page.context().clearCookies();
    await login(page, users.admin, undefined, '/meetings');
    await page.getByRole('button', { name: `Upload presentation for the 10-Minute Presentation on ${when}` }).click();
    const adminDialog = page.getByRole('dialog', { name: 'Upload presentation' });
    const list = adminDialog.getByRole('list', { name: 'Materials for the 10-minute presentation' });
    await expect(list).toContainText('Pop-up site');
    await expect(list).toContainText('added by Morgan Member');
    const adminForm = adminDialog.getByRole('form', { name: 'Video or website for the 10-minute presentation' });
    await adminForm.getByLabel('YouTube or website link').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await adminForm.getByLabel('Title (optional)').fill('Admin video');
    await adminForm.getByRole('button', { name: 'Add link' }).click();
    await expect(list).toContainText('Admin video');
    await expectAccessible(page);
  } finally {
    // Release the slot (removes the presenter's own slides) and the admin's video.
    await page.context().clearCookies();
    await login(page, users.member, undefined, '/meetings');
    await page.getByRole('button', { name: 'Release my 10-minute slot' }).first().click();
    const vids = await db<{ id: string }>(`meeting_slide_media?title=eq.Admin%20video&select=id`);
    for (const v of vids) await rest(`meeting_slide_media?id=eq.${v.id}`, 'DELETE');
  }
});
