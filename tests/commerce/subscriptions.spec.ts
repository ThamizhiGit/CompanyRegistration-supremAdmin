import { test, expect } from '../fixtures/graphql.fixture';

test('subscriptions page shows plan snapshots without module columns', async ({
  adminPage: page,
}) => {
  await page.getByRole('button', { name: 'Subscriptions' }).click();
  await expect(page.getByRole('heading', { name: 'Subscriptions & Payments' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Plan' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Modules' })).toHaveCount(0);
  await expect(page.getByText('Premium').first()).toBeVisible();
  await expect(page.getByText('42 employees')).toBeVisible();
  await expect(page.getByText('Original $504.00')).toBeVisible();
  await expect(page.getByText('trialing')).toBeVisible();
});

test('subscriptions page shows the current package and opens change package', async ({
  adminPage: page,
}) => {
  await page.getByRole('button', { name: 'Subscriptions' }).click();
  await expect(page.getByRole('columnheader', { name: 'Package' })).toBeVisible();
  await expect(page.getByTestId('package-cell-12').first()).toContainText('update available');
  await page.getByRole('button', { name: 'Change package' }).first().click();
  await expect(page.getByTestId('change-package-dialog')).toBeVisible();
});

test('a manual payment the server refuses (success: false) is reported as an error, not as recorded', async ({
  adminPage: page,
  mockApi,
}) => {
  mockApi.setOverride('AdminManualSubscriptionAction', {
    data: {
      adminManualSubscriptionAction: {
        success: false, message: 'Payment not found.', payment: null, __typename: 'AdminManualSubscriptionAction',
      },
    },
  });
  await page.getByRole('button', { name: 'Subscriptions' }).click();
  await page.getByTitle('Edit subscription').first().click();
  await expect(page.getByRole('heading', { name: 'Edit Subscription Payment' })).toBeVisible();
  await page.getByPlaceholder('Reason for recording this payment').fill('Paid by cheque');
  await page.getByRole('button', { name: /Record manual payment/ }).click();
  await expect(page.getByText('Payment not found.')).toBeVisible();
  await expect(page.getByText('Manual payment recorded')).toHaveCount(0);
  // The form stays open to try again.
  await expect(page.getByRole('heading', { name: 'Edit Subscription Payment' })).toBeVisible();
  expect(mockApi.lastVariables('AdminManualSubscriptionAction')).toMatchObject({ companyId: 12, reason: 'Paid by cheque' });
});

test('payments are read one page at a time, searched and counted by the server', async ({ adminPage: page, mockApi }) => {
  const many = Array.from({ length: 205 }, (_, index) => ({
    ...mockApi.payments[0],
    paymentIntentId: `pi_bulk_${index + 1}`,
    email: `payer${index + 1}@bulk.test`,
  }));
  mockApi.setOverride('AdminPaymentsFeed', (payload) => {
    const filter = payload.variables?.filter ?? {};
    const rows = filter.search ? many.filter((payment) => payment.email.includes(filter.search)) : many;
    const offset = filter.offset ?? 0;
    return {
      data: {
        adminPaymentsFeed: {
          totalCount: rows.length,
          items: rows.slice(offset, offset + (filter.limit ?? 50)),
          facets: [],
          __typename: 'AdminPaymentsFeedType',
        },
      },
    };
  });
  await page.getByRole('button', { name: 'Subscriptions' }).click();
  await expect(page.getByTestId('pager-summary')).toContainText('1–50 of 205 payments');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByTestId('pager-summary')).toContainText('51–100 of 205 payments');
  expect(mockApi.lastVariables('AdminPaymentsFeed')?.filter).toMatchObject({ limit: 50, offset: 50 });

  await page.getByPlaceholder('Search company, plan, email...').pressSequentially('payer205@bulk.test', { delay: 15 });
  await expect(page.getByText('payer205@bulk.test')).toBeVisible();
  // Typed text is sent once typing pauses: one request for the search, back on page 1.
  const searches = (mockApi.requests.get('AdminPaymentsFeed') ?? []).map((v) => v.filter?.search).filter(Boolean);
  expect(searches).toEqual(['payer205@bulk.test']);
  expect(mockApi.lastVariables('AdminPaymentsFeed')?.filter).toMatchObject({ offset: 0 });
});
