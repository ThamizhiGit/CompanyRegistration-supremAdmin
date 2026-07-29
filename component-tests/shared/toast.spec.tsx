import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { SharedToastStory } from '../fixtures/shared-test-stories';

test.describe('Toast', () => {
  for (const [type, background, color] of [
    ['success', 'rgb(225, 245, 225)', 'rgb(45, 106, 79)'],
    ['error', 'rgb(255, 225, 225)', 'rgb(185, 28, 28)'],
    ['info', 'rgb(224, 247, 250)', 'rgb(0, 131, 143)'],
  ] as const) {
    test(`renders the ${type} variant`, async ({ mount, page }) => {
      await mount(<SharedToastStory type={type} />);

      const message = page.getByText(`${type} notification`);
      await expect(message).toBeVisible();
      const toast = message.locator('..');
      await expect(toast).toHaveCSS('background-color', background);
      await expect(toast).toHaveCSS('color', color);
      await expect(toast.locator('svg')).toHaveCount(2);
    });
  }

  test('closes immediately from the close control', async ({ mount, page }) => {
    await mount(<SharedToastStory type="success" />);

    await page.getByText('success notification').locator('..').locator('button').click();
    await expect(page.getByText('toast closed')).toBeVisible();
    await expect(page.getByText('success notification')).toBeHidden();
  });

  test('automatically closes after its configured duration', async ({ mount, page }) => {
    await mount(<SharedToastStory type="info" duration={300} />);

    await expect(page.getByText('info notification')).toBeVisible();
    await expect(page.getByText('toast closed')).toBeVisible({ timeout: 2_000 });
  });
});
