import { expect, test } from '@playwright/test';
import { PASSWORD, codeIn, db, expectAccessible, lastMail, linkIn, login, users } from './support';

test.describe('sign up → admin approval → member access', () => {
  test('join form validates each step, creates a pending account, confirms email and gates member pages', async ({ page }) => {
    const email = `applicant.${Date.now()}@example.test`;
    await page.goto('/join?ref=AVER-001');
    await expect(page.getByText('Invited by Avery Lindqvist')).toBeVisible();
    await expectAccessible(page);

    // Step 1 validation
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('First name is required')).toBeVisible();
    await page.getByLabel('First name').fill('Jamie');
    await page.getByLabel('Last name').fill('Applicant');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Use at least 8 characters')).toBeVisible();
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2
    await expect(page.getByRole('heading', { name: 'Your business profile' })).toBeFocused();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Business name is required')).toBeVisible();
    await page.getByLabel('Business name').fill('Jamie Applicant Design');
    await page.getByLabel('Category').selectOption({ label: 'Marketing' });
    await page.getByLabel('Website').fill('ftp://bad');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Website must start with http:// or https://')).toBeVisible();
    await page.getByLabel('Website').fill('https://jamie.example.org');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3
    await expect(page.getByLabel('Referral code')).toHaveValue('AVER-001');
    await page.getByLabel('Meetings attended as a guest').selectOption('2');
    await page.getByRole('button', { name: 'Submit application' }).click();
    await expect(page.getByText('Please agree to attend meetings regularly')).toBeVisible();
    for (const label of [/Attend meetings regularly/, /Schedule three one-on-ones/, /Report referrals/]) await page.getByLabel(label).check();
    const before = Date.now();
    await page.getByRole('button', { name: 'Submit application' }).click();
    await expect(page.getByRole('heading', { name: 'Application received' })).toBeVisible();

    // Data written by the sign-up trigger
    const [profile] = await db<{ status: string; referred_by: string; business_name: string }>(
      `profiles?business_name=eq.${encodeURIComponent('Jamie Applicant Design')}&select=status,referred_by,business_name`,
    );
    expect(profile).toMatchObject({ status: 'pending', referred_by: '00000000-0000-4000-8000-000000000001' });

    // Confirm email via the link
    const mail = await lastMail(email, before);
    await page.goto(linkIn(mail));
    await expect(page).toHaveURL(/\/pending/);
    await expect(page.getByRole('heading', { name: 'Application received' })).toBeVisible();

    // Pending users cannot reach member pages
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/pending/);

    // Admin approves
    await page.getByRole('button', { name: 'Log out' }).click();
    await login(page, users.admin, PASSWORD, '/admin');
    await expect(page.getByRole('heading', { name: /Pending applications/ })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Approve Jamie Applicant' }).click();
    await expect(page.getByRole('button', { name: 'Approve Jamie Applicant' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Log out' }).click();

    // Now a member
    await login(page, email);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /, Jamie$/ })).toBeVisible();
  });

  test('the same email cannot sign up twice', async ({ page }) => {
    await page.goto('/join');
    await page.getByLabel('First name').fill('Dup');
    await page.getByLabel('Last name').fill('Licate');
    await page.getByLabel('Email').fill(users.member);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Business name').fill('Dup Co');
    await page.getByLabel('Category').selectOption({ label: 'Other' });
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Meetings attended as a guest').selectOption('0');
    for (const label of [/Attend meetings regularly/, /Schedule three one-on-ones/, /Report referrals/]) await page.getByLabel(label).check();
    await page.getByRole('button', { name: 'Submit application' }).click();
    await expect(page.getByText(/already exists/).first()).toBeVisible();
  });
});

test.describe('login, logout, codes and password reset', () => {
  test('wrong password shows an error; right password signs in; log out signs out', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').first().fill(users.member);
    await page
      .getByRole('tabpanel', { name: 'Password' })
      .getByLabel(/^Password/)
      .fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('That email and password don’t match our records.')).toBeVisible();
    await page
      .getByRole('tabpanel', { name: 'Password' })
      .getByLabel(/^Password/)
      .fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL('/');
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login form validates input', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('email code login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Email me a code' }).click();
    await page.getByRole('button', { name: 'Send my code' }).click();
    await expect(page.getByText('Email is required')).toBeVisible();
    const before = Date.now();
    await page.getByLabel('Email').last().fill(users.member2);
    await page.getByRole('button', { name: 'Send my code' }).click();
    await expect(page.getByText(/we emailed a 6-digit code/)).toBeVisible();
    await page.getByLabel('6-digit code').fill('000000');
    await page.getByRole('button', { name: 'Log in' }).last().click();
    await expect(page.getByText('That code is wrong or has expired')).toBeVisible();
    const code = codeIn(await lastMail(users.member2, before));
    await page.getByLabel('6-digit code').fill(code);
    await page.getByRole('button', { name: 'Log in' }).last().click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('password reset via emailed link', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Email is required')).toBeVisible();
    const before = Date.now();
    await page.getByLabel('Email').fill(users.pending);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText(/a reset link is on its way/)).toBeVisible();
    await page.goto(linkIn(await lastMail(users.pending, before)));
    await expect(page).toHaveURL(/\/reset-password/);
    await page.getByLabel(/^New password/).fill('new-password-123');
    await page.getByLabel('Confirm new password').fill('different-123');
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page.getByText('Passwords do not match')).toBeVisible();
    await page.getByLabel('Confirm new password').fill('new-password-123');
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page).toHaveURL(/\/pending/);
    await page.getByRole('button', { name: 'Log out' }).click();
    await login(page, users.pending, 'new-password-123', '/pending');
    await expect(page).toHaveURL(/\/pending/);
  });

  test('expired or reused email links land on login with a message', async ({ page }) => {
    await page.goto('/auth/callback?code=bogus&next=/dashboard');
    await expect(page).toHaveURL(/\/login\?error=link/);
    await expect(page.getByText(/That link has expired/)).toBeVisible();
  });
});
