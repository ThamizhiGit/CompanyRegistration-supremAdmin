import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { type MockedResponse } from '@apollo/client/testing';
import { CompaniesHarness } from '../fixtures/commerce-harnesses';
import {
  ADMIN_COMPANIES_QUERY,
  ADMIN_COMPANY_PAYMENT_HISTORY_QUERY,
  ADMIN_MANUAL_SUBSCRIPTION_MUTATION,
  ADMIN_REQUEST_REFUND_MUTATION,
} from '../../src/lib/graphql';

const companyVariables = {
  search: null,
  status: null,
  subscriptionStatus: null,
  dueDateFrom: null,
  dueDateTo: null,
  recurringDateFrom: null,
  recurringDateTo: null,
};

const company = {
  id: 7,
  company: 'Acme Labs',
  planId: 'premium',
  planName: 'Premium',
  employeeCount: 12,
  createdAt: '2026-01-01T00:00:00.000Z',
  isMultiLocationEnabled: false,
  subscriptionStatus: 'active',
  subscriptionDueDate: '2026-08-01T12:00:00.000Z',
  subscriptionRecurringDate: '2026-09-01T12:00:00.000Z',
  latestPaymentStatus: 'succeeded',
  latestPaymentIntentId: 'pi_acme',
  latestPaymentEmail: 'billing@acme.test',
  latestPaymentFinalAmountCents: 2500,
  latestPaymentCurrency: 'USD',
  latestPaymentGatewayMethod: 'card',
  latestPaymentGatewayStatus: 'settled',
};

const payment = {
  paymentIntentId: 'pi_acme',
  email: 'billing@acme.test',
  planId: 'premium',
  planName: 'Premium',
  employeeCountSnapshot: 12,
  originalAmountCents: 2500,
  finalAmountCents: 2500,
  status: 'succeeded',
  amount: 2500,
  currency: 'USD',
  companyId: 7,
  companyName: 'Acme Labs',
  source: 'portal',
  createdAt: '2026-01-02T00:00:00.000Z',
  dueDate: '2026-08-01T12:00:00.000Z',
  recurringDate: '2026-09-01T12:00:00.000Z',
  deniedReason: null,
  gatewayMethod: 'card',
  gatewayRefReceiverMedium: 'merchant-7',
  gatewayRefSenderMedium: 'customer-7',
  gatewayPayload: '{}',
  paymentGatewayStatus: 'settled',
};

const companiesMock = (items: unknown[], delay?: number): MockedResponse => ({
  request: { query: ADMIN_COMPANIES_QUERY, variables: companyVariables },
  ...(delay ? { delay } : {}),
  result: { data: { adminCompanies: items } },
});

const historyMock: MockedResponse = {
  request: {
    query: ADMIN_COMPANY_PAYMENT_HISTORY_QUERY,
    variables: { companyId: 7, dateFrom: null, dateTo: null, status: null },
  },
  result: { data: { adminCompanyPaymentHistory: [payment] } },
};

test.describe('commerce / companies', () => {
  test('covers loading, rendering, filtering, and empty results', async ({ mount }) => {
    const loading = await mount(<CompaniesHarness scenario="loading" />);
    await expect(loading.getByText('Loading companies...')).toBeVisible();
    await loading.unmount();
    const component = await mount(<CompaniesHarness scenario="data" />);
    await expect(component.getByText('Acme Labs', { exact: true })).toBeVisible();
    await component.getByPlaceholder('Search companies, email, payment...').fill('missing');
    await expect(component.getByText('No companies match your filters')).toBeVisible();
  });

  test('renders query errors and the true empty state', async ({ mount }) => {
    const failed = await mount(
      <CompaniesHarness scenario="error" />,
    );
    await expect(failed.getByText('Error: company service unavailable')).toBeVisible();
    await failed.unmount();

    const empty = await mount(<CompaniesHarness scenario="empty" />);
    await expect(empty.getByText('No companies found')).toBeVisible();
  });

  test('requests a partial refund and sends a manual subscription action', async ({ mount }) => {
    const mocks: MockedResponse[] = [
      companiesMock([company]),
      historyMock,
      {
        request: {
          query: ADMIN_REQUEST_REFUND_MUTATION,
          variables: { paymentIntentId: 'pi_acme', reason: 'Duplicate charge', amount: 1000 },
        },
        result: { data: { adminRequestRefund: { success: true, message: 'queued' } } },
      },
      {
        request: {
          query: ADMIN_MANUAL_SUBSCRIPTION_MUTATION,
          variables: {
            companyId: 7,
            subscriptionId: 'pi_acme',
            source: 'portal',
            paymentMethod: 'card',
            receiverMedium: 'merchant-7',
            senderMedium: 'customer-7',
            gatewayPayload: JSON.stringify({
              paymentIntentId: 'pi_acme',
              method: 'card',
              reason: 'Bank verified',
              source: 'portal',
            }),
            reason: 'Bank verified',
          },
        },
        result: { data: { adminManualSubscription: { success: true, message: 'recorded' } } },
      },
    ];
    const component = await mount(<CompaniesHarness scenario="actions" />);

    await component.getByTitle('View Company').click();
    await expect(component.getByText('pi_acme', { exact: true })).toBeVisible();
    await component.getByRole('button', { name: /Detail/ }).click();
    await component.getByPlaceholder('Refund reason').fill('Duplicate charge');
    await component.getByPlaceholder('Amount').fill('10');
    await component.getByRole('button', { name: /Apply refund/ }).click();
    await expect(component.getByLabel('toast')).toHaveText('success: Refund requested');

    // Re-open the payment detail because a successful refund closes it.
    await component.getByRole('button', { name: /Detail/ }).click();
    await component.getByPlaceholder('Receiver medium').fill('merchant-7');
    await component.getByPlaceholder('Sender medium').fill('customer-7');
    await component.getByPlaceholder('Reason / notes').fill('Bank verified');
    await component.getByRole('button', { name: /Trigger Manual/ }).click();
    await expect(component.getByLabel('toast')).toHaveText('success: Manual subscription action submitted');
  });
});
