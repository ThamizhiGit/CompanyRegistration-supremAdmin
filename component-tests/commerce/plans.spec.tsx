import React from 'react';
import { expect, test } from '@playwright/experimental-ct-react';
import { type MockedResponse } from '@apollo/client/testing';
import { PlansHarness } from '../fixtures/commerce-harnesses';
import {
  ADMIN_DELETE_PLAN_MUTATION,
  ADMIN_PLANS_QUERY,
  ADMIN_PROMO_CODES_QUERY,
  ADMIN_SAVE_PROMO_CODE_MUTATION,
} from '../../src/lib/graphql';

const planVariables = { includeInactive: true, search: null, active: null };
const promoVariables = { includeInactive: true, search: null, active: null, planId: null };

const paidPlan = {
  id: 'team',
  name: 'Team',
  description: 'For growing teams',
  basePriceCents: 2500,
  currency: 'USD',
  billingInterval: 'monthly',
  perEmployee: false,
  trialMonths: 1,
  employeeLimit: 50,
  features: ['Reports'],
  recommended: true,
  active: true,
  sortOrder: 1,
};

const baseMocks = (plans = [paidPlan], promos: unknown[] = []): MockedResponse[] => [
  { request: { query: ADMIN_PLANS_QUERY, variables: planVariables }, result: { data: { adminPlans: plans } } },
  { request: { query: ADMIN_PROMO_CODES_QUERY, variables: promoVariables }, result: { data: { adminPromoCodes: promos } } },
];

test.describe('commerce / plans', () => {
  test('shows loading, backend data, search filtering, and the promo empty state', async ({ mount }) => {
    const loading = await mount(<PlansHarness scenario="loading" />);
    await expect(loading.getByText('Loading plans...')).toBeVisible();
    await loading.unmount();
    const component = await mount(<PlansHarness scenario="data" />);
    await expect(component.getByText('Team', { exact: true })).toBeVisible();
    await component.getByRole('button', { name: 'Table View' }).click();
    await component.getByPlaceholder('Search plans').fill('does-not-exist');
    await expect(component.getByText('No plans found')).toBeVisible();
    await component.getByRole('button', { name: 'Promo Codes' }).click();
    await expect(component.getByText('No promo codes found')).toBeVisible();
  });

  test('uses the canonical fallback when the plans query errors', async ({ mount }) => {
    const component = await mount(
      <PlansHarness scenario="error" />,
    );

    await expect(component.getByText(/Showing canonical fallback plans/)).toBeVisible();
    await expect(component.getByText('Premium', { exact: true })).toBeVisible();
  });

  test('creates a promo code and reports validation failures', async ({ mount }) => {
    const saveVariables = {
      input: {
        code: 'SAVE20',
        name: '',
        discountType: 'percent',
        discountValue: 20,
        currency: 'USD',
        active: true,
        startsAt: null,
        endsAt: null,
        maxRedemptions: null,
        perEmailLimit: null,
        perCompanyLimit: null,
        firstTimeCustomerOnly: false,
        minimumAmountCents: null,
        appliesToPlanIds: ['team'],
        applicableBillingIntervals: [],
      },
    };
    const component = await mount(
      <PlansHarness scenario="actions" />,
    );

    await component.getByRole('button', { name: 'Promo Codes' }).click();
    await component.getByRole('button', { name: /New promo/i }).click();
    await component.getByRole('button', { name: 'Create promo' }).click();
    await expect(component.getByLabel('toast')).toHaveText('error: Promo code is required');
    await component.getByPlaceholder('SAVE20').fill('save20');
    await component.getByLabel('Discount %').fill('20');
    await component.getByRole('button', { name: 'Create promo' }).click();
    await expect(component.getByLabel('toast')).toHaveText('success: Promo code "SAVE20" created');
  });

  test('deletes a plan only after collecting an audit reason', async ({ mount, page }) => {
    const component = await mount(
      <PlansHarness scenario="actions" />,
    );

    page.once('dialog', async (dialog) => dialog.accept('Retired after migration'));
    const teamPlan = component.locator('article').filter({ hasText: 'Team' });
    await teamPlan.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(component.getByLabel('toast')).toHaveText('success: Plan "Team" deleted');
  });
});
