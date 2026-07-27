import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { type MockedResponse } from '@apollo/client/testing';
import { SubscriptionsHarness } from '../fixtures/commerce-harnesses';
import {
  ADMIN_COMPANIES_QUERY,
  ADMIN_PAYMENTS_QUERY,
} from '../../src/lib/graphql';

const paymentVariables = { status: null, companyId: null, dateFrom: null, dateTo: null, search: null };
const companyVariables = {
  search: null,
  status: null,
  subscriptionStatus: null,
  dueDateFrom: null,
  dueDateTo: null,
  recurringDateFrom: null,
  recurringDateTo: null,
};

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

const paymentsMock = (items: unknown[], delay?: number): MockedResponse => ({
  request: { query: ADMIN_PAYMENTS_QUERY, variables: paymentVariables },
  ...(delay ? { delay } : {}),
  result: { data: { adminPayments: items } },
});

const companiesMock: MockedResponse = {
  request: { query: ADMIN_COMPANIES_QUERY, variables: companyVariables },
  result: { data: { adminCompanies: [{ id: 42, company: 'Orbit Works' }] } },
};

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
