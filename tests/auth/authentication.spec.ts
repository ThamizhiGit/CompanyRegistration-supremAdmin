import { test, expect } from '../fixtures/graphql.fixture';
import { futureIso, pastIso } from '../fixtures/data-factories';
import { seedAdminSession } from '../fixtures/auth.fixture';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page, mockApi: _mockApi }) => {
    await page.goto('/');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Enter your username')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error when fields are empty', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Enter your username and password.', { exact: true })).toBeVisible();
  });

  test('should show error with only username', async ({ page }) => {
    await page.getByPlaceholder('Enter your username').fill('testuser');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Enter your username and password.', { exact: true })).toBeVisible();
  });

  test('should show error with only password', async ({ page }) => {
    await page.getByPlaceholder('Enter your password').fill('password123');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Enter your username and password.', { exact: true })).toBeVisible();
  });

  test('should toggle password visibility', async ({ page }) => {
    const password = page.getByPlaceholder('Enter your password');
    const toggle = password.locator('xpath=following-sibling::button');

    await expect(password).toHaveAttribute('type', 'password');
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'text');
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('should accept valid input', async ({ page }) => {
    await page.getByPlaceholder('Enter your username').fill('admin');
    await page.getByPlaceholder('Enter your password').fill('password123');
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('should trim whitespace from username', async ({ page, mockApi }) => {
    await page.getByPlaceholder('Enter your username').fill('  testuser  ');
    await page.getByPlaceholder('Enter your password').fill('password123');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect.poll(() => mockApi.lastVariables('SuperAdminLogin')?.username).toBe('testuser');
  });

  test('should successfully login with correct credentials', async ({ page, mockApi }) => {
    const expiresAt = futureIso(60);
    mockApi.setOverride('SuperAdminLogin', {
      data: {
        superAdminTokenAuth: {
          success: true,
          message: 'Login successful',
          token: 'auth_token_xyz123',
          expiresAt,
          superAdmin: {
            id: '1',
            username: 'admin',
            email: 'admin@example.com',
            isActive: true,
            lastLogin: pastIso(),
            __typename: 'SuperAdmin',
          },
          __typename: 'SuperAdminTokenAuthPayload',
        },
      },
    });

    await page.getByPlaceholder('Enter your username').fill('admin');
    await page.getByPlaceholder('Enter your password').fill('correct_password');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          token: sessionStorage.getItem('token'),
          username: sessionStorage.getItem('adminUsername'),
          expiresAt: sessionStorage.getItem('adminExpiresAt'),
        })),
      )
      .toEqual({ token: 'auth_token_xyz123', username: 'admin', expiresAt });
  });
});

test.describe('Session lifecycle', () => {
  test.beforeEach(async ({ mockApi: _mockApi }) => {});

  test('should show dashboard when session is valid', async ({ page }) => {
    await seedAdminSession(page, { username: 'testadmin' });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  });

  test('should clear session on logout', async ({ page }) => {
    await seedAdminSession(page, { username: 'testadmin' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(() => ({
          token: sessionStorage.getItem('token'),
          username: sessionStorage.getItem('adminUsername'),
        })),
      )
      .toEqual({ token: null, username: null });
  });

  test('should auto expire session when token expires', async ({ page }) => {
    await seedAdminSession(page, {
      username: 'testadmin',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
    await expect(page.getByText('Your session has expired. Please sign in again.')).toBeVisible();
  });
});
