import { expect, test } from '@playwright/test';
import { PASSWORD, db, expectAccessible, login, trackConsole, users } from './support';

// Owner request 2026-10-21: slides follow the new agenda (Procedures effective October 19, 2026), with the logo and
// the Golden Gate photo, speaking timers, and added slides (image / PDF upload, YouTube, websites); application form updates
// and the "Invite to apply" email.

const BREVO = 'http://127.0.0.1:54327';

test.describe.configure({ mode: 'serial' });

/** On Customize slides: tick exactly these timers (all others off) and save. */
async function setTimers(page: import('@playwright/test').Page, on: string[]) {
  const form = page.getByRole('form', { name: 'Slides to show' });
  for (const box of await form.getByRole('checkbox', { name: /^Show timer:/ }).all()) {
    const name = (await box.getAttribute('name')) ?? '';
    if (on.includes(name.replace(/^timer_/, ''))) await box.check();
    else await box.uncheck();
  }
  await form.getByRole('button', { name: 'Save slides' }).click();
  await expect(page.getByText('Slides saved.')).toBeVisible();
}

/** On Customize slides: also show the two (optional) question slides, each right after its presentation. */
async function showQuestionSlides(page: import('@playwright/test').Page) {
  const form = page.getByRole('form', { name: 'Slides to show' });
  for (const n of ['5', '10']) {
    await form.getByLabel(new RegExp(`^Show “.*Questions for the ${n}-minute presentation”`)).check();
    const at = await form.getByLabel(new RegExp(`^Position of “[^”]*· ${n === '5' ? '5-minute educational' : '10-minute'} presentation”`)).inputValue();
    await form.getByLabel(new RegExp(`^Position of “.*Questions for the ${n}-minute presentation”`)).fill(at);
  }
}

async function goToSlide(deck: import('@playwright/test').Locator, page: import('@playwright/test').Page, heading: string | RegExp) {
  await page.keyboard.press('Home');
  for (let i = 0; i < 30; i++) {
    if (await deck.getByRole('heading', { name: heading }).isVisible()) return;
    await page.keyboard.press('ArrowRight');
  }
  throw new Error(`slide not found: ${heading}`);
}

test.describe('meeting slides follow the new agenda', () => {
  test('the owner’s standard deck: order, larger logo and bridge on every slide, no tabs, no date or time stamps, no timers by default', async ({ page }) => {
    const errors = trackConsole(page);
    await login(page, users.member, undefined, '/present/next');
    const deck = page.getByRole('region', { name: 'Meeting slides' });
    const labels: string[] = [];
    const total = Number((await deck.getByText(/^Slide 1 of \d+$/).textContent())?.match(/of (\d+)/)?.[1]);
    for (let i = 0; i < total; i++) {
      const g = deck.getByRole('group').filter({ visible: true });
      labels.push(((await g.getAttribute('aria-label')) ?? '').replace(/ \(slide.*$/, ''));
      // The BARP Champion slide is the owner's artwork, which carries the logo itself (owner, 2026-10-24).
      if (labels.at(-1) === 'BARP Champion') await expect(g.getByTestId('champion-background')).toBeAttached();
      else await expect(g.locator('img[src*="logo-mark"]')).toBeAttached();
      // No date/time stamp in the corner and no timers unless an admin switches them on (owner, 2026-10-22).
      await expect(g.getByText(/^\d{1,2}:\d{2} AM$/)).toHaveCount(0);
      await expect(g.getByRole('timer')).toHaveCount(0);
      await page.keyboard.press('ArrowRight');
    }
    expect(labels).toEqual([
      'Logo',
      'Welcome (open networking)',
      'Let’s begin (meeting called to order)',
      'Visitors (how to join)',
      'Meet the Management Team',
      '60-second infomercial and reporting',
      'Introduction of Visitors',
      'Statistics',
      'Leaderboards',
      'BARP Champion',
      '5-minute educational presentation',
      '10-minute presentation',
      'Announcements',
      'Adjourn',
    ]);
    await expect(deck.locator('img[src*="hero-bridge"]').first()).toBeAttached();
    // No green section tabs (spaced capitals) above the titles any more.
    await expect(deck.getByText(/^(Welcome in|Meeting called to order|Leadership & responsibilities|Please welcome|Roundtable)$/)).toHaveCount(0);

    // Slide 1: just the logo, large.
    await page.keyboard.press('Home');
    const first = deck.getByRole('group').filter({ visible: true });
    await expect(first.getByText(/Meeting #|A system for business growth|AM PT/)).toHaveCount(0);
    const stageW = (await deck.locator('[aria-roledescription="slide"]').boundingBox())?.width ?? 0;
    const logoW = (await first.locator('img[src*="logo-mark"]').boundingBox())?.width ?? 0;
    expect(logoW).toBeGreaterThan(stageW * 0.12);

    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
    // Title and text sit in the vertical middle of the slide, not at the top.
    const stageBox = (await deck.locator('[aria-roledescription="slide"]').boundingBox())!;
    const welcomeBox = (await deck.getByRole('heading', { name: 'Welcome', exact: true }).boundingBox())!;
    expect(welcomeBox.y - stageBox.y).toBeGreaterThan(stageBox.height * 0.22);
    // The Golden Gate photo shows on the right and fades to white beneath the text.
    await expect(deck.getByRole('group').filter({ visible: true }).locator('img[src*="welcome-bridge"]')).toBeVisible();
    await expect(deck.getByText(/A chance to chat/)).toHaveCount(0);
    // Welcome: two points since 2026-10-23 (no "Say hello").
    await expect(deck.getByText('Please can you put your camera on, and add your name and business to your Zoom Window.')).toBeVisible();
    await expect(deck.getByText('Meeting called to order at 8:30am sharp')).toBeVisible();
    await expect(deck.getByText(/Say hello to someone/)).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    const begin = deck.getByRole('group').filter({ visible: true });
    await expect(begin.getByRole('heading', { name: 'Let’s begin.' })).toBeVisible();
    await expect(begin.getByRole('img', { name: 'Please silence your phone' })).toBeVisible();
    await expect(begin.getByRole('listitem')).toHaveCount(0);
    const b = (await begin.getByRole('heading', { name: 'Let’s begin.' }).boundingBox())!;
    expect(Math.abs(b.x + b.width / 2 - (stageBox.x + stageBox.width / 2))).toBeLessThan(stageBox.width * 0.03);
    await page.keyboard.press('ArrowRight');
    const visitors = deck.getByRole('group').filter({ visible: true });
    await expect(visitors.getByRole('heading', { name: 'Visitors', exact: true })).toBeVisible();
    await expect(visitors.getByRole('list', { name: 'How to become a member' }).getByRole('listitem')).toHaveText([
      /1\s*Attend as a guest/,
      /2\s*Receive all application forms/,
      /3\s*Have a one-on-one with the Membership Committee/,
      /4\s*Application approved/,
      /5\s*We help you grow your business by referral/,
    ]);
    await page.keyboard.press('ArrowRight');
    const mgmt = deck.getByRole('group').filter({ visible: true });
    await expect(mgmt.getByRole('heading', { name: 'Meet the Management Team' })).toBeVisible();
    // Grouped like the printed Management Team slide: roles in two columns, then the Membership Committee.
    await expect(mgmt.getByRole('heading', { name: 'Membership Committee' })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    // "Introduction of Guests" is no longer in the standard deck (owner, 2026-10-22): the infomercial slide comes next.
    await expect(deck.getByRole('heading', { name: 'Introduction of Guests' })).toHaveCount(0);
    const info = deck.getByRole('group').filter({ visible: true });
    await expect(info.getByRole('listitem')).toHaveText(['Infomercial', 'Referrals', 'One-to-ones', 'Closed business', 'Thank-yous', 'Testimonials', 'Leads']);
    await expect(info.getByRole('heading', { name: '60-second infomercial and reporting' })).toBeVisible();
    // No sentence under the title (owner, 2026-10-22).
    await expect(info.getByText(/Tells who you are/)).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    // "Introduction of Visitors" between the infomercials and Statistics, title only, centred (owner, 2026-10-24).
    const intro = deck.getByRole('group').filter({ visible: true });
    await expect(intro.getByRole('heading', { name: 'Introduction of Visitors' })).toBeVisible();
    await expect(intro.getByRole('listitem')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('heading', { name: 'Statistics' })).toBeVisible();

    // After the leaderboards: "BARP Champion", coming soon (owner, 2026-10-23).
    await goToSlide(deck, page, 'Leaderboards');
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('heading', { name: 'BARP Champion' })).toBeVisible();
    await expect(
      deck
        .getByRole('group')
        .filter({ visible: true })
        .getByText(/^(Coming soon|Leading .* so far)$/),
    ).toBeAttached();
    // The owner's champion artwork is the slide's background (owner, 2026-10-24).
    await expect(deck.getByRole('group').filter({ visible: true }).getByTestId('champion-background')).toHaveAttribute('src', /champion-/);

    // Presentation slides show the presentation title; no question slides after them by default (owner, 2026-10-23).
    await goToSlide(deck, page, '5-Minute Educational Presentation');
    await expect(deck.getByText('“Understanding umbrella insurance”')).toBeVisible();
    await expect(deck.getByText(/One member shares something/)).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('heading', { name: '10-Minute Presentation' })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('heading', { name: /^Upcoming events/ })).toBeVisible();

    // Closing slide: the next meeting's presenters, with their photo or initials.
    await page.keyboard.press('End');
    const presenters = deck.getByRole('group').filter({ visible: true }).getByRole('list', { name: 'Presenting next meeting' });
    await expect(presenters.getByRole('listitem')).toHaveCount(2);
    await expect(presenters.getByRole('listitem').first()).toContainText('5-minute presentation');
    await expectAccessible(page);
    expect(errors).toEqual([]);
  });

  test('admins add materials (PDF, website, YouTube) for the 5- and 10-minute presentations; the presentation timer carries on over them', async ({ page }) => {
    await login(page, users.admin, undefined, '/present/next');
    const deck = page.getByRole('region', { name: 'Meeting slides' });
    await deck.getByRole('link', { name: 'Customize slides' }).click();
    const five = page.getByRole('form', { name: 'Upload for the 5-minute presentation' });
    await five.getByLabel('File').setInputFiles('tests/e2e/fixtures/two-pages.pdf');
    await five.getByLabel('Title (optional)').fill('Umbrella insurance deck');
    await five.getByRole('button', { name: 'Add to slides' }).click();
    await expect(five.getByText('PDF added (2 pages).')).toBeVisible();
    const fiveLink = page.getByRole('form', { name: 'Video or website for the 5-minute presentation' });
    await fiveLink.getByLabel('YouTube or website link').fill('http://insecure.example.com');
    await fiveLink.getByRole('button', { name: 'Add link' }).click();
    await expect(fiveLink.getByText(/Paste a YouTube or website link/)).toBeVisible();
    const site = 'https://example.com/bbext/?p=video_land&id=a09a5bf9-a634-4eea-ad4c-2c1d7bf630e0&beid=gm%3A2046e282';
    await fiveLink.getByLabel('YouTube or website link').fill(site);
    await fiveLink.getByLabel('Title (optional)').fill('Client video page');
    await fiveLink.getByRole('button', { name: 'Add link' }).click();
    await expect(page.getByText('Website added.')).toBeVisible();
    const ten = page.getByRole('form', { name: 'Video or website for the 10-minute presentation' });
    await ten.getByLabel('YouTube or website link').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await ten.getByLabel('Title (optional)').fill('Client story');
    await ten.getByRole('button', { name: 'Add link' }).click();
    await expect(page.getByText('Video added.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Materials for the 5-minute presentation' })).toContainText('Umbrella insurance deck');
    await expect(page.getByRole('list', { name: 'Materials for the 5-minute presentation' })).toContainText('Client video page');
    await expect(page.getByRole('list', { name: 'Materials for the 10-minute presentation' })).toContainText('Client story');
    await expectAccessible(page);
    // The question slides are optional since 2026-10-23: switch them on to check their timers.
    await showQuestionSlides(page);
    await setTimers(page, ['five_minute', 'five_materials', 'five_qa', 'ten_minute', 'ten_materials', 'ten_qa']);

    await page.getByRole('link', { name: 'Open the slides' }).click();
    await goToSlide(deck, page, '5-Minute Educational Presentation');
    await deck.getByRole('button', { name: /Start timer \(5-minute presentation\)/ }).click();
    await expect(deck.getByRole('timer', { name: /5-minute presentation/ })).not.toHaveText('5:00', { timeout: 3000 });

    // The same countdown keeps running on top of the presenter's own slides.
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('img', { name: 'Umbrella insurance deck, page 1' })).toBeVisible();
    const small = deck.getByRole('timer', { name: /5-minute presentation/ });
    await expect(small).toBeVisible();
    await expect(small).not.toHaveText('5:00');
    await deck.getByRole('button', { name: /Pause \(5-minute presentation\)/ }).click();
    const paused = await small.textContent();
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('img', { name: 'Umbrella insurance deck, page 2' })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('heading', { name: 'Client video page' })).toBeVisible();
    await expect(deck.getByRole('timer', { name: /5-minute presentation/ })).toHaveText(paused ?? '');
    await expect(deck.locator('iframe')).toHaveCount(0);
    await expect(deck.getByRole('button', { name: /Open in a new window/ })).toBeVisible();
    await deck.getByRole('button', { name: /Show the website here/ }).click();
    await expect(deck.locator(`iframe[src="${site}"]`)).toBeAttached();
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('timer', { name: /1 minute of questions/ })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(deck.getByRole('heading', { name: '5-Minute Educational Presentation' })).toBeVisible();
    await expect(deck.getByRole('timer', { name: /5-minute presentation/ })).toHaveText(paused ?? '');

    await goToSlide(deck, page, '10-Minute Presentation');
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('button', { name: 'Play video: Client story' })).toBeVisible();
    await expect(deck.getByRole('timer', { name: /10-minute presentation/ })).toHaveText('10:00');
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('timer', { name: /5 minutes of questions/ })).toBeVisible();

    await deck.getByRole('link', { name: 'Customize slides' }).click();
    await page.getByRole('button', { name: 'Reset to the standard agenda' }).click();
    await expect(page.getByText('Back to the standard agenda.')).toBeVisible();
    for (const name of ['Umbrella insurance deck', 'Client video page', 'Client story']) {
      await page.getByRole('button', { name: `Remove ${name}` }).click();
      await expect(page.getByRole('button', { name: `Remove ${name}` })).toHaveCount(0);
    }
  });

  test('timers are off by default; admins switch them on per slide and on the presenter’s added slides, for one meeting', async ({ page }) => {
    await login(page, users.admin, undefined, '/present/next');
    const deck = page.getByRole('region', { name: 'Meeting slides' });
    await deck.getByRole('link', { name: 'Customize slides' }).click();
    const five = page.getByRole('form', { name: 'Video or website for the 5-minute presentation' });
    await five.getByLabel('YouTube or website link').fill('https://example.com/demo');
    await five.getByLabel('Title (optional)').fill('Demo page');
    await five.getByRole('button', { name: 'Add link' }).click();
    await expect(page.getByText('Website added.')).toBeVisible();
    const form = page.getByRole('form', { name: 'Slides to show' });
    for (const box of await form.getByRole('checkbox', { name: /^Show timer:/ }).all()) await expect(box).not.toBeChecked();
    await form.getByLabel('Show timer: 60-second infomercial and reporting').check();
    await form.getByLabel('Show timer: 5-minute presentation slide').check();
    await form.getByLabel('Show timer: Questions for the 10-minute presentation').check();
    // The question slides are optional since 2026-10-23: switch them on to check their timers.
    await showQuestionSlides(page);
    await form.getByRole('button', { name: 'Save slides' }).click();
    await expect(page.getByText('Slides saved.')).toBeVisible();
    await expect(page.getByRole('form', { name: 'Slides to show' }).getByLabel('Show timer: 5-minute presentation slide')).toBeChecked();
    await expectAccessible(page);

    await page.getByRole('link', { name: 'Open the slides' }).click();
    await goToSlide(deck, page, '60-second infomercial and reporting');
    const timer = deck.getByRole('timer', { name: /60-second infomercial/ });
    await expect(timer).toHaveText('1:00');
    await deck.getByRole('button', { name: /Start timer \(60-second infomercial\)/ }).click();
    await expect(timer).not.toHaveText('1:00', { timeout: 3000 });
    await deck.getByRole('button', { name: /Pause/ }).click();
    await deck.getByRole('button', { name: /Reset 60-second infomercial/ }).click();
    await expect(timer).toHaveText('1:00');
    await goToSlide(deck, page, '5-Minute Educational Presentation');
    await expect(deck.getByRole('timer', { name: /5-minute presentation/ })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('heading', { name: 'Demo page' })).toBeVisible();
    await expect(deck.getByRole('timer')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('heading', { name: /^Questions/ })).toBeVisible();
    await expect(deck.getByRole('timer')).toHaveCount(0);
    await goToSlide(deck, page, '10-Minute Presentation');
    await expect(deck.getByRole('timer')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('timer', { name: /5 minutes of questions/ })).toHaveText('5:00');

    await deck.getByRole('link', { name: 'Customize slides' }).click();
    await page.getByRole('button', { name: 'Remove Demo page' }).click();
    await expect(page.getByRole('button', { name: 'Remove Demo page' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Reset to the standard agenda' }).click();
    await expect(page.getByText('Back to the standard agenda.')).toBeVisible();
    await expect(page.getByRole('form', { name: 'Slides to show' }).getByLabel('Show timer: 5-minute presentation slide')).not.toBeChecked();
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
    await upload.getByLabel('Show after').selectOption('statistics');
    await upload.getByRole('button', { name: 'Add to slides' }).click();
    await expect(upload.getByText('PDF added (2 pages).')).toBeVisible();

    const yt = page.getByRole('form', { name: 'Add a YouTube video or website' });
    await yt.getByLabel('YouTube or website link').fill('not a link');
    await yt.getByRole('button', { name: 'Add link' }).click();
    await expect(yt.getByText(/Paste a YouTube or website link/)).toBeVisible();
    await yt.getByLabel('YouTube or website link').fill('https://youtu.be/dQw4w9WgXcQ?t=30');
    await yt.getByLabel('Title (optional)').fill('Member testimonial');
    await page.getByRole('form', { name: 'Add a YouTube video or website' }).getByRole('button', { name: 'Add link' }).click();
    await expect(page.getByText('Video added.')).toBeVisible();
    const list = page.getByRole('list', { name: 'Added slides list' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(list).toContainText('PDF · 2 pages');
    await expect(page.getByText('Nothing added yet.')).toHaveCount(2);
    await expectAccessible(page);

    await page.getByRole('link', { name: 'Open the slides' }).click();
    await expect(deck.getByText(new RegExp(`^Slide 1 of ${before + 4}$`))).toBeVisible();
    await goToSlide(deck, page, 'Sponsor thank-you');
    const shownImage = deck.getByRole('img', { name: 'Sponsor thank-you' });
    await expect(shownImage).toBeVisible();
    expect(await shownImage.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await page.keyboard.press('ArrowRight');
    await expect(deck.getByRole('heading', { name: 'Visitors', exact: true })).toBeVisible();

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
    await page.getByLabel('Phone').fill('650-555-0124');
    await page.getByLabel('Business name').fill('Ivy Bookkeeping');
    await page.getByRole('button', { name: 'Send my invite request' }).click();
    await expect(page.getByText("You're on the list, Ivy!")).toBeVisible();

    await login(page, users.admin, undefined, '/admin');
    await page.getByRole('button', { name: 'Invite to apply (Ivy Applicant)' }).click();
    await expect(page.getByText('Invite sent.')).toBeVisible();
    let mail: { subject: string; htmlContent: string; textContent: string } | undefined;
    for (let i = 0; i < 40 && !mail; i++) {
      const all = (await (await fetch(`${BREVO}/emails?to=${encodeURIComponent(email)}`)).json()) as {
        subject: string;
        htmlContent: string;
        textContent: string;
      }[];
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
    await info.getByLabel(/^Password/).fill(PASSWORD);
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
