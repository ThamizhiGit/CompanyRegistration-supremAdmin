import React from 'react';
import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@playwright/experimental-ct-react';
import App from '../../src/App';
import {
  ADMIN_REVENUE_SUMMARY_QUERY,
  TOKEN_AUTH_MUTATION,
} from '../../src/lib/graphql';
import { GraphQLProvider } from '../../src/providers/GraphQLProvider';
import {
  SharedDashboardStory,
  SharedProviderConsumerStory,
} from '../fixtures/shared-test-stories';

const revenueSummary = {
  totalCompanies: 2,
  totalUsers: 7,
  totalPayments: 3,
  grossRevenue: 1200,
  totalExpenses: 200,
  netRevenue: 1000,
  byStatus: [],
  expenseByCategory: [],
  expenseByVendor: [],
};

test.describe('GraphQLProvider', () => {
  test('provides the configured application Apollo client to descendants', async ({ mount, page }) => {
    await mount(
      <GraphQLProvider>
        <SharedProviderConsumerStory />
      </GraphQLProvider>,
    );

    await expect(page.getByText('configured client available')).toBeVisible();
  });
});

test.describe('App authentication shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => window.sessionStorage.clear());
  });

  test('renders login content, validates required credentials, and toggles password visibility', async ({
    mount,
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mount(
      <MockedProvider>
        <App />
      </MockedProvider>,
    );

    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByText('AI Workforce')).toBeVisible();
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Enter your username and password.')).toBeVisible();

    const password = page.getByPlaceholder('Enter your password');
    await expect(password).toHaveAttribute('type', 'password');
    await password.locator('xpath=following-sibling::button').click();
    await expect(password).toHaveAttribute('type', 'text');
  });

  test('logs in successfully, persists the session, and shows the admin dashboard', async ({ mount, page }) => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await mount(
      <MockedProvider
        mocks={[
          {
            request: {
              query: TOKEN_AUTH_MUTATION,
              variables: { username: 'root', password: 'secret' },
            },
            result: {
              data: {
                superAdminTokenAuth: {
                  success: true,
                  message: 'Welcome',
                  token: 'test-token',
                  expiresAt,
                  superAdmin: {
                    id: 'admin-1',
                    username: 'root',
                    email: 'root@example.test',
                    isActive: true,
                    lastLogin: null,
                  },
                },
              },
            },
          },
          {
            request: { query: ADMIN_REVENUE_SUMMARY_QUERY },
            result: { data: { adminRevenueSummary: revenueSummary } },
          },
        ]}
      >
        <App />
      </MockedProvider>,
    );

    await page.getByPlaceholder('Enter your username').fill('  root  ');
    await page.getByPlaceholder('Enter your password').fill('secret');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('heading', { name: 'Supreme Admin' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account menu for root' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          token: sessionStorage.getItem('token'),
          username: sessionStorage.getItem('adminUsername'),
        })),
      )
      .toEqual({ token: 'test-token', username: 'root' });
  });

  test('clears an expired stored session and explains why sign-in is required', async ({ mount, page }) => {
    await page.evaluate(() => {
      sessionStorage.setItem('token', 'expired-token');
      sessionStorage.setItem('adminUsername', 'old-admin');
      sessionStorage.setItem('adminExpiresAt', new Date(Date.now() - 1_000).toISOString());
    });

    await mount(
      <MockedProvider>
        <App />
      </MockedProvider>,
    );

    await expect(page.getByText('Your session has expired. Please sign in again.')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem('token')))
      .toBeNull();
  });

  test('shows authentication failures returned by the API', async ({ mount, page }) => {
    await mount(
      <MockedProvider
        mocks={[
          {
            request: {
              query: TOKEN_AUTH_MUTATION,
              variables: { username: 'root', password: 'wrong' },
            },
            result: {
              data: {
                superAdminTokenAuth: {
                  success: false,
                  message: 'Invalid credentials',
                  token: null,
                  expiresAt: null,
                  superAdmin: null,
                },
              },
            },
          },
        ]}
      >
        <App />
      </MockedProvider>,
    );

    await page.getByPlaceholder('Enter your username').fill('root');
    await page.getByPlaceholder('Enter your password').fill('wrong');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Invalid credentials')).toBeVisible();
  });
});

test.describe('AdminDashboard', () => {
  test('renders the initial page and routes between real page components', async ({ mount, page }) => {
    await mount(<SharedDashboardStory />);

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.getByRole('button', { name: 'Plans' }).click();
    await expect(page.getByRole('heading', { name: 'Plans & Pricing' })).toBeVisible();
    await page.getByRole('button', { name: 'Dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
