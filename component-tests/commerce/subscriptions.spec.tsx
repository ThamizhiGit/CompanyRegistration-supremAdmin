import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { type MockedResponse } from '@apollo/client/testing';
import { SubscriptionsHarness } from '../fixtures/commerce-harnesses';
import { feedResult, paymentFeedVariables } from '../fixtures/paging';
import { ADMIN_PAYMENTS_FEED_QUERY } from '../../src/lib/graphql';
import { ADMIN_LIST_PAGE_SIZE } from '../../src/lib/useAllPagesQuery';

const payment = {
  paymentIntentId: 'pi_42',
  email: 'pay@orbit.test',
  planId: 'premium',
  planName: 'Premium',
  employeeCountSnapshot: 20,
  originalAmountCents: 5000,
  finalAmountCents: 5000,
  trialEndsAt: '2026-08-15T00:00:00.000Z',
  amount: 5000,
  currency: 'USD',
  status: 'pending',
  companyId: 42,
  companyName: 'Orbit Works',
  source: 'portal',
  deniedReason: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  dueDate: '2026-08-01T10:00:00.000Z',
  recurringDate: '2026-09-01T10:00:00.000Z',
  gatewayMethod: 'paypal',
  gatewayRefReceiverMedium: 'merchant@orbit.test',
  gatewayRefSenderMedium: 'payer@orbit.test',
  paymentGatewayStatus: 'pending',
};

const paymentsMock = (items: unknown[], delay?: number, extra: { totalCount?: number; facets?: unknown[] } = {}): MockedResponse => ({
  request: { query: ADMIN_PAYMENTS_FEED_QUERY, variables: paymentFeedVariables() },
  ...(delay ? { delay } : {}),
  result: feedResult('adminPaymentsFeed', items, extra),
});

/** One "Export all" page (200 rows at a time). */
const exportPage = (page: number, items: unknown[], totalCount: number, delay?: number): MockedResponse => ({
  request: { query: ADMIN_PAYMENTS_FEED_QUERY, variables: paymentFeedVariables({}, page, ADMIN_LIST_PAGE_SIZE) },
  ...(delay ? { delay } : {}),
  result: feedResult('adminPaymentsFeed', items, { totalCount }),
});
const manyPayments = (count: number, from = 0) =>
  Array.from({ length: count }, (_, index) => ({ ...payment, paymentIntentId: `pi_bulk_${from + index}` }));

test.describe('commerce / subscriptions', () => {
  test('covers loading, render, search filtering, and empty data', async ({ mount }) => {
    const loading = await mount(<SubscriptionsHarness scenario="loading" />);
    await expect(loading.getByText('Loading subscriptions...')).toBeVisible();
    await loading.unmount();
    const component = await mount(<SubscriptionsHarness scenario="data" />);
    await expect(component.getByText('Orbit Works', { exact: true })).toBeVisible();
    await component.getByPlaceholder('Search company, plan, email...').fill('unknown');
    await expect(component.getByText('No payments match your filters')).toBeVisible();
    await component.unmount();

    const empty = await mount(<SubscriptionsHarness scenario="empty" />);
    await expect(empty.getByText('No payments found')).toBeVisible();
  });

  test('renders the payments query error', async ({ mount }) => {
    const component = await mount(
      <SubscriptionsHarness scenario="error" />,
    );
    await expect(component.getByText('Error: payments unavailable')).toBeVisible();
  });

  test('opens the responsive subscription payment detail', async ({ mount }) => {
    const component = await mount(<SubscriptionsHarness scenario="data" />);

    await component.getByTitle('View subscription').click();
    await expect(component.getByRole('heading', { name: 'Subscription Payment Detail' })).toBeVisible();
    await expect(component.getByRole('heading', { name: 'Company information' })).toBeVisible();
    await expect(component.getByRole('heading', { name: 'Payment information' })).toBeVisible();
    await expect(component.getByRole('heading', { name: 'Billing schedule' })).toBeVisible();
    await expect(component.getByRole('heading', { name: 'Gateway information' })).toBeVisible();
    await expect(component.getByRole('button', { name: 'Edit Payment' })).toBeVisible();
  });

  test('status, plan and gateway filter options come from the server facets and filter there', async ({ mount, page }) => {
    const facets = [
      { field: 'status', value: 'pending', label: null, count: 3 },
      { field: 'status', value: 'failed', label: null, count: 1 },
    ];
    const component = await mount(
      <SubscriptionsHarness
        mocks={[
          paymentsMock([payment], undefined, { totalCount: 4, facets }),
          {
            request: { query: ADMIN_PAYMENTS_FEED_QUERY, variables: paymentFeedVariables({ status: ['failed'] }) },
            result: feedResult('adminPaymentsFeed', [{ ...payment, paymentIntentId: 'pi_failed', status: 'failed' }], { totalCount: 1, facets }),
          },
        ]}
      />,
    );
    await component.getByTitle('Status filter').click();
    await expect(page.getByLabel('pending')).toBeVisible();
    await page.getByLabel('failed').check();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(component.getByTestId('pager-summary')).toHaveText(/1–1 of 1 payments/);
  });

  test('"Export all" reads every page of the filter, 200 at a time', async ({ mount }) => {
    const component = await mount(
      <SubscriptionsHarness
        mocks={[
          paymentsMock([payment], undefined, { totalCount: 250 }),
          exportPage(0, manyPayments(200), 250),
          exportPage(1, manyPayments(50, 200), 250),
        ]}
      />,
    );
    await component.getByRole('button', { name: 'Export all' }).click();
    await expect(component.getByLabel('toast')).toHaveText('success: Excel file downloaded successfully!');
  });

  test('"Export all" can be cancelled and then reports nothing', async ({ mount, page }) => {
    const component = await mount(
      <SubscriptionsHarness
        mocks={[
          paymentsMock([payment], undefined, { totalCount: 250 }),
          exportPage(0, manyPayments(200), 250, 1200),
          exportPage(1, manyPayments(50, 200), 250),
        ]}
      />,
    );
    await component.getByRole('button', { name: 'Export all' }).click();
    await component.getByRole('button', { name: 'Cancel export' }).click();
    await expect(component.getByRole('button', { name: 'Export all' })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);
    await expect(component.getByLabel('toast')).toHaveText('');
  });

  test('a card payment cannot be marked refunded by hand', async ({ mount }) => {
    const card = { ...payment, paymentIntentId: 'pi_card', source: 'stripe', status: 'succeeded' };
    const component = await mount(<SubscriptionsHarness mocks={[paymentsMock([card])]} />);
    await component.getByTitle('Edit subscription').click();
    await expect(component.getByRole('heading', { name: 'Edit Subscription Payment' })).toBeVisible();
    await expect(component.locator('option[value="refunded"]')).toHaveCount(0);
  });

  test('opens all subscription administration actions and validates their required reasons', async ({ mount }) => {
    const component = await mount(<SubscriptionsHarness scenario="data" />);
    await component.getByTitle('Edit subscription').click();
    await expect(component.getByRole('heading', { name: 'Edit Subscription Payment' })).toBeVisible();

    await component.getByRole('button', { name: 'Save due date' }).click();
    await expect(component.getByLabel('toast')).toHaveText('error: Reason is required to change due date');

    await component.getByRole('button', { name: 'Suspend', exact: true }).click();
    await expect(component.getByLabel('toast')).toHaveText('error: Reason is required to suspend a company');

    await component.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(component.getByLabel('toast')).toHaveText('error: Reason is required to resume a company');

    await component.getByRole('button', { name: /Record manual payment/ }).click();
    await expect(component.getByLabel('toast')).toHaveText('error: Reason is required to record a manual payment');
  });
});
