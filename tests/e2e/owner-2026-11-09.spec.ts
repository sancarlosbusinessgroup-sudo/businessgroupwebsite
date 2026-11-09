import { expect, test } from '@playwright/test';
import { STACK, db, expectAccessible, login, serviceKey, users } from './support';

// Owner requests 2026-11-09: web addresses in event text are clickable; in-person venues open Google Maps;
// the displayed "Hosted by" name can be changed (the poster still owns the event); the Happy-birthday slide
// uses the balloon artwork with fireworks; the events slide shows each event's image.

function pacificDay(days: number, hour: number): string {
  const d = new Date(Date.now() + days * 86400000);
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return `${ymd}T${String(hour).padStart(2, '0')}:00`;
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

const ADDRESS = '1000 Laurel St, San Carlos, CA 94070';
const MAPS = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`;

test.describe('owner requests 2026-11-09', () => {
  test('event text links are clickable, the venue opens Google Maps, and "Hosted by" can be changed without changing the owner', async ({
    page,
    browser,
  }) => {
    const title = `Open house ${Date.now().toString().slice(-6)}`;
    await login(page, users.member, undefined, '/events/new');
    // The default host name is offered as the placeholder.
    await expect(page.getByLabel('Hosted by')).toHaveAttribute('placeholder', 'Morgan Member');
    await page.getByLabel('Event title').fill(title);
    await page.getByLabel(/^Starts/).fill(pacificDay(5, 17));
    await page.getByLabel(/^Ends/).fill(pacificDay(5, 19));
    await page.getByLabel('Address').fill(ADDRESS);
    await page.getByLabel('Description').fill('Tour the new office.\nRSVP at https://example.org/rsvp?x=1. More at www.example.com!');
    await page.getByLabel('Hosted by').fill('Morgan & Co Realty');
    await page.getByRole('button', { name: 'Publish event' }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    // Stored: the label is separate from the host.
    const [me] = await db<{ id: string }>('profiles?select=id&first_name=eq.Morgan&last_name=eq.Member');
    const [ev] = await db<{ slug: string; host_id: string; host_label: string }>(`member_events?select=slug,host_id,host_label&title=eq.${encodeURIComponent(title)}`);
    expect(ev).toMatchObject({ host_id: me!.id, host_label: 'Morgan & Co Realty' });

    // Visitors see the label, clickable links and the map link.
    const ctx = await browser.newContext();
    const visitor = await ctx.newPage();
    await visitor.goto(`/events/${ev!.slug}`);
    await expect(visitor.getByText('Member event · hosted by Morgan & Co Realty')).toBeVisible();
    const desc = visitor.getByTestId('event-description');
    const rsvp = desc.getByRole('link', { name: /example\.org\/rsvp/ });
    await expect(rsvp).toHaveAttribute('href', 'https://example.org/rsvp?x=1');
    await expect(rsvp).toHaveAttribute('target', '_blank');
    await expect(rsvp).toHaveAttribute('rel', /noopener/);
    await expect(desc.getByRole('link', { name: /www\.example\.com/ })).toHaveAttribute('href', 'https://www.example.com');
    // The punctuation stays outside the link.
    await expect(desc.getByRole('link', { name: /www\.example\.com/ })).not.toContainText('!');
    await expect(desc).toContainText(/More at www\.example\.com.*!$/);
    const venues = visitor.getByTestId('venue-link');
    await expect(venues).toHaveCount(2); // in the header and after the description
    await expect(venues.first()).toHaveAttribute('href', MAPS);
    await expect(venues.first()).toHaveAttribute('target', '_blank');
    await expect(venues.last()).toContainText(ADDRESS);
    await expectAccessible(visitor);

    // The list card too.
    await visitor.goto('/events');
    const card = visitor.getByRole('article').filter({ hasText: title });
    await expect(card).toContainText('hosted by Morgan & Co Realty');
    await expect(card.getByTestId('venue-link')).toHaveAttribute('href', MAPS);
    await expect(card.getByRole('link', { name: /example\.org\/rsvp/ })).toHaveAttribute('href', 'https://example.org/rsvp?x=1');
    await ctx.close();

    // Edit: the label is filled in; clearing it brings the member's own name back. The event still belongs to them.
    await page.goto(`/events/${ev!.slug}/edit`);
    await expect(page.getByLabel('Hosted by')).toHaveValue('Morgan & Co Realty');
    await page.getByLabel('Hosted by').fill('');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Member event · hosted by Morgan Member')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit event' })).toBeVisible();
    const [after] = await db<{ host_id: string; host_label: string | null }>(`member_events?select=host_id,host_label&slug=eq.${ev!.slug}`);
    expect(after).toEqual({ host_id: me!.id, host_label: null });

    // Too short is refused.
    await page.goto(`/events/${ev!.slug}/edit`);
    await page.getByLabel('Hosted by').fill('A');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Use at least 2 characters')).toBeVisible();
  });

  test('slides: the events slide shows the event image; the birthday slide has the balloon artwork and fireworks', async ({ page }) => {
    const title = `Picture event ${Date.now().toString().slice(-6)}`;
    await login(page, users.member, undefined, '/events/new');
    await page.getByLabel('Event title').fill(title);
    await page.getByLabel(/^Starts/).fill(pacificDay(4, 17));
    await page.getByLabel(/^Ends/).fill(pacificDay(4, 19));
    await page.getByLabel('Address').fill(ADDRESS);
    await page.getByLabel('Image (optional)').setInputFiles('tests/e2e/fixtures/slide-image.png');
    await page.getByRole('button', { name: 'Publish event' }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    const [ev] = await db<{ id: string; image_path: string | null }>(`member_events?select=id,image_path&title=eq.${encodeURIComponent(title)}`);
    expect(ev?.image_path).toBeTruthy();

    const [me] = await db<{ id: string }>('profiles?select=id&first_name=eq.Morgan&last_name=eq.Member');
    await rest(`profiles?id=eq.${me?.id}`, 'PATCH', { birthday_month: 2, birthday_day: 14 });
    const [m] = await rest('meetings', 'POST', {
      slug: `birthday-art-${Date.now()}`,
      title: 'Birthday artwork meeting',
      category: 'Networking',
      starts_at: '2027-02-08T16:15:00Z',
      ends_at: '2027-02-08T17:30:00Z',
    });
    try {
      // Events slide (the next meeting: the event is within its 45-day window).
      await page.goto('/present/next');
      const deck = page.getByRole('region', { name: 'Meeting slides' });
      const goTo = async (heading: RegExp) => {
        await expect(async () => {
          if (!(await deck.getByRole('heading', { name: heading }).isVisible())) {
            await page.keyboard.press('ArrowRight');
            throw new Error('not there yet');
          }
        }).toPass({ timeout: 30000, intervals: [200] });
      };
      await goTo(/Upcoming events & announcements/);
      const item = deck.getByRole('listitem').filter({ hasText: title });
      await expect(item).toBeVisible();
      await expect(item.getByTestId('event-slide-image')).toBeVisible();

      // Birthday slide.
      await page.goto(`/present/${m?.slug}`);
      await goTo(/^Happy birthday!$/);
      await expect(deck.getByTestId('birthday-background')).toBeVisible();
      await expect(deck.getByTestId('birthday-background')).toHaveAttribute('src', /birthday-bg/);
      await expect(deck.getByTestId('fireworks')).toBeAttached();
      await expect(deck.getByText('Morgan Member', { exact: true })).toBeVisible();
      await expect(deck.getByText('Feb 14', { exact: true })).toBeVisible();
    } finally {
      await rest(`meetings?id=eq.${m?.id}`, 'DELETE');
      await rest(`profiles?id=eq.${me?.id}`, 'PATCH', { birthday_month: null, birthday_day: null });
      await rest(`member_events?id=eq.${ev?.id}`, 'DELETE');
    }
  });
});
