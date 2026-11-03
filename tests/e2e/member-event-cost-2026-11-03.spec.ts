import { expect, test } from '@playwright/test';
import { db, expectAccessible, login, users } from './support';

// Owner request 2026-11-03: the event form asks whether the event is free or paid; a paid event says what it
// costs and where to pay (a payment link and/or instructions), shown to everyone on the event page.

function pacificDay(days: number, hour: number): string {
  const d = new Date(Date.now() + days * 86400000);
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return `${ymd}T${String(hour).padStart(2, '0')}:00`;
}

test.describe('member event cost (2026-11-03)', () => {
  test('free is the default; choosing Paid shows price, payment link and how to pay, and both are required @responsive', async ({ page }) => {
    await login(page, users.member, undefined, '/events/new');
    await expect(page.getByRole('radio', { name: 'Free' })).toBeChecked();
    await expect(page.getByLabel('Price')).toHaveCount(0);
    await page.getByRole('radio', { name: 'Paid' }).check();
    await expect(page.getByLabel('Price')).toBeVisible();
    await expect(page.getByLabel('Payment link')).toBeVisible();
    await expect(page.getByLabel('How to pay')).toBeVisible();
    await expectAccessible(page);

    await page.getByLabel('Event title').fill('Paid workshop');
    await page.getByLabel(/^Starts/).fill(pacificDay(5, 18));
    await page.getByLabel(/^Ends/).fill(pacificDay(5, 20));
    await page.getByLabel('Address').fill('600 Elm St, San Carlos');
    await page.getByRole('button', { name: 'Publish event' }).click();
    await expect(page.getByText('Add the price')).toBeVisible();
    await expect(page.getByText('Add a payment link or tell guests how to pay')).toBeVisible();
  });

  test('a paid event shows its price, how to pay and a Pay button to visitors; editing keeps the details', async ({ page, browser }) => {
    const title = `Wine tasting ${Date.now().toString().slice(-6)}`;
    await login(page, users.member, undefined, '/events/new');
    await page.getByLabel('Event title').fill(title);
    await page.getByLabel(/^Starts/).fill(pacificDay(6, 18));
    await page.getByLabel(/^Ends/).fill(pacificDay(6, 20));
    await page.getByLabel('Address').fill('600 Elm St, San Carlos');
    await page.getByRole('radio', { name: 'Paid' }).check();
    await page.getByLabel('Price').fill('$25 members / $35 guests');
    await page.getByLabel('Payment link').fill('https://pay.example.com/wine');
    await page.getByLabel('How to pay').fill('Or pay at the door, cash or card.');
    await page.getByRole('button', { name: 'Publish event' }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    const [ev] = await db<{ slug: string; is_paid: boolean; price: string; payment_url: string; payment_info: string }>(
      `member_events?select=slug,is_paid,price,payment_url,payment_info&title=eq.${encodeURIComponent(title)}`,
    );
    expect(ev).toMatchObject({ is_paid: true, price: '$25 members / $35 guests', payment_url: 'https://pay.example.com/wine' });

    // Visitors (not logged in) see the cost, how to pay and the Pay button.
    const visitor = await browser.newPage();
    await visitor.goto(`/events/${ev!.slug}`);
    const cost = visitor.getByRole('region', { name: 'Cost' });
    await expect(cost).toContainText('$25 members / $35 guests');
    await expect(cost).toContainText('Or pay at the door, cash or card.');
    const pay = visitor.getByRole('link', { name: /Pay for this event/ });
    await expect(pay).toHaveAttribute('href', 'https://pay.example.com/wine');
    await expect(pay).toHaveAttribute('target', '_blank');
    await visitor.goto('/events');
    await expect(visitor.getByRole('article').filter({ hasText: title })).toContainText('$25 members / $35 guests');
    await visitor.close();

    // The edit form opens with Paid and the details filled in; switching to Free clears them.
    await page.goto(`/events/${ev!.slug}/edit`);
    await expect(page.getByRole('radio', { name: 'Paid' })).toBeChecked();
    await expect(page.getByLabel('Price')).toHaveValue('$25 members / $35 guests');
    await page.getByRole('radio', { name: 'Free' }).check();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('region', { name: 'Cost' })).toContainText('Free');
    await expect(page.getByRole('link', { name: /Pay for this event/ })).toHaveCount(0);
    const [after] = await db<{ is_paid: boolean; price: string | null }>(`member_events?select=is_paid,price&slug=eq.${ev!.slug}`);
    expect(after).toEqual({ is_paid: false, price: null });
  });
});
