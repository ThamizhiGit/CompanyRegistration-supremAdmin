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

test('every page of payments is loaded (not only the first 50)', async ({ adminPage: page, mockApi }) => {
  const many = Array.from({ length: 205 }, (_, index) => ({
    ...mockApi.payments[0],
    paymentIntentId: `pi_bulk_${index + 1}`,
    email: `payer${index + 1}@bulk.test`,
  }));
  mockApi.setOverride('AdminPayments', (payload) => {
    const offset = payload.variables?.offset ?? 0;
    return { data: { adminPayments: many.slice(offset, offset + (payload.variables?.limit ?? 50)) } };
  });
  await page.getByRole('button', { name: 'Subscriptions' }).click();
  await page.getByPlaceholder('Search company, plan, email...').fill('payer205@bulk.test');
  await expect(page.getByText('payer205@bulk.test')).toBeVisible();
  expect((mockApi.requests.get('AdminPayments') ?? []).map((v) => [v.limit, v.offset])).toEqual(
    expect.arrayContaining([[200, 0], [200, 200]]),
  );
});
