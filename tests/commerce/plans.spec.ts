import { test, expect } from '../fixtures/graphql.fixture';

test('admin navigation and plans popup flows', async ({ adminPage: page }) => {
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByRole('heading', { name: 'Plans & Pricing' })).toBeVisible();

  await page.getByPlaceholder('Search plans').fill('premium');
  await page.getByRole('button', { name: 'New plan' }).click();
  await expect(page.getByRole('heading', { name: 'Create Plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).first().click();
  await expect(page.getByRole('heading', { name: 'Edit Plan' })).toBeVisible();
});

test('plan cards show prices, feature areas and subscriber versions', async ({ adminPage: page }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Premium', exact: true })).toBeVisible();
  await expect(page.getByText('Free for 6 months', { exact: true })).toBeVisible();
  await expect(page.getByTestId('plan-price-premium')).toHaveText('$12.00 / mo');

  // A part of a feature area shows under its area, not as a separate module.
  const premiumModules = page.getByTestId('plan-modules-premium');
  await expect(premiumModules).toContainText('Core HR & Employee Management');
  await expect(premiumModules).toContainText('Project Management · Projects & Tasks');
  await expect(page.getByTestId('plan-subscribers-premium')).toHaveText('v2 · 2 subscriber(s) · 1 on an older version');
});

test('plans page saves plan edits with the package modules', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();
  await page.getByLabel('Trial months').fill('7');
  await page.getByRole('button', { name: 'Save plan' }).click();

  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.trialMonths).toBe(7);
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    id: 'premium',
    basePriceCents: 1200,
    currency: 'USD',
    billingInterval: 'monthly',
    perEmployee: true,
    recommended: true,
    modules: [
      { moduleId: 'employee_management', priceOverrideCents: null },
      { moduleId: 'pj_projects', priceOverrideCents: null },
    ],
  });
  // Subscribers are on an older version now: the apply dialog opens with a dry-run preview.
  await expect(page.getByTestId('apply-subscribers-dialog')).toBeVisible();
  await expect.poll(() => mockApi.lastVariables('AdminApplyPlanToSubscribers')?.dryRun).toBe(true);
});

test('plans page saves yearly billing interval edits', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();
  await page.getByTestId('plan-billing-interval').selectOption('yearly');
  await page.getByRole('button', { name: 'Save plan' }).click();

  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.billingInterval).toBe('yearly');
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    id: 'premium',
    name: 'Premium',
    billingInterval: 'yearly',
    basePriceCents: 1200,
    yearlyPriceCents: null,
    yearlyDiscountPct: 0,
  });
});

test('editing a yearly-only package keeps it yearly at the same price', async ({ adminPage: page, mockApi }) => {
  mockApi.plans.push({
    ...mockApi.plans[1],
    id: 'premium_yearly',
    name: 'Premium Yearly',
    basePriceCents: 12000,
    billingInterval: 'yearly',
    trialMonths: 0,
    recommended: false,
  });
  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByTestId('plan-price-premium_yearly')).toHaveText('$120.00 / yr');
  await page.getByRole('button', { name: 'Edit plan' }).nth(2).click();
  await expect(page.getByTestId('plan-billing-interval')).toHaveValue('yearly');
  await expect(page.getByTestId('plan-price')).toHaveValue('120');
  await page.getByRole('button', { name: 'Save plan' }).click();

  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.id).toBe('premium_yearly');
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    billingInterval: 'yearly',
    basePriceCents: 12000,
    isPublic: false,
    modules: [{ moduleId: 'invoicing', priceOverrideCents: null }],
  });
});

test('plans page creates a new plan with a module tree selection', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'New plan' }).click();

  await page.getByLabel('Plan ID').fill('starter');
  await page.getByLabel('Name', { exact: true }).fill('Starter');
  await page.getByTestId('plan-price').fill('5');
  await page.getByLabel('Employee limit').fill('25');
  await page.getByLabel('Description').fill('A starter plan for smaller teams.');
  await page.getByLabel('Features').fill('Core dashboard\nEmail support');

  // A whole feature area, plus one part of another.
  await page.getByTestId('module-checkbox-employee_management').check();
  await page.getByTestId('module-expand-invoicing').click();
  await page.getByTestId('module-checkbox-inv_invoices').check();
  await expect(page.getByTestId('module-checkbox-invoicing')).toHaveJSProperty('indeterminate', true);
  await page.getByRole('button', { name: 'Create plan' }).click();

  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.id).toBe('starter');
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    id: 'starter',
    name: 'Starter',
    basePriceCents: 500,
    currency: 'USD',
    billingInterval: 'monthly',
    perEmployee: false,
    trialMonths: 0,
    employeeLimit: 25,
    features: ['Core dashboard', 'Email support'],
    recommended: false,
    active: true,
    sortOrder: 3,
    modules: [
      { moduleId: 'employee_management', priceOverrideCents: null },
      { moduleId: 'inv_invoices', priceOverrideCents: null },
    ],
  });
});

test('a new plan without modules is not saved', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'New plan' }).click();
  await page.getByLabel('Plan ID').fill('empty');
  await page.getByLabel('Name', { exact: true }).fill('Empty');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByText('Select the modules this package unlocks.').first()).toBeVisible();
  expect(mockApi.lastVariables('AdminSavePlan')).toBeUndefined();
});

test('apply an edited package to subscribers after a dry run', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByTestId('apply-subscribers-premium').click();
  const dialog = page.getByTestId('apply-subscribers-dialog');
  const preview = dialog.getByTestId('apply-subscribers-preview');
  await expect(preview).toContainText('Acme Labs');
  // Pre-package companies are left alone unless the admin opts in.
  await expect(preview).not.toContainText('Legacy Co');
  await dialog.getByTestId('apply-subscribers-include-legacy').check();
  await expect(preview).toContainText('Legacy Co');
  await expect(preview).toContainText('Had every module (legacy)');
  await expect(preview).toContainText('Invoicing & Statement of Accounts');

  await dialog.getByTestId('apply-subscribers-submit').click();
  await expect(page.getByText('A reason is required')).toBeVisible();
  await dialog.getByTestId('apply-subscribers-reason').fill('Projects added to Premium');
  await dialog.getByTestId('apply-subscribers-submit').click();
  await expect.poll(() => mockApi.lastVariables('AdminApplyPlanToSubscribers')).toMatchObject({
    planId: 'premium',
    dryRun: false,
    includeUnrestricted: true,
    reason: 'Projects added to Premium',
  });
  await expect(dialog).toHaveCount(0);
});
