import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  requireRealBackendCredentials,
} from '../fixtures/auth.fixture';

test('real backend supports read-only supreme-admin login, queries, and navigation', async ({
  page,
}) => {
  const credentials = requireRealBackendCredentials();
  await loginAsAdmin(page, credentials);

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Gross Revenue')).toBeVisible();

  const destinations = [
    ['Plans', 'Plans & Pricing'],
    ['Companies', 'Companies'],
    ['Subscriptions', 'Subscriptions & Payments'],
    ['Users', 'Users'],
    ['Accounts', 'Accounts'],
  ] as const;

  for (const [label, heading] of destinations) {
    await page.getByRole('button', { name: label }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Expenses' }).click();
  await expect(page.getByRole('button', { name: 'New Expense' })).toBeVisible();
});
