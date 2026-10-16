import { test, expect } from '../fixtures/graphql.fixture';
import type { MockGraphQLApi } from '../fixtures/graphql.fixture';

const moduleCatalog = [
  { id: 'employee_management', name: 'Core HR', parentId: null },
  { id: 'hr_shifts', name: 'Shifts', parentId: 'employee_management' },
  { id: 'project_management', name: 'Project Management', parentId: null },
  { id: 'pj_projects', name: 'Projects', parentId: 'project_management' },
  { id: 'workforce_ai', name: 'AI Workforce', parentId: null },
  { id: 'accounting_reconciliation', name: 'Accounting', parentId: null },
  { id: 'time_attendance', name: 'Time & Attendance', parentId: null },
].map((m, i) => ({
  ...m,
  description: '',
  active: true,
  sortOrder: i,
  category: 'core',
  isCore: false,
  icon: '',
  dependsOn: [],
  __typename: 'AdminModule',
}));

function mockPackages(api: MockGraphQLApi) {
  api.setOverride('AdminPackageModules', { data: { adminModules: moduleCatalog } });
  api.setOverride('AdminCompanyPackages', {
    data: {
      adminCompanyPackages: [
        {
          companyId: 12,
          companyName: 'Acme Labs',
          planId: 'growth-ai',
          activeModules: ['employee_management', 'hr_shifts', 'project_management', 'pj_projects', 'workforce_ai', 'time_attendance'],
          unrestricted: false,
          liveSubscription: {
            id: '1',
            planId: 'growth-ai',
            planName: 'Growth + AI',
            planVersion: 1,
            currentPlanVersion: 2,
            isOutdated: true,
            status: 'active',
            billingInterval: 'yearly',
            moduleCodes: [],
            priceCents: 24480,
            currency: 'USD',
            currentPeriodEnd: null,
            createdBy: 'admin',
            createdAt: null,
            __typename: 'AdminCompanySubscription',
          },
          __typename: 'AdminCompanyPackage',
        },
      ],
    },
  });
  api.setOverride('AdminPackageOptions', {
    data: {
      adminPlans: [
        {
          id: 'growth-ai',
          name: 'Growth + AI',
          active: true,
          version: 2,
          availableIntervals: ['monthly', 'yearly'],
          modules: [{ moduleId: 'employee_management', name: 'Core HR', __typename: 'AdminPlanModule' }],
          pricing: { currency: 'USD', monthlyPriceCents: 2550, yearlyPriceCents: 24480, __typename: 'PackagePriceBreakdown' },
          __typename: 'AdminPlan',
        },
        {
          id: 'finance',
          name: 'Finance',
          active: true,
          version: 1,
          availableIntervals: ['monthly'],
          modules: [
            { moduleId: 'employee_management', name: 'Core HR', __typename: 'AdminPlanModule' },
            { moduleId: 'accounting_reconciliation', name: 'Accounting', __typename: 'AdminPlanModule' },
          ],
          pricing: { currency: 'USD', monthlyPriceCents: 4000, yearlyPriceCents: null, __typename: 'PackagePriceBreakdown' },
          __typename: 'AdminPlan',
        },
      ],
    },
  });
}

test('subscriptions page shows plan snapshots, the live package and its modules', async ({
  adminPage: page,
  mockApi,
}) => {
  mockPackages(mockApi);
  await page.getByRole('button', { name: 'Subscriptions' }).click();
  await expect(page.getByRole('heading', { name: 'Subscriptions & Payments' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /^Plan\b/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Package' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Modules' })).toBeVisible();
  await expect(page.getByText('42 employees')).toBeVisible();
  await expect(page.getByText('Original $504.00')).toBeVisible();

  // Package column: live package, interval, version and an outdated badge.
  await expect(page.getByRole('cell', { name: /Growth \+ AI/ })).toBeVisible();
  await expect(page.getByText('update available')).toBeVisible();

  // Modules column: children collapse into their feature area; overflow shows "+N more".
  await expect(page.getByText('Core HR', { exact: true })).toBeVisible();
  await expect(page.getByText('Project Management', { exact: true })).toBeVisible();
  await expect(page.getByText('Shifts', { exact: true })).toHaveCount(0);
  await expect(page.getByText('+1 more')).toBeVisible();

  expect(mockApi.lastVariables('AdminCompanyPackages')).toEqual({ companyIds: [12] });
});

test('change package sends the package, interval and reason', async ({ adminPage: page, mockApi }) => {
  mockPackages(mockApi);
  await page.getByRole('button', { name: 'Subscriptions' }).click();
  await page.getByRole('button', { name: 'Change package' }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Change package' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('New package').selectOption('finance');
  // Finance is monthly only, so the interval falls back to monthly.
  await expect(dialog.getByText('$40.00 / mo')).toBeVisible();
  await expect(dialog.getByTestId('package-module-diff')).toContainText('Gains: Accounting');
  await expect(dialog.getByTestId('package-module-diff')).toContainText('Loses access to: Project Management, AI Workforce, Time & Attendance');

  await dialog.getByRole('button', { name: 'Change package' }).click();
  await expect(page.getByText('Reason is required to change the package')).toBeVisible();
  await dialog.getByLabel('Reason').fill('Customer asked for finance');
  await dialog.getByRole('button', { name: 'Change package' }).click();

  await expect
    .poll(() => mockApi.lastVariables('AdminAssignCompanyPlan'))
    .toEqual({ companyId: 12, planId: 'finance', reason: 'Customer asked for finance', billingInterval: 'monthly' });
  await expect(dialog).toHaveCount(0);
});
