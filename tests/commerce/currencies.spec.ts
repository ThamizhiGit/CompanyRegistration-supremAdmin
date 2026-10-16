import { test, expect } from '../fixtures/graphql.fixture';

const rate = (over: Record<string, unknown>) => ({
  name: '',
  symbol: '',
  zeroDecimal: false,
  roundingUnitMinor: 100,
  isManual: false,
  active: true,
  source: 'er-api',
  updatedAt: '2026-09-24T02:15:00Z',
  isBase: false,
  convert: null,
  __typename: 'AdminCurrencyRate',
  ...over,
});

test('currency rates: preview, pin a rate, refresh now', async ({ adminPage: page, mockApi }) => {
  mockApi.setOverride('AdminCurrencyRates', (payload) => {
    const cents = Number(payload.variables?.previewUsdCents ?? 0);
    return {
      data: {
        adminCurrencyRates: {
          baseCurrency: 'USD',
          lastRefreshedAt: '2026-09-24T02:15:00Z',
          sourceUrl: 'https://open.er-api.com/v6/latest/USD',
          rates: [
            rate({ code: 'USD', name: 'US Dollar', symbol: '$', ratePerUsd: '1', isBase: true, source: 'seed', convert: cents }),
            rate({ code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', ratePerUsd: '300', roundingUnitMinor: 10000, convert: Math.round((cents * 300) / 10000) * 10000 }),
            rate({ code: 'JPY', name: 'Japanese Yen', symbol: '¥', ratePerUsd: '150', zeroDecimal: true, isManual: true, convert: Math.round((cents * 150) / 100) }),
          ],
          __typename: 'AdminCurrencyRatesOverview',
        },
      },
    };
  });
  mockApi.setOverride('AdminSaveCurrencyRate', {
    data: { adminSaveCurrencyRate: { success: true, message: 'LKR saved.', rate: null, __typename: 'AdminSaveCurrencyRate' } },
  });
  mockApi.setOverride('AdminRefreshCurrencyRates', {
    data: { adminRefreshCurrencyRates: { success: true, message: 'Updated 7 rate(s).', updatedCount: 7, __typename: 'AdminRefreshCurrencyRates' } },
  });

  await page.getByRole('button', { name: 'Currencies' }).click();
  await expect(page.getByRole('heading', { name: 'Currency Rates' })).toBeVisible();
  const lkrRow = page.getByRole('row', { name: /LKR/ });
  await expect(lkrRow).toContainText('LKR 7,700.00');   // $25.50 x 300, rounded to Rs 100
  await expect(lkrRow).toContainText('Nearest 100');
  await expect(page.getByRole('row', { name: /JPY/ })).toContainText('Pinned');
  await expect(page.getByRole('row', { name: /JPY/ })).toContainText('¥3,825');

  await page.getByLabel('Preview USD amount').fill('100');
  await expect(lkrRow).toContainText('LKR 30,000.00');

  await page.getByRole('button', { name: 'Edit LKR' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit LKR' });
  await dialog.getByLabel('Rate per USD').fill('310.5');
  await expect(dialog.getByRole('checkbox', { name: /Pin this rate/ })).toBeChecked();   // editing a rate pins it
  await dialog.getByLabel('Round prices to').fill('50');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(() => mockApi.lastVariables('AdminSaveCurrencyRate')?.input)
    .toEqual({ code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', ratePerUsd: '310.5', roundingUnitMinor: 5000, active: true, isManual: true });
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Refresh rates now' }).click();
  await expect(page.getByText('Updated 7 rate(s).')).toBeVisible();
  expect(mockApi.requests.get('AdminRefreshCurrencyRates')?.length).toBe(1);
});

test('currency form validates before saving', async ({ adminPage: page, mockApi }) => {
  mockApi.setOverride('AdminCurrencyRates', {
    data: { adminCurrencyRates: { baseCurrency: 'USD', lastRefreshedAt: null, sourceUrl: '', rates: [], __typename: 'AdminCurrencyRatesOverview' } },
  });
  await page.getByRole('button', { name: 'Currencies' }).click();
  await expect(page.getByTestId('last-refreshed')).toHaveText('Never');
  await page.getByRole('button', { name: 'Add currency' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add currency' });
  await dialog.getByLabel('Code').fill('rs');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Currency code must be 3 letters (e.g. LKR)')).toBeVisible();
  await dialog.getByLabel('Code').fill('NPR');
  await dialog.getByLabel('Rate per USD').fill('-3');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Rate must be a number greater than 0')).toBeVisible();
  expect(mockApi.requests.get('AdminSaveCurrencyRate')).toBeUndefined();
});
