import { test, expect } from '@playwright/test';

type ExpenseTestData = {
  title: string;
  vendor: string;
  category: 'hosting' | 'service' | 'integration' | 'llm' | 'other';
  categoryLabel: string;
  expenseDateLocal: string;
};

const createExpenseTestData = (): ExpenseTestData => {
  const runId = Date.now();
  const categories = [
    { value: 'hosting', label: 'Hosting' },
    { value: 'service', label: 'Service' },
    { value: 'integration', label: 'Integration' },
    { value: 'other', label: 'Other' },
  ] as const;
  const selected = categories[runId % categories.length];
  const expenseDate = new Date(runId + 60_000);

  return {
    title: `DigitalOcean App Platform ${selected.label} ${runId}`,
    vendor: `DigitalOcean E2E ${runId}`,
    category: selected.value,
    categoryLabel: selected.label,
    expenseDateLocal: expenseDate.toISOString().slice(0, 16),
  };
};

const digitalOceanExpense = {
  id: 'expense-do-app-platform',
  expenseRef: 'EXP-DO-APP-001',
  title: 'DigitalOcean App Platform hosting',
  description:
    'App Platform PaaS hosting. Static frontend can use free tier; backend deploys as a separate paid container starting at $5/month.',
  category: 'hosting',
  status: 'draft',
  vendor: 'DigitalOcean',
  projectCode: 'SUPREME-DASHBOARD',
  serviceCode: 'APP-PLATFORM',
  incurredAt: '2026-07-08T12:00:00.000Z',
  dueAt: null,
  paidAt: null,
  currency: 'USD',
  subtotalCents: 500,
  taxCents: 0,
  totalCents: 500,
  createdAt: '2026-07-08T12:00:00.000Z',
  updatedAt: '2026-07-08T12:00:00.000Z',
  createdBy: 'admin',
  approvedBy: null,
  invoiceNumber: null,
  invoiceDate: null,
  referenceLink: 'https://www.digitalocean.com/products/app-platform',
  tags: ['hosting', 'paas', 'digitalocean'],
  metadata: null,
  lineItems: [
    {
      id: 'line-do-backend-container',
      expenseId: 'expense-do-app-platform',
      lineType: 'hosting',
      label: 'App Platform backend container',
      quantity: 1,
      unitPriceCents: 500,
      costCents: 500,
      unit: 'month',
      notes:
        'Backend deployed as a separate App Platform component. Paid backend containers start at $5/month.',
      llmProvider: null,
      llmModel: null,
      inputTokens: null,
      outputTokens: null,
      __typename: 'ExpenseLineItem',
    },
  ],
  __typename: 'Expense',
};

const installGraphQLMock = async (page: any) => {
  let created = false;
  let capturedCreateInput: any = null;
  let createdExpense: any = digitalOceanExpense;

  await page.route('**/graphql/', async (route: any) => {
    const payload = route.request().postData() ? JSON.parse(route.request().postData()!) : { operationName: '' };

    if (payload.operationName === 'SuperAdminLogin') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            superAdminTokenAuth: {
              success: true,
              message: 'ok',
              token: 'expense-e2e-token',
              expiresAt: '2027-07-13T09:12:00Z',
              superAdmin: {
                id: '1',
                username: 'admin',
                email: 'admin@example.com',
                isActive: true,
                lastLogin: '2026-07-06T09:12:00Z',
                __typename: 'SuperAdmin',
              },
              __typename: 'SuperAdminTokenAuthPayload',
            },
          },
        }),
      });
      return;
    }

    if (payload.operationName === 'AdminRevenueSummary') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminRevenueSummary: {
              totalCompanies: 0,
              totalUsers: 0,
              totalPayments: 0,
              grossRevenue: 0,
              totalExpenses: 0,
              netRevenue: 0,
              byStatus: [],
              expenseByCategory: [],
              expenseByVendor: [],
              __typename: 'RevenueSummary',
            },
          },
        }),
      });
      return;
    }

    if (payload.operationName === 'AdminExpenses') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminExpenses: {
              totalCount: created ? 1 : 0,
              items: created ? [createdExpense] : [],
              __typename: 'ExpenseFeed',
            },
          },
        }),
      });
      return;
    }

    if (payload.operationName === 'AdminExpenseById') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { adminExpenseById: createdExpense } }),
      });
      return;
    }

    if (payload.operationName === 'AdminCreateExpense') {
      created = true;
      capturedCreateInput = payload.variables.input;
      createdExpense = {
        ...digitalOceanExpense,
        title: capturedCreateInput.title,
        category: capturedCreateInput.category,
        vendor: capturedCreateInput.vendor,
        incurredAt: capturedCreateInput.incurredAt,
        currency: capturedCreateInput.currency,
        taxCents: capturedCreateInput.taxCents,
        lineItems: digitalOceanExpense.lineItems.map((lineItem) => ({
          ...lineItem,
          lineType: capturedCreateInput.lineItems[0].lineType,
          label: capturedCreateInput.lineItems[0].label,
          unit: capturedCreateInput.lineItems[0].unit,
          unitPriceCents: capturedCreateInput.lineItems[0].unitPriceCents,
          costCents: capturedCreateInput.lineItems[0].unitPriceCents,
        })),
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminCreateExpense: {
              success: true,
              message: 'Expense created',
              expense: createdExpense,
              __typename: 'ExpensePayload',
            },
          },
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
  });

  return {
    getCapturedCreateInput: () => capturedCreateInput,
  };
};

const login = async (page: any, username = 'admin', password = 'pass') => {
  await page.goto('/');
  await page.fill('input[placeholder="Enter your username"]', username);
  await page.fill('input[placeholder="Enter your password"]', password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
};

const fillDigitalOceanExpenseForm = async (page: any, expense: ExpenseTestData) => {
  await page.getByLabel('Expense title').fill(expense.title);
  await page.getByLabel('Vendor').fill(expense.vendor);
  await page.getByLabel('Category').selectOption(expense.category);
  await page.getByLabel('Expense date').fill(expense.expenseDateLocal);
  await page.getByLabel('Currency').selectOption('USD');
  await page.getByLabel('Tax amount').fill('0');

  await page.getByRole('button', { name: 'Optional details' }).click();
  await page.getByLabel('Project code').fill('SUPREME-DASHBOARD');
  await page.getByLabel('Service code').fill('APP-PLATFORM');
  await page.getByLabel('Reference link').fill('https://www.digitalocean.com/products/app-platform');
  await page.getByLabel('Tags').fill('hosting, paas, digitalocean');
  await page.getByLabel('Description').fill(
    'App Platform PaaS hosting. Static frontend can use free tier; backend deploys as a separate paid container starting at $5/month.',
  );

  await page.getByLabel('Cost type').selectOption(expense.category);
  await page.getByLabel('Item name').fill('App Platform backend container');
  await page.getByLabel('Quantity').fill('1');
  await page.getByLabel('Unit price (USD)').fill('5.00');
  await page.getByLabel('Billing unit').fill('month');
  await page.getByLabel('Notes').fill(
    'Backend deployed as a separate App Platform component. Paid backend containers start at $5/month.',
  );

  await expect(page.getByLabel('Calculated cost')).toHaveValue('$5.00');
};

test('creates a DigitalOcean App Platform hosting expense', async ({ page }) => {
  const expense = createExpenseTestData();
  const graphQL = await installGraphQLMock(page);
  await login(page);

  await page.getByRole('button', { name: 'Accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  await page.getByRole('button', { name: 'Expenses' }).click();
  await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible();
  await expect(page.getByText('No expenses recorded yet')).toBeVisible();

  await page.getByRole('button', { name: 'New Expense' }).first().click();
  await expect(page.getByRole('heading', { name: 'Create Expense' })).toBeVisible();

  await fillDigitalOceanExpenseForm(page, expense);
  await page.getByRole('button', { name: 'Save Expense' }).click();

  await expect(page.getByText('Expense created')).toBeVisible();
  await expect(page.getByText('EXP-DO-APP-001')).toBeVisible();
  await expect(page.getByText(expense.title)).toBeVisible();

  const capturedInput = graphQL.getCapturedCreateInput();
  expect(capturedInput).toMatchObject({
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

test('creates a DigitalOcean App Platform hosting expense in the real backend', async ({ page }) => {
  test.skip(
    process.env.RUN_REAL_EXPENSE_E2E !== '1',
    'Set RUN_REAL_EXPENSE_E2E=1 with EXPENSE_E2E_USERNAME and EXPENSE_E2E_PASSWORD to write real expense data.',
  );

  const username = process.env.EXPENSE_E2E_USERNAME;
  const password = process.env.EXPENSE_E2E_PASSWORD;
  expect(username, 'EXPENSE_E2E_USERNAME is required').toBeTruthy();
  expect(password, 'EXPENSE_E2E_PASSWORD is required').toBeTruthy();

  const expense = createExpenseTestData();
  await login(page, username, password);

  await page.getByRole('button', { name: 'Accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  await page.getByRole('button', { name: 'Expenses' }).click();
  await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible();

  await page.getByRole('button', { name: 'New Expense' }).first().click();
  await expect(page.getByRole('heading', { name: 'Create Expense' })).toBeVisible();

  await fillDigitalOceanExpenseForm(page, expense);
  await page.getByRole('button', { name: 'Save Expense' }).click();

  const duplicateWarning = page.getByText(/Duplicate expense/i);
  if (await duplicateWarning.isVisible().catch(() => false)) {
    throw new Error(`Generated expense data unexpectedly matched an existing duplicate: ${expense.title}`);
  }

  await page.getByPlaceholder('Search').fill(expense.title);
  const createdRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: expense.title, exact: true }) });
  await expect(createdRow).toBeVisible();
  await expect(createdRow.getByRole('cell', { name: expense.vendor, exact: true })).toBeVisible();
  await expect(createdRow.getByRole('cell', { name: expense.category, exact: true })).toBeVisible();
});
