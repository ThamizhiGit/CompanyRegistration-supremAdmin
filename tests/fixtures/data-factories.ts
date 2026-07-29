export type ExpenseCategory = 'hosting' | 'service' | 'integration' | 'llm' | 'other';

export type ExpenseFormData = {
  title: string;
  vendor: string;
  category: ExpenseCategory;
  categoryLabel: string;
  expenseDateLocal: string;
};

let sequence = 0;

export const uniqueId = (prefix: string) => {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
};

export const futureIso = (minutes = 60) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

export const pastIso = (minutes = 60) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

export const localDateTime = (date = new Date()) =>
  date.toISOString().slice(0, 16);

export const createExpenseFormData = (): ExpenseFormData => {
  const runId = Date.now() + sequence;
  const categories = [
    { value: 'hosting', label: 'Hosting' },
    { value: 'service', label: 'Service' },
    { value: 'integration', label: 'Integration' },
    { value: 'other', label: 'Other' },
  ] as const;
  const selected = categories[runId % categories.length];

  return {
    title: `DigitalOcean App Platform ${selected.label} ${uniqueId('expense')}`,
    vendor: `DigitalOcean E2E ${uniqueId('vendor')}`,
    category: selected.value,
    categoryLabel: selected.label,
    expenseDateLocal: localDateTime(new Date(Date.now() + 60_000)),
  };
};

export const createMockExpense = (overrides: Record<string, unknown> = {}) => {
  const id = uniqueId('expense');
  const now = new Date().toISOString();

  return {
    id,
    expenseRef: `EXP-${id.slice(-6).toUpperCase()}`,
    title: 'DigitalOcean App Platform hosting',
    description: 'App Platform hosting stack for tests.',
    category: 'hosting',
    status: 'draft',
    vendor: 'DigitalOcean',
    projectCode: 'SUPREME-DASHBOARD',
    serviceCode: 'APP-PLATFORM',
    incurredAt: now,
    dueAt: null,
    paidAt: null,
    currency: 'USD',
    subtotalCents: 500,
    taxCents: 0,
    totalCents: 500,
    createdAt: now,
    updatedAt: now,
    createdBy: 'admin',
    approvedBy: null,
    invoiceNumber: null,
    invoiceDate: null,
    referenceLink: 'https://www.digitalocean.com/products/app-platform',
    tags: ['hosting', 'paas', 'digitalocean'],
    metadata: null,
    lineItems: [
      {
        id: `${id}-line-1`,
        expenseId: id,
        lineType: 'hosting',
        label: 'App Platform backend container',
        quantity: 1,
        unitPriceCents: 500,
        costCents: 500,
        unit: 'month',
        notes: 'Backend component charge.',
        llmProvider: null,
        llmModel: null,
        inputTokens: null,
        outputTokens: null,
        __typename: 'ExpenseLineItem',
      },
    ],
    __typename: 'Expense',
    ...overrides,
  };
};

export async function fillExpenseForm(page: Page, expense: ExpenseFormData) {
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
}
import { expect, type Page } from '@playwright/test';
