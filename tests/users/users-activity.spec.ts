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

test('users: one page at a time; a failed page is reported with a retry, not hidden', async ({ adminPage: page, mockApi }) => {
  const many = Array.from({ length: 201 }, (_, index) => ({
    ...mockApi.users[1],
    id: 100 + index,
    username: `bulk${index + 1}`,
    email: `bulk${index + 1}@acme.com`,
    firstName: 'Bulk',
    lastName: `User ${index + 1}`,
  }));
  let failLaterPages = false;
  mockApi.setOverride('AdminUsersFeed', (payload) => {
    const filter = payload.variables?.filter ?? {};
    const offset = filter.offset ?? 0;
    if (offset > 0 && failLaterPages) return { errors: [{ message: 'users page 2 unavailable' }] };
    return {
      data: {
        adminUsersFeed: { totalCount: many.length, items: many.slice(offset, offset + (filter.limit ?? 50)), facets: [], __typename: 'AdminUsersFeedType' },
      },
    };
  });
  await page.getByRole('button', { name: 'Users' }).click();
  await expect(page.getByTestId('pager-summary')).toContainText('1–50 of 201 users');
  await expect(page.getByText('bulk1@acme.com', { exact: true })).toBeVisible();

  failLaterPages = true;
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByRole('alert')).toContainText('users page 2 unavailable');

  failLaterPages = false;
  await page.getByRole('alert').getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('bulk51@acme.com')).toBeVisible();
});

test('a user edit is sent with the numeric user id the API expects', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Users' }).click();
  await page.getByRole('row', { name: 'John Doe' }).locator('button[title="Edit User"]').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => mockApi.lastVariables('AdminUpdateUser')?.userId).toBe(1);
  await expect(page.getByText('User updated')).toBeVisible();
});
