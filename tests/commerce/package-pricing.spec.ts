import { test, expect } from '../fixtures/graphql.fixture';

type PackagingOverrides = Record<string, unknown>;

const packaging = (overrides: PackagingOverrides) => ({
  data: {
    adminPlans: [
      {
        id: 'premium',
        pricingMode: 'fixed',
        bundleDiscountPct: 0,
        yearlyPriceCents: null,
        yearlyDiscountPct: 0,
        isPublic: true,
        version: 1,
        availableIntervals: ['monthly'],
        companiesCount: 0,
        subscribersCount: 0,
        outdatedSubscribersCount: 0,
        modules: [
          { moduleId: 'hr', name: 'HR', category: null, priceOverrideCents: null, unitCents: 0, __typename: 'AdminPlanModule' },
        ],
        pricing: null,
        __typename: 'AdminPlan',
        ...overrides,
      },
    ],
  },
});

const moduleCatalog = {
  data: {
    adminModules: [
      {
        id: 'hr', name: 'HR', description: null, active: true, sortOrder: 1, category: null,
        isCore: false, icon: null, dependsOn: [], parentId: null, __typename: 'AdminModule',
      },
    ],
  },
};

test('a legacy yearly-only package round-trips unchanged when saved without edits', async ({ adminPage: page, mockApi }) => {
  const premium = mockApi.plans.find((plan: { id: string }) => plan.id === 'premium')!;
  Object.assign(premium, { billingInterval: 'yearly', basePriceCents: 120000 });
  mockApi.setOverride('AdminPackageModules', moduleCatalog);
  mockApi.setOverride(
    'AdminPlansPackaging',
    packaging({
      availableIntervals: ['yearly'],
      pricing: { currency: 'USD', monthlyPriceCents: null, yearlyPriceCents: 120000, savingsPct: 0, __typename: 'PackagePriceBreakdown' },
    }),
  );

  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByText('$1,200', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();

  await expect(page.getByLabel('Billing interval')).toHaveValue('yearly');
  await expect(page.getByLabel('Package price ($ / year)')).toHaveValue('1200');
  await expect(page.getByTestId('preview-yearly')).toContainText('$1,200.00 / year');
  await expect(page.getByTestId('preview-monthly')).toHaveCount(0);

  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.id).toBe('premium');
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    basePriceCents: 120000,
    billingInterval: 'yearly',
    yearlyPriceCents: null,
  });
});

test('a "both" package priced by yearly discount keeps its yearly option when saved', async ({ adminPage: page, mockApi }) => {
  const premium = mockApi.plans.find((plan: { id: string }) => plan.id === 'premium')!;
  Object.assign(premium, { billingInterval: 'both', basePriceCents: 1000 });
  mockApi.setOverride('AdminPackageModules', moduleCatalog);
  mockApi.setOverride(
    'AdminPlansPackaging',
    packaging({
      yearlyDiscountPct: 20,
      availableIntervals: ['monthly', 'yearly'],
      pricing: { currency: 'USD', monthlyPriceCents: 1000, yearlyPriceCents: 9600, savingsPct: 20, __typename: 'PackagePriceBreakdown' },
    }),
  );

  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();

  await expect(page.getByLabel('Billing interval')).toHaveValue('both');
  await expect(page.getByTestId('preview-yearly')).toContainText('$96.00 / year');

  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.id).toBe('premium');
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    basePriceCents: 1000,
    billingInterval: 'both',
    yearlyPriceCents: null,
    yearlyDiscountPct: 20,
  });
});

test('choosing Monthly only clears the yearly offer and discount', async ({ adminPage: page, mockApi }) => {
  mockApi.setOverride('AdminPackageModules', moduleCatalog);
  mockApi.setOverride(
    'AdminPlansPackaging',
    packaging({
      yearlyPriceCents: 12000,
      yearlyDiscountPct: 10,
      availableIntervals: ['monthly', 'yearly'],
      pricing: { currency: 'USD', monthlyPriceCents: 1200, yearlyPriceCents: 12000, savingsPct: 17, __typename: 'PackagePriceBreakdown' },
    }),
  );

  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();
  await expect(page.getByLabel('Billing interval')).toHaveValue('both');
  await expect(page.getByTestId('yearly-price')).toHaveValue('120');

  await page.getByLabel('Billing interval').selectOption('monthly');
  await expect(page.getByTestId('preview-yearly')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.id).toBe('premium');
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    basePriceCents: 1200,
    billingInterval: 'monthly',
    yearlyPriceCents: null,
    yearlyDiscountPct: 0,
  });
});
