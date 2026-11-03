import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { UserActivityLog } from '../../src/components/admin/pages/UserActivityLog';
import { ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY } from '../../src/lib/graphql';
import { apollo, delayed } from '../fixtures/operations-test-utils';
import { feedResult, feedVariables } from '../fixtures/paging';

test.describe('standalone UserActivityLog', () => {
  const activityVars = (filter: Record<string, unknown> = {}) => feedVariables({
    companyId: null,
    from: null,
    to: null,
    cursor: null,
    actor: null,
    action: null,
    userId: null,
    ...filter,
  });
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
    __typename: 'AdminActivityLogType',
  };
  const answer = (items: unknown[], extra: { totalCount?: number; nextCursor?: string | null } = {}) =>
    feedResult('adminUserActivityLogsFeed', items, { nextCursor: null, ...extra });

  test('covers loading, error, and empty logs', async ({ mount }) => {
    const loading = await mount(apollo(<UserActivityLog />, [
      delayed({ request: { query: ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY, variables: activityVars() }, result: answer([]) }),
    ]));
    await expect(loading.getByText('Loading activity logs...')).toBeVisible();
    await loading.unmount();

    const failed = await mount(apollo(<UserActivityLog />, [{
      request: { query: ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY, variables: activityVars() },
      result: { errors: [{ message: 'audit unavailable' }] },
    }]));
    await expect(failed.getByText('Error: audit unavailable')).toBeVisible();
    await failed.unmount();

    const empty = await mount(apollo(<UserActivityLog />, [{
      request: { query: ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY, variables: activityVars() },
      result: answer([]),
    }]));
    await expect(empty.getByText('No activity in selected filters')).toBeVisible();
  });

  test('opens and closes a complete activity detail dialog', async ({ mount }) => {
    const component = await mount(apollo(<UserActivityLog />, [{
      request: { query: ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY, variables: activityVars() },
      result: answer([log]),
    }]));

    await component.getByRole('button', { name: 'View' }).click();
    await expect(component.getByRole('heading', { name: 'Activity Detail' })).toBeVisible();
    await expect(component.getByText('203.0.113.8')).toBeVisible();
    await expect(component.getByText('Playwright')).toBeVisible();
    await expect(component.getByText('{"source":"admin"}')).toBeVisible();
    await component.getByRole('button', { name: 'Close' }).click();
    await expect(component.getByRole('heading', { name: 'Activity Detail' })).toHaveCount(0);
  });

  test('pages with the keyset cursor and back', async ({ mount }) => {
    const older = { ...log, id: 'log-2', actor: 'older@example.com' };
    const component = await mount(apollo(<UserActivityLog />, [
      { request: { query: ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY, variables: activityVars() }, result: answer([log], { totalCount: 51, nextCursor: 'c1' }), maxUsageCount: 2 },
      { request: { query: ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY, variables: activityVars({ cursor: 'c1' }) }, result: answer([older], { totalCount: 51 }) },
    ]));
    await expect(component.getByTestId('pager-summary')).toHaveText(/1–50 of 51 entries/);
    await component.getByRole('button', { name: 'Next page' }).click();
    await expect(component.getByText('older@example.com')).toBeVisible();
    await expect(component.getByTestId('pager-summary')).toHaveText(/51–51 of 51 entries/);
    await component.getByRole('button', { name: 'Previous page' }).click();
    await expect(component.getByText('ops@example.com')).toBeVisible();
  });

  test('shows the chosen from/to dates in the inputs (local time, not the ISO string)', async ({ mount }) => {
    const component = await mount(apollo(<UserActivityLog />, [
      { request: { query: ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY, variables: activityVars() }, result: answer([]) },
      {
        request: {
          query: ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY,
          variables: (variables: Record<string, any>) => Boolean(variables.filter?.from),
        },
        result: answer([]),
        maxUsageCount: 5,
      },
    ]));
    await component.getByLabel('From').fill('2026-07-20T10:30');
    await expect(component.getByLabel('From')).toHaveValue('2026-07-20T10:30');
  });
});
