import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { Expenses } from '../../src/components/admin/pages/Expenses';
import { ADMIN_EXPENSES_QUERY } from '../../src/lib/graphql';
import { apollo, delayed } from '../fixtures/operations-test-utils';

const initialFilter = {
  search: null,
  category: null,
  status: null,
  vendor: null,
  projectCode: null,
  currency: null,
  fromDate: null,
  toDate: null,
  limit: 10,
  offset: 0,
  minTotalCents: null,
  maxTotalCents: null,
};
const initialSort = { field: 'incurredAt', direction: 'desc' };

const expense = (overrides: Record<string, unknown> = {}) => ({
  id: 'expense-1',
  expenseRef: 'EXP-001',
  title: 'Cloud hosting',
  description: 'Production infrastructure',
  category: 'hosting',
  status: 'draft',
  vendor: 'AWS',
  projectCode: 'PLATFORM',
  serviceCode: 'EC2',
  incurredAt: '2026-07-20T12:00:00.000Z',
  dueAt: null,
  paidAt: null,
  currency: 'USD',
  subtotalCents: 10_000,
  taxCents: 500,
  totalCents: 10_500,
  createdAt: '2026-07-20T12:00:00.000Z',
  updatedAt: '2026-07-20T12:00:00.000Z',
  createdBy: 'admin',
  approvedBy: null,
  invoiceNumber: null,
  invoiceDate: null,
  referenceLink: null,
  tags: ['infra'],
  metadata: null,
  lineItems: [{
    id: 'line-1',
    expenseId: 'expense-1',
    lineType: 'hosting',
    label: 'EC2 compute',
    quantity: 1,
    unitPriceCents: 10_000,
    costCents: 10_000,
    unit: 'month',
    notes: null,
    llmProvider: null,
    llmModel: null,
    inputTokens: null,
    outputTokens: null,
  }],
  ...overrides,
});

const expensesMock = (items: unknown[], totalCount = items.length, offset = 0) => ({
  request: {
    query: ADMIN_EXPENSES_QUERY,
    variables: {
      filter: { ...initialFilter, offset },
      sort: initialSort,
    },
  },
  result: { data: { adminExpenses: { items, totalCount } } },
});

test.describe('Expenses', () => {
  test('covers loading, GraphQL error, and empty feed', async ({ mount }) => {
    const loading = await mount(apollo(<Expenses onToast={() => {}} />, [
      delayed(expensesMock([])),
    ]));
    await expect(loading.getByText('Loading expenses...')).toBeVisible();
    await loading.unmount();

    const failed = await mount(apollo(<Expenses onToast={() => {}} />, [{
      request: {
        query: ADMIN_EXPENSES_QUERY,
        variables: { filter: initialFilter, sort: initialSort },
      },
      result: { errors: [{ message: 'expenses unavailable' }] },
    }]));
    await expect(failed.getByText('Error: expenses unavailable')).toBeVisible();
    await failed.unmount();

    const empty = await mount(apollo(<Expenses onToast={() => {}} />, [expensesMock([])]));
    await expect(empty.getByText('No expenses recorded yet')).toBeVisible();
    await expect(empty.getByText('Showing 0 - 0 of 0')).toBeVisible();
  });

  test('filters the current page by vendor and clears the filter', async ({ mount, page }) => {
    const component = await mount(apollo(<Expenses onToast={() => {}} />, [
      expensesMock([
        expense(),
        expense({
          id: 'expense-2',
          expenseRef: 'EXP-002',
          title: 'Model tokens',
          category: 'llm',
          vendor: 'OpenAI',
          projectCode: 'AI',
          status: 'approved',
          totalCents: 7_500,
        }),
      ]),
    ]));

    await component.getByTitle('Vendor filter').click();
    await page.getByLabel('OpenAI').check();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(component.getByRole('row', { name: /Model tokens/ })).toBeVisible();
    await expect(component.getByText('Cloud hosting')).toHaveCount(0);

    await component.getByRole('button', { name: 'Clear filters' }).click();
    await expect(component.getByText('Cloud hosting')).toBeVisible();
    await expect(component.getByText('Model tokens')).toBeVisible();
  });

  test('requests the next page with the correct offset', async ({ mount }) => {
    const component = await mount(apollo(<Expenses onToast={() => {}} />, [
      expensesMock([expense()], 15),
      expensesMock([
        expense({ id: 'expense-11', expenseRef: 'EXP-011', title: 'Page two expense' }),
      ], 15, 10),
    ]));

    await expect(component.getByText('Page 1 / 2')).toBeVisible();
    await component.getByRole('button', { name: 'Next' }).click();
    await expect(component.getByText('Page 2 / 2')).toBeVisible();
    await expect(component.getByText('Page two expense')).toBeVisible();
    await expect(component.getByText('Showing 11 - 15 of 15')).toBeVisible();
  });

  test('validates required fields and LLM-specific line-item fields', async ({ mount }) => {
    const toasts: Array<{ type: string; message: string }> = [];
    const component = await mount(apollo(
      <Expenses onToast={(type, message) => toasts.push({ type, message })} />,
      [expensesMock([])],
    ));

    await component.getByRole('button', { name: 'New Expense' }).first().click();
    await component.getByRole('button', { name: 'Save Expense' }).click();
    await expect.poll(() => toasts).toEqual([{
      type: 'error',
      message: 'Please fix validation errors in the form',
    }]);
    await expect(component.getByPlaceholder('AWS monthly hosting')).toHaveClass(/border-rose-300/);
    await expect(component.getByPlaceholder('AWS, OpenAI, Stripe')).toHaveClass(/border-rose-300/);
    await expect(component.getByPlaceholder('e.g. EC2 compute, GPT tokens')).toHaveClass(/border-rose-300/);

    await component.getByPlaceholder('AWS monthly hosting').fill('AI inference');
    await component.getByPlaceholder('AWS, OpenAI, Stripe').fill('OpenAI');
    await component.getByLabel('Cost type').selectOption('llm');
    await component.getByPlaceholder('e.g. EC2 compute, GPT tokens').fill('GPT tokens');
    await component.getByRole('button', { name: 'Save Expense' }).click();
    await expect(component.getByPlaceholder('OpenAI, Anthropic')).toHaveClass(/border-rose-300/);
    await expect(component.getByPlaceholder('gpt-4.1, claude-sonnet')).toHaveClass(/border-rose-300/);
  });

  test('adds and removes line items while preserving at least one row', async ({ mount }) => {
    const component = await mount(apollo(<Expenses onToast={() => {}} />, [expensesMock([])]));
    await component.getByRole('button', { name: 'New Expense' }).first().click();

    await expect(component.getByText('Cost type')).toHaveCount(1);
    await component.getByRole('button', { name: 'Add line item' }).click();
    await expect(component.getByText('Cost type')).toHaveCount(2);

    const removeButtons = component.locator('button.bg-rose-50');
    await removeButtons.last().click();
    await expect(component.getByText('Cost type')).toHaveCount(1);
    await removeButtons.first().click();
    await expect(component.getByText('Cost type')).toHaveCount(1);
  });

  test('hydrates the edit form and exposes valid status transitions', async ({ mount }) => {
    const component = await mount(apollo(<Expenses onToast={() => {}} />, [
      expensesMock([expense()]),
    ]));

    await component.getByRole('row', { name: /Cloud hosting/ }).getByTitle('Edit').click();
    await expect(component.getByRole('heading', { name: 'Edit Expense' })).toBeVisible();
    await expect(component.getByLabel('Expense title')).toHaveValue('Cloud hosting');
    await expect(component.getByLabel('Vendor')).toHaveValue('AWS');
    await expect(component.getByPlaceholder('e.g. EC2 compute, GPT tokens')).toHaveValue('EC2 compute');
    await component.getByLabel('Status').selectOption('pending');
    await expect(component.getByLabel('Status')).toHaveValue('pending');
    await expect(component.getByRole('button', { name: 'Update Expense' })).toBeVisible();
  });
});
