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

test('companies page loads packages in batches of 500 so every row gets its package', async ({
  adminPage: page,
  mockApi,
}) => {
  const template = mockApi.companies[0];
  for (let id = 1000; id < 1600; id += 1) {
    mockApi.companies.push({ ...template, id, company: `Bulk Co ${id}` });
  }
  mockApi.setOverride('AdminCompanyPackages', (payload) => ({
    data: {
      adminCompanyPackages: (payload.variables?.companyIds as number[]).map((companyId) => ({
        companyId,
        companyName: `Company ${companyId}`,
        planId: 'premium',
        activeModules: [],
        unrestricted: false,
        liveSubscription: {
          id: String(companyId), planId: 'premium', planName: `Package ${companyId}`, planVersion: 1,
          currentPlanVersion: 1, isOutdated: false, status: 'active', billingInterval: 'monthly',
          moduleCodes: [], priceCents: 1200, currency: 'USD', currentPeriodEnd: null, createdBy: null,
          createdAt: null, __typename: 'AdminCompanySubscription',
        },
        __typename: 'AdminCompanyPackage',
      })),
    },
  }));

  await page.getByRole('button', { name: 'Companies' }).click();
  // 600 rows take a while to render
  await expect(page.getByText('Package 1599', { exact: true })).toBeVisible({ timeout: 20_000 });
  const batches = (mockApi.requests.get('AdminCompanyPackages') || []).map((v) => (v.companyIds as number[]).length);
  expect(Math.max(...batches)).toBeLessThanOrEqual(500);
});
