import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { SharedLayoutStory } from '../fixtures/shared-test-stories';

test.describe('AdminLayout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('renders account context, active navigation, children, and changes pages', async ({ mount, page }) => {
    await mount(<SharedLayoutStory />);

    await expect(page.getByRole('heading', { name: 'Supreme Admin' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content: dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');

    await page.getByRole('button', { name: 'Companies' }).click();
    await expect(page.getByRole('heading', { name: 'Content: companies' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Companies' })).toHaveAttribute('aria-current', 'page');
  });

  test('collapses and expands the desktop sidebar', async ({ mount, page }) => {
    await mount(<SharedLayoutStory />);

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Plans' })).toHaveAttribute('title', 'Plans');

    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
  });

  test('opens settings and profile menus, supports Escape, and requests logout', async ({ mount, page }) => {
    await mount(<SharedLayoutStory />);

    const settings = page.getByRole('button', { name: 'Settings' });
    await settings.click();
    const settingsDialog = page.locator('#admin-settings-panel');
    await expect(settingsDialog).toHaveAttribute('aria-hidden', 'false');
    await expect(settingsDialog).toContainText('Ada Admin');
    await page.keyboard.press('Escape');
    await expect(settingsDialog).toHaveAttribute('aria-hidden', 'true');
    await expect(settings).toBeFocused();

    const account = page.getByRole('button', { name: 'Account menu for Ada Admin' });
    await account.click();
    const menu = page.locator('#admin-profile-menu');
    await expect(menu).toHaveAttribute('aria-hidden', 'false');
    await page.getByRole('menuitem', { name: 'View Profile' }).click();
    await expect(menu).toContainText('Username: Ada Admin');
    await page.getByRole('menuitem', { name: 'Sign Out' }).click();
    await expect(page.getByText('logout requested')).toBeVisible();
  });

  test('displays a live session countdown and header logout calls the handler', async ({ mount, page }) => {
    await page.evaluate(() => {
      window.sessionStorage.setItem('adminExpiresAt', new Date(Date.now() + 65_000).toISOString());
    });
    await mount(<SharedLayoutStory />);

    const logout = page.locator('button[aria-label="Logout"]');
    await expect(logout).not.toContainText('00:00:00');
    await logout.click();
    await expect(page.getByText('logout requested')).toBeVisible();
  });
});

test.describe('AdminLayout mobile navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('opens, navigates, and restores focus after closing the sidebar', async ({ mount, page }) => {
    await mount(<SharedLayoutStory />);

    const menuButton = page.getByRole('button', { name: 'Open navigation' });
    const sidebar = page.locator('aside[aria-label="Admin navigation"]');
    await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
    await menuButton.click({ force: true });
    await expect(sidebar).toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByRole('button', { name: 'Close navigation', exact: true })).toBeFocused();

    await page.getByRole('button', { name: 'Users' }).click();
    await expect(page.getByRole('heading', { name: 'Content: users' })).toBeVisible();
    await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
    await expect(menuButton).toBeFocused();
  });

  test('closes settings first and then navigation on consecutive Escape presses', async ({ mount, page }) => {
    await mount(<SharedLayoutStory />);

    await page.getByRole('button', { name: 'Open navigation' }).click({ force: true });
    await page.getByRole('button', { name: 'Settings' }).click();
    const settingsDialog = page.locator('#admin-settings-panel');
    const sidebar = page.locator('aside[aria-label="Admin navigation"]');
    await expect(settingsDialog).toHaveAttribute('aria-hidden', 'false');

    await page.keyboard.press('Escape');
    await expect(settingsDialog).toHaveAttribute('aria-hidden', 'true');
    await expect(sidebar).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
  });
});
