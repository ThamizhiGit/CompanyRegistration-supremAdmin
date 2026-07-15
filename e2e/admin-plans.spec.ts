import { test, expect } from '@playwright/test';

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

const plans = [
  {
    id: 'free',
    name: 'Free',
    description: 'Everything you need to get started - no credit card, no commitment.',
    basePriceCents: 0,
    currency: 'USD',
    billingInterval: 'monthly',
    perEmployee: false,
    trialMonths: 0,
    employeeLimit: 10,
    features: [
      'Up to 10 employees',
      'Core HR & Payroll',
      'Time & Attendance tracking',
      'Basic reporting (5 templates)',
      'Employee self-service portal',
      '2 integrations',
      'Email support',
    ],
    recommended: false,
    active: true,
    sortOrder: 1,
    updatedAt: '2026-07-10T00:00:00Z',
    updatedBy: { id: '1', username: 'admin', __typename: 'SuperAdmin' },
    __typename: 'Plan',
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Full AI power across every department. Unlimited scale, zero friction.',
    basePriceCents: 1200,
    currency: 'USD',
    billingInterval: 'monthly',
    perEmployee: true,
    trialMonths: 6,
    employeeLimit: null,
    features: [
      'Unlimited employees',
      'Full AI Workforce intelligence',
      'Multi-rate & multi-entity payroll',
      'AI Talent & ATS (unlimited jobs)',
      'AI Performance & 360 feedback',
      'AI Accounting & self-reconciliation',
      'AI CRM - full pipeline',
      '100+ analytics report templates',
      'Unlimited integrations',
      'Dedicated success manager',
      '24 / 7 priority support & SLA',
      'Custom onboarding & training',
    ],
    recommended: true,
    active: true,
    sortOrder: 2,
    updatedAt: '2026-07-10T00:00:00Z',
    updatedBy: { id: '1', username: 'admin', __typename: 'SuperAdmin' },
    __typename: 'Plan',
  },
];

let capturedPlanInput: any = null;
let capturedCompanyPlanInput: any = null;

const installGraphQLMock = async (page: any) => {
  capturedPlanInput = null;
  capturedCompanyPlanInput = null;

  await page.route('**/graphql/', async (route: any) => {
    const payload = route.request().postData() ? JSON.parse(route.request().postData()!) : {};
    const variables = payload.variables || {};

    if (payload.operationName === 'SuperAdminLogin') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { superAdminTokenAuth: loginResponse } }),
      });
    }

    if (payload.operationName === 'AdminRevenueSummary') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminRevenueSummary: {
              totalCompanies: 1,
              totalUsers: 42,
              totalPayments: 2,
              grossRevenue: 50400,
              totalExpenses: 0,
              netRevenue: 50400,
              byStatus: [],
              expenseByCategory: [],
              expenseByVendor: [],
              __typename: 'RevenueSummary',
            },
          },
        }),
      });
    }

    if (payload.operationName === 'AdminPlans') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { adminPlans: plans } }),
      });
    }

    if (payload.operationName === 'AdminSavePlan') {
      capturedPlanInput = variables.input;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminSavePlan: {
              success: true,
              message: 'Plan saved',
              plan: {
                id: variables.input.id,
                name: variables.input.name,
                basePriceCents: variables.input.basePriceCents,
                currency: variables.input.currency,
                billingInterval: variables.input.billingInterval,
                perEmployee: variables.input.perEmployee,
                trialMonths: variables.input.trialMonths,
                employeeLimit: variables.input.employeeLimit,
                active: variables.input.active,
                __typename: 'Plan',
              },
              __typename: 'AdminSavePlanPayload',
            },
          },
        }),
      });
    }

    if (payload.operationName === 'AdminModules') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminModules: [
              {
                id: 'crm',
                name: 'AI CRM',
                description: 'Legacy CRM entitlement',
                price: 10000,
                currency: 'USD',
                active: true,
                sortOrder: 1,
                offerPrice: null,
                offerLabel: null,
                offerStartsAt: null,
                offerEndsAt: null,
                effectivePrice: 10000,
                usersCount: 3,
                updatedAt: '2026-07-01T00:00:00Z',
                updatedBy: { id: '1', username: 'admin', __typename: 'SuperAdmin' },
                __typename: 'Module',
              },
            ],
          },
        }),
      });
    }

    if (payload.operationName === 'AdminCompanies') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminCompanies: [
              {
                id: 12,
                company: 'Acme Labs',
                planId: 'premium',
                planName: 'Premium',
                employeeCount: 42,
                activeModules: ['crm'],
                latestPaymentModules: ['crm'],
                createdAt: '2026-06-01T00:00:00Z',
                isMultiLocationEnabled: true,
                subscriptionStatus: 'trial',
                trialEndsAt: '2027-01-10T00:00:00Z',
                nextBillingDate: '2027-01-10T00:00:00Z',
                nextBillingAmountCents: 50400,
                subscriptionDueDate: '2027-01-10T00:00:00Z',
                subscriptionRecurringDate: '2027-02-10T00:00:00Z',
                paymentHistoryCount: 1,
                latestPaymentStatus: 'succeeded',
                latestPaymentIntentId: 'pi_1',
                latestPaymentEmail: 'john@acme.com',
                latestPaymentAmount: 0,
                latestPaymentPlanId: 'premium',
                latestPaymentPlanName: 'Premium',
                latestPaymentEmployeeCountSnapshot: 42,
                latestPaymentFinalAmountCents: 0,
                latestPaymentCurrency: 'USD',
                latestPaymentSource: 'stripe',
                latestPaymentDeniedReason: null,
                latestPaymentGatewayMethod: 'card',
                latestPaymentGatewayRefReceiverMedium: 'BANK-11',
                latestPaymentGatewayRefSenderMedium: 'CARD-22',
                latestPaymentGatewayStatus: 'ok',
                latestPaymentCreatedAt: '2026-07-10T00:00:00Z',
                __typename: 'Company',
              },
            ],
          },
        }),
      });
    }

    if (payload.operationName === 'AdminAssignCompanyPlan') {
      capturedCompanyPlanInput = variables;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminAssignCompanyPlan: {
              success: true,
              message: 'Company plan assigned',
              company: {
                id: variables.companyId,
                company: 'Acme Labs',
                planId: variables.planId,
                planName: variables.planId === 'free' ? 'Free' : 'Premium',
                subscriptionStatus: 'trial',
                trialEndsAt: '2027-01-10T00:00:00Z',
                nextBillingDate: '2027-01-10T00:00:00Z',
                nextBillingAmountCents: 0,
                __typename: 'Company',
              },
              __typename: 'AdminAssignCompanyPlanPayload',
            },
          },
        }),
      });
    }

    if (payload.operationName === 'AdminUpdateCompanyDetail') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminUpdateCompanyDetail: {
              success: true,
              message: 'Company updated',
              company: {
                id: variables.companyId,
                company: variables.company,
                subscriptionStatus: variables.subscriptionStatus,
                subscriptionDueDate: variables.subscriptionDueDate,
                subscriptionRecurringDate: variables.subscriptionRecurringDate,
                isMultiLocationEnabled: true,
                __typename: 'Company',
              },
              __typename: 'AdminUpdateCompanyDetailPayload',
            },
          },
        }),
      });
    }

    if (payload.operationName === 'AdminSetCompanyModules') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminSetCompanyModules: {
              success: true,
              message: 'Entitlements updated',
              company: { id: variables.companyId, company: 'Acme Labs', activeModules: variables.modules, __typename: 'Company' },
              __typename: 'AdminSetCompanyModulesPayload',
            },
          },
        }),
      });
    }

    if (payload.operationName === 'AdminPayments') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            adminPayments: [
              {
                paymentIntentId: 'pi_1',
                email: 'john@acme.com',
                planId: 'premium',
                planName: 'Premium',
                employeeCountSnapshot: 42,
                originalAmountCents: 50400,
                finalAmountCents: 0,
                trialEndsAt: '2027-01-10T00:00:00Z',
                modules: ['crm'],
                amount: 0,
                currency: 'USD',
                status: 'pending',
                companyId: 12,
                companyName: 'Acme Labs',
                source: 'stripe',
                deniedReason: null,
                createdAt: '2026-07-10T00:00:00Z',
                updatedAt: '2026-07-10T00:00:00Z',
                dueDate: '2027-01-10T00:00:00Z',
                recurringDate: '2027-02-10T00:00:00Z',
                gatewayMethod: 'card',
                gatewayRefReceiverMedium: 'BANK-11',
                gatewayRefSenderMedium: 'CARD-22',
                paymentGatewayStatus: 'trialing',
                __typename: 'Payment',
              },
            ],
          },
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    });
  });
};

const login = async (page: any) => {
  await page.addInitScript(() => window.sessionStorage.clear());
  await page.goto('/');
  await page.fill('input[placeholder="Enter your username"]', 'admin');
  await page.fill('input[placeholder="Enter your password"]', 'pass');
  await page.locator('button[type="submit"]').click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
};

test('plans page renders two canonical plans and saves plan edits', async ({ page }) => {
  await installGraphQLMock(page);
  await login(page);

  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByRole('heading', { name: 'Plans & Pricing' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Premium' })).toBeVisible();
  await expect(page.getByText('Free for 6 months', { exact: true })).toBeVisible();
  await expect(page.getByText('$12', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();
  await expect(page.getByRole('heading', { name: 'Edit Plan' })).toBeVisible();
  await page.getByLabel('Trial months').fill('7');
  await page.getByRole('button', { name: 'Save plan' }).click();

  await expect.poll(() => capturedPlanInput?.trialMonths).toBe(7);
  expect(capturedPlanInput).toMatchObject({
    id: 'premium',
    basePriceCents: 1200,
    currency: 'USD',
    perEmployee: true,
    recommended: true,
  });
});

test('plans page saves yearly billing interval edits', async ({ page }) => {
  await installGraphQLMock(page);
  await login(page);

  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByRole('heading', { name: 'Plans & Pricing' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();
  await expect(page.getByRole('heading', { name: 'Edit Plan' })).toBeVisible();
  await page.getByLabel('Billing interval').selectOption('yearly');
  await page.getByRole('button', { name: 'Save plan' }).click();

  await expect.poll(() => capturedPlanInput?.billingInterval).toBe('yearly');
  expect(capturedPlanInput).toMatchObject({
    id: 'premium',
    name: 'Premium',
    billingInterval: 'yearly',
    basePriceCents: 1200,
    currency: 'USD',
  });
});

test('plans page creates a new plan from the plan window', async ({ page }) => {
  await installGraphQLMock(page);
  await login(page);

  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'New plan' }).click();

  await expect(page.getByRole('heading', { name: 'Create Plan' })).toBeVisible();
  await page.getByLabel('Plan ID').fill('starter');
  await page.getByLabel('Name').fill('Starter');
  await page.getByLabel('Base price ($)').fill('5');
  await page.getByLabel('Employee limit').fill('25');
  await page.getByLabel('Description').fill('A starter plan for smaller teams.');
  await page.getByLabel('Features').fill('Core dashboard\nEmail support');
  await page.getByRole('button', { name: 'Create plan' }).click();

  await expect.poll(() => capturedPlanInput?.id).toBe('starter');
  expect(capturedPlanInput).toMatchObject({
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

test('companies page shows plan billing context and assigns plan', async ({ page }) => {
  await installGraphQLMock(page);
  await login(page);

  await page.getByRole('button', { name: 'Companies' }).click();
  await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible();
  await expect(page.getByText('Premium')).toBeVisible();
  await expect(page.getByText('42 employees')).toBeVisible();

  await page.locator('[title="Edit Company"]').click();
  await page.getByLabel('Subscription Plan').selectOption('free');
  await page.getByRole('button', { name: /Save changes/ }).click();

  await expect.poll(() => capturedCompanyPlanInput?.planId).toBe('free');
  expect(capturedCompanyPlanInput.companyId).toBe(12);
});

test('subscriptions page prefers plan snapshots over legacy modules', async ({ page }) => {
  await installGraphQLMock(page);
  await login(page);

  await page.getByRole('button', { name: 'Subscriptions' }).click();
  await expect(page.getByRole('heading', { name: 'Subscriptions & Payments' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Plan' })).toBeVisible();
  await expect(page.getByText('Premium')).toBeVisible();
  await expect(page.getByText('42 employees')).toBeVisible();
  await expect(page.getByText('Original $504.00')).toBeVisible();
  await expect(page.getByText('trialing')).toBeVisible();
});
