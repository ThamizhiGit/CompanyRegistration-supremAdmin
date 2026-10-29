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

  test('opens the Company 360 date-range picker from payment history', async ({ mount, page }) => {
    const component = await mount(<CompaniesHarness scenario="actions" />);

    await component.getByTitle('View Company').click();
    await component.getByRole('button', { name: 'Payment History' }).click();
    await component.getByRole('button', { name: /Select Date Range/ }).click();

    const picker = page.getByRole('dialog', { name: 'Choose date range' });
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('button', { name: 'Today' })).toBeVisible();
    await expect(picker.getByRole('button', { name: 'Last 7 Days' })).toBeVisible();
    await expect(picker.getByRole('button', { name: 'Last 30 Days' })).toBeVisible();
    await expect(picker.getByRole('button', { name: 'This Month' })).toBeVisible();
    await expect(picker.getByRole('button', { name: 'Last Month' })).toBeVisible();
    await picker.getByRole('button', { name: 'Cancel' }).click();
    await expect(picker).not.toBeVisible();
  });

  test('requests a partial refund and sends a manual subscription action', async ({ mount, page }) => {
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
            gatewayPayload: {
              paymentIntentId: 'pi_acme',
              method: 'card',
              reason: 'Bank verified',
              source: 'portal',
            },
            reason: 'Bank verified',
          },
        },
        result: { data: { adminManualSubscriptionAction: { success: true, message: 'recorded', payment: null } } },
      },
    ];
    const component = await mount(<CompaniesHarness scenario="actions" />);

    await component.getByTitle('View Company').click();
    await expect(component.getByText('pi_acme', { exact: true })).toBeVisible();
    await component.getByRole('button', { name: /Detail/ }).click();
    await component.getByPlaceholder('Refund reason').fill('Duplicate charge');
    await component.getByPlaceholder('Amount').fill('10');
    // A partial refund is confirmed too, with the amount and currency.
    const dialogs: string[] = [];
    page.once('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.accept();
    });
    await component.getByRole('button', { name: /Apply refund/ }).click();
    await expect(component.getByLabel('toast')).toHaveText('success: Refund requested');
    expect(dialogs).toEqual(['Refund $10.00 (USD) of this payment?']);

    // Re-open the payment detail because a successful refund closes it.
    await component.getByRole('button', { name: /Detail/ }).click();
    await component.getByPlaceholder('Receiver medium').fill('merchant-7');
    await component.getByPlaceholder('Sender medium').fill('customer-7');
    await component.getByPlaceholder('Reason / notes').fill('Bank verified');
    await component.getByRole('button', { name: /Trigger Manual/ }).click();
    await expect(component.getByLabel('toast')).toHaveText('success: Manual subscription action submitted');
  });

  test('refuses a refund amount that is not above zero and confirms a full refund', async ({ mount, page }) => {
    // The harness answers the full refund (amount: null) for pi_acme.
    const component = await mount(<CompaniesHarness scenario="actions" />);

    await component.getByTitle('View Company').click();
    await component.getByRole('button', { name: /Detail/ }).click();
    await expect(component.getByPlaceholder('Amount')).toHaveAttribute('step', '0.01');

    await component.getByPlaceholder('Amount').fill('0');
    await component.getByRole('button', { name: /Apply refund/ }).click();
    await expect(component.getByLabel('toast')).toHaveText(
      'error: Enter a refund amount greater than zero, or leave it empty for a full refund.',
    );

    // Empty amount = full refund: only after the admin confirms it.
    await component.getByPlaceholder('Amount').fill('');
    const dialogs: string[] = [];
    page.once('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    await component.getByRole('button', { name: /Apply refund/ }).click();
    await expect.poll(() => dialogs).toEqual(['No amount entered: refund the full payment?']);
    await expect(component.getByPlaceholder('Amount')).toBeVisible(); // still open: nothing requested

    page.once('dialog', (dialog) => void dialog.accept());
    await component.getByRole('button', { name: /Apply refund/ }).click();
    await expect(component.getByLabel('toast')).toHaveText('success: Refund requested');
  });

  test('an ISK refund is typed in whole units (Stripe refuses fractions)', async ({ mount }) => {
    const component = await mount(<CompaniesHarness scenario="actions" paymentCurrency="ISK" />);
    await component.getByTitle('View Company').click();
    await component.getByRole('button', { name: /Detail/ }).click();
    await expect(component.getByPlaceholder('Amount')).toHaveAttribute('step', '1');
    await component.getByPlaceholder('Amount').fill('5.5');
    await component.getByRole('button', { name: /Apply refund/ }).click();
    await expect(component.getByLabel('toast')).toHaveText('error: ISK refunds must be in whole units.');
  });

  test('a double click sends one refund and one manual action', async ({ mount, page }) => {
    // Each answer is mocked once and takes 800 ms: a second request would fail.
    const component = await mount(<CompaniesHarness scenario="slow-actions" />);
    await component.getByTitle('View Company').click();
    await component.getByRole('button', { name: /Detail/ }).click();
    await component.getByPlaceholder('Refund reason').fill('Duplicate charge');
    await component.getByPlaceholder('Amount').fill('10');

    let confirms = 0;
    page.on('dialog', (dialog) => {
      confirms += 1;
      void dialog.accept();
    });
    await component.getByRole('button', { name: /Apply refund/ }).dblclick();
    await expect(component.getByRole('button', { name: /Requesting refund/ })).toBeDisabled();
    await expect(component.getByLabel('toast')).toHaveText('success: Refund requested');
    expect(confirms).toBe(1);

    await component.getByRole('button', { name: /Detail/ }).click();
    await component.getByPlaceholder('Receiver medium').fill('merchant-7');
    await component.getByPlaceholder('Sender medium').fill('customer-7');
    await component.getByPlaceholder('Reason / notes').fill('Bank verified');
    await component.getByRole('button', { name: /Trigger Manual/ }).dblclick();
    await expect(component.getByRole('button', { name: /Submitting/ })).toBeDisabled();
    await expect(component.getByLabel('toast')).toHaveText('success: Manual subscription action submitted');
    await expect(component.getByRole('button', { name: /Trigger Manual/ })).toBeEnabled();
  });
});
