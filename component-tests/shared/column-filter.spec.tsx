import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import {
  buildColumnFilterOptions,
  EMPTY_FILTER_VALUE,
  matchesColumnFilter,
  toColumnFilterValue,
} from '../../src/components/admin/ColumnFilter';
import { SharedFilterStory } from '../fixtures/shared-test-stories';

test.describe('ColumnFilter helpers', () => {
  test('normalizes empty values and builds sorted, counted options', () => {
    const rows = [
      { status: 'Zulu' },
      { status: null },
      { status: 'alpha' },
      { status: 'Zulu' },
      { status: '' },
    ];

    expect(toColumnFilterValue(undefined)).toBe(EMPTY_FILTER_VALUE);
    expect(toColumnFilterValue(42)).toBe('42');
    expect(buildColumnFilterOptions(rows, (row) => row.status)).toEqual([
      { value: 'alpha', count: 1 },
      { value: 'Zulu', count: 2 },
      { value: EMPTY_FILTER_VALUE, count: 2 },
    ]);
  });

  test('matches all rows without a selection and exact normalized values otherwise', () => {
    expect(matchesColumnFilter([], 'anything')).toBe(true);
    expect(matchesColumnFilter(['Active'], 'Active')).toBe(true);
    expect(matchesColumnFilter(['Active'], 'Inactive')).toBe(false);
    expect(matchesColumnFilter([EMPTY_FILTER_VALUE], null)).toBe(true);
  });
});

test.describe('ColumnFilter component', () => {
  test('searches values, reports no matches, and closes with Done', async ({ mount, page }) => {
    await mount(<SharedFilterStory />);

    const trigger = page.getByTitle('Status filter');
    await expect(trigger).toHaveText(/Filter/);
    await trigger.click();

    await expect(page.getByText('Status', { exact: true })).toBeVisible();
    const search = page.getByPlaceholder('Search values...');
    await search.fill('active');
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await expect(page.getByText('Inactive', { exact: true })).toBeVisible();

    await search.fill('missing');
    await expect(page.getByText('No values')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(search).toBeHidden();
  });

  test('selects multiple values, deselects, and clears the controlled selection', async ({ mount, page }) => {
    await mount(<SharedFilterStory />);
    const trigger = page.getByTitle('Status filter');
    const selected = page.getByLabel('selected values');

    await trigger.click();
    await page.getByText('Active', { exact: true }).locator('..').locator('input').check();
    await page.getByText('Inactive', { exact: true }).locator('..').locator('input').check();
    await expect(selected).toHaveText('Active|Inactive');
    await expect(trigger).toContainText('2 selected');

    await page.getByText('Active', { exact: true }).locator('..').locator('input').uncheck();
    await expect(selected).toHaveText('Inactive');
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(selected).toHaveText('none');
    await expect(trigger).toHaveText(/Filter/);
  });

  test('closes its portalled popup on Escape and outside pointer interaction', async ({ mount, page }) => {
    await mount(<SharedFilterStory />);
    const trigger = page.getByTitle('Status filter');
    const search = page.getByPlaceholder('Search values...');

    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(search).toBeHidden();

    await trigger.click();
    await page.getByRole('button', { name: 'Outside target' }).dispatchEvent('mousedown');
    await expect(search).toBeHidden();
  });
});
