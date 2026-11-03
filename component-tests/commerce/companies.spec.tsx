import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { type MockedResponse } from '@apollo/client/testing';
import { CompaniesHarness } from '../fixtures/commerce-harnesses';
import { companyFeedVariables, feedResult, paged } from '../fixtures/paging';
import {
  ADMIN_COMPANIES_FEED_QUERY,
  ADMIN_COMPANY_PAYMENT_HISTORY_QUERY,
  ADMIN_MANUAL_SUBSCRIPTION_MUTATION,
  ADMIN_REQUEST_REFUND_MUTATION,
  ADMIN_UPDATE_COMPANY_DETAIL_MUTATION,
  ADMIN_UPDATE_PAYMENT_STATUS_MUTATION,
} from '../../src/lib/graphql';

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
  refundedAmount: 0,
};

const companiesMock = (items: unknown[], delay?: number, extra: { totalCount?: number } = {}): MockedResponse => ({
  request: { query: ADMIN_COMPANIES_FEED_QUERY, variables: companyFeedVariables() },
  maxUsageCount: 3,
  ...(delay ? { delay } : {}),
  result: feedResult('adminCompaniesFeed', items, extra),
});

const historyMock: MockedResponse = {
  request: {
    query: ADMIN_COMPANY_PAYMENT_HISTORY_QUERY,
    variables: paged({ companyId: 7, dateFrom: null, dateTo: null, status: null }),
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
          variables: { paymentIntentId: 'pi_acme', reason: 'Duplicate charge', amount: 1000, mode: 'refund_and_rebill' },
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
    await expect.poll(() => dialogs).toEqual(['No amount entered: refund everything still paid on this payment?']);
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

  test('Company 360 totals are per currency and net of refunds', async ({ mount }) => {
    const history: MockedResponse = {
      ...historyMock,
      result: {
        data: {
          adminCompanyPaymentHistory: [
            { ...payment, paymentIntentId: 'pi_usd', amount: 2500, currency: 'USD', refundedAmount: 500 },
            { ...payment, paymentIntentId: 'pi_eur', amount: 4000, currency: 'EUR', refundedAmount: 0 },
            { ...payment, paymentIntentId: 'pi_back', amount: 1000, currency: 'USD', status: 'refunded', refundedAmount: 0 },
          ],
        },
      },
    };
    const component = await mount(<CompaniesHarness mocks={[companiesMock([company]), history]} />);
    await component.getByTitle('View Company').click();
    // The totals sit on the Company 360 Subscription tab.
    await component.getByRole('button', { name: 'Subscription', exact: true }).click();
    const totals = component.getByTestId('company-total-paid');
    await expect(totals).toHaveCount(2);
    // One line per currency (in the order the payments came), net of refunds.
    await expect(totals.filter({ hasText: '€40.00' })).toHaveCount(1);
    const usd = totals.filter({ hasText: '$20.00' });
    await expect(usd).toHaveCount(1);
    await expect(usd).toContainText('$15.00 refunded');
  });

  test('payment history never offers "refunded" (refunds go through Refund) and sends one status change at a time', async ({ mount }) => {
    const pending = { ...payment, status: 'pending' };
    const component = await mount(
      <CompaniesHarness
        mocks={[
          companiesMock([company]),
          { ...historyMock, maxUsageCount: 3, result: { data: { adminCompanyPaymentHistory: [pending] } } },
          {
            request: { query: ADMIN_UPDATE_PAYMENT_STATUS_MUTATION, variables: { paymentIntentId: 'pi_acme', status: 'failed', reason: 'manual_update_failed' } },
            delay: 800,
            result: { data: { adminUpdatePaymentStatus: { success: true, message: 'ok', payment: { paymentIntentId: 'pi_acme', status: 'failed' } } } },
          },
        ]}
      />,
    );
    await component.getByTitle('View Company').click();
    await component.getByRole('button', { name: 'Payment History' }).click();
    const select = component.getByLabel('Update status for pi_acme');
    await expect(select.locator('option[value="refunded"]')).toHaveCount(0);
    await select.selectOption('failed');
    // In flight: the control is disabled, a second change cannot be sent.
    await expect(select).toBeDisabled();
    await expect(select).toBeEnabled();
  });

  test('a status change is saved with its reason and only the changed fields', async ({ mount }) => {
    const component = await mount(
      <CompaniesHarness
        mocks={[
          companiesMock([company]),
          {
            request: {
              query: ADMIN_UPDATE_COMPANY_DETAIL_MUTATION,
              variables: { input: { id: 7, company: 'Acme Labs', subscriptionStatus: 'past_due', isMultiLocationEnabled: false, reason: 'Card declined twice' } },
            },
            delay: 500,
            result: { data: { adminUpdateCompanyDetail: { success: true, message: 'ok', company: null } } },
          },
        ]}
      />,
    );
    await component.getByTitle('Edit Company').click();
    // Suspension is not set here (it has its own action).
    await expect(component.getByLabel('Subscription Status').locator('option[value="suspended"]')).toHaveCount(0);
    await component.getByLabel('Subscription Status').selectOption('past_due');
    const save = component.getByRole('button', { name: /Save changes/ });
    await expect(save).toBeDisabled(); // a reason is required
    await component.getByLabel('Reason for change').fill('Card declined twice');
    await save.dblclick();
    await expect(save).toBeDisabled(); // in flight
    await expect(component.getByLabel('toast')).toHaveText('success: Company detail updated');
  });

  test('editing a company on another package keeps it and accepts equal trial dates', async ({ mount }) => {
    // A registration sets both dates to the end of the trial.
    const shiftsCompany = {
      ...company,
      planId: 'shifts-only',
      planName: 'Shifts Only',
      subscriptionDueDate: '2026-12-03T16:41:00.000Z',
      subscriptionRecurringDate: '2026-12-03T16:41:00.000Z',
    };
    const component = await mount(<CompaniesHarness mocks={[companiesMock([shiftsCompany])]} />);
    await component.getByTitle('Edit Company').click();
    const plan = component.getByLabel('Subscription Plan');
    await expect(plan).toHaveValue('shifts-only');
    await expect(plan.locator('option[value="shifts-only"]')).toHaveText('Shifts Only');
    await component.getByLabel('Subscription Status').selectOption('trial');
    await expect(plan).toHaveValue('shifts-only');
    await expect(component.getByText(/Recurring date must/)).toHaveCount(0);
  });

  test('pages through companies by the server total', async ({ mount }) => {
    const component = await mount(
      <CompaniesHarness
        mocks={[
          companiesMock([company], undefined, { totalCount: 75 }),
          {
            request: { query: ADMIN_COMPANIES_FEED_QUERY, variables: companyFeedVariables({}, 1) },
            result: feedResult('adminCompaniesFeed', [{ ...company, id: 8, company: 'Beta Works' }], { totalCount: 75 }),
          },
        ]}
      />,
    );
    await expect(component.getByTestId('pager-summary')).toHaveText(/1–50 of 75 companies/);
    await component.getByRole('button', { name: 'Next page' }).click();
    await expect(component.getByText('Beta Works', { exact: true })).toBeVisible();
    await expect(component.getByTestId('pager-summary')).toHaveText(/51–75 of 75 companies/);
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
