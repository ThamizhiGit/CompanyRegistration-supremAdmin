import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { Accounts } from '../../src/components/admin/pages/Accounts';
import {
  ADMIN_ACCOUNTS_REPORT_QUERY,
  ADMIN_INFRASTRUCTURE_QUERY,
} from '../../src/lib/graphql';
import { apollo, delayed } from '../fixtures/operations-test-utils';

const infrastructure = {
  income: 250_000,
  expense: 90_000,
  net: 160_000,
  period: 'Last 30 days',
  pendingBalance: 12_500,
  failedRefunds: 2,
  byDay: [{ date: '2026-07-20', income: 30_000, expense: 8_000 }],
};

test.describe('Accounts reports', () => {
  const current = new Date();
  const year = current.getFullYear();
  const month = current.getMonth() + 1;
  const report = {
    period: 'monthly',
    year,
    month,
    groupBy: 'day',
    income: 400_000,
    expense: 150_000,
    net: 250_000,
    pendingBalance: 20_000,
    failedRefunds: 0,
    rows: [
      { label: '2026-07-20', income: 100_000, expense: 20_000, net: 80_000 },
      { label: '2026-07-01', income: 50_000, expense: 40_000, net: 10_000 },
    ],
  };

  test('opens monthly and annual tabs, renders rows, sorts, and handles no rows', async ({ mount }) => {
    const component = await mount(apollo(<Accounts onToast={() => {}} />, [
      {
        request: { query: ADMIN_INFRASTRUCTURE_QUERY, variables: { period: '30d' } },
        result: { data: { adminInfrastructure: infrastructure } },
      },
      {
        request: {
          query: ADMIN_ACCOUNTS_REPORT_QUERY,
          variables: { period: 'monthly', year, month, groupBy: null },
        },
        result: { data: { adminAccountsReport: report } },
      },
      {
        request: {
          query: ADMIN_ACCOUNTS_REPORT_QUERY,
          variables: { period: 'annual', year, month: null, groupBy: null },
        },
        result: {
          data: {
            adminAccountsReport: { ...report, period: 'annual', month: null, rows: [] },
          },
        },
      },
    ]));

    await component.getByRole('button', { name: 'Monthly Reports' }).click();
    await expect(component.getByText('$4,000.00')).toBeVisible();
    const rows = component.locator('tbody tr');
    await expect(rows.first()).toContainText('2026-07-01');
    await component.getByRole('button', { name: /Period/ }).click();
    await expect(rows.first()).toContainText('2026-07-20');

    await component.getByRole('button', { name: 'Annual Reports' }).click();
    await expect(component.getByText('No report rows available')).toBeVisible();
    await expect(component.getByRole('button', { name: 'Excel' })).toBeEnabled();
    await expect(component.getByRole('button', { name: 'PDF' })).toBeEnabled();
  });

  test('shows report loading and error states', async ({ mount }) => {
    const loading = await mount(apollo(<Accounts onToast={() => {}} />, [
      {
        request: { query: ADMIN_INFRASTRUCTURE_QUERY, variables: { period: '30d' } },
        result: { data: { adminInfrastructure: infrastructure } },
      },
      delayed({
        request: {
          query: ADMIN_ACCOUNTS_REPORT_QUERY,
          variables: { period: 'monthly', year, month, groupBy: null },
        },
        result: { data: { adminAccountsReport: report } },
      }),
    ]));
    await loading.getByRole('button', { name: 'Monthly Reports' }).click();
    await expect(loading.getByText('Loading report...')).toBeVisible();
    await loading.unmount();

    const failed = await mount(apollo(<Accounts onToast={() => {}} />, [
      {
        request: { query: ADMIN_INFRASTRUCTURE_QUERY, variables: { period: '30d' } },
        result: { data: { adminInfrastructure: infrastructure } },
      },
      {
        request: {
          query: ADMIN_ACCOUNTS_REPORT_QUERY,
          variables: { period: 'monthly', year, month, groupBy: null },
        },
        result: { errors: [{ message: 'report unavailable' }] },
      },
    ]));
    await failed.getByRole('button', { name: 'Monthly Reports' }).click();
    await expect(failed.getByText('Error: report unavailable')).toBeVisible();
  });
});
