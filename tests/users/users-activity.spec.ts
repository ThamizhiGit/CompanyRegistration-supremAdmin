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

test('users: every page is loaded and a failed later page is reported, not hidden', async ({ adminPage: page, mockApi }) => {
  const many = Array.from({ length: 201 }, (_, index) => ({
    ...mockApi.users[1],
    id: 100 + index,
    username: `bulk${index + 1}`,
    email: `bulk${index + 1}@acme.com`,
    firstName: 'Bulk',
    lastName: `User ${index + 1}`,
  }));
  let failSecondPage = true;
  mockApi.setOverride('AdminUsers', (payload) => {
    const offset = payload.variables?.offset ?? 0;
    if (offset > 0 && failSecondPage) return { errors: [{ message: 'users page 2 unavailable' }] };
    return { data: { adminUsers: many.slice(offset, offset + 200) } };
  });
  await page.getByRole('button', { name: 'Users' }).click();
  await expect(page.getByTestId('partial-list-warning')).toContainText('Only the first 200 users could be loaded: users page 2 unavailable');
  await expect(page.getByText('bulk201@acme.com')).toHaveCount(0);

  failSecondPage = false;
  await page.getByTestId('partial-list-warning').getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('bulk201@acme.com')).toBeVisible();
});

test('a user edit is sent with the numeric user id the API expects', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Users' }).click();
  await page.getByRole('row', { name: 'John Doe' }).locator('button[title="Edit User"]').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => mockApi.lastVariables('AdminUpdateUser')?.userId).toBe(1);
  await expect(page.getByText('User updated')).toBeVisible();
});
