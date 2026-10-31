import { expect, test } from '@playwright/test';
import { db, expectAccessible, login, users } from './support';

// Owner request 2026-10-31: "My Events" on the dashboard, an "Events" tab beside Gallery, several dates per event,
// public or members-only events, and an image size guide on the form.

function pacificDay(days: number, hour: number): string {
  const d = new Date(Date.now() + days * 86400000);
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return `${ymd}T${String(hour).padStart(2, '0')}:00`;
}

test.describe('member events (2026-10-31)', () => {
  test('the header has an Events tab right after Gallery that opens the member events page @responsive', async ({ page }) => {
    await login(page, users.member);
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    if (await menu.isVisible()) await menu.click();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Support' })).toBeVisible();
    const labels = (await nav.getByRole('link').allTextContents()).map((t) => t.trim());
    expect(labels.indexOf('Events')).toBe(labels.indexOf('Gallery') + 1);
    await nav.getByRole('link', { name: 'Events', exact: true }).click();
    await expect(page).toHaveURL(/\/events$/);
  });

  test('the form has an image size guide and a who-can-see-it choice (public by default)', async ({ page }) => {
    await login(page, users.member, undefined, '/events/new');
    await expect(page.getByText('Best image size')).toBeVisible();
    await expect(page.getByText(/1600 × 900 pixels/)).toBeVisible();
    await expect(page.getByLabel(/Everyone \(public\)/)).toBeChecked();
    await expect(page.getByLabel(/Members only/)).not.toBeChecked();
    await expectAccessible(page);
  });

  test('dashboard: My Events sits under My ask this week; a member adds a members-only event with two dates from the pop-up @responsive', async ({
    page,
    browser,
  }) => {
    const title = `Members mixer ${Date.now().toString().slice(-6)}`;
    await login(page, users.member);
    const ask = page.getByRole('heading', { name: 'My ask this week' });
    const box = page.getByRole('region', { name: 'My Events' });
    await expect(box).toBeVisible();
    expect((await box.boundingBox())!.y).toBeGreaterThan((await ask.boundingBox())!.y);
    await expect(box.getByRole('link', { name: 'Member Events' })).toHaveAttribute('href', '/events');

    await box.getByRole('button', { name: '+ Add an event' }).click();
    const dialog = page.getByRole('dialog', { name: 'Post an event' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Event title').fill(title);
    await dialog.getByLabel(/^Starts/).fill(pacificDay(4, 18));
    await dialog.getByLabel(/^Ends/).fill(pacificDay(4, 20));
    await dialog.getByRole('button', { name: '+ Add another date' }).click();
    // The new date is suggested one week later, same times.
    await expect(dialog.getByLabel('Date 2 starts')).toHaveValue(pacificDay(11, 18));
    await expect(dialog.getByLabel('Date 2 ends')).toHaveValue(pacificDay(11, 20));
    await dialog.getByLabel('Address').fill('600 Elm St, San Carlos');
    await dialog.getByLabel(/Members only/).check();
    await dialog.getByRole('button', { name: 'Publish event' }).click();
    await expect(dialog.getByText('Your event is posted!')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();

    const row = box.getByRole('listitem').filter({ hasText: title });
    await expect(row).toContainText('and 1 more date');
    await expect(row).toContainText('Members only');

    const events = await db<{ slug: string; visibility: string; series_id: string | null }>(
      `member_events?select=slug,visibility,series_id&title=eq.${encodeURIComponent(title)}&order=starts_at`,
    );
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.visibility === 'members')).toBe(true);
    expect(events[0]!.series_id).not.toBeNull();
    expect(events[1]!.series_id).toBe(events[0]!.series_id);

    // Members see it, marked Members only, with the other date listed.
    await page.goto(`/events/${events[0]!.slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText('Members only').first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Also on' }).getByRole('link')).toHaveCount(1);

    // Visitors never see it.
    const visitor = await browser.newPage();
    await visitor.goto('/events');
    await expect(visitor.getByText(title)).toHaveCount(0);
    await visitor.goto(`/events/${events[0]!.slug}`);
    await expect(visitor.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await visitor.close();

    // Editing shows both dates; deleting all removes both.
    await page.getByRole('link', { name: 'Edit event' }).click();
    await expect(page.getByText('Changes apply to all 2 dates of this event.')).toBeVisible();
    await expect(page.getByLabel('Date 2 starts')).toHaveValue(pacificDay(11, 18));
    await page.goBack();
    await page.getByRole('button', { name: 'Delete all 2 dates' }).click();
    await page.getByRole('button', { name: 'Yes, delete' }).click();
    await expect(page).toHaveURL(/\/events\?deleted=1/);
    expect(await db(`member_events?select=id&title=eq.${encodeURIComponent(title)}`)).toHaveLength(0);
  });

  test('editing a two-date event: change one time, remove a date, keep the rest; a bad date points at its row', async ({ page }) => {
    const title = `Two-date clinic ${Date.now().toString().slice(-6)}`;
    await login(page, users.member, undefined, '/events/new');
    await page.getByLabel('Event title').fill(title);
    await page.getByLabel(/^Starts/).fill(pacificDay(5, 9));
    await page.getByLabel(/^Ends/).fill(pacificDay(5, 10));
    await page.getByRole('button', { name: '+ Add another date' }).click();
    await page.getByLabel('Date 2 ends').fill(pacificDay(12, 8));
    await page.getByLabel('Address').fill('1 Laurel St');
    await page.getByRole('button', { name: 'Publish event' }).click();
    await expect(page.getByText('The end must be after the start')).toBeVisible();
    await expect(page.getByLabel('Date 2 ends')).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('Date 2 ends').fill(pacificDay(12, 10));
    await page.getByRole('button', { name: 'Publish event' }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    // Public by default.
    await expect(page.getByText('Members only')).toHaveCount(0);

    await page.getByRole('link', { name: 'Edit event' }).click();
    await page.getByRole('button', { name: 'Remove date 2' }).click();
    await page.getByLabel(/^Ends/).fill(pacificDay(5, 11));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    const rows = await db<{ ends_at: string }>(`member_events?select=ends_at&title=eq.${encodeURIComponent(title)}`);
    expect(rows).toHaveLength(1);
    await page
      .getByRole('button', { name: /^Delete/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Yes, delete' }).click();
    await expect(page).toHaveURL(/\/events\?deleted=1/);
  });
});
