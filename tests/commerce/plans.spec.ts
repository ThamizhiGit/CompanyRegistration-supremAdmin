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

test('plans page renders two canonical plans and saves plan edits', async ({
  adminPage: page,
  mockApi,
}) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Premium' })).toBeVisible();
  await expect(page.getByText('Free for 6 months', { exact: true })).toBeVisible();
  await expect(page.getByText('$12', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();
  await page.getByLabel('Trial months').fill('7');
  await page.getByRole('button', { name: 'Save plan' }).click();

  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.trialMonths).toBe(7);
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    id: 'premium',
    basePriceCents: 1200,
    currency: 'USD',
    perEmployee: true,
    recommended: true,
  });
});

test('plans page saves yearly billing interval edits', async ({
  adminPage: page,
  mockApi,
}) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();
  await page.getByLabel('Billing interval').selectOption('yearly');
  await page.getByRole('button', { name: 'Save plan' }).click();

  await expect
    .poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.billingInterval)
    .toBe('yearly');
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    id: 'premium',
    name: 'Premium',
    billingInterval: 'yearly',
    basePriceCents: 1200,
    currency: 'USD',
  });
});

test('plans page creates a new plan from the plan window', async ({
  adminPage: page,
  mockApi,
}) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'New plan' }).click();

  await page.getByLabel('Plan ID').fill('starter');
  await page.getByLabel('Name').fill('Starter');
  await page.getByLabel('Base price ($)').fill('5');
  await page.getByLabel('Employee limit').fill('25');
  await page.getByLabel('Description').fill('A starter plan for smaller teams.');
  await page.getByLabel('Features').fill('Core dashboard\nEmail support');
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
  });
});
