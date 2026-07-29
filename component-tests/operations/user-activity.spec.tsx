import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { UserActivityLog } from '../../src/components/admin/pages/UserActivityLog';
import { ADMIN_ACTIVITY_LOG_QUERY } from '../../src/lib/graphql';
import { apollo, delayed } from '../fixtures/operations-test-utils';

test.describe('standalone UserActivityLog', () => {
  const initialVariables = {
    actor: '',
    action: '',
    companyId: null,
    userId: null,
    from: null,
    to: null,
  };
  const log = {
    id: 'log-1',
    actor: 'ops@example.com',
    action: 'LOGIN',
    targetType: 'customuser',
    targetId: '11',
    companyId: 1,
    userId: 11,
    details: { source: 'admin' },
    createdAt: '2026-07-20T10:00:00.000Z',
    ipAddress: '203.0.113.8',
    userAgent: 'Playwright',
  };

  test('covers loading, error, and empty logs', async ({ mount }) => {
    const loading = await mount(apollo(<UserActivityLog />, [
      delayed({
        request: { query: ADMIN_ACTIVITY_LOG_QUERY, variables: initialVariables },
        result: { data: { adminUserActivityLogs: [] } },
      }),
    ]));
    await expect(loading.getByText('Loading activity logs...')).toBeVisible();
    await loading.unmount();

    const failed = await mount(apollo(<UserActivityLog />, [{
      request: { query: ADMIN_ACTIVITY_LOG_QUERY, variables: initialVariables },
      result: { errors: [{ message: 'audit unavailable' }] },
    }]));
    await expect(failed.getByText('Error: audit unavailable')).toBeVisible();
    await failed.unmount();

    const empty = await mount(apollo(<UserActivityLog />, [{
      request: { query: ADMIN_ACTIVITY_LOG_QUERY, variables: initialVariables },
      result: { data: { adminUserActivityLogs: [] } },
    }]));
    await expect(empty.getByText('No activity in selected filters')).toBeVisible();
  });

  test('opens and closes a complete activity detail dialog', async ({ mount }) => {
    const component = await mount(apollo(<UserActivityLog />, [{
      request: { query: ADMIN_ACTIVITY_LOG_QUERY, variables: initialVariables },
      result: { data: { adminUserActivityLogs: [log] } },
    }]));

    await component.getByRole('button', { name: 'View' }).click();
    await expect(component.getByRole('heading', { name: 'Activity Detail' })).toBeVisible();
    await expect(component.getByText('203.0.113.8')).toBeVisible();
    await expect(component.getByText('Playwright')).toBeVisible();
    await expect(component.getByText('{"source":"admin"}')).toBeVisible();
    await component.getByRole('button', { name: 'Close' }).click();
    await expect(component.getByRole('heading', { name: 'Activity Detail' })).toHaveCount(0);
  });
});
