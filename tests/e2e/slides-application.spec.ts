import { expect, test } from '@playwright/test';
import { PASSWORD, db, expectAccessible, login, trackConsole, users } from './support';

// Owner request 2026-10-21: slides follow the new agenda (Procedures effective October 19, 2026), with the logo and
// the Golden Gate photo, speaking timers, and added slides (image / PDF upload, YouTube); application form updates
// and the "Invite to apply" email.

const BREVO = 'http://127.0.0.1:54327';

test.describe.configure({ mode: 'serial' });

async function goToSlide(deck: import('@playwright/test').Locator, page: import('@playwright/test').Page, heading: string | RegExp) {
  await page.keyboard.press('Home');
  for (let i = 0; i < 30; i++) {
    if (await deck.getByRole('heading', { name: heading }).isVisible()) return;
    await page.keyboard.press('ArrowRight');
  }
  throw new Error(`slide not found: ${heading}`);
}

test.describe('meeting slides follow the new agenda', () => {
  test('agenda order and times, logo and bridge on every slide, 60-second timer', async ({ page }) => {
    const errors = trackConsole(page);
    await login(page, users.member, undefined, '/present/next');
    const deck = page.getByRole('region', { name: 'Meeting slides' });
    const labels: string[] = [];
    const total = Number((await deck.getByText(/^Slide 1 of \d+$/).textContent())?.match(/of (\d+)/)?.[1]);
    for (let i = 0; i < total; i++) {
      const g = deck.getByRole('group').filter({ visible: true });
      labels.push(((await g.getAttribute('aria-label')) ?? '').replace(/ \(slide.*$/, ''));
      await expect(g.locator('img[src*="logo-mark"]')).toBeAttached();
      await page.keyboard.press('ArrowRight');
    }
    const order = [
      'Welcome',
      'Today’s agenda',
      'Open networking',
      'Meeting called to order',
      'Introduction of the leadership team',
      'Introduction of guests',
      '60-second infomercials',
      'Statistics',
      '5-minute educational presentation',
      'Questions for the 5-minute presentation',
      '10-minute presentation',
      'Questions for the 10-minute presentation',
      'Announcements',
      'Thank you, visitors',
      'Adjourn',
    ];
    expect(labels.filter((l) => order.includes(l))).toEqual(order);
    await expect(deck.locator('img[src*="hero-bridge"]').first()).toBeAttached();

    await goToSlide(deck, page, 'Today’s agenda');
    await expect(deck.getByText('9:11', { exact: true })).toBeVisible();
    await goToSlide(deck, page, '60-second infomercials');
    await expect(deck.getByText('8:33 AM').filter({ visible: true })).toBeVisible();
    const timer = deck.getByRole('timer', { name: /60-second infomercial/ });
    await expect(timer).toHaveText('1:00');
    await deck.getByRole('button', { name: /Start timer \(60-second infomercial\)/ }).click();
    await expect(timer).not.toHaveText('1:00', { timeout: 3000 });
    await deck.getByRole('button', { name: /Pause/ }).click();
    await deck.getByRole('button', { name: /Reset 60-second infomercial/ }).click();
    await expect(timer).toHaveText('1:00');
    await expectAccessible(page);
    expect(errors).toEqual([]);
  });

  test('admins add an image, a PDF (one slide per page) and a YouTube video, move and remove them', async ({ page }) => {
    await login(page, users.admin, undefined, '/present/next');
    const deck = page.getByRole('region', { name: 'Meeting slides' });
    const before = Number((await deck.getByText(/^Slide 1 of \d+$/).textContent())?.match(/of (\d+)/)?.[1]);
    await deck.getByRole('link', { name: 'Customize slides' }).click();

    const upload = page.getByRole('form', { name: 'Upload an image or PDF' });
    await upload.getByLabel('File').setInputFiles('tests/e2e/fixtures/slide-image.png');
    await upload.getByLabel('Title (optional)').fill('Sponsor thank-you');
    await upload.getByLabel('Show after').selectOption('call_to_order');
    await upload.getByRole('button', { name: 'Add to slides' }).click();
    await expect(upload.getByText('Image added.')).toBeVisible();

    await upload.getByLabel('File').setInputFiles('tests/e2e/fixtures/two-pages.pdf');
    await upload.getByLabel('Title (optional)').fill('Celeste’s deck');
    await upload.getByLabel('Show after').selectOption('ten_minute');
    await upload.getByRole('button', { name: 'Add to slides' }).click();
    await expect(upload.getByText('PDF added (2 pages).')).toBeVisible();

    const yt = page.getByRole('form', { name: 'Add a YouTube video' });
    await yt.getByLabel('YouTube link').fill('https://vimeo.com/123');
    await yt.getByRole('button', { name: 'Add video' }).click();
    await expect(yt.getByText(/Paste a YouTube video link/)).toBeVisible();
    await yt.getByLabel('YouTube link').fill('https://youtu.be/dQw4w9WgXcQ?t=30');
    await yt.getByLabel('Title (optional)').fill('Member testimonial');
    await page.getByRole('form', { name: 'Add a YouTube video' }).getByRole('button', { name: 'Add video' }).click();
    await expect(page.getByText('Video added.')).toBeVisible();
    const list = page.getByRole('list', { name: 'Added slides list' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(list).toContainText('PDF · 2 pages');
    await expectAccessible(page);

    await page.getByRole('link', { name: 'Open the slides' }).click();
    await expect(deck.getByText(new RegExp(`^Slide 1 of ${before + 4}$`))).toBeVisible();
    await goToSlide(deck, page, 'Sponsor thank-you');
    const shownImage = deck.getByRole('img', { name: 'Sponsor thank-you' });
    await expect(shownImage).toBeVisible();
    expect(await shownImage.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('heading', { name: 'Introduction of the leadership team' }).or(deck.getByRole('heading', { name: 'Meet the leadership team' }))).toBeVisible();

    await goToSlide(deck, page, /Celeste’s deck/);
    await expect(deck.getByRole('img', { name: 'Celeste’s deck, page 1' })).toBeVisible();
    await expect(deck.getByText('Loading page 1…')).toHaveCount(0, { timeout: 10_000 });
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('img', { name: 'Celeste’s deck, page 2' })).toBeVisible();
    await expect(deck.getByText('This page could not be shown.')).toHaveCount(0);

    await goToSlide(deck, page, 'Member testimonial');
    // Nothing loads from YouTube until Play.
    await expect(deck.locator('iframe')).toHaveCount(0);
    await deck.getByRole('button', { name: 'Play video: Member testimonial' }).click();
    await expect(deck.locator('iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"][src*="start=30"]')).toBeAttached();

    await deck.getByRole('link', { name: 'Customize slides' }).click();
    const move = page.getByRole('form', { name: 'Move Sponsor thank-you' });
    await move.getByLabel('Show after').selectOption('adjourn');
    await move.getByRole('button', { name: 'Move' }).click();
    await expect(page.getByRole('list', { name: 'Added slides list' })).toContainText('after “9:30 · Adjourn”');
    for (const name of ['Sponsor thank-you', 'Celeste’s deck', 'Member testimonial']) {
      await page.getByRole('button', { name: `Remove ${name}` }).click();
      await expect(page.getByRole('button', { name: `Remove ${name}` })).toHaveCount(0);
    }
    await expect(page.getByText('No added slides yet.')).toBeVisible();
  });

  test('members cannot see the slide setup page', async ({ page }) => {
    await login(page, users.member, undefined, '/present/next');
    const href = await page.url();
    await page.goto(`${href.replace(/\/$/, '')}/setup`);
    await expect(page.getByRole('form', { name: 'Upload an image or PDF' })).toHaveCount(0);
  });
});

test.describe('membership application', () => {
  test('admin invites a visited guest to apply; the email links to the form, filled in with what we know', async ({ page }) => {
    const email = `guest.apply.${Date.now()}@example.org`;
    await page.goto('/visit');
    await page.getByLabel('First name').fill('Ivy');
    await page.getByLabel('Last name').fill('Applicant');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Business name').fill('Ivy Bookkeeping');
    await page.getByRole('button', { name: 'Send my invite request' }).click();
    await expect(page.getByText("You're on the list, Ivy!")).toBeVisible();

    await login(page, users.admin, undefined, '/admin');
    await page.getByRole('button', { name: 'Invite to apply (Ivy Applicant)' }).click();
    await expect(page.getByText('Invite sent.')).toBeVisible();
    let mail: { subject: string; htmlContent: string; textContent: string } | undefined;
    for (let i = 0; i < 40 && !mail; i++) {
      const all = (await (await fetch(`${BREVO}/emails?to=${encodeURIComponent(email)}`)).json()) as { subject: string; htmlContent: string; textContent: string }[];
      mail = all.find((m) => /invited to apply/.test(m.subject));
      if (!mail) await page.waitForTimeout(250);
    }
    expect(mail?.subject).toBe("You're invited to apply to Bay Area Referral Partners");
    const link = mail?.textContent.match(/https?:\/\/\S+\/join\?invite=[0-9a-f-]{36}/)?.[0] ?? '';
    expect(link).not.toBe('');
    await page.reload();
    await expect(page.getByText(/Invited \w{3} \d+, \d{4}/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await page.goto(new URL(link).pathname + new URL(link).search);
    await expect(page.getByText("You're invited to apply, Ivy!")).toBeVisible();
    const info = page.getByRole('group', { name: 'Business information' });
    await expect(info.getByLabel('First name')).toHaveValue('Ivy');
    await expect(info.getByLabel('Email')).toHaveValue(email);
    await expect(info.getByLabel('Business name')).toHaveValue('Ivy Bookkeeping');
    await expectAccessible(page);
  });

  test('the form matches the paper application: sections, reference business names, signature, date and name', async ({ page }) => {
    const email = `e2e.paperform.${Date.now()}@example.test`;
    await page.goto('/join');
    for (const legend of ['Business information', 'Business reference 1', 'Business reference 2', 'Agreement terms'])
      await expect(page.getByRole('group', { name: legend })).toBeVisible();
    await expect(page.getByText(/By signing below, I agree to the terms above/)).toBeVisible();
    const info = page.getByRole('group', { name: 'Business information' });
    await info.getByLabel('First name').fill('Paula');
    await info.getByLabel('Last name').fill('Paperform');
    await expect(page.getByRole('group', { name: 'Agreement terms' }).getByText('Paula Paperform')).toBeVisible();
    await info.getByLabel('Email').fill(email);
    await info.getByLabel('Business phone').fill('(650) 555-0142');
    await info.getByLabel('Business name').fill('Paperform Printing');
    await info.getByLabel('Category').selectOption({ index: 1 });
    await info.getByLabel(/How long have you been in this business/).fill('6 years');
    await info.getByLabel(/Describe your product or service/).fill('Printing for small businesses.');
    await info.getByLabel('Password').fill(PASSWORD);
    for (const n of [1, 2]) {
      const ref = page.getByRole('group', { name: `Business reference ${n}` });
      await ref.getByLabel(/^Name/).fill(`Ref ${n} Person`);
      await ref.getByLabel('Business', { exact: true }).fill('Accountant');
      await ref.getByLabel('Business name', { exact: true }).fill(`Ref ${n} Accounting Co`);
      await ref.getByLabel('Phone').fill('(650) 555-0100');
    }
    await page.getByLabel('Meetings attended as a guest').selectOption('1');
    await page.getByLabel(/By signing below/).check();
    await page.getByLabel('Signature').fill('Paula Paperform');
    await page.getByRole('button', { name: 'Submit application' }).click();
    await expect(page.getByRole('heading', { name: 'Application received' })).toBeVisible();
    const [p] = await db<{ id: string }>(`profiles?select=id&first_name=eq.Paula&last_name=eq.Paperform`);
    const [app] = await db<{ references: { business: string; business_name: string }[] }>(`member_applications?select=references&profile_id=eq.${p?.id}`);
    expect(app?.references.map((r) => [r.business, r.business_name])).toEqual([
      ['Accountant', 'Ref 1 Accounting Co'],
      ['Accountant', 'Ref 2 Accounting Co'],
    ]);
  });
});
