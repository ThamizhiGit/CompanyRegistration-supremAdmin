import { test, expect } from '../fixtures/graphql.fixture';

test('users edit in popup and activity pages exist', async ({ adminPage: page }) => {
  await page.getByRole('button', { name: 'Users' }).click();
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

  const johnRow = page.getByRole('row', { name: 'John Doe' });
  await johnRow.locator('button[title="View Activity"]').click();
  await expect(page.getByRole('heading', { name: 'User Activity - John Doe' })).toBeVisible();
  await expect(page.getByText('Created user account')).toBeVisible();
  await page.getByRole('button', { name: '×' }).click();

  await johnRow.locator('button[title="Edit User"]').click();
  await expect(page.getByRole('heading', { name: 'Edit User' })).toBeVisible();
  await expect(page.getByText('Location Id')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('user activity modal is scoped to clicked user', async ({ adminPage: page }) => {
  await page.getByRole('button', { name: 'Users' }).click();
  const johnRow = page.getByRole('row', { name: 'John Doe' });
  await johnRow.locator('button[title="View Activity"]').click();

  await expect(page.getByRole('heading', { name: 'User Activity - John Doe' })).toBeVisible();
  await expect(page.locator('details')).toHaveCount(2);
  await expect(page.getByText('Created user account')).toBeVisible();
  await expect(page.getByText('Updated Expense', { exact: true })).toBeVisible();
  await expect(page.getByText('for john@acme.com')).toBeVisible();

  await page.getByRole('button', { name: '×' }).click();
  await expect(page.getByRole('heading', { name: 'User Activity - John Doe' })).toHaveCount(0);
});
