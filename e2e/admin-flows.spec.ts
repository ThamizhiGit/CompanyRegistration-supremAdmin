import { test, expect } from '@playwright/test';

type ExpenseCategory = 'hosting' | 'service' | 'integration' | 'llm' | 'other';
type ExpenseStatus = 'draft' | 'pending' | 'approved' | 'paid' | 'rejected' | 'archived';

type ExpenseLineItem = {
  id: string;
  expenseId: string;
  lineType: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
  costCents: number;
  unit: string | null;
  notes: string | null;
};

type ExpenseRecord = {
  id: string;
  expenseRef: string;
  title: string;
  description: string;
  category: ExpenseCategory;
  status: ExpenseStatus;
  vendor: string;
  projectCode: string | null;
  serviceCode: string | null;
  incurredAt: string;
  dueAt: string | null;
  paidAt: string | null;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  approvedBy: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  referenceLink: string | null;
  tags: string[];
  lineItems: ExpenseLineItem[];
};

const login = async (page: any, username = 'admin', password = 'pass') => {
  await page.goto('/');
  await page.fill('input[placeholder="Enter your username"]', username);
  await page.fill('input[placeholder="Enter your password"]', password);
  await page.locator('button[type="submit"]').click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
};

const fillExpenseForm = async (page: any, expense: { title: string; vendor: string; category: ExpenseCategory; expenseDateLocal: string }) => {
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
  await page.getByLabel('Description').fill('App Platform hosting stack for tests.');

  await page.getByLabel('Cost type').selectOption(expense.category);
  await page.getByLabel('Item name').fill('App Platform backend container');
  await page.getByLabel('Quantity').fill('1');
  await page.getByLabel('Unit price (USD)').fill('5.00');
  await page.getByLabel('Billing unit').fill('month');
  await page.getByLabel('Notes').fill('Backend component charge.');

  await expect(page.getByLabel('Calculated cost')).toHaveValue('$5.00');
};

const installFlowMocks = async (page: any, options: { legacyRevenue?: boolean } = {}) => {
  let capturedCreateInput: any = null;
  let capturedUpdateInput: any = null;
  let capturedSetStatusInput: any = null;

  const loginResponse = {
    success: true,
    message: 'ok',
    token: 'e2e-token',
    expiresAt: '2027-07-13T10:00:00Z',
    superAdmin: {
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      isActive: true,
      lastLogin: '2026-07-06T09:12:00Z',
      __typename: 'SuperAdmin',
    },
    __typename: 'SuperAdminTokenAuthPayload',
  };

  const users = [
    {
      id: 'user-1',
      username: 'john',
      email: 'john@acme.com',
      firstName: 'John',
      lastName: 'Doe',
      isCompanyAdmin: true,
      isActive: true,
      company: { id: 12, company: 'Acme Labs', __typename: 'Company' },
      location: { id: 4, location: 'HQ', __typename: 'Location' },
      __typename: 'User',
    },
    {
      id: 'user-2',
      username: 'jane',
      email: 'jane@acme.com',
      firstName: 'Jane',
      lastName: 'Roe',
      isCompanyAdmin: false,
      isActive: true,
      company: { id: 12, company: 'Acme Labs', __typename: 'Company' },
      location: { id: 5, location: 'Remote', __typename: 'Location' },
      __typename: 'User',
    },
  ];

  const userActivityLogs = [
    {
      id: 'act-1',
      actor: 'admin',
      action: 'CREATE',
      targetType: 'customuser',
      targetId: 'user-1',
      companyId: 12,
      userId: 'user-1',
      details: '{"email":"john@acme.com","name":"John Doe"}',
      createdAt: '2026-07-08T10:00:00Z',
      ipAddress: '127.0.0.1',
      userAgent: 'Playwright',
      __typename: 'UserActivity',
    },
    {
      id: 'act-2',
      actor: 'admin',
      action: 'UPDATE',
      targetType: 'expense',
      targetId: 'expense-legacy',
      companyId: 12,
      userId: 'user-1',
      details: '{"status":"approved"}',
      createdAt: '2026-07-08T10:10:00Z',
      ipAddress: '127.0.0.1',
      userAgent: 'Playwright',
      __typename: 'UserActivity',
    },
    {
      id: 'act-3',
      actor: 'admin',
      action: 'DELETE',
      targetType: 'expense',
      targetId: 'expense-other',
      companyId: 13,
      userId: 'user-2',
      details: '{"status":"removed"}',
      createdAt: '2026-07-08T11:00:00Z',
      ipAddress: '127.0.0.1',
      userAgent: 'Playwright',
      __typename: 'UserActivity',
    },
  ];

  const companies = [
    {
      id: 12,
      company: 'Acme Labs',
      activeModules: ['crm'],
      latestPaymentModules: ['crm'],
      createdAt: '2026-06-01T00:00:00Z',
      isMultiLocationEnabled: true,
      subscriptionStatus: 'trial',
      subscriptionDueDate: '2026-08-01T00:00:00Z',
      subscriptionRecurringDate: '2026-09-01T00:00:00Z',
      paymentHistoryCount: 0,
      latestPaymentStatus: 'succeeded',
      latestPaymentIntentId: 'pi_1',
      latestPaymentEmail: 'john@acme.com',
      latestPaymentAmount: 10000,
      latestPaymentCurrency: 'USD',
      latestPaymentSource: 'stripe',
      latestPaymentDeniedReason: 'insufficient_funds',
      latestPaymentGatewayMethod: 'card',
      latestPaymentGatewayRefReceiverMedium: 'BANK-11',
      latestPaymentGatewayRefSenderMedium: 'CARD-22',
      latestPaymentGatewayStatus: 'ok',
      latestPaymentCreatedAt: '2026-06-20T00:00:00Z',
      __typename: 'Company',
    },
  ];

  const infrastructureByPeriod: Record<string, any> = {
    '7d': {
      income: 12000,
      expense: 3500,
      net: 8500,
      period: '7d',
      pendingBalance: 1500,
      failedRefunds: 0,
      byDay: [
        { date: '2026-07-01', income: 3000, expense: 1000, __typename: 'DailyFinancePoint' },
        { date: '2026-07-02', income: 9000, expense: 2500, __typename: 'DailyFinancePoint' },
      ],
    },
    '30d': {
      income: 50000,
      expense: 16000,
      net: 34000,
      period: '30d',
      pendingBalance: 14000,
      failedRefunds: 0,
      byDay: [
        { date: '2026-07-01', income: 10000, expense: 1000, __typename: 'DailyFinancePoint' },
        { date: '2026-07-02', income: 12000, expense: 1200, __typename: 'DailyFinancePoint' },
      ],
    },
  };

  let expenses: ExpenseRecord[] = [];
  let nextExpenseId = 1;

  const createExpenseFromInput = (input: any, id: string): ExpenseRecord => ({
    id,
    expenseRef: `EXP-${String(nextExpenseId).padStart(3, '0')}`,
    title: input.title,
    description: input.description || '',
    category: input.category,
    status: input.status || 'draft',
    vendor: input.vendor,
    projectCode: input.projectCode || null,
    serviceCode: input.serviceCode || null,
    incurredAt: input.incurredAt,
    dueAt: input.dueAt || null,
    paidAt: null,
    currency: input.currency || 'USD',
    subtotalCents: input.lineItems[0] ? Math.round(Number(input.lineItems[0].quantity) * Number(input.lineItems[0].unitPriceCents) * 100) : 0,
    taxCents: input.taxCents || 0,
    totalCents: input.lineItems[0]
      ? Math.round(Number(input.lineItems[0].quantity) * Number(input.lineItems[0].unitPriceCents) * 100) + (input.taxCents || 0)
      : input.taxCents || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
    approvedBy: null,
    invoiceNumber: input.invoiceNumber || null,
    invoiceDate: input.invoiceDate || null,
    referenceLink: input.referenceLink || null,
    tags: input.tags || [],
    lineItems: input.lineItems.map((line: any, index: number) => ({
      id: `${id}-line-${index + 1}`,
      expenseId: id,
      lineType: line.lineType,
      label: line.label,
      quantity: Number(line.quantity),
      unitPriceCents: Math.round(Number(line.unitPriceCents) * 100),
      costCents: Math.round(Number(line.quantity) * Number(line.unitPriceCents) * 100),
      unit: line.unit || null,
      notes: line.notes || null,
    })),
  });

  await page.route('**/graphql/', async (route: any) => {
    let payload: any = {};

    try {
      const requestBody = route.request().postData();
      if (requestBody) {
        payload = JSON.parse(requestBody);
      }
    } catch {
      payload = {};
    }

    const operationName = payload.operationName;
    const variables = payload.variables || {};

    if (operationName === 'SuperAdminLogin') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { superAdminTokenAuth: loginResponse } }),
      });
      return;
    }

    if (operationName === 'AdminRevenueSummary') {
      const summary: any = {
        totalCompanies: 2,
        totalUsers: 7,
        totalPayments: 4,
        grossRevenue: 120000,
        byStatus: [
          { status: 'succeeded', count: 2, amount: 90000, __typename: 'PaymentStatusSummary' },
          { status: 'pending', count: 1, amount: 2000, __typename: 'PaymentStatusSummary' },
        ],
      };

      if (options.legacyRevenue) {
        summary.totalExpenses = null;
        summary.netRevenue = null;
      } else {
        summary.totalExpenses = 500;
        summary.netRevenue = 119500;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { adminRevenueSummary: summary } }),
      });
      return;
    }

    if (operationName === 'AdminExpenses') {
      const { filter } = variables;
      let items = [...expenses];

      if (filter?.search) {
        const needle = String(filter.search).toLowerCase();
        items = items.filter((item) => item.title.toLowerCase().includes(needle));
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminExpenses: {
              totalCount: items.length,
              items,
            },
          },
        }),
      });
      return;
    }

    if (operationName === 'AdminCreateExpense') {
      const input = variables.input;
      capturedCreateInput = input;
      const id = `expense-${nextExpenseId++}`;
      const created = createExpenseFromInput(input, id);
      expenses.unshift(created);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminCreateExpense: {
              success: true,
              message: 'Expense created',
              expense: {
                id: created.id,
                expenseRef: created.expenseRef,
                title: created.title,
                status: created.status,
                totalCents: created.totalCents,
                currency: created.currency,
                __typename: 'ExpensePayload',
              },
              __typename: 'ExpensePayload',
            },
          },
        }),
      });
      return;
    }

    if (operationName === 'AdminUpdateExpense') {
      const input = variables.input;
      capturedUpdateInput = input;
      const index = expenses.findIndex((expense) => expense.id === input.id);

      if (index >= 0) {
        expenses[index] = {
          ...expenses[index],
          title: input.title,
          description: input.description || expenses[index].description,
          category: input.category,
          vendor: input.vendor,
          projectCode: input.projectCode || null,
          serviceCode: input.serviceCode || null,
          incurredAt: input.incurredAt,
          dueAt: input.dueAt || null,
          currency: input.currency || expenses[index].currency,
          taxCents: input.taxCents || 0,
          invoiceNumber: input.invoiceNumber || null,
          invoiceDate: input.invoiceDate || null,
          referenceLink: input.referenceLink || null,
          tags: input.tags || [],
          updatedAt: new Date().toISOString(),
        };
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminUpdateExpense: {
              success: true,
              message: 'Expense updated',
              expense: {
                id: input.id,
                expenseRef: expenses[index]?.expenseRef || `EXP-${nextExpenseId.toString().padStart(3, '0')}`,
                title: input.title,
                status: input.status || expenses[index]?.status || 'draft',
                totalCents: expenses[index]?.totalCents || 0,
                currency: input.currency || 'USD',
                __typename: 'ExpensePayload',
              },
              __typename: 'ExpensePayload',
            },
          },
        }),
      });
      return;
    }

    if (operationName === 'AdminSetExpenseStatus') {
      const input = variables.input;
      capturedSetStatusInput = input;
      const index = expenses.findIndex((expense) => expense.id === input.id);
      if (index >= 0) {
        expenses[index] = {
          ...expenses[index],
          status: input.status,
          updatedAt: new Date().toISOString(),
        };
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminSetExpenseStatus: {
              success: true,
              message: `Status updated to ${input.status}`,
              expense: {
                id: input.id,
                expenseRef: expenses[index]?.expenseRef || input.id,
                status: input.status,
                __typename: 'ExpensePayload',
              },
              __typename: 'ExpensePayload',
            },
          },
        }),
      });
      return;
    }

    if (operationName === 'AdminExpenseById') {
      const expense = expenses.find((item) => item.id === variables.id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminExpenseById: expense || null,
          },
        }),
      });
      return;
    }

    if (operationName === 'AdminInfrastructure') {
      const period = variables.period || '30d';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminInfrastructure: infrastructureByPeriod[period] || infrastructureByPeriod['30d'],
          },
        }),
      });
      return;
    }

    if (operationName === 'AdminUsers') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminUsers: users,
          },
        }),
      });
      return;
    }

    if (operationName === 'AdminCompanies') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { adminCompanies: companies } }),
      });
      return;
    }

    if (operationName === 'AdminUserActivityLogs') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminUserActivityLogs: userActivityLogs,
          },
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
  });

  return {
    getCapturedCreateInput: () => capturedCreateInput,
    getCapturedUpdateInput: () => capturedUpdateInput,
    getCapturedSetStatusInput: () => capturedSetStatusInput,
  };
};

test.describe('Admin UI flow suite (mocked backend)', () => {
  test('renders dashboard summary with expense-aware metrics and backward compatibility', async ({ page }) => {
    await installFlowMocks(page, { legacyRevenue: true });
    await login(page);

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Gross Revenue')).toBeVisible();
    await expect(page.getByText('Total Expenses')).toBeVisible();
    await expect(page.getByText('Net Revenue')).toBeVisible();

    const dashboardText = await page.locator('body').textContent();
    expect(dashboardText).toContain('$1,200.00');
    expect(dashboardText).toContain('$0.00');
    expect(dashboardText).toContain('Payment Status Breakdown');
  });

  test('full expense flow: create, detail, edit and status change', async ({ page }) => {
    const flow = await installFlowMocks(page);
    await login(page);

    await page.getByRole('button', { name: 'Accounts' }).click();
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
    await page.getByRole('button', { name: 'Expenses' }).click();
    await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible();
    await expect(page.getByText('No expenses recorded yet')).toBeVisible();

    await page.getByRole('button', { name: 'New Expense' }).first().click();
    await expect(page.getByRole('heading', { name: 'Create Expense' })).toBeVisible();

    const runId = Date.now();
    const expense = {
      title: `DigitalOcean App Platform ${runId}`,
      vendor: `DigitalOcean ${runId}`,
      category: 'hosting' as ExpenseCategory,
      expenseDateLocal: new Date(runId + 60_000).toISOString().slice(0, 16),
    };

    await fillExpenseForm(page, expense);
    await page.getByRole('button', { name: 'Save Expense' }).click();

    await expect(page.getByText('Expense created')).toBeVisible();
    const capturedCreateInput = flow.getCapturedCreateInput();
    expect(capturedCreateInput.title).toBe(expense.title);
    expect(capturedCreateInput.vendor).toBe(expense.vendor);
    expect(capturedCreateInput.category).toBe(expense.category);
    expect(capturedCreateInput.lineItems?.[0]?.unitPriceCents).toBe(500);

    const createdRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: expense.title, exact: true }) });
    await expect(createdRow).toBeVisible();
    await expect(createdRow.getByRole('cell', { name: expense.vendor, exact: true })).toBeVisible();

    await createdRow.locator('button[title="View"]').click();
    await expect(page.getByRole('heading', { name: /^EXP-/ })).toBeVisible();
    const detailModal = page.locator('.fixed.inset-0').filter({ has: page.getByRole('heading', { name: /^EXP-/ }) });
    await expect(detailModal.getByText(expense.title, { exact: true })).toBeVisible();
    await expect(detailModal.getByText(expense.vendor, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).last().click();

    await createdRow.locator('button[title="Edit"]').click();
    await expect(page.getByRole('heading', { name: 'Edit Expense' })).toBeVisible();
    const updatedVendor = `${expense.vendor} (${expense.title.slice(-4)})`;
    await page.getByLabel('Vendor').fill(updatedVendor);
    await page.getByLabel('Status').selectOption('approved');
    await page.getByRole('button', { name: 'Update Expense' }).click();

    await expect(page.getByText('Expense updated')).toBeVisible();
    const capturedUpdateInput = flow.getCapturedUpdateInput();
    const capturedSetStatusInput = flow.getCapturedSetStatusInput();
    expect(capturedUpdateInput.vendor).toBe(updatedVendor);
    expect(capturedSetStatusInput.status).toBe('approved');

    await page.getByPlaceholder('Search').fill(expense.title);
    const updatedRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: expense.title, exact: true }) });
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow.getByRole('cell', { name: 'approved', exact: true })).toBeVisible();
  });

  test('infrastructure period change updates trend payload in UI', async ({ page }) => {
    await installFlowMocks(page);
    await login(page);

    await page.getByRole('button', { name: 'Accounts' }).click();
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Infrastructure' })).toBeVisible();

    const periodSelect = page.getByLabel('Infrastructure reporting period');
    await expect(periodSelect).toBeVisible();
    await expect(page.getByText('Daily trend (30d)')).toBeVisible();
    await expect(page.getByText('$500.00')).toBeVisible();

    await periodSelect.selectOption('7d');
    await expect(page.getByText('Daily trend (7d)')).toBeVisible();
    await expect(page.getByText('$120.00')).toBeVisible();
    await expect(page.getByText('$35.00')).toBeVisible();
  });

  test('user activity modal is scoped to clicked user', async ({ page }) => {
    await installFlowMocks(page);
    await login(page);

    await page.getByRole('button', { name: 'Users' }).click();
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

    const johnRow = page.getByRole('row', { name: 'John Doe' });
    await expect(johnRow).toBeVisible();
    await johnRow.locator('button[title="View Activity"]').click();

    await expect(page.getByRole('heading', { name: 'User Activity - John Doe' })).toBeVisible();
    const activityCards = page.locator('details');
    await expect(activityCards).toHaveCount(2);
    await expect(page.getByText('Created user account')).toBeVisible();
    await expect(page.getByText('Updated Expense', { exact: true })).toBeVisible();
    await expect(page.getByText('for john@acme.com')).toBeVisible();

    await page.getByRole('button', { name: '×' }).click();
    await expect(page.getByRole('heading', { name: 'User Activity - John Doe' })).toHaveCount(0);
  });
});
