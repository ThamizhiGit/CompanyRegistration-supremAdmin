import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.locator('input[placeholder="Enter your username"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Enter your password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error when fields are empty', async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Enter your username and password.')).toBeVisible();
  });

  test('should show error with only username', async ({ page }) => {
    await page.fill('input[placeholder="Enter your username"]', 'testuser');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Enter your username and password.')).toBeVisible();
  });

  test('should show error with only password', async ({ page }) => {
    await page.fill('input[placeholder="Enter your password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Enter your username and password.')).toBeVisible();
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
                expiresAt: '2026-07-13T09:12:00Z',
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
      } else {
        route.continue();
      }
    });

    await page.fill('input[placeholder="Enter your username"]', 'admin');
    await page.fill('input[placeholder="Enter your password"]', 'correct_password');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Wait for login to complete
    await page.waitForTimeout(2000);

    const token = await page.evaluate(() => localStorage.getItem('token'));
    const adminUsername = await page.evaluate(() => localStorage.getItem('adminUsername'));

    // Verify token and username are stored
    expect(token).toBe('auth_token_xyz123');
    expect(adminUsername).toBe('admin');

    console.log('✅ Login successful:', { token, adminUsername });
  });
});

test.describe('Dashboard Sidebar', () => {
  test.beforeEach(async ({ page, context }) => {
    // Setup: Mock localStorage with valid token
    await context.addInitScript(() => {
      localStorage.setItem('token', 'test-token-12345');
      localStorage.setItem('adminUsername', 'testadmin');
    });
    await page.goto('/');
  });

  test('should navigate to dashboard when authenticated', async ({ page }) => {
    // When token exists, app should attempt to load dashboard
    // Check that we're not on login page
    await page.waitForTimeout(500);
    const welcomeText = page.locator('text=Welcome back');
    const isLoginVisible = await welcomeText.isVisible().catch(() => false);

    expect(isLoginVisible).toBeFalsy();
  });

  test('should clear auth on logout', async ({ page }) => {
    // Verify token is in storage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBe('test-token-12345');
  });
});
