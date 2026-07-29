import { test, expect } from '../fixtures/graphql.fixture';

test('company filters, detail edit, and payment history popups', async ({
  adminPage: page,
}) => {
  await page.getByRole('button', { name: 'Companies' }).click();
  await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Gateway' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Modules' })).toHaveCount(0);

  const acmeRow = page.getByRole('row').filter({ hasText: 'Acme Labs' }).first();
  await expect(acmeRow.getByText('active', { exact: true })).toBeVisible();
  await expect(page.getByText('john@acme.com')).toBeVisible();
  await expect(page.getByText('card')).toBeVisible();

  const search = page.getByPlaceholder('Search companies, email, payment...');
  await search.fill('john@acme.com');
  await expect(page.getByText('Acme Labs')).toBeVisible();
  await search.fill('no matching tenant');
  await expect(page.getByText('No companies match your filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(search).toHaveValue('');

  await page.locator('[title="Edit Company"]').click();
  await expect(page.getByRole('heading', { name: 'Edit Company' })).toBeVisible();
  await expect(page.getByText('Subscription Plan')).toBeVisible();
  await expect(page.getByText('Legacy Entitlements', { exact: true })).toHaveCount(0);
  await page.getByLabel('Subscription Status').selectOption('trial');
  await expect(page.getByLabel('Subscription Plan')).toHaveValue('premium');
  await expect(
    page.getByText('Trial status uses the Premium plan and requires billing dates.'),
  ).toBeVisible();
  await page.getByLabel('Subscription Status').selectOption('active');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.locator('[title="View Company"]').click();
  await expect(page.getByRole('heading', { name: 'Company 360' })).toBeVisible();
  await page.getByRole('button', { name: 'Detail' }).click();
  await expect(page.getByText('Payment Detail')).toBeVisible();
  await expect(page.getByPlaceholder('Refund reason')).toBeVisible();
  await expect(page.getByRole('button', { name: /Apply refund/i })).toBeVisible();
  await expect(page.getByText('Manual subscription trigger')).toBeVisible();
  await expect(page.getByPlaceholder('Payment method')).toBeVisible();
  await expect(page.getByRole('button', { name: /Trigger Manual/i })).toBeVisible();
});

test('companies page shows plan billing context and assigns plan', async ({
  adminPage: page,
  mockApi,
}) => {
  await page.getByRole('button', { name: 'Companies' }).click();
  await expect(page.getByText('Premium')).toBeVisible();
  await expect(page.getByText('42 employees')).toBeVisible();

  await page.locator('[title="Edit Company"]').click();
  await page.getByLabel('Subscription Plan').selectOption('free');
  await expect(page.getByLabel('Subscription Status')).toHaveValue('active');
  await expect(page.getByLabel('Reason for change')).toHaveCount(0);
  await page.getByRole('button', { name: /Save changes/ }).click();

  await expect
    .poll(() => mockApi.lastVariables('AdminAssignCompanyPlan')?.planId)
    .toBe('free');
  expect(mockApi.lastVariables('AdminAssignCompanyPlan')?.companyId).toBe(12);
});
