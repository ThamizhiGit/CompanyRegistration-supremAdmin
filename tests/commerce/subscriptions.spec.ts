import { test, expect } from '../fixtures/graphql.fixture';

test('subscriptions page shows plan snapshots without module columns', async ({
  adminPage: page,
}) => {
  await page.getByRole('button', { name: 'Subscriptions' }).click();
  await expect(page.getByRole('heading', { name: 'Subscriptions & Payments' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Plan' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Modules' })).toHaveCount(0);
  await expect(page.getByText('Premium').first()).toBeVisible();
  await expect(page.getByText('42 employees')).toBeVisible();
  await expect(page.getByText('Original $504.00')).toBeVisible();
  await expect(page.getByText('trialing')).toBeVisible();
});

test('subscriptions page shows the current package and opens change package', async ({
  adminPage: page,
}) => {
  await page.getByRole('button', { name: 'Subscriptions' }).click();
  await expect(page.getByRole('columnheader', { name: 'Package' })).toBeVisible();
  await expect(page.getByTestId('package-cell-12').first()).toContainText('update available');
  await page.getByRole('button', { name: 'Change package' }).first().click();
  await expect(page.getByTestId('change-package-dialog')).toBeVisible();
});
