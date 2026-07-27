import { expect, type Page } from '@playwright/test';
import { futureIso } from './data-factories';

export const ADMIN_SESSION_KEYS = {
  token: 'token',
  username: 'adminUsername',
  expiresAt: 'adminExpiresAt',
} as const;

export async function clearAdminSession(page: Page) {
  await page.addInitScript((keys) => {
    window.sessionStorage.removeItem(keys.token);
    window.sessionStorage.removeItem(keys.username);
    window.sessionStorage.removeItem(keys.expiresAt);
  }, ADMIN_SESSION_KEYS);
}

export async function seedAdminSession(
  page: Page,
  options: { token?: string; username?: string; expiresAt?: string } = {},
) {
  const session = {
    token: options.token ?? 'mock-admin-token',
    username: options.username ?? 'admin',
    expiresAt: options.expiresAt ?? futureIso(60),
  };

  await page.addInitScript(({ keys, values }) => {
    window.sessionStorage.setItem(keys.token, values.token);
    window.sessionStorage.setItem(keys.username, values.username);
    window.sessionStorage.setItem(keys.expiresAt, values.expiresAt);
  }, { keys: ADMIN_SESSION_KEYS, values: session });
}

export async function loginAsAdmin(
  page: Page,
  credentials: { username?: string; password?: string } = {},
) {
  await page.goto('/');
  await page.getByPlaceholder('Enter your username').fill(credentials.username ?? 'admin');
  await page.getByPlaceholder('Enter your password').fill(credentials.password ?? 'pass');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
}

export function requireRealBackendCredentials() {
  const username = process.env.SUPREME_E2E_USERNAME;
  const password = process.env.SUPREME_E2E_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Real-backend Playwright tests require SUPREME_E2E_USERNAME and SUPREME_E2E_PASSWORD.',
    );
  }

  return { username, password };
}
