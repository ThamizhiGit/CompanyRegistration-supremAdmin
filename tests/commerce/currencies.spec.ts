import { test, expect } from '../fixtures/graphql.fixture';

test('currencies page lists rates with a checkout-rounded preview', async ({ adminPage: page }) => {
  await page.getByRole('button', { name: 'Currencies' }).click();
  await expect(page.getByRole('heading', { name: 'Currencies' })).toBeVisible();
  await expect(page.getByTestId('currency-preview-LKR')).toHaveText('LKR 3,600.00');
  // Zero-decimal currencies are whole units: 12 USD = ¥1,800, not ¥18.
  await expect(page.getByTestId('currency-preview-JPY')).toHaveText('¥1,800');
  await expect(page.getByTestId('currency-row-JPY')).toContainText('Placeholder (not checked yet)');
  await expect(page.getByTestId('currency-toggle-USD')).toBeDisabled();
});

test('switching a currency on and refreshing rates', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Currencies' }).click();
  await page.getByTestId('currency-toggle-JPY').click();
  await expect.poll(() => mockApi.lastVariables('AdminSaveCurrencyRate')).toMatchObject({ code: 'JPY', active: true });

  await page.getByTestId('currencies-refresh').click();
  await expect(page.getByText('Updated 1 currency(s).')).toBeVisible();
});

test('switching a currency off asks first', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Currencies' }).click();

  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.getByTestId('currency-toggle-LKR').click();
  await expect(page.getByTestId('currency-toggle-LKR')).toHaveText('On');
  expect(mockApi.lastVariables('AdminSaveCurrencyRate')).toBeUndefined();

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('Switch LKR off?');
    void dialog.accept();
  });
  await page.getByTestId('currency-toggle-LKR').click();
  await expect.poll(() => mockApi.lastVariables('AdminSaveCurrencyRate')).toMatchObject({ code: 'LKR', active: false });
});

test('a typed rate is pinned', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Currencies' }).click();
  await page.getByTestId('currency-edit-LKR').click();
  await page.getByTestId('currency-rate').fill('301.5');
  await expect(page.getByTestId('currency-pinned')).toBeChecked();
  await page.getByTestId('currency-save').click();
  await expect.poll(() => mockApi.lastVariables('AdminSaveCurrencyRate')).toMatchObject({
    code: 'LKR',
    ratePerUsd: '301.5',
    isManual: true,
  });
});

test('adding a currency that is already listed does not overwrite it', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Currencies' }).click();
  await page.getByRole('button', { name: /Add currency/i }).click();
  await page.getByTestId('currency-code').fill('LKR');
  await page.getByTestId('currency-rate').fill('1');
  await page.getByTestId('currency-save').click();
  await expect(page.getByText('LKR is already in the list. Edit that row instead.')).toBeVisible();
  expect(mockApi.lastVariables('AdminSaveCurrencyRate')).toBeUndefined();
});
