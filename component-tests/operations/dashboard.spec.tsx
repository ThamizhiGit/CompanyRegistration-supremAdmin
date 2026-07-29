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
            byStatus: [
              { status: 'succeeded', count: 15, amount: 450_000 },
              { status: 'failed', count: 2, amount: 50_000 },
            ],
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
  });
});
