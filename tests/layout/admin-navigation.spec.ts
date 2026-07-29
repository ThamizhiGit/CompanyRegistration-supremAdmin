import { test, expect } from '../fixtures/graphql.fixture';
import { loginAsAdmin } from '../fixtures/auth.fixture';

test('sidebar has all options and every page loads', async ({ adminPage: page }) => {
  const pages = [
    ['Dashboard', 'Dashboard'],
    ['Plans', 'Plans & Pricing'],
    ['Companies', 'Companies'],
    ['Subscriptions', 'Subscriptions & Payments'],
    ['Users', 'Users'],
    ['Accounts', 'Accounts'],
  ] as const;

  for (const [label, heading] of pages) {
    await page.getByRole('button', { name: label }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
});

test('sidebar exposes active, hover, collapse, and settings interaction feedback', async ({
  adminPage: page,
}) => {
  const sidebar = page.getByRole('complementary', { name: 'Admin navigation' });
  const dashboard = sidebar.getByRole('button', { name: 'Dashboard' });
  const plans = sidebar.getByRole('button', { name: 'Plans' });
  const companies = sidebar.getByRole('button', { name: 'Companies' });
  const settings = sidebar.getByRole('button', { name: 'Settings' });
  const settingsPanel = page.locator('#admin-settings-panel');

  await expect(dashboard).toHaveAttribute('aria-current', 'page');
  await plans.click();
  await expect(plans).toHaveAttribute('aria-current', 'page');
  await companies.hover();
  await expect(companies).toHaveCSS('cursor', 'pointer');

  await settings.click();
  await expect(settingsPanel).toHaveAttribute('aria-hidden', 'false');
  await dashboard.click();
  await expect(settingsPanel).toHaveAttribute('aria-hidden', 'true');

  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(sidebar).toHaveCSS('width', '76px');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(sidebar).toHaveCSS('width', '292px');
  await page.keyboard.press('Escape');
  await expect(settings).toBeFocused();
});

test('mobile sidebar closes cleanly and does not retain stale settings state', async ({
  page,
  mockApi: _mockApi,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsAdmin(page);

  const sidebar = page.locator('aside[aria-label="Admin navigation"]');
  const openNavigation = page.getByRole('button', { name: 'Open navigation' });
  const settingsPanel = page.locator('#admin-settings-panel');

  await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
  await openNavigation.click();
  await expect(sidebar).toHaveAttribute('aria-hidden', 'false');

  const settings = sidebar.getByRole('button', { name: 'Settings' });
  await settings.click();
  await expect(settingsPanel).toHaveAttribute('aria-hidden', 'false');
  await page.keyboard.press('Escape');
  await expect(settingsPanel).toHaveAttribute('aria-hidden', 'true');
  await page.keyboard.press('Escape');
  await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
  await expect(openNavigation).toBeFocused();

  await openNavigation.click();
  await sidebar.getByRole('button', { name: 'Companies' }).click();
  await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible();
  await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
});

test('header account menu exposes working profile and session controls', async ({
  adminPage: page,
}) => {
  const accountButton = page.getByRole('button', { name: 'Account menu for admin' });
  const accountMenu = page.locator('#admin-profile-menu');

  await expect(page.getByRole('button', { name: 'Logout' })).toContainText(/\d{2}:\d{2}:\d{2}/);
  await accountButton.click();
  await expect(accountMenu).toHaveAttribute('aria-hidden', 'false');
  await accountMenu.getByRole('menuitem', { name: 'View Profile' }).click();
  await expect(accountMenu.getByText('Username:')).toBeVisible();
  await expect(accountMenu.getByText('admin', { exact: true })).toBeVisible();
  await expect(accountMenu.getByRole('menuitem', { name: 'Sign Out' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(accountMenu).toHaveAttribute('aria-hidden', 'true');
  await expect(accountButton).toBeFocused();
});
