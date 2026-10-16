import { expect, test, type Page } from '@playwright/test';
import { db, expectAccessible, login, trackConsole, users } from './support';

// Phase B of docs/phase-2-spec.md: member events, speaker topics, meeting slides.

/** A Pacific date+time string (YYYY-MM-DDTHH:mm) `days` from now at `hour`:00. */
function pacificDay(days: number, hour: number): string {
  const d = new Date(Date.now() + days * 86400000);
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return `${ymd}T${String(hour).padStart(2, '0')}:00`;
}

async function postEvent(page: Page, title: string) {
  await page.goto('/events/new');
  await page.getByLabel('Event title').fill(title);
  await page.getByLabel('Starts').fill(pacificDay(5, 17));
  await page.getByLabel('Ends').fill(pacificDay(5, 19));
  await page.getByLabel('In person').check();
  await page.getByLabel('Address').fill('600 Elm St, San Carlos');
  await page.getByLabel('Description').fill('Bring business cards.');
  await page.getByRole('button', { name: 'Publish event' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

test.describe('member events', () => {
  test('visitors see member events but must log in to post one', async ({ page }) => {
    await page.goto('/events');
    await expect(page.getByText(/Member event · hosted by/).first()).toBeVisible();
    await page.goto('/events/new');
    await expect(page).toHaveURL(/\/login/);
  });

  test('a member posts an event (validation first); it is public, on the calendar feed, and the host can edit and delete it', async ({ page }) => {
    await login(page, users.member, undefined, '/events/new');
    await expect(page.getByRole('heading', { level: 1, name: 'Post an event' })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Publish event' }).click();
    await expect(page.getByText('Event title is required')).toBeVisible();

    await postEvent(page, 'Morgan’s brand clinic');
    await expect(page.getByText('Member event · hosted by Morgan Member')).toBeVisible();
    const slug = page.url().split('/events/')[1] ?? '';
    expect(slug).toMatch(/^morgan-s-brand-clinic-[a-z0-9]{6}$/);

    await page.getByRole('link', { name: 'Edit event' }).click();
    await page.getByLabel('Event title').fill('Morgan’s brand clinic (moved)');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Morgan’s brand clinic (moved)' })).toBeVisible();

    // Public list and feeds
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
    await page.goto('/events');
    await expect(page.getByRole('link', { name: 'Morgan’s brand clinic (moved)', exact: true })).toBeVisible();
    const feed = await page.request.get('/calendar.ics');
    expect(await feed.text()).toContain('SUMMARY:Morgan’s brand clinic (moved)');
    const one = await page.request.get(`/events/${slug}/calendar.ics`);
    expect(await one.text()).toContain('LOCATION:600 Elm St\\, San Carlos');

    // Other members cannot edit; the host deletes
    await login(page, users.member2, undefined, `/events/${slug}`);
    await expect(page.getByRole('link', { name: 'Edit event' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
    await login(page, users.member, undefined, `/events/${slug}`);
    await page.getByRole('button', { name: 'Delete event' }).click();
    await expect(page).toHaveURL(/\/events(\?|$)/);
    expect(await db(`member_events?slug=eq.${slug}&select=id`)).toEqual([]);
  });

  test('an online event shows its link and the "Member events" filter works', async ({ page }) => {
    await login(page, users.member2, undefined, '/events/new');
    await page.getByLabel('Event title').fill('Bakery business webinar');
    await page.getByLabel('Category').selectOption('Workshop');
    await page.getByLabel('Starts').fill(pacificDay(6, 12));
    await page.getByLabel('Ends').fill(pacificDay(6, 13));
    await page.getByLabel('Online', { exact: true }).check();
    await page.getByLabel('Online link').fill('http://not-secure.example');
    await page.getByRole('button', { name: 'Publish event' }).click();
    await expect(page.getByText('Use a secure link that starts with https://')).toBeVisible();
    await page.getByLabel('Online link').fill('https://meet.example.org/bakery');
    await page.getByRole('button', { name: 'Publish event' }).click();
    await expect(page.getByRole('link', { name: 'Join online' })).toHaveAttribute('href', 'https://meet.example.org/bakery');

    await page.goto('/events');
    await page.getByRole('link', { name: /^Member events · / }).click();
    await expect(page.getByRole('link', { name: 'Bakery business webinar', exact: true })).toBeVisible();
    await expect(page.getByText(/\[New Name\] Meeting/)).toHaveCount(0);
  });

  test('admins can remove any member event', async ({ page }) => {
    const [ev] = await db<{ slug: string }>('member_events?select=slug&order=starts_at&limit=1');
    await login(page, users.admin, undefined, `/events/${ev?.slug}`);
    await expect(page.getByRole('button', { name: 'Delete event' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit event' })).toBeVisible();
  });
});

test.describe('meeting slides', () => {
  test('signed-out visitors cannot open the slides', async ({ page }) => {
    await page.goto('/present/next');
    await expect(page).toHaveURL(/\/login/);
  });

  test('members open the next meeting deck: keyboard navigation, speaker topic, axe @responsive', async ({ page }) => {
    const errors = trackConsole(page);
    await login(page, users.member, undefined, '/present/next');
    const deck = page.getByRole('region', { name: 'Meeting slides' });
    await expect(deck.getByRole('heading', { name: /Welcome to \[New Name\]/ })).toBeVisible();
    await expect(deck.getByText(/^Slide 1 of \d+$/)).toBeVisible();
    await expectAccessible(page);

    await page.keyboard.press('ArrowRight');
    await expect(deck.getByText(/^Slide 2 of/)).toBeVisible();
    await expect(deck.getByRole('heading', { name: 'Please silence your phones' })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(deck.getByText(/^Slide 1 of/)).toBeVisible();
    await page.keyboard.press('PageDown'); // presentation clickers send PageDown / PageUp
    await expect(deck.getByText(/^Slide 2 of/)).toBeVisible();

    await page.keyboard.press('End');
    await expect(deck.getByRole('heading', { name: /Thank you/ })).toBeVisible();
    await deck.getByRole('button', { name: 'Previous slide' }).click();
    await expect(deck.getByRole('heading', { name: /Upcoming events/ })).toBeVisible();

    // Jump to the 5-minute presentation slide
    await page.keyboard.press('Home');
    for (let i = 0; i < 12; i++) {
      if (await deck.getByRole('heading', { name: '5-minute presentation' }).isVisible()) break;
      await page.keyboard.press('ArrowRight');
    }
    await expect(deck.getByText('Nathan Pryor')).toBeVisible();
    await expect(deck.getByText('Understanding umbrella insurance')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('admins turn slides off and reorder them for a meeting, then reset', async ({ page }) => {
    await login(page, users.admin, undefined, '/present/next');
    const deck = page.getByRole('region', { name: 'Meeting slides' });
    const total = Number((await deck.getByText(/^Slide 1 of \d+$/).textContent())?.match(/of (\d+)/)?.[1]);

    await deck.getByRole('link', { name: 'Customize slides' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Slides for/ })).toBeVisible();
    await expectAccessible(page);
    await page.getByLabel('Show “Please silence your phones”').uncheck();
    await page.getByLabel('Position of “Thank you & next meeting”').fill('0');
    await page.getByRole('button', { name: 'Save slides' }).click();
    await expect(page.getByText('Slides saved.')).toBeVisible();

    await page.getByRole('link', { name: 'Open the slides' }).click();
    await expect(deck.getByText(new RegExp(`^Slide 1 of ${total - 1}$`))).toBeVisible();
    await expect(deck.getByRole('heading', { name: /Thank you/ })).toBeVisible();

    await deck.getByRole('link', { name: 'Customize slides' }).click();
    await page.getByRole('button', { name: 'Reset to the standard agenda' }).click();
    await expect(page.getByText('Back to the standard agenda.')).toBeVisible();
  });

  test('members cannot customize slides', async ({ page }) => {
    await login(page, users.member, undefined, '/present/next');
    await expect(page.getByRole('link', { name: 'Customize slides' })).toHaveCount(0);
  });
});
