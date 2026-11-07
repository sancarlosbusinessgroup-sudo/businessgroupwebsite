import { expect, test } from '@playwright/test';
import { db, expectAccessible, login, users } from './support';

// Owner requests 2026-11-07: presenters add their own slides on the Meetings page (admins are emailed);
// "Post an event" sits under the Member events heading (no side card); admins reorder the gallery.

const BREVO = 'http://127.0.0.1:54327';
type Sent = { subject: string; htmlContent: string };
async function emailsTo(to: string, subject: RegExp, timeoutMs = 10_000): Promise<Sent[]> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const all = (await (await fetch(`${BREVO}/emails?to=${encodeURIComponent(to)}`)).json()) as Sent[];
    const hits = all.filter((e) => subject.test(e.subject));
    if (hits.length || Date.now() > end) return hits;
    await new Promise((r) => setTimeout(r, 250));
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('owner requests 2026-11-07', () => {
  test('a presenter uploads a PDF and adds a website for their own slot; admins are emailed and see it; it shows after their slide; they remove it', async ({
    page,
  }) => {
    await login(page, users.member, undefined, '/meetings');
    const claim = page.getByRole('form', { name: /^Claim the 5-minute slot/ }).first();
    await claim.getByLabel('Topic').fill('Saving on business insurance');
    await claim.getByRole('button', { name: 'Claim' }).click();
    const mine = page.getByRole('region', { name: /^Slides for my 5-minute presentation/ }).first();
    await expect(mine).toBeVisible();
    await mine.getByRole('button', { name: 'Add my slides' }).click();
    const upload = mine.getByRole('form', { name: /^Upload for my 5-minute presentation/ });
    await upload.getByLabel('File').setInputFiles('tests/e2e/fixtures/two-pages.pdf');
    await upload.getByLabel('Title (optional)').fill('My insurance deck');
    await upload.getByRole('button', { name: 'Add to slides' }).click();
    await expect(upload.getByText('PDF added (2 pages).')).toBeVisible();
    const link = mine.getByRole('form', { name: /^Video or website for my 5-minute presentation/ });
    await link.getByLabel('YouTube or website link').fill('https://example.com/my-quote');
    await link.getByLabel('Title (optional)').fill('Quote page');
    await link.getByRole('button', { name: 'Add link' }).click();
    await expect(page.getByText('Website added.')).toBeVisible();
    const list = mine.getByRole('list', { name: /^Added for my 5-minute presentation/ });
    await expect(list).toContainText('My insurance deck');
    await expect(list).toContainText('Quote page');
    await expectAccessible(page);

    // Stored in the member's own folder, after the 5-minute slide.
    const [row] = await db<{ storage_path: string; after_slide: string }>(`meeting_slide_media?title=eq.My%20insurance%20deck&select=storage_path,after_slide`);
    expect(row?.after_slide).toBe('five_minute');
    expect(row?.storage_path).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/);

    // Admins are told.
    const mails = await emailsTo(users.admin, /added a PDF for their 5-Minute Member Education/);
    expect(mails.length).toBeGreaterThan(0);
    expect(mails[0]!.htmlContent).toContain('My insurance deck');
    expect(mails[0]!.htmlContent).toContain('/setup');

    // The presenter removes the website; the PDF stays.
    await list.getByRole('button', { name: 'Remove Quote page' }).click();
    await expect(list).not.toContainText('Quote page');
    await expect(list).toContainText('My insurance deck');

    // Releasing the slot removes their slides too.
    await page
      .getByRole('button', { name: /^Release my 5-minute/ })
      .first()
      .click();
    await expect(page.getByRole('region', { name: /^Slides for my 5-minute presentation/ })).toHaveCount(0);
    await expect.poll(async () => (await db(`meeting_slide_media?title=eq.My%20insurance%20deck&select=id`)).length).toBe(0);
  });

  test('admins see who added a presenter’s material in Customize slides', async ({ page }) => {
    await login(page, users.member, undefined, '/meetings');
    const claim = page.getByRole('form', { name: /^Claim the 10-minute slot/ }).first();
    await claim.getByLabel('Topic').fill('How referrals work for us');
    await claim.getByRole('button', { name: 'Claim' }).click();
    const mine = page.getByRole('region', { name: /^Slides for my 10-minute presentation/ }).first();
    await mine.getByRole('button', { name: 'Add my slides' }).click();
    const link = mine.getByRole('form', { name: /^Video or website for my 10-minute presentation/ });
    await link.getByLabel('YouTube or website link').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await link.getByLabel('Title (optional)').fill('Client story video');
    await link.getByRole('button', { name: 'Add link' }).click();
    await expect(page.getByText('Video added.')).toBeVisible();
    const [m] = await db<{ meetings: { slug: string } }>(`meeting_slide_media?title=eq.Client%20story%20video&select=meetings(slug)`);

    await page.context().clearCookies();
    await login(page, users.admin, undefined, `/present/${m!.meetings.slug}/setup`);
    const ten = page.getByRole('list', { name: 'Materials for the 10-minute presentation' });
    await expect(ten).toContainText('Client story video');
    await expect(ten).toContainText(/added by /);
    // Admin cleans up.
    await ten.getByRole('button', { name: 'Remove Client story video' }).click();
    await expect(page.getByText('Client story video')).toHaveCount(0);
  });

  test('member events: “Hosting something?” sits under the heading and the side card is gone @responsive', async ({ page }) => {
    await login(page, users.member, undefined, '/events');
    const banner = page.getByTestId('post-event-banner');
    await expect(banner.getByRole('heading', { name: 'Hosting something?' })).toBeVisible();
    await expect(banner.getByText('Members can post workshops, socials and open houses. They appear here right away.')).toBeVisible();
    await expect(banner.getByRole('link', { name: 'Post an event' })).toHaveAttribute('href', '/events/new');
    const heading = page.getByRole('heading', { name: 'Upcoming member events' });
    expect((await banner.boundingBox())!.y).toBeGreaterThan((await heading.boundingBox())!.y);
    await expect(page.getByRole('complementary').getByRole('heading', { name: 'Hosting something?' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Hosting something?' })).toHaveCount(1);
    await expectAccessible(page);
  });

  test('admins reorder the gallery; the Gallery page follows', async ({ page }) => {
    await login(page, users.admin, undefined, '/admin/gallery');
    const cards = page.locator('main li[id^="photo-"]');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(2);
    const thirdId = (await cards.nth(2).getAttribute('id'))!.replace('photo-', '');
    const thirdCaption = await cards.nth(2).locator('img').getAttribute('alt');
    await cards
      .nth(2)
      .getByRole('button', { name: /to the top$/ })
      .click();
    await expect(cards.first()).toHaveAttribute('id', `photo-${thirdId}`);
    await expect(cards.first().getByLabel(/^Position/)).toHaveValue('1');
    await expect(cards.first().getByRole('button', { name: /to the top$/ })).toBeDisabled();

    // Move it down one, then to position 3 by typing.
    await cards
      .first()
      .getByRole('button', { name: /one later$/ })
      .click();
    await expect(cards.nth(1)).toHaveAttribute('id', `photo-${thirdId}`);
    await cards
      .nth(1)
      .getByLabel(/^Position/)
      .fill('3');
    await cards.nth(1).getByRole('button', { name: 'Move', exact: true }).click();
    await expect(cards.nth(2)).toHaveAttribute('id', `photo-${thirdId}`);
    await expectAccessible(page);

    // Back to the top and check the public gallery.
    await cards
      .nth(2)
      .getByRole('button', { name: /to the top$/ })
      .click();
    await expect(cards.first()).toHaveAttribute('id', `photo-${thirdId}`);
    await page.goto('/gallery');
    await expect(page.getByRole('button', { name: /^Open photo:/ }).first()).toContainText(thirdCaption!);
  });
});
