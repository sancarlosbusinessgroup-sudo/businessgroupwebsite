import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// Local test stack only (scripts/local-stack). These values never point at the real project.
export const STACK = 'http://127.0.0.1:54321';
export const MAIL = 'http://127.0.0.1:54326';
export const PASSWORD = 'local-test-password-1';

export const users = {
  admin: 'e2e.admin@example.test',
  member: 'e2e.member@example.test',
  member2: 'e2e.member2@example.test',
  pending: 'e2e.pending@example.test',
} as const;

// Same local-only secret as scripts/local-stack/keys.mjs.
const LOCAL_JWT_SECRET = 'local-only-jwt-secret-for-tests-0123456789abcdef';

export async function serviceKey(): Promise<string> {
  const { createHmac } = await import('node:crypto');
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ iss: 'local', role: 'service_role', exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac('sha256', LOCAL_JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

/** Query the local database through PostgREST as service role (bypasses RLS: test assertions only). */
export async function db<T = Record<string, unknown>>(path: string): Promise<T[]> {
  const key = await serviceKey();
  const res = await fetch(`${STACK}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`db ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

type Mail = { to: string[]; subject: string; body: string; at: number };

export async function lastMail(to: string, since = 0, timeoutMs = 10_000): Promise<Mail> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const res = await fetch(`${MAIL}/messages?to=${encodeURIComponent(to)}`);
    const list = (await res.json()) as Mail[];
    const hit = list.filter((m) => m.at >= since).at(-1);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email for ${to}`);
}

export function linkIn(mail: Mail): string {
  const m = mail.body.match(/href="([^"]+)"/);
  if (!m?.[1]) throw new Error('no link in email');
  return m[1].replace(/&amp;/g, '&');
}

export async function login(page: Page, email: string, password = PASSWORD, next = '/dashboard') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').first().fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id}: ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
  );
  expect(summary).toEqual([]);
}

/** Collects console errors so tests can assert the page logged none. */
export function trackConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
