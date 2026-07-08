import { test, expect } from '@playwright/test';

type OperationName =
  | 'SuperAdminLogin'
  | 'AdminRevenueSummary'
  | 'AdminModules'
  | 'AdminCompanies'
  | 'AdminPayments'
  | 'AdminModuleDetail'
  | 'AdminCompanyPaymentHistory'
  | 'AdminUsers'
  | 'AdminInfrastructure'
  | 'AdminUserActivityLogs';

const graphQLMocks: Record<OperationName, any> = {
  SuperAdminLogin: {
    data: {
      superAdminTokenAuth: {
        success: true,
        message: 'ok',
        token: 'e2e-token',
        expiresAt: '2026-07-13T09:12:00Z',
        superAdmin: {
          id: '1',
          username: 'admin',
          email: 'admin@example.com',
          isActive: true,
          lastLogin: '2026-07-06T09:12:00Z',
          __typename: 'SuperAdmin'
        },
        __typename: 'SuperAdminTokenAuthPayload',
      },
    },
  },
  AdminRevenueSummary: {
    data: {
      adminRevenueSummary: {
        totalCompanies: 2,
        totalUsers: 7,
        totalPayments: 4,
        grossRevenue: 120000,
        byStatus: [
          { status: 'succeeded', count: 2, amount: 90000, __typename: 'PaymentStatusSummary' },
          { status: 'failed', count: 1, amount: 30000, __typename: 'PaymentStatusSummary' },
        ],
      },
    },
  },
  AdminModules: {
    data: {
      adminModules: [
        {
          id: 'crm',
          name: 'CRM',
          description: 'crm package',
          price: 10000,
          currency: 'USD',
          active: true,
          sortOrder: 1,
          offerPrice: null,
          offerLabel: null,
          offerStartsAt: null,
          offerEndsAt: null,
          offerActive: false,
          effectivePrice: 10000,
          usersCount: 3,
          updatedAt: '2026-07-01T00:00:00Z',
          updatedBy: { id: '1', username: 'admin', __typename: 'SuperAdmin' },
          __typename: 'Module',
        },
      ],
    },
  },
  AdminCompanies: {
    data: {
      adminCompanies: [
        {
          id: 12,
          company: 'Acme Labs',
          activeModules: [],
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
      ],
    },
  },
  AdminPayments: {
    data: {
      adminPayments: [
        {
          paymentIntentId: 'pi_1',
          email: 'john@acme.com',
          modules: ['crm'],
          amount: 10000,
          currency: 'USD',
          status: 'pending',
          companyId: 12,
          companyName: 'Acme Labs',
          source: 'stripe',
          deniedReason: null,
          createdAt: '2026-06-20T00:00:00Z',
          updatedAt: '2026-06-20T00:00:00Z',
          dueDate: '2026-07-10T00:00:00Z',
          recurringDate: '2026-08-10T00:00:00Z',
          gatewayMethod: 'card',
          gatewayRefReceiverMedium: 'BANK-11',
          gatewayRefSenderMedium: 'CARD-22',
          gatewayPayload: JSON.stringify({ trace: 'abc-1' }),
          paymentGatewayStatus: 'pending',
          __typename: 'Payment',
        },
      ],
    },
  },
  AdminModuleDetail: {
    data: {
      adminModuleDetail: {
        id: 'crm',
        name: 'CRM',
        description: 'crm package',
        price: 10000,
        currency: 'USD',
        active: true,
        users: [
          { id: 'u1', firstName: 'John', lastName: 'Doe', email: 'john@acme.com', username: 'john', __typename: 'User' },
        ],
        logs: [
          {
            id: 'log-1',
            action: 'offer_update',
            actor: 'admin',
            message: 'Updated offer',
            createdAt: '2026-06-30T00:00:00Z',
            __typename: 'ModuleLog',
          },
        ],
        __typename: 'Module',
      },
    },
  },
  AdminCompanyPaymentHistory: {
    data: {
      adminCompanyPaymentHistory: [
        {
          paymentIntentId: 'pi_1',
          email: 'john@acme.com',
          modules: '["crm"]',
          status: 'succeeded',
          amount: 10000,
          currency: 'USD',
          companyId: 12,
          companyName: 'Acme Labs',
          createdAt: '2026-06-20T00:00:00Z',
          updatedAt: '2026-06-20T00:00:00Z',
          dueDate: '2026-07-10T00:00:00Z',
          recurringDate: '2026-08-10T00:00:00Z',
          deniedReason: 'insufficient_funds',
          gatewayMethod: 'card',
          gatewayRefReceiverMedium: 'BANK-11',
          gatewayRefSenderMedium: 'CARD-22',
          gatewayPayload: JSON.stringify({ trace: 'abc-1' }),
          paymentGatewayStatus: 'ok',
          source: 'stripe',
          __typename: 'Payment',
        },
      ],
    },
  },
  AdminUsers: {
    data: {
      adminUsers: [
        {
          id: 'u1',
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
      ],
    },
  },
  AdminInfrastructure: {
    data: {
      adminInfrastructure: {
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
    },
  },
  AdminUserActivityLogs: {
    data: {
      adminUserActivityLogs: [
        {
          id: 'act-1',
          actor: 'admin',
          action: 'package_update',
          targetType: 'package',
          targetId: 'crm',
          companyId: 12,
          userId: 'u1',
          details: { message: 'Updated package offer' },
          createdAt: '2026-07-05T05:00:00Z',
          ipAddress: '127.0.0.1',
          userAgent: 'playwright',
          __typename: 'UserActivity',
        },
      ],
    },
  },
};

const installGraphQLMock = (page: any) =>
  page.route('**/graphql/', async (route: any) => {
    const payload = route.request().postData() ? JSON.parse(route.request().postData()!) : { operationName: '' };
    const operationName = payload.operationName as OperationName;
    const mock = graphQLMocks[operationName] || { data: {} };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mock),
    });
  });

const login = async (page: any) => {
  await page.goto('/');
  await page.fill('input[placeholder="Enter your username"]', 'admin');
  await page.fill('input[placeholder="Enter your password"]', 'pass');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(500);
};

test('admin navigation and package popup flows', async ({ page }) => {
  await installGraphQLMock(page);
  await login(page);

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.getByRole('button', { name: 'Packages' }).click();
  await expect(page.getByRole('heading', { name: 'Packages' })).toBeVisible();

  await page.getByPlaceholder('Search packages').fill('crm');
  await page.getByRole('button', { name: 'New Package' }).click();
  await expect(page.getByRole('heading', { name: 'Create New Package' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.locator('[title="View package detail"]').click();
  await expect(page.getByRole('heading', { name: 'Package Detail' })).toBeVisible();
});

test('company filters, detail edit, and payment history popups', async ({ page }) => {
  await installGraphQLMock(page);
  await login(page);

  await page.getByRole('button', { name: 'Companies' }).click();
  await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible();
  await expect(page.getByText('Payment Email')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Gateway' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Modules' })).toBeVisible();
  await expect(page.getByText('company status: trial')).toBeVisible();
  await expect(page.getByText('john@acme.com')).toBeVisible();
  await expect(page.getByText('card')).toBeVisible();
  await expect(page.getByText('CRM')).toBeVisible();
  await expect(page.getByText('Latest paid modules')).toBeVisible();

  await page.locator('select').first().selectOption('succeeded');
  await expect(page.getByText('Acme Labs')).toBeVisible();
  await page.getByPlaceholder('Email...').fill('john@acme.com');
  await expect(page.getByText('Acme Labs')).toBeVisible();
  await page.getByPlaceholder('Method, status, ref...').fill('card');
  await expect(page.getByText('Acme Labs')).toBeVisible();
  await page.getByPlaceholder('Module name...').fill('crm');
  await expect(page.getByText('Acme Labs')).toBeVisible();
  await page.getByPlaceholder('Company name...').fill('Acme');
  await page.locator('input[type="datetime-local"]').first().fill('2026-06-01T00:00');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByPlaceholder('Company name...')).toHaveValue('');

  await page.locator('[title="Edit Company"]').click();
  await expect(page.getByRole('heading', { name: 'Edit Company' })).toBeVisible();
  await expect(page.getByText('Active Modules')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.locator('[title="View Company"]').click();
  await expect(page.getByRole('heading', { name: 'View Company' })).toBeVisible();

  // Scroll the modal to reveal payment history table
  await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    if (modal) {
      modal.scrollTop = modal.scrollHeight;
    }
  });

  await page.waitForTimeout(500);

  // Find and click the Detail button in the payment history table
  const buttons = page.locator('button');
  let detailClicked = false;
  for (let i = 0; i < await buttons.count(); i++) {
    const text = await buttons.nth(i).textContent();
    if (text && text.includes('Detail')) {
      await buttons.nth(i).click();
      detailClicked = true;
      break;
    }
  }

  expect(detailClicked).toBeTruthy();
  await page.waitForTimeout(500);

  // Verify payment detail modal opened
  await expect(page.locator('h3').filter({ hasText: 'Payment Detail' })).toBeVisible({ timeout: 3000 });

  // Test refund submodule
  await expect(page.getByPlaceholder('Refund reason')).toBeVisible();
  await expect(page.getByPlaceholder('Amount')).toBeVisible();
  await expect(page.getByRole('button', { name: /Apply refund/i })).toBeVisible();

  // Test manual subscription trigger
  await expect(page.getByText('Manual subscription trigger')).toBeVisible();
  await expect(page.getByPlaceholder('Source')).toBeVisible();
  await expect(page.getByPlaceholder('Payment method')).toBeVisible();
  await expect(page.getByPlaceholder('Receiver medium')).toBeVisible();
  await expect(page.getByPlaceholder('Sender medium')).toBeVisible();
  await expect(page.getByRole('button', { name: /Trigger Manual/i })).toBeVisible();
});

test('users edit in popup and activity pages exist', async ({ page }) => {
  await installGraphQLMock(page);
  await login(page);

  await page.getByRole('button', { name: 'Users' }).click();
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User Activity - John Doe' })).toBeVisible();
  await expect(page.getByText('Updated package offer')).toBeVisible();
  await page.getByRole('button', { name: '×' }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit User' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Infrastructure' }).click();
  await expect(page.getByRole('heading', { name: 'Infrastructure' })).toBeVisible();

  // Test income/expense cards
  await expect(page.getByText('Income').first()).toBeVisible();
  await expect(page.getByText('Expense').first()).toBeVisible();
  await expect(page.getByText('Net').first()).toBeVisible();
  await expect(page.getByText('Pending balance')).toBeVisible();

  // Test daily trend table
  await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Income' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Expense' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Net' })).toBeVisible();

  // Test period selector
  const periodSelect = page.locator('select').last();
  await expect(periodSelect).toBeVisible();
  await periodSelect.selectOption('30d');
  await expect(periodSelect).toHaveValue('30d');
});

test('sidebar has all options and every page loads', async ({ page }) => {
  await installGraphQLMock(page);
  await login(page);

  const sidebarOptions = [
    { label: 'Dashboard', heading: 'Dashboard' },
    { label: 'Packages', heading: 'Packages' },
    { label: 'Companies', heading: 'Companies' },
    { label: 'Subscriptions', heading: 'Subscriptions & Payments' },
    { label: 'Users', heading: 'Users' },
    { label: 'Infrastructure', heading: 'Infrastructure' },
  ];

  for (const option of sidebarOptions) {
    await page.getByRole('button', { name: option.label }).click();
    await expect(page.getByRole('heading', { name: option.heading })).toBeVisible();
  }
});
