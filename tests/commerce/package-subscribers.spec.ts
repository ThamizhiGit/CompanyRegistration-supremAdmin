import { test, expect } from '../fixtures/graphql.fixture';

const packaging = (outdated: number) => ({
  data: {
    adminPlans: [
      {
        id: 'premium',
        pricingMode: 'fixed',
        bundleDiscountPct: 0,
        yearlyPriceCents: null,
        yearlyDiscountPct: 0,
        isPublic: true,
        version: 3,
        availableIntervals: ['monthly'],
        companiesCount: 2,
        subscribersCount: 2,
        outdatedSubscribersCount: outdated,
        modules: [],
        pricing: { currency: 'USD', monthlyPriceCents: 1200, yearlyPriceCents: null, savingsPct: 0, __typename: 'PackagePriceBreakdown' },
        __typename: 'AdminPlan',
      },
    ],
  },
});

test('an edited package can be pushed to its existing subscribers after a preview', async ({
  adminPage: page,
  mockApi,
}) => {
  let applied = false;
  mockApi.setOverride('AdminPlansPackaging', () => packaging(applied ? 0 : 2));
  mockApi.setOverride('AdminApplyPlanToSubscribers', (payload) => {
    const dryRun = Boolean(payload.variables?.dryRun);
    if (!dryRun) applied = true;
    return {
      data: {
        adminApplyPlanToSubscribers: {
          success: true,
          message: dryRun ? '2 subscriber(s) would be updated.' : 'Package applied to 2 subscriber(s).',
          dryRun,
          updatedCount: dryRun ? 0 : 2,
          changes: [
            { companyId: 12, companyName: 'Acme Labs', fromVersion: 2, toVersion: 3, added: ['accounting_reconciliation'], removed: [], __typename: 'AdminPlanSubscriberChange' },
            { companyId: 13, companyName: 'Beta Co', fromVersion: 1, toVersion: 3, added: [], removed: ['workforce_ai'], __typename: 'AdminPlanSubscriberChange' },
          ],
          plan: { id: 'premium', version: 3, subscribersCount: 2, outdatedSubscribersCount: dryRun ? 2 : 0, __typename: 'AdminPlan' },
          __typename: 'AdminApplyPlanToSubscribers',
        },
      },
    };
  });

  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByText('2 subscriber(s) · v3')).toBeVisible();
  await page.getByRole('button', { name: 'Apply to 2 subscriber(s)' }).click();

  const dialog = page.getByRole('dialog', { name: 'Apply package to existing subscribers' });
  const changes = dialog.getByTestId('apply-subscriber-changes');
  await expect(changes).toContainText('Acme Labs');
  await expect(changes).toContainText('+ Accounting Reconciliation');
  await expect(changes).toContainText('− Workforce Ai');
  await expect(dialog).toContainText('Prices do not change.');
  expect(mockApi.lastVariables('AdminApplyPlanToSubscribers')).toMatchObject({ planId: 'premium', dryRun: true, onlyOutdated: true });

  await dialog.getByLabel('Apply reason').fill('Added accounting');
  await dialog.getByRole('button', { name: 'Apply to 2 subscribers' }).click();
  await expect
    .poll(() => mockApi.lastVariables('AdminApplyPlanToSubscribers'))
    .toMatchObject({ planId: 'premium', dryRun: false, reason: 'Added accounting' });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apply to 2 subscriber(s)' })).toHaveCount(0);
});
