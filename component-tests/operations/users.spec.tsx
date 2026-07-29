import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { Users } from '../../src/components/admin/pages/Users';
import {
  ADMIN_ACTIVITY_LOG_QUERY,
  ADMIN_COMPANIES_QUERY,
  ADMIN_UPDATE_USER_MUTATION,
  ADMIN_USERS_QUERY,
} from '../../src/lib/graphql';
import { apollo, delayed } from '../fixtures/operations-test-utils';

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

const userQuery = {
  request: { query: ADMIN_USERS_QUERY, variables: { companyId: null } },
  result: { data: { adminUsers: users } },
};
const companiesQuery = {
  request: { query: ADMIN_COMPANIES_QUERY, variables: { search: null } },
  result: {
    data: { adminCompanies: [{ id: 1, company: 'Analytical Inc' }, { id: 2, company: 'Compiler Co' }] },
  },
};

test.describe('Users', () => {
  test('covers loading, query error, and empty users', async ({ mount }) => {
    const loading = await mount(apollo(<Users onToast={() => {}} />, [
      delayed(userQuery),
      companiesQuery,
    ]));
    await expect(loading.getByText('Loading users...')).toBeVisible();
    await loading.unmount();

    const failed = await mount(apollo(<Users onToast={() => {}} />, [
      {
        request: { query: ADMIN_USERS_QUERY, variables: { companyId: null } },
        result: { errors: [{ message: 'users unavailable' }] },
      },
      companiesQuery,
    ]));
    await expect(failed.getByText('Error: users unavailable')).toBeVisible();
    await failed.unmount();

    const empty = await mount(apollo(<Users onToast={() => {}} />, [{
      request: { query: ADMIN_USERS_QUERY, variables: { companyId: null } },
      result: { data: { adminUsers: [] } },
    }, companiesQuery]));
    await expect(empty.getByText('No users found')).toBeVisible();
  });

  test('searches and applies a column filter', async ({ mount, page }) => {
    const component = await mount(apollo(<Users onToast={() => {}} />, [userQuery, companiesQuery]));
    await component.getByPlaceholder('Search...').fill('grace');
    await expect(component.getByRole('row', { name: /Grace Hopper/ })).toBeVisible();
    await expect(component.getByText('Ada Lovelace')).toHaveCount(0);

    await component.getByPlaceholder('Search...').fill('');
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
        userQuery,
        companiesQuery,
        {
          request: {
            query: ADMIN_UPDATE_USER_MUTATION,
            variables: {
              userId: '11',
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
        userQuery,
      ],
    ));

    await component.getByRole('row', { name: /Ada Lovelace/ }).getByTitle('Edit User').click();
    await component.getByLabel('First name').fill('Augusta');
    await component.getByRole('button', { name: 'Save' }).click();
    await expect(component.getByRole('heading', { name: 'Edit User' })).toHaveCount(0);
    await expect.poll(() => toasts).toEqual([{ type: 'success', message: 'User updated' }]);
  });

  test('loads selected-user activity and expands raw detail', async ({ mount }) => {
    const component = await mount(apollo(<Users onToast={() => {}} />, [
      userQuery,
      companiesQuery,
      {
        request: { query: ADMIN_ACTIVITY_LOG_QUERY, variables: { userId: 11 } },
        result: {
          data: {
            adminUserActivityLogs: [
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
              },
              {
                id: 'other',
                actor: 'admin@example.com',
                action: 'UPDATE',
                targetType: 'company',
                targetId: '2',
                companyId: 2,
                userId: 12,
                details: '{}',
                createdAt: '2026-07-20T11:00:00.000Z',
              },
            ],
          },
        },
      },
    ]));

    await component.getByRole('row', { name: /Ada Lovelace/ }).getByTitle('View Activity').click();
    await expect(component.getByRole('heading', { name: 'User Activity - Ada Lovelace' })).toBeVisible();
    await expect(component.getByText('Updated user account for ada@example.com')).toBeVisible();
    await expect(component.getByText('Updated Company')).toHaveCount(0);
    await component.getByText('Details', { exact: true }).click();
    await expect(component.getByText(/"email":"ada@example.com"/)).toBeVisible();
  });
});
