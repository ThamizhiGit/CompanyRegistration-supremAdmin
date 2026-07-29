import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { Infrastructure } from '../../src/components/admin/pages/Infrastructure';
import { ADMIN_INFRASTRUCTURE_QUERY } from '../../src/lib/graphql';
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

test.describe('Infrastructure', () => {
  test('covers loading, error, empty payload and empty trend', async ({ mount }) => {
    const loading = await mount(apollo(<Infrastructure />, [
      delayed({
        request: { query: ADMIN_INFRASTRUCTURE_QUERY, variables: { period: '30d' } },
        result: { data: { adminInfrastructure: infrastructure } },
      }),
    ]));
    await expect(loading.getByText('Loading infrastructure...')).toBeVisible();
    await loading.unmount();

    const failed = await mount(apollo(<Infrastructure />, [{
      request: { query: ADMIN_INFRASTRUCTURE_QUERY, variables: { period: '30d' } },
      result: { errors: [{ message: 'metrics unavailable' }] },
    }]));
    await expect(failed.getByText('Error: metrics unavailable')).toBeVisible();
    await failed.unmount();

    const empty = await mount(apollo(<Infrastructure />, [{
      request: { query: ADMIN_INFRASTRUCTURE_QUERY, variables: { period: '30d' } },
      result: { data: { adminInfrastructure: null } },
    }]));
    await expect(empty.getByText('No infrastructure data available')).toBeVisible();
    await empty.unmount();

    const noTrend = await mount(apollo(<Infrastructure />, [{
      request: { query: ADMIN_INFRASTRUCTURE_QUERY, variables: { period: '30d' } },
      result: { data: { adminInfrastructure: { ...infrastructure, byDay: [] } } },
    }]));
    await expect(noTrend.getByText('No trend data available')).toBeVisible();
  });

  test('changes reporting period and renders the returned daily trend', async ({ mount }) => {
    const component = await mount(apollo(<Infrastructure />, [
      {
        request: { query: ADMIN_INFRASTRUCTURE_QUERY, variables: { period: '30d' } },
        result: { data: { adminInfrastructure: infrastructure } },
      },
      {
        request: { query: ADMIN_INFRASTRUCTURE_QUERY, variables: { period: '7d' } },
        result: {
          data: {
            adminInfrastructure: {
              ...infrastructure,
              period: 'Last 7 days',
              byDay: [{ date: '2026-07-26', income: 12_000, expense: 15_000 }],
            },
          },
        },
      },
    ]));

    await expect(component.getByText('2026-07-20')).toBeVisible();
    await component.getByLabel('Infrastructure reporting period').selectOption('7d');
    await expect(component.getByText('Daily trend (Last 7 days)')).toBeVisible();
    await expect(component.getByRole('row', { name: /2026-07-26.*\$120\.00.*\$150\.00.*-\$30\.00/ })).toBeVisible();
  });
});
