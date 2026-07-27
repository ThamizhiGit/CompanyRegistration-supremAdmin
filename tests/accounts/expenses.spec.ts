import { test, expect } from '../fixtures/graphql.fixture';
import {
  createExpenseFormData,
  fillExpenseForm,
} from '../fixtures/data-factories';

test('full expense flow: create, detail, edit and status change', async ({
  adminPage: page,
  mockApi,
}) => {
  await page.getByRole('button', { name: 'Accounts' }).click();
  await page.getByRole('button', { name: 'Expenses' }).click();
  await expect(page.getByText('No expenses recorded yet')).toBeVisible();

  await page.getByRole('button', { name: 'New Expense' }).first().click();
  const expense = createExpenseFormData();
  await fillExpenseForm(page, expense);
  await page.getByRole('button', { name: 'Save Expense' }).click();

  await expect(page.getByText('Expense created')).toBeVisible();
  expect(mockApi.lastVariables('AdminCreateExpense')?.input).toMatchObject({
    title: expense.title,
    vendor: expense.vendor,
    category: expense.category,
    lineItems: [{ unitPriceCents: 500 }],
  });

  const createdRow = page.getByRole('row').filter({
    has: page.getByRole('cell', { name: expense.title, exact: true }),
  });
  await expect(createdRow).toBeVisible();
  await createdRow.locator('button[title="View"]').click();
  const detailDialog = page.locator('.fixed.inset-0').filter({
    has: page.getByRole('heading', { name: /^EXP-/ }),
  });
  await expect(detailDialog).toBeVisible();
  await expect(detailDialog.getByText(expense.vendor, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).last().click();

  await createdRow.locator('button[title="Edit"]').click();
  const updatedVendor = `${expense.vendor} updated`;
  await page.getByLabel('Vendor').fill(updatedVendor);
  await page.getByLabel('Status').selectOption('approved');
  await page.getByRole('button', { name: 'Update Expense' }).click();

  await expect(page.getByText('Expense updated')).toBeVisible();
  expect(mockApi.lastVariables('AdminUpdateExpense')?.input.vendor).toBe(updatedVendor);
  expect(mockApi.lastVariables('AdminSetExpenseStatus')?.input.status).toBe('approved');
  await page.getByPlaceholder('Search').fill(expense.title);
  await expect(
    page.getByRole('row').filter({ hasText: expense.title }).getByText('approved', { exact: true }),
  ).toBeVisible();
});

test('creates a DigitalOcean App Platform hosting expense', async ({
  adminPage: page,
  mockApi,
}) => {
  const expense = createExpenseFormData();
  await page.getByRole('button', { name: 'Accounts' }).click();
  await page.getByRole('button', { name: 'Expenses' }).click();
  await page.getByRole('button', { name: 'New Expense' }).first().click();
  await fillExpenseForm(page, expense);
  await page.getByRole('button', { name: 'Save Expense' }).click();

  await expect(page.getByText('Expense created')).toBeVisible();
  await expect(page.getByText(expense.title)).toBeVisible();
  expect(mockApi.lastVariables('AdminCreateExpense')?.input).toMatchObject({
    title: expense.title,
    category: expense.category,
    vendor: expense.vendor,
    currency: 'USD',
    taxCents: 0,
    projectCode: 'SUPREME-DASHBOARD',
    serviceCode: 'APP-PLATFORM',
    referenceLink: 'https://www.digitalocean.com/products/app-platform',
    tags: ['hosting', 'paas', 'digitalocean'],
    lineItems: [
      {
        lineType: expense.category,
        label: 'App Platform backend container',
        quantity: 1,
        unitPriceCents: 500,
        unit: 'month',
      },
    ],
  });
});
