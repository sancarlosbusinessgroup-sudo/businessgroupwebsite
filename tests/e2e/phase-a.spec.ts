import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { db, expectAccessible, login, trackConsole, users } from './support';

// Phase A of docs/phase-2-spec.md.

async function download(page: Page, name: string | RegExp) {
  const wait = page.waitForEvent('download');
  await page.getByRole('link', { name }).click();
  const d = await wait;
  return { name: d.suggestedFilename(), text: await readFile((await d.path()) as string, 'utf8') };
}

test.describe('public site', () => {
  test('no "Proud supporter" credit anywhere in the footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('contentinfo')).not.toContainText('Proud supporter');
    await expect(page.getByRole('contentinfo')).not.toContainText(/San ?Carlos ?Life/i);
  });

  test('About shows the Management list from the database', async ({ page }) => {
    await page.goto('/about');
    const section = page.getByRole('region', { name: 'Management' });
    await expect(section.getByText('Avery Lindqvist')).toBeVisible();
    await expect(section.getByText('President', { exact: true })).toBeVisible();
  });

  test('visitors see businesses but no contact details or downloads in the directory', async ({ page }) => {
    await page.goto('/members');
    await expect(page.getByText('Harbor Lane Realty')).toBeVisible();
    await expect(page.getByRole('link', { name: /@example\.com$/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Download/ })).toHaveCount(0);
    await page.goto('/members/export?format=csv');
    await expect(page).toHaveURL(/\/login/);
  });

  test('public profiles no longer show per-member activity stats', async ({ page }) => {
    await page.goto('/members/harbor-lane-realty');
    await expect(page.getByRole('heading', { level: 1, name: 'Avery Lindqvist' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /activity$/ })).toHaveCount(0);
    await expect(page.getByText('Referrals given (90 days)')).toHaveCount(0);
  });

  test('Visit page lists open professions; the join form warns about a full category', async ({ page }) => {
    await page.goto('/visit');
    const open = page.getByRole('region', { name: 'Open professions' });
    await expect(open.getByText('Accounting')).toBeVisible();
    await expect(open.getByText('Real Estate', { exact: true })).toHaveCount(0);

    await page.goto('/join');
    await page.getByLabel('First name').fill('Jo');
    await page.getByLabel('Last name').fill('Test');
    await page.getByLabel('Email').fill('jo.full@example.test');
    await page.getByLabel(/^Password/).fill('local-test-password-1');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Category').selectOption({ label: 'Real Estate (full)' });
    await expect(page.getByText(/Real Estate already has a member/)).toBeVisible();
  });
});

test.describe('members', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, users.member);
  });

  test('dashboard: leaderboard, group totals, invite card; no personal stat tiles', async ({ page }) => {
    const errors = trackConsole(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
    const board = page.getByRole('region', { name: 'Leaderboard' });
    for (const m of ['One-on-ones', 'Referrals', 'Closed deals', 'Visitors brought']) {
      await expect(board.getByRole('heading', { name: m })).toBeVisible();
    }
    await board.getByRole('link', { name: 'All time' }).click();
    await expect(page).toHaveURL(/lb=all/);
    await expect(board.getByRole('listitem').first()).toBeVisible();
    await expect(page.getByRole('region', { name: /Group this/ })).toContainText('Closed deals');
    await expect(page.getByRole('region', { name: 'Invite a visitor' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /My numbers/ })).toHaveCount(0);
    await expect(page.getByText('$')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('weekly ask: set it on the dashboard, it shows in the directory', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByLabel("This week I'm looking for…").fill('An intro to a café owner in Belmont');
    await page.getByRole('button', { name: 'Save my ask' }).click();
    await expect(page.getByText('Your ask is saved.')).toBeVisible();
    await page.goto('/members?q=Test+Member+Studio');
    await expect(page.getByText('An intro to a café owner in Belmont')).toBeVisible();
  });

  test('directory cards show contacts; members download CSV and vCard, and downloads are logged', async ({ page }) => {
    const before = (await db('directory_downloads?select=id')).length;
    await page.goto('/members');
    await expect(page.getByRole('link', { name: 'avery.lindqvist@example.com' })).toBeVisible();
    await expect(page.getByRole('link', { name: '(650) 555-0101' })).toBeVisible();

    const csv = await download(page, 'Download spreadsheet (CSV)');
    expect(csv.name).toMatch(/\.csv$/);
    expect(csv.text).toContain('First name,Last name,Business,Category,Email,Phone,Website,City');
    expect(csv.text).toContain('Harbor Lane Realty');
    expect(csv.text).toContain('avery.lindqvist@example.com');

    const vcf = await download(page, 'Download contacts (vCard)');
    expect(vcf.name).toMatch(/\.vcf$/);
    expect(vcf.text).toContain('BEGIN:VCARD');
    expect(vcf.text).toContain('ORG:Harbor Lane Realty');

    expect((await db('directory_downloads?select=id')).length).toBe(before + 2);
  });

  test('one-on-one form has no star rating', async ({ page }) => {
    await page.goto('/one-on-ones');
    await expect(page.getByRole('radio', { name: /stars?$/ })).toHaveCount(0);
    await expect(page.getByText('How was the one-on-one?')).toHaveCount(0);
  });

  test('members cannot open admin stats or the CSV export', async ({ page }) => {
    await page.goto('/admin/stats');
    await expect(page).toHaveURL(/\/dashboard/);
    const res = await page.request.get('/admin/stats/export', { maxRedirects: 0 });
    expect(res.status()).not.toBe(200);
  });
});

test.describe('admins', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, users.admin, undefined, '/admin');
  });

  test('admin pages render without console errors and pass axe @responsive', async ({ page }) => {
    const errors = trackConsole(page);
    for (const [path, heading] of [
      ['/admin', 'Admin'],
      ['/admin/stats', 'Member stats'],
      ['/admin/leadership', 'Management'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expectAccessible(page);
    }
    expect(errors).toEqual([]);
  });

  test('stats page: period, sorting and CSV export', async ({ page }) => {
    await page.goto('/admin/stats');
    await page.getByLabel('Period', { exact: true }).selectOption('all');
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(page).toHaveURL(/period=all/);
    const table = page.getByRole('table', { name: /Member stats/ });
    await expect(table.getByRole('row', { name: /Avery Lindqvist/ })).toBeVisible();

    await table.getByRole('link', { name: /Referrals given/ }).click();
    await expect(page).toHaveURL(/sort=referrals_given/);
    await expect(table.getByRole('columnheader', { name: /Referrals given/ })).toHaveAttribute('aria-sort', 'descending');

    await page.getByLabel('Period', { exact: true }).selectOption('custom');
    await page.getByLabel('From').fill('2026-01-01');
    await page.getByLabel('To').fill('2026-12-31');
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(page).toHaveURL(/from=2026-01-01/);

    const csv = await download(page, 'Download CSV');
    expect(csv.name).toMatch(/^member-stats-.*\.csv$/);
    expect(csv.text).toContain(
      'First name,Last name,Business,One-on-ones,Referrals given,Referrals received,Closed deals,Closed deals received,Visitors brought',
    );
    expect(csv.text).toContain('Lindqvist');
  });

  test('Management: add a person, see them on About, then remove them', async ({ page }) => {
    await page.goto('/admin/leadership');
    const add = page.getByRole('form', { name: 'Add a person' });
    await add.getByRole('button', { name: 'Add person' }).click();
    await expect(add.getByText('Name is required')).toBeVisible();
    await add.getByLabel('Name').fill('Quinn Treasurer');
    await add.getByLabel('Role').fill('Treasurer');
    await add.getByLabel('Sort order').fill('5');
    await add.getByRole('button', { name: 'Add person' }).click();
    await expect(add.getByText('Added.')).toBeVisible();

    await page.goto('/about');
    await expect(page.getByRole('region', { name: 'Management' }).getByText('Quinn Treasurer')).toBeVisible();

    await page.goto('/admin/leadership');
    const row = page.getByRole('form', { name: 'Edit Quinn Treasurer' });
    await row.getByLabel('Role').fill('Secretary/Treasurer');
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(row.getByText('Saved')).toBeVisible();
    await page.getByRole('button', { name: 'Remove Quinn Treasurer' }).click();
    await expect(page.getByRole('form', { name: 'Edit Quinn Treasurer' })).toHaveCount(0);
  });

  test('category seats: raising a limit opens the profession on the Visit page', async ({ page }) => {
    await page.goto('/admin');
    const form = page.getByRole('form', { name: 'Seats for Real Estate' });
    await form.getByLabel('Seats').fill('2');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByText('Saved')).toBeVisible();
    await page.goto('/visit');
    await expect(page.getByRole('region', { name: 'Open professions' }).getByText('Real Estate', { exact: true })).toBeVisible();

    await page.goto('/admin');
    await form.getByLabel('Seats').fill('1');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByText('Saved')).toBeVisible();
  });

  test('admin sees the directory download log', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Directory downloads' })).toBeVisible();
  });
});
