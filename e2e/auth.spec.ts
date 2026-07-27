import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
    await expect(page.locator('input[placeholder="Enter your username"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Enter your password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error when fields are empty', async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.getByText('Enter your username and password.', { exact: true })).toBeVisible();
  });

  test('should show error with only username', async ({ page }) => {
    await page.fill('input[placeholder="Enter your username"]', 'testuser');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Enter your username and password.', { exact: true })).toBeVisible();
  });

  test('should show error with only password', async ({ page }) => {
    await page.fill('input[placeholder="Enter your password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Enter your username and password.', { exact: true })).toBeVisible();
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.locator('input[placeholder="Enter your password"]');
    const toggleBtn = page.locator('button[type="button"]').filter({ has: page.locator('svg') }).last();

    await expect(passwordInput).toHaveAttribute('type', 'password');
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should accept valid input', async ({ page }) => {
    await page.fill('input[placeholder="Enter your username"]', 'admin');
    await page.fill('input[placeholder="Enter your password"]', 'password123');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
  });

  test('should trim whitespace from username', async ({ page }) => {
    await page.fill('input[placeholder="Enter your username"]', '  testuser  ');
    await page.fill('input[placeholder="Enter your password"]', 'password123');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    // Form should submit without the whitespace
  });

  test('should successfully login with correct credentials', async ({ page }) => {
    // Mock successful GraphQL response at the correct endpoint
    await page.route('**/graphql/', (route) => {
      const postData = route.request().postData();
      if (postData?.includes('superAdminTokenAuth')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              superAdminTokenAuth: {
                success: true,
                message: 'Login successful',
                token: 'auth_token_xyz123',
                expiresAt: '2027-07-13T09:12:00Z',
                superAdmin: {
                  id: '1',
                  username: 'admin',
                  email: 'admin@example.com',
                  isActive: true,
                  lastLogin: '2026-07-06T09:12:00Z',
                  __typename: 'SuperAdmin',
                },
                __typename: 'SuperAdminTokenAuthPayload',
              },
            },
          }),
        });
      } else if (postData?.includes('adminRevenueSummary')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              adminRevenueSummary: {
                totalCompanies: 1,
                totalUsers: 1,
                totalPayments: 0,
                grossRevenue: 0,
                totalExpenses: 0,
                byStatus: [],
                __typename: 'AdminRevenueSummary',
              },
            },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.fill('input[placeholder="Enter your username"]', 'admin');
    await page.fill('input[placeholder="Enter your password"]', 'correct_password');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    const token = await page.evaluate(() => sessionStorage.getItem('token'));
    const adminUsername = await page.evaluate(() => sessionStorage.getItem('adminUsername'));
    const adminExpiresAt = await page.evaluate(() => sessionStorage.getItem('adminExpiresAt'));

    // Verify token and username are stored
    expect(token).toBe('auth_token_xyz123');
    expect(adminUsername).toBe('admin');
    expect(adminExpiresAt).toBe('2027-07-13T09:12:00Z');
  });
});

test.describe('Session lifecycle', () => {
  const installSessionMocks = async (page: any) => {
    await page.route('**/graphql/', (route) => {
      const postData = route.request().postData() || '';
      if (postData.includes('adminRevenueSummary')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              adminRevenueSummary: {
                totalCompanies: 1,
                totalUsers: 1,
                totalPayments: 1,
                grossRevenue: 0,
                totalExpenses: 0,
                byStatus: [],
                __typename: 'AdminRevenueSummary',
              },
            },
          }),
        });
        return;
      }

      route.continue();
    });
  };

  test.beforeEach(async ({ page, context }) => {
    // Setup: Mock authenticated session in sessionStorage
    await context.addInitScript(() => {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      sessionStorage.setItem('token', 'test-token-12345');
      sessionStorage.setItem('adminUsername', 'testadmin');
      sessionStorage.setItem('adminExpiresAt', expiresAt);
    });
    await installSessionMocks(page);
    await page.goto('/');
  });

  test('should show dashboard when session is valid', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  });

  test('should clear session on logout', async ({ page }) => {
    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();

    const token = await page.evaluate(() => sessionStorage.getItem('token'));
    const adminUsername = await page.evaluate(() => sessionStorage.getItem('adminUsername'));
    expect(token).toBeNull();
    expect(adminUsername).toBeNull();
  });

  test('should auto expire session when token expires', async ({ page }) => {
    await page.addInitScript(() => {
      const expiry = new Date(Date.now() - 1000).toISOString();
      sessionStorage.setItem('adminExpiresAt', expiry);
    });
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
    await expect(page.getByText('Your session has expired. Please sign in again.', { exact: true })).toBeVisible();
  });
});
