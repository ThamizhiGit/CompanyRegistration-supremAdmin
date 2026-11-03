import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { Dashboard } from '../../src/components/admin/pages/Dashboard';
import { ADMIN_REVENUE_SUMMARY_QUERY } from '../../src/lib/graphql';
import { apollo, delayed } from '../fixtures/operations-test-utils';

test.describe('Dashboard', () => {
  test('covers loading, GraphQL error, and missing data', async ({ mount }) => {
    const loading = await mount(apollo(<Dashboard />, [
      delayed({ request: { query: ADMIN_REVENUE_SUMMARY_QUERY }, result: { data: {} } }),
    ]));
    await expect(loading.getByText('Loading dashboard...')).toBeVisible();
    await loading.unmount();

    const failed = await mount(apollo(<Dashboard />, [{
      request: { query: ADMIN_REVENUE_SUMMARY_QUERY },
      result: { errors: [{ message: 'revenue unavailable' }] },
    }]));
    await expect(failed.getByRole('heading', { name: 'Error Loading Dashboard' })).toBeVisible();
    await expect(failed.getByText('revenue unavailable')).toBeVisible();
    await failed.unmount();

    const empty = await mount(apollo(<Dashboard />, [{
      request: { query: ADMIN_REVENUE_SUMMARY_QUERY },
      result: { data: { adminRevenueSummary: null } },
    }]));
    await expect(empty.getByText('No data available')).toBeVisible();
  });

  test('renders metrics, derives net revenue, and shows status rows', async ({ mount }) => {
    const component = await mount(apollo(<Dashboard />, [{
      request: { query: ADMIN_REVENUE_SUMMARY_QUERY },
      result: {
        data: {
          adminRevenueSummary: {
            totalCompanies: 8,
            totalUsers: 23,
            totalPayments: 17,
            grossRevenue: 500_000,
            totalExpenses: 125_000,
            netRevenue: null,
            refundedRevenue: 0,
            approximate: false,
            unconvertedCurrencies: [],
            revenueByCurrency: [{ currency: 'USD', gross: 500_000, refunded: 0, net: 500_000 }],
            expensesByCurrency: [{ currency: 'USD', gross: 125_000, refunded: 0, net: 125_000 }],
            byStatus: [
              { status: 'succeeded', currency: 'USD', count: 15, amount: 450_000 },
              { status: 'failed', currency: 'USD', count: 2, amount: 50_000 },
            ],
            expenseByCategory: [],
            expenseByVendor: [],
          },
        },
      },
    }]));

    await expect(component.getByText('Companies').locator('..').getByText('8')).toBeVisible();
    await expect(component.getByText('$5,000.00')).toBeVisible();
    await expect(component.getByText('$1,250.00')).toBeVisible();
    await expect(component.getByText('$3,750.00')).toBeVisible();
    await expect(component.getByRole('heading', { name: 'Payment Status Breakdown' })).toBeVisible();
    await expect(component.getByRole('row', { name: /failed 2 \$500\.00/ })).toBeVisible();
    await expect(component.getByTestId('fx-note')).toHaveCount(0);
  });

  test('shows each currency on its own line, net of refunds, and labels the USD total approximate', async ({ mount }) => {
    const component = await mount(apollo(<Dashboard />, [{
      request: { query: ADMIN_REVENUE_SUMMARY_QUERY },
      result: {
        data: {
          adminRevenueSummary: {
            totalCompanies: 3,
            totalUsers: 9,
            totalPayments: 3,
            grossRevenue: 4_700,
            refundedRevenue: 300,
            totalExpenses: 0,
            netRevenue: 4_700,
            approximate: true,
            unconvertedCurrencies: ['XTS'],
            revenueByCurrency: [
              { currency: 'EUR', gross: 2_000, refunded: 0, net: 2_000 },
              { currency: 'USD', gross: 1_000, refunded: 300, net: 700 },
            ],
            expensesByCurrency: [],
            byStatus: [
              { status: 'succeeded', currency: 'EUR', count: 1, amount: 2_000 },
              { status: 'succeeded', currency: 'USD', count: 1, amount: 1_000 },
            ],
            expenseByCategory: [],
            expenseByVendor: [],
          },
        },
      },
    }]));
    await expect(component.getByText('≈ $47.00').first()).toBeVisible();
    const lines = component.getByTestId('currency-lines-Gross Revenue');
    await expect(lines).toContainText('€20.00');
    await expect(lines).toContainText('$7.00');
    await expect(component.getByTestId('fx-note')).toContainText('Not included (no rate): XTS.');
    // Status rows keep their currency: never two currencies added in one cell.
    await expect(component.getByRole('row', { name: /succeeded 1 €20\.00/ })).toBeVisible();
    await expect(component.getByRole('row', { name: /succeeded 1 \$10\.00/ })).toBeVisible();
  });
});
