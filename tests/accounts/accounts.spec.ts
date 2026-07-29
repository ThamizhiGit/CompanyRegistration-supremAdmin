import { test, expect } from '../fixtures/graphql.fixture';

test('infrastructure period change updates trend payload in UI', async ({
  adminPage: page,
}) => {
  await page.getByRole('button', { name: 'Accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Infrastructure' })).toBeVisible();

  await expect(page.getByText('Income').first()).toBeVisible();
  await expect(page.getByText('Expense').first()).toBeVisible();
  await expect(page.getByText('Net').first()).toBeVisible();
  await expect(page.getByText('Pending balance')).toBeVisible();

  const period = page.getByLabel('Infrastructure reporting period');
  await expect(page.getByText('Daily trend (30d)')).toBeVisible();
  await expect(page.getByText('$500.00')).toBeVisible();
  await period.selectOption('7d');
  await expect(page.getByText('Daily trend (7d)')).toBeVisible();
  await expect(page.getByText('$120.00')).toBeVisible();
  await expect(page.getByText('$35.00')).toBeVisible();
});
