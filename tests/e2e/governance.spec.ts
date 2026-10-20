import { expect, test } from '@playwright/test';
import { expectAccessible, trackConsole } from './support';

// Bylaws & Procedures page (from the group's documents, effective October 19, 2026).

test.describe('bylaws and procedures', () => {
  test('public page renders both documents, passes axe @responsive', async ({ page }) => {
    const errors = trackConsole(page);
    await page.goto('/bylaws');
    await expect(page.getByRole('heading', { level: 1, name: 'Bylaws & Procedures' })).toBeVisible();
    await expect(page.getByText('Effective October 19, 2026').first()).toBeVisible();
    for (const h of ['Bylaws', 'Procedures', 'Member acceptance criteria', 'Member release criteria', 'Meeting agenda', 'Member expectations', 'Definitions']) {
      await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
    }
    await expect(page.getByText('Members are only allowed to miss 2 meetings in a 6-month period.').first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Meeting called to order' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '1 minute of questions for the 5-minute presentation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '15-Minute Presentation' })).toBeVisible();
    await expect(page.getByText(/Examples of announcements: industry awards/)).toBeVisible();
    await expect(page.getByText(/not be allowed to do their 60-second speaking opportunity/)).toBeVisible();
    // Leadership comes from the Management list (database)
    const leaders = page.getByRole('region', { name: 'Leadership & responsibilities' });
    await expect(leaders.getByText('Avery Lindqvist')).toBeVisible();
    await expect(leaders.getByText('President', { exact: true })).toBeVisible();
    await expectAccessible(page);
    expect(errors).toEqual([]);
  });

  test('linked from the footer and from the application form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Bylaws & procedures' }).click();
    await expect(page).toHaveURL(/\/bylaws$/);
    await page.goto('/join');
    await expect(page.getByRole('link', { name: /Bylaws and Procedures/ }).first()).toHaveAttribute('href', '/bylaws');
  });

  test('the Visit page shows the official meeting agenda', async ({ page }) => {
    await page.goto('/visit');
    await expect(page.getByText(/60-second infomercials/).first()).toBeVisible();
    await expect(page.getByText('Meeting called to order').first()).toBeVisible();
  });
});
