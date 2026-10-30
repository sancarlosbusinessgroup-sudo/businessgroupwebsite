import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';

// E2E runs against `next start` + the local Supabase-compatible stack (npm run stack:start).
// Set E2E_BASE_URL to run the smoke suite against a deployed site instead.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
// Some cloud sessions ship Chromium under /opt/pw-browsers (any build); use it instead of downloading one.
const preinstalled = (() => {
  const root = '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const dir of readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .reverse())
    for (const exe of [`${root}/${dir}/chrome-linux/chrome`, `${root}/${dir}/chrome-linux64/chrome`]) if (existsSync(exe)) return exe;
  return undefined;
})();
const launchOptions = preinstalled ? { executablePath: preinstalled } : {};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  globalSetup: process.env.E2E_BASE_URL ? undefined : './tests/e2e/global-setup.ts',
  use: { baseURL, trace: 'retain-on-failure', launchOptions },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 800 }, isMobile: false }, grep: /@responsive/ },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } }, grep: /@responsive/ },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npm run start', url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
