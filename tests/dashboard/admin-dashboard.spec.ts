import { test, expect } from '../fixtures/graphql.fixture';
import { loginAsAdmin } from '../fixtures/auth.fixture';

test('renders dashboard summary with expense-aware metrics and backward compatibility', async ({
  page,
  mockApi,
}) => {
  mockApi.legacyRevenue = true;
  await loginAsAdmin(page);

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Gross Revenue')).toBeVisible();
  await expect(page.getByText('Total Expenses')).toBeVisible();
  await expect(page.getByText('Net Revenue')).toBeVisible();
  await expect(page.locator('body')).toContainText('$1,200.00');
  await expect(page.locator('body')).toContainText('$0.00');
  await expect(page.getByText('Payment Status Breakdown')).toBeVisible();
});
