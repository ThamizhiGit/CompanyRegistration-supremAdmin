import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { Users } from '../../src/components/admin/pages/Users';
import {
  ADMIN_UPDATE_USER_MUTATION,
  ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY,
  ADMIN_USERS_FEED_QUERY,
} from '../../src/lib/graphql';
import { apollo, delayed } from '../fixtures/operations-test-utils';
import { feedResult, feedVariables } from '../fixtures/paging';

const users = [
  {
    id: '11',
    username: 'ada',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    isCompanyAdmin: true,
    isActive: true,
    company: { id: 1, company: 'Analytical Inc' },
    location: { id: 4, location: 'London' },
  },
  {
    id: '12',
    username: 'grace',
    email: 'grace@example.com',
    firstName: 'Grace',
    lastName: 'Hopper',
    isCompanyAdmin: false,
    isActive: false,
    company: { id: 2, company: 'Compiler Co' },
    location: { id: 5, location: 'New York' },
  },
];

const facets = [
  { field: 'isActive', value: 'True', label: null, count: 1 },
  { field: 'isActive', value: 'False', label: null, count: 1 },
  { field: 'companyId', value: '1', label: 'Analytical Inc', count: 1 },
  { field: 'companyId', value: '2', label: 'Compiler Co', count: 1 },
];

/** Variables of the users feed: what the page sends for these filters. */
const usersVars = (filter: Record<string, unknown> = {}, page = 0) => feedVariables(
  { companyId: [], locationId: [], isActive: null, isCompanyAdmin: null, search: null, ...filter },
  { page, sort: null },
);
const usersMock = (filter: Record<string, unknown> = {}, rows = users, extra: { totalCount?: number; page?: number } = {}) => ({
  request: { query: ADMIN_USERS_FEED_QUERY, variables: usersVars(filter, extra.page) },
  result: feedResult('adminUsersFeed', rows, { totalCount: extra.totalCount, facets }),
});

test.describe('Users', () => {
  test('covers loading, query error, and empty users', async ({ mount }) => {
    const loading = await mount(apollo(<Users onToast={() => {}} />, [delayed(usersMock())]));
    await expect(loading.getByText('Loading users...')).toBeVisible();
    // The page itself (title, search) is there while the list loads.
    await expect(loading.getByRole('heading', { name: 'Users' })).toBeVisible();
    await loading.unmount();

    const failed = await mount(apollo(<Users onToast={() => {}} />, [{
      request: { query: ADMIN_USERS_FEED_QUERY, variables: usersVars() },
      result: { errors: [{ message: 'users unavailable' }] },
    }]));
    await expect(failed.getByText('Error: users unavailable')).toBeVisible();
    await failed.unmount();

    const empty = await mount(apollo(<Users onToast={() => {}} />, [usersMock({}, [])]));
    await expect(empty.getByText('No users found')).toBeVisible();
  });

  test('sends one request per search once typing pauses', async ({ mount }) => {
    // Only the final text has a mock: a request per key would find none and show an error.
    const component = await mount(apollo(<Users onToast={() => {}} />, [
      usersMock(),
      usersMock({ search: 'grace' }, [users[1]]),
    ]));
    await expect(component.getByRole('row', { name: /Ada Lovelace/ })).toBeVisible();
    await component.getByPlaceholder('Search...').pressSequentially('grace', { delay: 30 });
    await expect(component.getByRole('row', { name: /Grace Hopper/ })).toBeVisible();
    await expect(component.getByText('Ada Lovelace')).toHaveCount(0);
    await expect(component.getByRole('alert')).toHaveCount(0);
  });

  test('a search answered after a newer one never replaces it', async ({ mount, page }) => {
    const component = await mount(apollo(<Users onToast={() => {}} />, [
      usersMock(),
      { ...usersMock({ search: 'gr' }, [{ ...users[0], firstName: 'Stale', lastName: 'Answer' }]), delay: 1500 },
      usersMock({ search: 'grace' }, [users[1]]),
    ]));
    const search = component.getByPlaceholder('Search...');
    await search.fill('gr');
    await page.waitForTimeout(450); // the "gr" request is sent and still pending
    await search.fill('grace');
    await expect(component.getByRole('row', { name: /Grace Hopper/ })).toBeVisible();
    await page.waitForTimeout(1600); // past the "gr" answer: Apollo dropped it
    await expect(component.getByText('Stale Answer')).toHaveCount(0);
    await expect(component.getByRole('row', { name: /Grace Hopper/ })).toBeVisible();
  });

  test('keeps the rows on screen while the next page loads, and pages by totalCount', async ({ mount }) => {
    const second = [{ ...users[1], id: '61', username: 'page2', firstName: 'Second', lastName: 'Page' }];
    const component = await mount(apollo(<Users onToast={() => {}} />, [
      usersMock({}, users, { totalCount: 120 }),
      { ...usersMock({}, second, { totalCount: 120, page: 1 }), delay: 1000 },
    ]));
    await expect(component.getByTestId('pager-summary')).toHaveText(/1–50 of 120 users/);
    await expect(component.getByText('Page 1 of 3')).toBeVisible();
    await component.getByRole('button', { name: 'Next page' }).click();
    // While page 2 loads: page 1's rows stay, the pager says it is loading.
    await expect(component.getByLabel('Loading')).toBeVisible();
    await expect(component.getByRole('row', { name: /Ada Lovelace/ })).toBeVisible();
    await expect(component.getByRole('row', { name: /Second Page/ })).toBeVisible();
    await expect(component.getByTestId('pager-summary')).toHaveText(/51–100 of 120 users/);
    await expect(component.getByText('Ada Lovelace')).toHaveCount(0);
  });

  test('filters by status on the server', async ({ mount, page }) => {
    const component = await mount(apollo(<Users onToast={() => {}} />, [
      usersMock(),
      usersMock({ isActive: false }, [users[1]]),
    ]));
    await component.getByTitle('Status filter').click();
    await page.getByLabel('Inactive').check();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(component.getByRole('row', { name: /Grace Hopper/ })).toBeVisible();
    await expect(component.getByText('Ada Lovelace')).toHaveCount(0);
  });

  test('edits and saves a user, sending the mutation and success toast', async ({ mount }) => {
    const toasts: Array<{ type: string; message: string }> = [];
    const component = await mount(apollo(
      <Users onToast={(type, message) => toasts.push({ type, message })} />,
      [
        usersMock(),
        {
          request: {
            query: ADMIN_UPDATE_USER_MUTATION,
            variables: {
              userId: 11,
              firstName: 'Augusta',
              lastName: 'Lovelace',
              email: 'ada@example.com',
              username: 'ada',
              isCompanyAdmin: true,
              isActive: true,
            },
          },
          result: { data: { adminUpdateUser: { success: true, message: 'updated' } } },
        },
        usersMock(),
      ],
    ));

    await component.getByRole('row', { name: /Ada Lovelace/ }).getByTitle('Edit User').click();
    await component.getByLabel('First name').fill('Augusta');
    await component.getByRole('button', { name: 'Save' }).click();
    await expect(component.getByRole('heading', { name: 'Edit User' })).toHaveCount(0);
    await expect.poll(() => toasts).toEqual([{ type: 'success', message: 'User updated' }]);
  });

  test('loads the selected user\'s activity (the row itself, not a lookup) and expands raw detail', async ({ mount }) => {
    const component = await mount(apollo(<Users onToast={() => {}} />, [
      usersMock(),
      {
        request: { query: ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY, variables: feedVariables({ userId: '11' }) },
        result: feedResult('adminUserActivityLogsFeed', [
          {
            id: 'a1',
            actor: 'admin@example.com',
            action: 'UPDATE',
            targetType: 'customuser',
            targetId: '11',
            companyId: 1,
            userId: 11,
            details: JSON.stringify({ email: 'ada@example.com' }),
            createdAt: '2026-07-20T10:00:00.000Z',
            ipAddress: null,
            userAgent: null,
            __typename: 'AdminActivityLogType',
          },
        ], { nextCursor: null }),
      },
    ]));

    await component.getByRole('row', { name: /Ada Lovelace/ }).getByTitle('View Activity').click();
    await expect(component.getByRole('heading', { name: 'User Activity - Ada Lovelace' })).toBeVisible();
    await expect(component.getByText('Updated user account for ada@example.com')).toBeVisible();
    await component.getByText('Details', { exact: true }).click();
    await expect(component.getByText(/"email":"ada@example.com"/)).toBeVisible();
  });
});
