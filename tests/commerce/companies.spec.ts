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
  await expect(page.getByText('Manual subscription action')).toBeVisible();
  await expect(page.getByPlaceholder('Payment method')).toBeVisible();
  await expect(page.getByRole('button', { name: /Trigger Manual/i })).toBeVisible();
});

test('companies page shows plan billing context and assigns plan', async ({
  adminPage: page,
  mockApi,
}) => {
  await page.getByRole('button', { name: 'Companies' }).click();
  await expect(page.getByText('Premium').first()).toBeVisible();
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

test('companies page shows each package and changes it with a module diff', async ({
  adminPage: page,
  mockApi,
}) => {
  await page.getByRole('button', { name: 'Companies' }).click();
  await expect(page.getByRole('columnheader', { name: 'Package' })).toBeVisible();
  const cell = page.getByTestId('package-cell-12');
  await expect(cell).toContainText('Premium');
  await expect(cell).toContainText('v1');
  await expect(page.getByTestId('package-update-12')).toBeVisible();
  await expect.poll(() => mockApi.lastVariables('AdminCompanyPackages')?.companyIds).toEqual([12]);

  await page.getByTestId('change-package-12').click();
  const dialog = page.getByTestId('change-package-dialog');
  await dialog.getByTestId('change-package-plan').selectOption('premium_yearly');
  await expect(dialog.getByTestId('change-package-interval')).toHaveValue('yearly');
  await expect(dialog.getByTestId('change-package-diff')).toContainText('+ Invoicing & Statement of Accounts');
  await expect(dialog.getByTestId('change-package-losses')).toContainText('Core HR & Employee Management');
  await dialog.getByTestId('change-package-reason').fill('Customer upgraded');
  await dialog.getByTestId('change-package-submit').click();

  await expect.poll(() => mockApi.lastVariables('AdminAssignCompanyPlan')).toMatchObject({
    companyId: 12,
    planId: 'premium_yearly',
    billingInterval: 'yearly',
    reason: 'Customer upgraded',
  });
});

test('changing the package of a pre-package company warns about what it loses', async ({
  adminPage: page,
  mockApi,
}) => {
  mockApi.companyPackages.set(12, {
    companyId: 12, planId: 'premium', planName: 'Premium', billingInterval: 'monthly', planVersion: 0,
    latestVersion: 2, updateAvailable: true, activeModules: [], unrestricted: true, access: 'legacy',
    __typename: 'AdminCompanyPackage',
  });
  await page.getByRole('button', { name: 'Companies' }).click();
  await expect(page.getByTestId('package-cell-12')).toContainText('All modules (legacy)');
  await page.getByTestId('change-package-12').click();
  const dialog = page.getByTestId('change-package-dialog');
  await dialog.getByTestId('change-package-plan').selectOption('free');
  await expect(dialog.getByTestId('change-package-legacy-warning')).toBeVisible();
  // Everything outside the Free package is listed as lost (not only gains).
  await expect(dialog.getByTestId('change-package-losses')).toContainText('Project Management');
  await expect(dialog.getByTestId('change-package-losses')).toContainText('AI Workforce Intelligence');
});
