import fs from 'node:fs';
import {
  expect,
  test as base,
  type Page,
  type Route,
} from '@playwright/test';
import { loginAsAdmin } from './auth.fixture';
import { createSchemaValidator } from './schema-validation';
import {
  createMockExpense,
  futureIso,
  pastIso,
  uniqueId,
} from './data-factories';

type GraphQLPayload = {
  operationName?: string;
  variables?: Record<string, any>;
  query?: string;
};

// Every mocked request is checked against the backend schema first: a
// request the real API would refuse (a wrong variable type, a missing
// argument, 12.5 for an Int) gets the server's error and fails the test.
const { request: checkRequest } = createSchemaValidator(
  fs.readFileSync(new URL('./superadmin-schema.graphql', import.meta.url), 'utf8'),
);

type MockOverride =
  | Record<string, unknown>
  | ((payload: GraphQLPayload, api: MockGraphQLApi) => Record<string, unknown> | Promise<Record<string, unknown>>);

export type MockGraphQLApi = ReturnType<typeof createMockGraphQLApi>;

const json = (route: Route, data: Record<string, unknown>) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });

const planFixtures = () => [
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
    features: ['Up to 10 employees', 'Core HR & Payroll', 'Email support'],
    recommended: false,
    active: true,
    sortOrder: 1,
    updatedAt: pastIso(),
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
      'AI Accounting & self-reconciliation',
      '24 / 7 priority support & SLA',
    ],
    recommended: true,
    active: true,
    sortOrder: 2,
    updatedAt: pastIso(),
    updatedBy: { id: '1', username: 'admin', __typename: 'SuperAdmin' },
    __typename: 'Plan',
  },
];

const moduleFixtures = () => [
  ['employee_management', 'Core HR & Employee Management', null, 1],
  ['hr_org_structure', 'Departments, Designations & Job Roles', 'employee_management', 2],
  ['hr_shifts', 'Shifts', 'employee_management', 3],
  ['project_management', 'Project Management', null, 4],
  ['pj_enquiry', 'Enquiries', 'project_management', 5],
  ['pj_projects', 'Projects & Tasks', 'project_management', 6],
  ['invoicing', 'Invoicing & Statement of Accounts', null, 7],
  ['inv_invoices', 'Invoices', 'invoicing', 8],
  ['inv_soa', 'Statement of Accounts', 'invoicing', 9],
  ['workforce_ai', 'AI Workforce Intelligence', null, 10],
].map(([id, name, parentId, sortOrder]) => ({
  id,
  name,
  description: '',
  active: true,
  sortOrder,
  category: 'hr',
  isCore: false,
  icon: '',
  dependsOn: [],
  parentId,
  __typename: 'AdminModuleType',
}));

const packagingFixtures = () => [
  {
    id: 'free',
    name: 'Free',
    active: true,
    billingInterval: 'monthly',
    perEmployee: false,
    pricingMode: 'fixed',
    bundleDiscountPct: 0,
    yearlyPriceCents: null,
    yearlyDiscountPct: 0,
    isPublic: true,
    version: 1,
    companiesCount: 1,
    subscribersCount: 1,
    outdatedSubscribersCount: 0,
    modules: [{ moduleId: 'employee_management', name: 'Core HR & Employee Management', category: 'hr', parentId: null, priceOverrideCents: null, unitCents: 0, __typename: 'AdminPlanModule' }],
    pricing: { currency: 'USD', monthlyPriceCents: 0, yearlyPriceCents: null, savingsPct: 0, availableIntervals: ['monthly'], __typename: 'AdminPlanPricing' },
    __typename: 'AdminPlan',
  },
  {
    id: 'premium',
    name: 'Premium',
    active: true,
    billingInterval: 'monthly',
    perEmployee: true,
    pricingMode: 'fixed',
    bundleDiscountPct: 0,
    yearlyPriceCents: null,
    yearlyDiscountPct: 0,
    isPublic: true,
    version: 2,
    companiesCount: 2,
    subscribersCount: 2,
    outdatedSubscribersCount: 1,
    modules: [
      { moduleId: 'employee_management', name: 'Core HR & Employee Management', category: 'hr', parentId: null, priceOverrideCents: null, unitCents: 0, __typename: 'AdminPlanModule' },
      { moduleId: 'pj_projects', name: 'Projects & Tasks', category: 'operations', parentId: 'project_management', priceOverrideCents: null, unitCents: 0, __typename: 'AdminPlanModule' },
    ],
    pricing: { currency: 'USD', monthlyPriceCents: 1200, yearlyPriceCents: null, savingsPct: 0, availableIntervals: ['monthly'], __typename: 'AdminPlanPricing' },
    __typename: 'AdminPlan',
  },
  {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    active: true,
    billingInterval: 'yearly',
    perEmployee: false,
    pricingMode: 'fixed',
    bundleDiscountPct: 0,
    yearlyPriceCents: null,
    yearlyDiscountPct: 0,
    isPublic: false,
    version: 1,
    companiesCount: 0,
    subscribersCount: 0,
    outdatedSubscribersCount: 0,
    modules: [{ moduleId: 'invoicing', name: 'Invoicing & Statement of Accounts', category: 'finance', parentId: null, priceOverrideCents: null, unitCents: 0, __typename: 'AdminPlanModule' }],
    pricing: { currency: 'USD', monthlyPriceCents: null, yearlyPriceCents: 12000, savingsPct: 0, availableIntervals: ['yearly'], __typename: 'AdminPlanPricing' },
    __typename: 'AdminPlan',
  },
];

const currencyFixtures = () => [
  { code: 'USD', name: 'US Dollar', symbol: '$', ratePerUsd: '1', roundTo: 0, active: true, isManual: true, source: 'base', decimals: 2 },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', ratePerUsd: '300', roundTo: 0, active: true, isManual: false, source: 'auto', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', ratePerUsd: '150', roundTo: 0, active: false, isManual: false, source: 'seed', decimals: 0 },
].map((row) => ({ ...row, updatedAt: pastIso(60), updatedBy: 'system', previewCents: null as number | null, __typename: 'AdminCurrencyRate' }));

function createMockGraphQLApi() {
  const api = {
    legacyRevenue: false,
    modules: moduleFixtures(),
    packaging: packagingFixtures(),
    currencies: currencyFixtures(),
    companyPackages: new Map<number, Record<string, unknown>>([
      [12, { companyId: 12, planId: 'premium', planName: 'Premium', billingInterval: 'monthly', planVersion: 1, latestVersion: 2, updateAvailable: true, activeModules: ['employee_management'], unrestricted: false, access: 'package', __typename: 'AdminCompanyPackage' }],
    ]),
    requests: new Map<string, Array<Record<string, any>>>(),
    /** Requests the backend schema would have refused (must stay empty). */
    schemaErrors: [] as string[],
    overrides: new Map<string, MockOverride>(),
    plans: planFixtures(),
    companies: [
      {
        id: 12,
        company: 'Acme Labs',
        planId: 'premium',
        planName: 'Premium',
        employeeCount: 42,
        createdAt: pastIso(60 * 24 * 30),
        isMultiLocationEnabled: true,
        subscriptionStatus: 'trial',
        trialEndsAt: futureIso(60 * 24 * 180),
        nextBillingDate: futureIso(60 * 24 * 180),
        nextBillingAmountCents: 50400,
        subscriptionDueDate: futureIso(60 * 24 * 180),
        subscriptionRecurringDate: futureIso(60 * 24 * 210),
        paymentHistoryCount: 1,
        latestPaymentStatus: 'succeeded',
        latestPaymentIntentId: 'pi_1',
        latestPaymentEmail: 'john@acme.com',
        latestPaymentAmount: 10000,
        latestPaymentPlanId: 'premium',
        latestPaymentPlanName: 'Premium',
        latestPaymentEmployeeCountSnapshot: 42,
        latestPaymentOriginalAmountCents: 50400,
        latestPaymentDiscountAmountCents: 0,
        latestPaymentFinalAmountCents: 50400,
        latestPaymentPromoCode: null,
        latestPaymentPromoLabel: null,
        latestPaymentCurrency: 'USD',
        latestPaymentSource: 'stripe',
        latestPaymentDeniedReason: 'insufficient_funds',
        latestPaymentGatewayMethod: 'card',
        latestPaymentGatewayRefReceiverMedium: 'BANK-11',
        latestPaymentGatewayRefSenderMedium: 'CARD-22',
        latestPaymentGatewayStatus: 'ok',
        latestPaymentCreatedAt: pastIso(60 * 24),
        __typename: 'Company',
      },
    ],
    payments: [
      {
        paymentIntentId: 'pi_1',
        email: 'john@acme.com',
        planId: 'premium',
        planName: 'Premium',
        employeeCountSnapshot: 42,
        originalAmountCents: 50400,
        discountAmountCents: 0,
        finalAmountCents: 0,
        promoCode: null,
        promoLabel: null,
        trialEndsAt: futureIso(60 * 24 * 180),
        amount: 0,
        currency: 'USD',
        status: 'pending',
        companyId: 12,
        companyName: 'Acme Labs',
        source: 'stripe',
        deniedReason: null,
        createdAt: pastIso(60 * 24),
        updatedAt: pastIso(60 * 24),
        dueDate: futureIso(60 * 24 * 180),
        recurringDate: futureIso(60 * 24 * 210),
        gatewayMethod: 'card',
        gatewayRefReceiverMedium: 'BANK-11',
        gatewayRefSenderMedium: 'CARD-22',
        gatewayPayload: JSON.stringify({ trace: 'abc-1' }),
        paymentGatewayStatus: 'trialing',
        __typename: 'Payment',
      },
    ],
    users: [
      {
        // AdminUserType.id is an Int on the server.
        id: 1,
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
        id: 2,
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
    ],
    activities: [
      {
        id: 'act-1',
        actor: 'admin',
        action: 'CREATE',
        targetType: 'customuser',
        targetId: '1',
        companyId: 12,
        userId: '1',
        details: '{"email":"john@acme.com","name":"John Doe"}',
        createdAt: pastIso(30),
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
        userId: '1',
        details: '{"status":"approved"}',
        createdAt: pastIso(20),
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
        userId: '2',
        details: '{"status":"removed"}',
        createdAt: pastIso(10),
        ipAddress: '127.0.0.1',
        userAgent: 'Playwright',
        __typename: 'UserActivity',
      },
    ],
    infrastructure: {
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
    } as Record<string, any>,
    expenses: [] as Array<Record<string, any>>,
    setOverride(operationName: string, override: MockOverride) {
      api.overrides.set(operationName, override);
    },
    lastVariables(operationName: string) {
      return api.requests.get(operationName)?.at(-1);
    },
  };

  return api;
}

function recordRequest(api: MockGraphQLApi, operationName: string, variables: Record<string, any>) {
  const requests = api.requests.get(operationName) ?? [];
  requests.push(variables);
  api.requests.set(operationName, requests);
}

function expenseFromInput(input: Record<string, any>) {
  const expense = createMockExpense({
    id: uniqueId('expense'),
    title: input.title,
    description: input.description ?? '',
    category: input.category,
    status: input.status ?? 'draft',
    vendor: input.vendor,
    projectCode: input.projectCode ?? null,
    serviceCode: input.serviceCode ?? null,
    incurredAt: input.incurredAt,
    dueAt: input.dueAt ?? null,
    currency: input.currency ?? 'USD',
    taxCents: input.taxCents ?? 0,
    invoiceNumber: input.invoiceNumber ?? null,
    invoiceDate: input.invoiceDate ?? null,
    referenceLink: input.referenceLink ?? null,
    tags: input.tags ?? [],
  });
  const lineItems = (input.lineItems ?? []).map((line: Record<string, any>, index: number) => {
    const unitPriceCents = Math.round(Number(line.unitPriceCents) * 100);
    return {
      ...expense.lineItems[0],
      id: `${expense.id}-line-${index + 1}`,
      expenseId: expense.id,
      lineType: line.lineType,
      label: line.label,
      quantity: Number(line.quantity),
      unitPriceCents,
      costCents: Math.round(Number(line.quantity) * unitPriceCents),
      unit: line.unit ?? null,
      notes: line.notes ?? null,
    };
  });
  const subtotalCents = lineItems.reduce((sum: number, line: Record<string, any>) => sum + line.costCents, 0);
  return {
    ...expense,
    lineItems,
    subtotalCents,
    totalCents: subtotalCents + Number(input.taxCents ?? 0),
  };
}

async function defaultResponse(payload: GraphQLPayload, api: MockGraphQLApi) {
  const operationName = payload.operationName ?? '';
  const variables = payload.variables ?? {};

  switch (operationName) {
    case 'SuperAdminLogin':
      return {
        data: {
          superAdminTokenAuth: {
            success: true,
            message: 'ok',
            token: 'e2e-token',
            expiresAt: futureIso(60),
            superAdmin: {
              id: '1',
              username: String(variables.username ?? 'admin').trim(),
              email: 'admin@example.com',
              isActive: true,
              lastLogin: pastIso(60),
              __typename: 'SuperAdmin',
            },
            __typename: 'SuperAdminTokenAuthPayload',
          },
        },
      };
    case 'AdminRevenueSummary': {
      const summary: Record<string, unknown> = {
        totalCompanies: 2,
        totalUsers: 7,
        totalPayments: 4,
        grossRevenue: 120000,
        totalExpenses: api.legacyRevenue ? null : 500,
        netRevenue: api.legacyRevenue ? null : 119500,
        byStatus: [
          { status: 'succeeded', count: 2, amount: 90000, __typename: 'PaymentStatusSummary' },
          { status: 'pending', count: 1, amount: 2000, __typename: 'PaymentStatusSummary' },
        ],
        expenseByCategory: [],
        expenseByVendor: [],
        __typename: 'RevenueSummary',
      };
      return { data: { adminRevenueSummary: summary } };
    }
    case 'AdminPlans':
      return { data: { adminPlans: api.plans } };
    case 'AdminPackageModules':
      return { data: { adminModules: api.modules } };
    case 'AdminPlansPackaging':
      return { data: { adminPlans: api.packaging } };
    case 'AdminCompanyPackages': {
      const ids: number[] = variables.companyIds ?? [];
      const rows = ids.map((id) => api.companyPackages.get(id) ?? {
        companyId: id, planId: null, planName: null, billingInterval: null, planVersion: 0, latestVersion: null,
        updateAvailable: false, activeModules: [], unrestricted: true, access: 'legacy', __typename: 'AdminCompanyPackage',
      });
      return { data: { adminCompanyPackages: rows } };
    }
    case 'AdminApplyPlanToSubscribers': {
      const companies = [
        { companyId: 12, companyName: 'Acme Labs', currentVersion: 1, wasUnrestricted: false, gains: ['pj_projects'], losses: [], __typename: 'AdminSubscriberChange' },
        // Pre-package companies only when the admin opts in (includeUnrestricted).
        ...(variables.includeUnrestricted
          ? [{ companyId: 13, companyName: 'Legacy Co', currentVersion: 0, wasUnrestricted: true, gains: [], losses: ['invoicing', 'inv_invoices', 'inv_soa'], __typename: 'AdminSubscriberChange' }]
          : []),
      ];
      return {
        data: {
          adminApplyPlanToSubscribers: {
            success: true,
            message: 'ok',
            dryRun: variables.dryRun !== false,
            appliedCount: variables.dryRun === false ? companies.length : 0,
            companies,
            __typename: 'AdminApplyPlanToSubscribersPayload',
          },
        },
      };
    }
    case 'AdminCurrencyRates': {
      const preview = variables.previewUsdCents ?? 0;
      return {
        data: {
          adminCurrencyRates: {
            baseCurrency: 'USD',
            lastRefreshedAt: pastIso(120),
            sourceUrl: 'https://open.er-api.com/v6/latest/USD',
            rates: api.currencies.map((row) => ({
              ...row,
              previewCents: row.decimals === 0
                ? Math.ceil((preview / 100) * Number(row.ratePerUsd))
                : Math.ceil(preview * Number(row.ratePerUsd)),
            })),
            __typename: 'AdminCurrencyRates',
          },
        },
      };
    }
    case 'AdminSaveCurrencyRate': {
      const code = String(variables.code).toUpperCase();
      let row = api.currencies.find((item) => item.code === code);
      if (!row) {
        row = { ...currencyFixtures()[1], code, name: '', symbol: '', source: 'manual' };
        api.currencies.push(row);
      }
      if (variables.active !== undefined && variables.active !== null) row.active = variables.active;
      if (variables.ratePerUsd) row.ratePerUsd = variables.ratePerUsd;
      if (variables.isManual !== undefined && variables.isManual !== null) row.isManual = variables.isManual;
      return {
        data: {
          adminSaveCurrencyRate: { success: true, message: 'saved', rate: row, __typename: 'AdminSaveCurrencyRatePayload' },
        },
      };
    }
    case 'AdminRefreshCurrencyRates':
      return {
        data: {
          adminRefreshCurrencyRates: {
            success: true, message: 'Updated 1 currency(s).', updated: ['LKR'], skipped: [], pinned: [], missing: [],
            __typename: 'AdminRefreshCurrencyRatesPayload',
          },
        },
      };
    case 'AdminPromoCodes':
      return { data: { adminPromoCodes: [] } };
    case 'AdminSavePlan': {
      const input = variables.input;
      const existing = api.plans.findIndex((plan) => plan.id === input.id);
      const plan = {
        ...(existing >= 0 ? api.plans[existing] : {}),
        ...input,
        updatedAt: new Date().toISOString(),
        updatedBy: { id: '1', username: 'admin', __typename: 'SuperAdmin' },
        __typename: 'Plan',
        version: 2,
        outdatedSubscribersCount: input.id === 'premium' ? 1 : 0,
      };
      if (existing >= 0) api.plans[existing] = plan;
      else api.plans.push(plan);
      return {
        data: {
          adminSavePlan: {
            success: true,
            message: 'Plan saved',
            plan,
            __typename: 'AdminSavePlanPayload',
          },
        },
      };
    }
    case 'AdminCompanies':
      return { data: { adminCompanies: api.companies } };
    case 'AdminCompanyPaymentHistory':
      return { data: { adminCompanyPaymentHistory: api.payments } };
    case 'AdminPayments':
      return { data: { adminPayments: api.payments } };
    case 'AdminAssignCompanyPlan': {
      const company = api.companies.find((item) => item.id === variables.companyId);
      if (company) {
        company.planId = variables.planId;
        company.planName = variables.planId === 'free' ? 'Free' : 'Premium';
      }
      return {
        data: {
          adminAssignCompanyPlan: {
            success: true,
            message: 'Company plan assigned',
            company,
            __typename: 'AdminAssignCompanyPlanPayload',
          },
        },
      };
    }
    case 'AdminUpdateCompanyDetail':
      return {
        data: {
          adminUpdateCompanyDetail: {
            success: true,
            message: 'Company updated',
            company: api.companies[0],
            __typename: 'AdminUpdateCompanyDetailPayload',
          },
        },
      };
    case 'AdminUsers':
      return { data: { adminUsers: api.users } };
    case 'AdminUpdateUser':
      return {
        data: {
          adminUpdateUser: {
            success: true,
            message: 'User updated',
            user: { ...api.users[0], ...variables },
            __typename: 'AdminUpdateUserPayload',
          },
        },
      };
    case 'AdminUserActivityLogs': {
      const logs = api.activities.filter((activity) => {
        if (variables.userId && String(activity.userId) !== String(variables.userId)) return false;
        if (variables.companyId && activity.companyId !== variables.companyId) return false;
        return true;
      });
      return { data: { adminUserActivityLogs: logs } };
    }
    case 'AdminInfrastructure':
      return {
        data: {
          adminInfrastructure:
            api.infrastructure[String(variables.period ?? '30d')] ?? api.infrastructure['30d'],
        },
      };
    case 'AdminAccountsReport':
      return {
        data: {
          adminAccountsReport: [
            {
              period: '2026-07',
              income: 50000,
              expense: 16000,
              net: 34000,
              currency: 'USD',
              __typename: 'AccountsReportRow',
            },
          ],
        },
      };
    case 'AdminExpenses': {
      const search = String(variables.filter?.search ?? '').toLowerCase();
      const items = search
        ? api.expenses.filter((expense) => String(expense.title).toLowerCase().includes(search))
        : api.expenses;
      return {
        data: {
          adminExpenses: {
            totalCount: items.length,
            items,
            __typename: 'ExpenseFeed',
          },
        },
      };
    }
    case 'AdminExpenseById':
      return {
        data: {
          adminExpenseById: api.expenses.find((expense) => expense.id === variables.id) ?? null,
        },
      };
    case 'AdminCreateExpense': {
      const expense = expenseFromInput(variables.input);
      api.expenses.unshift(expense);
      return {
        data: {
          adminCreateExpense: {
            success: true,
            message: 'Expense created',
            expense,
            __typename: 'ExpensePayload',
          },
        },
      };
    }
    case 'AdminUpdateExpense': {
      const index = api.expenses.findIndex((expense) => expense.id === variables.input.id);
      if (index >= 0) {
        api.expenses[index] = {
          ...api.expenses[index],
          ...variables.input,
          updatedAt: new Date().toISOString(),
        };
      }
      return {
        data: {
          adminUpdateExpense: {
            success: true,
            message: 'Expense updated',
            expense: api.expenses[index],
            __typename: 'ExpensePayload',
          },
        },
      };
    }
    case 'AdminSetExpenseStatus': {
      const index = api.expenses.findIndex((expense) => expense.id === variables.input.id);
      if (index >= 0) api.expenses[index].status = variables.input.status;
      return {
        data: {
          adminSetExpenseStatus: {
            success: true,
            message: `Status updated to ${variables.input.status}`,
            expense: api.expenses[index],
            __typename: 'ExpensePayload',
          },
        },
      };
    }
    default:
      return { data: {} };
  }
}

export async function installGraphQLMock(page: Page, api = createMockGraphQLApi()) {
  await page.route('**/graphql/', async (route) => {
    let payload: GraphQLPayload = {};
    try {
      payload = JSON.parse(route.request().postData() ?? '{}');
    } catch {
      payload = {};
    }

    const operationName = payload.operationName ?? '';
    recordRequest(api, operationName, payload.variables ?? {});
    const problems = checkRequest(payload.query ?? '', payload.variables, payload.operationName);
    if (problems.length) {
      api.schemaErrors.push(`${operationName || '(anonymous)'}: ${problems.join(' | ')}`);
      await json(route, { errors: problems.map((message) => ({ message })) });
      return;
    }
    const override = api.overrides.get(operationName);
    const response = override
      ? typeof override === 'function'
        ? await override(payload, api)
        : override
      : await defaultResponse(payload, api);
    await json(route, response);
  });

  return api;
}

type Fixtures = {
  mockApi: MockGraphQLApi;
  adminPage: Page;
};

export const test = base.extend<Fixtures>({
  mockApi: async ({ page }, use) => {
    const api = await installGraphQLMock(page);
    await use(api);
    expect(api.schemaErrors, 'GraphQL requests the backend schema would refuse').toEqual([]);
  },
  adminPage: async ({ page, mockApi: _mockApi }, use) => {
    await loginAsAdmin(page);
    await use(page);
  },
});

export { expect };
