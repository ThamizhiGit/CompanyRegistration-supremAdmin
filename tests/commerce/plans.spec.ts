import { test, expect } from '../fixtures/graphql.fixture';

test('admin navigation and plans popup flows', async ({ adminPage: page }) => {
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByRole('heading', { name: 'Plans & Pricing' })).toBeVisible();

  await page.getByPlaceholder('Search plans').fill('premium');
  await page.getByRole('button', { name: 'New plan' }).click();
  await expect(page.getByRole('heading', { name: 'Create Plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).first().click();
  await expect(page.getByRole('heading', { name: 'Edit Plan' })).toBeVisible();
});

test('plan cards show prices, feature areas and subscriber versions', async ({ adminPage: page }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Premium', exact: true })).toBeVisible();
  await expect(page.getByText('Free for 6 months', { exact: true })).toBeVisible();
  await expect(page.getByTestId('plan-price-premium')).toHaveText('$12.00 / mo');

  // A part of a feature area shows under its area, not as a separate module.
  const premiumModules = page.getByTestId('plan-modules-premium');
  await expect(premiumModules).toContainText('Core HR & Employee Management');
  await expect(premiumModules).toContainText('Project Management · Projects & Tasks');
  await expect(page.getByTestId('plan-subscribers-premium')).toHaveText('v2 · 2 subscriber(s) · 1 on an older version');
});

test('plans page saves plan edits with the package modules', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();
  await page.getByLabel('Trial months').fill('7');
  await page.getByRole('button', { name: 'Save plan' }).click();

  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.trialMonths).toBe(7);
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    id: 'premium',
    basePriceCents: 1200,
    currency: 'USD',
    billingInterval: 'monthly',
    perEmployee: true,
    recommended: true,
    modules: [
      { moduleId: 'employee_management', priceOverrideCents: null },
      { moduleId: 'pj_projects', priceOverrideCents: null },
    ],
  });
  // Subscribers are on an older version now: the apply dialog opens with a dry-run preview.
  await expect(page.getByTestId('apply-subscribers-dialog')).toBeVisible();
  await expect.poll(() => mockApi.lastVariables('AdminApplyPlanToSubscribers')?.dryRun).toBe(true);
});

test('plans page saves yearly billing interval edits', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();
  await page.getByTestId('plan-billing-interval').selectOption('yearly');
  await page.getByRole('button', { name: 'Save plan' }).click();

  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.billingInterval).toBe('yearly');
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    id: 'premium',
    name: 'Premium',
    billingInterval: 'yearly',
    basePriceCents: 1200,
    yearlyPriceCents: null,
    yearlyDiscountPct: 0,
  });
});

test('editing a yearly-only package keeps it yearly at the same price', async ({ adminPage: page, mockApi }) => {
  mockApi.plans.push({
    ...mockApi.plans[1],
    id: 'premium_yearly',
    name: 'Premium Yearly',
    basePriceCents: 12000,
    billingInterval: 'yearly',
    trialMonths: 0,
    recommended: false,
  });
  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByTestId('plan-price-premium_yearly')).toHaveText('$120.00 / yr');
  await page.getByRole('button', { name: 'Edit plan' }).nth(2).click();
  await expect(page.getByTestId('plan-billing-interval')).toHaveValue('yearly');
  await expect(page.getByTestId('plan-price')).toHaveValue('120');
  await page.getByRole('button', { name: 'Save plan' }).click();

  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.id).toBe('premium_yearly');
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    billingInterval: 'yearly',
    basePriceCents: 12000,
    isPublic: false,
    modules: [{ moduleId: 'invoicing', priceOverrideCents: null }],
  });
});

test('plans page creates a new plan with a module tree selection', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'New plan' }).click();

  await page.getByLabel('Plan ID').fill('starter');
  await page.getByLabel('Name', { exact: true }).fill('Starter');
  await page.getByTestId('plan-price').fill('5');
  await page.getByLabel('Employee limit').fill('25');
  await page.getByLabel('Description').fill('A starter plan for smaller teams.');
  await page.getByLabel('Features').fill('Core dashboard\nEmail support');

  // A whole feature area, plus one part of another.
  await page.getByTestId('module-checkbox-employee_management').check();
  await page.getByTestId('module-expand-invoicing').click();
  await page.getByTestId('module-checkbox-inv_invoices').check();
  await expect(page.getByTestId('module-checkbox-invoicing')).toHaveJSProperty('indeterminate', true);
  await page.getByRole('button', { name: 'Create plan' }).click();

  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.id).toBe('starter');
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({
    id: 'starter',
    name: 'Starter',
    basePriceCents: 500,
    currency: 'USD',
    billingInterval: 'monthly',
    perEmployee: false,
    trialMonths: 0,
    employeeLimit: 25,
    features: ['Core dashboard', 'Email support'],
    recommended: false,
    active: true,
    sortOrder: 3,
    modules: [
      { moduleId: 'employee_management', priceOverrideCents: null },
      { moduleId: 'inv_invoices', priceOverrideCents: null },
    ],
  });
});

test('a new plan without modules is not saved', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'New plan' }).click();
  await page.getByLabel('Plan ID').fill('empty');
  await page.getByLabel('Name', { exact: true }).fill('Empty');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByText('Select the modules this package unlocks.').first()).toBeVisible();
  expect(mockApi.lastVariables('AdminSavePlan')).toBeUndefined();
});

test('apply an edited package to subscribers after a dry run', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByTestId('apply-subscribers-premium').click();
  const dialog = page.getByTestId('apply-subscribers-dialog');
  const preview = dialog.getByTestId('apply-subscribers-preview');
  await expect(preview).toContainText('Acme Labs');
  // Pre-package companies are left alone unless the admin opts in.
  await expect(preview).not.toContainText('Legacy Co');
  await dialog.getByTestId('apply-subscribers-include-legacy').check();
  await expect(preview).toContainText('Legacy Co');
  await expect(preview).toContainText('Had every module (legacy)');
  await expect(preview).toContainText('Invoicing & Statement of Accounts');

  await dialog.getByTestId('apply-subscribers-submit').click();
  await expect(page.getByText('A reason is required')).toBeVisible();
  await dialog.getByTestId('apply-subscribers-reason').fill('Projects added to Premium');
  await dialog.getByTestId('apply-subscribers-submit').click();
  await expect.poll(() => mockApi.lastVariables('AdminApplyPlanToSubscribers')).toMatchObject({
    planId: 'premium',
    dryRun: false,
    includeUnrestricted: true,
    reason: 'Projects added to Premium',
  });
  await expect(dialog).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Money, currencies and whole numbers (review #185-#187, #193, #194)
// ---------------------------------------------------------------------------

test('switching the plan currency keeps the typed price (10.50 USD -> JPY -> USD)', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'New plan' }).click();
  await page.getByLabel('Plan ID').fill('intl');
  await page.getByLabel('Name', { exact: true }).fill('International');
  await page.getByTestId('module-checkbox-employee_management').check();
  const price = page.getByTestId('plan-price');
  const currency = page.getByTestId('plan-currency');
  await price.fill('10.50');

  // A list of the stored currencies, not a text box converted per keystroke.
  await expect(currency.locator('option')).toHaveText(['JPY', 'LKR', 'USD']);
  await currency.selectOption('JPY');
  await expect(price).toHaveValue('10.50');
  await expect(price).toHaveAttribute('step', '1');
  // JPY has no decimals: refused, not silently rounded to 11.
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByText('Package price must be a whole number of JPY (no decimals).')).toBeVisible();
  expect(mockApi.lastVariables('AdminSavePlan')).toBeUndefined();

  await currency.selectOption('USD');
  await expect(price).toHaveValue('10.50');
  await expect(price).toHaveAttribute('step', '0.01');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.basePriceCents).toBe(1050);
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({ id: 'intl', currency: 'USD', createOnly: true });
});

test('ISK prices are typed in whole units and sent as two-decimal minor units', async ({ adminPage: page, mockApi }) => {
  mockApi.currencies.push({ ...mockApi.currencies[1], code: 'ISK', name: 'Icelandic Krona', symbol: 'kr', decimals: 2 });
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'New plan' }).click();
  await page.getByLabel('Plan ID').fill('iceland');
  await page.getByLabel('Name', { exact: true }).fill('Iceland');
  await page.getByTestId('module-checkbox-employee_management').check();
  await page.getByTestId('plan-currency').selectOption('ISK');
  const price = page.getByTestId('plan-price');
  await expect(price).toHaveAttribute('step', '1');
  await price.fill('1500.5');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByText('Package price must be a whole number of ISK (no decimals).')).toBeVisible();
  expect(mockApi.lastVariables('AdminSavePlan')).toBeUndefined();

  await price.fill('1500');
  await page.getByRole('button', { name: 'Create plan' }).click();
  // Stripe takes ISK as a two-decimal currency: 1500 ISK = 150000.
  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.basePriceCents).toBe(150000);
  expect(mockApi.lastVariables('AdminSavePlan')?.input?.currency).toBe('ISK');
});

test('a decimal yearly discount is refused before it reaches the API', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();
  await page.getByTestId('add-yearly-price').click();
  await page.getByTestId('yearly-discount').fill('12.5');
  await expect(page.getByTestId('package-validation')).toHaveText('Yearly discount (%) must be a whole number between 0 and 100.');
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(page.getByText('Yearly discount (%) must be a whole number between 0 and 100.').first()).toBeVisible();
  expect(mockApi.lastVariables('AdminSavePlan')).toBeUndefined();

  await page.getByTestId('yearly-discount').fill('15');
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.yearlyDiscountPct).toBe(15);
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({ billingInterval: 'both', yearlyPriceCents: null });
});

test('a fixed yearly price takes at most 2 decimals and is sent exactly (100.50 -> 10050)', async ({ adminPage: page, mockApi }) => {
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).nth(1).click();
  await page.getByTestId('add-yearly-price').click();
  await page.getByTestId('yearly-mode-fixed').click();
  await page.getByTestId('yearly-price').fill('100.005');
  // Three decimals are refused for a two-decimal currency (not silently rounded).
  await expect(page.getByTestId('package-validation')).toHaveText('Yearly price can have at most 2 decimals.');
  await page.getByTestId('yearly-price').fill('100.50');
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.yearlyPriceCents).toBe(10050);
  expect(mockApi.lastVariables('AdminSavePlan')?.input?.yearlyDiscountPct).toBe(0);
});

const promoSaved = (payload: { variables?: Record<string, any> }) => ({
  data: {
    adminSavePromoCode: {
      success: true,
      message: 'saved',
      promoCode: { id: 'promo-1', code: payload.variables?.input?.code, __typename: 'AdminPromoCode' },
      __typename: 'AdminSavePromoCodePayload',
    },
  },
});

test('switching the promo currency keeps the typed amount (10.50 USD -> JPY -> USD)', async ({ adminPage: page, mockApi }) => {
  mockApi.setOverride('AdminSavePromoCode', promoSaved);
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Promo Codes' }).click();
  await page.getByRole('button', { name: 'New promo' }).click();
  await page.getByPlaceholder('SAVE20').fill('travel');
  await page.getByLabel('Discount type').selectOption('amount');
  const amount = page.getByTestId('promo-discount');
  const currency = page.getByTestId('promo-currency');
  await amount.fill('10.50');
  await currency.selectOption('JPY');
  await expect(amount).toHaveValue('10.50');
  await expect(page.getByText('Minimum amount (JPY)')).toBeVisible();
  await currency.selectOption('USD');
  await expect(amount).toHaveValue('10.50');
  await expect(page.getByText('Minimum amount (USD)')).toBeVisible();
  await page.getByRole('button', { name: 'Create promo' }).click();
  await expect.poll(() => mockApi.lastVariables('AdminSavePromoCode')?.input?.discountValue).toBe(1050);
  expect(mockApi.lastVariables('AdminSavePromoCode')?.input).toMatchObject({ code: 'TRAVEL', discountType: 'amount', currency: 'USD' });
});

test('promo amounts and percentages that the API would refuse are stopped in the form', async ({ adminPage: page, mockApi }) => {
  mockApi.setOverride('AdminSavePromoCode', promoSaved);
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Promo Codes' }).click();
  await page.getByRole('button', { name: 'New promo' }).click();
  await page.getByPlaceholder('SAVE20').fill('half');
  // 12.5% is an Int error on the server: refused here.
  await page.getByLabel('Discount %').fill('12.5');
  await page.getByRole('button', { name: 'Create promo' }).click();
  await expect(page.getByText('Percent discount must be a whole number between 1 and 100')).toBeVisible();
  expect(mockApi.lastVariables('AdminSavePromoCode')).toBeUndefined();

  await page.getByLabel('Discount type').selectOption('amount');
  await page.getByTestId('promo-currency').selectOption('JPY');
  await page.getByTestId('promo-discount').fill('500.5');
  await page.getByRole('button', { name: 'Create promo' }).click();
  await expect(page.getByText('Discount amount must be a whole number of JPY (no decimals).')).toBeVisible();
  expect(mockApi.lastVariables('AdminSavePromoCode')).toBeUndefined();

  await page.getByTestId('promo-discount').fill('500');
  await page.getByRole('button', { name: 'Create promo' }).click();
  await expect.poll(() => mockApi.lastVariables('AdminSavePromoCode')?.input?.discountValue).toBe(500);
  expect(mockApi.lastVariables('AdminSavePromoCode')?.input?.currency).toBe('JPY');
});

// ---------------------------------------------------------------------------
// Loading, deleting and editing packages (review #182, #183, #191, #207)
// ---------------------------------------------------------------------------

test('a deleted plan id can be used again for a new plan right away', async ({ adminPage: page, mockApi }) => {
  mockApi.setOverride('AdminDeletePlan', (payload, api) => {
    const id = payload.variables?.id;
    api.plans = api.plans.filter((plan) => plan.id !== id);
    api.packaging = api.packaging.filter((plan) => plan.id !== id);
    return {
      data: { adminDeletePlan: { success: true, message: 'deleted', deletedId: id, __typename: 'AdminDeletePlanPayload' } },
    };
  });
  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByTestId('plan-subscribers-premium')).toBeVisible();
  const packagingReads = mockApi.requests.get('AdminPlansPackaging')?.length ?? 0;

  page.once('dialog', (dialog) => dialog.accept('Replaced by a new Premium'));
  await page.locator('article').filter({ hasText: 'Premium' }).first().getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Plan "Premium" deleted')).toBeVisible();
  // The packaging list is read again (it feeds the "id already exists" check and the counts).
  await expect.poll(() => mockApi.requests.get('AdminPlansPackaging')?.length ?? 0).toBeGreaterThan(packagingReads);

  await page.getByRole('button', { name: 'New plan' }).click();
  await page.getByLabel('Plan ID').fill('premium');
  await page.getByLabel('Name', { exact: true }).fill('Premium');
  await page.getByTestId('module-checkbox-employee_management').check();
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByText('A plan with ID "premium" already exists')).toHaveCount(0);
  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.id).toBe('premium');
  expect(mockApi.lastVariables('AdminSavePlan')?.input?.createOnly).toBe(true);
});

test('a plan cannot be edited before its package details load (private / yearly settings would be lost)', async ({ adminPage: page, mockApi }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  mockApi.setOverride('AdminPlansPackaging', async (_payload, api) => {
    await gate;
    return { data: { adminPlans: api.packaging } };
  });
  mockApi.plans.push({ ...mockApi.plans[1], id: 'premium_yearly', name: 'Premium Yearly', basePriceCents: 12000, billingInterval: 'yearly', trialMonths: 0, recommended: false });
  await page.getByRole('button', { name: 'Plans' }).click();
  const edit = page.getByRole('button', { name: 'Edit plan' }).nth(2);
  await expect(edit).toBeDisabled();
  release();
  await expect(edit).toBeEnabled();
  await edit.click();
  await expect(page.getByTestId('package-public')).not.toBeChecked();
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.id).toBe('premium_yearly');
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({ isPublic: false, billingInterval: 'yearly' });
});

test('when package details fail to load, Edit says so instead of opening a blank package', async ({ adminPage: page, mockApi }) => {
  mockApi.setOverride('AdminPlansPackaging', { errors: [{ message: 'packaging unavailable' }] });
  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByTestId('packaging-load-error')).toContainText('packaging unavailable');
  await page.getByRole('button', { name: 'Edit plan' }).first().click();
  await expect(page.getByText(/package details of "Free" could not be loaded/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edit Plan' })).toHaveCount(0);
});

test('a module list that fails to load is shown as an error, not as an empty list', async ({ adminPage: page, mockApi }) => {
  mockApi.setOverride('AdminPackageModules', { errors: [{ message: 'modules unavailable' }] });
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'New plan' }).click();
  await expect(page.getByText('Could not load modules: modules unavailable')).toBeVisible();
});

test('a plan without modules (an old plan) can still be edited and saved', async ({ adminPage: page, mockApi }) => {
  mockApi.packaging[0].modules = [];
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Edit plan' }).first().click();
  await expect(page.getByTestId('package-no-modules')).toBeVisible();
  await page.getByLabel('Description').fill('Core features only.');
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect.poll(() => mockApi.lastVariables('AdminSavePlan')?.input?.id).toBe('free');
  expect(mockApi.lastVariables('AdminSavePlan')?.input).toMatchObject({ description: 'Core features only.', modules: [] });
});

test('every page of plans is loaded, and a failed later page is reported', async ({ adminPage: page, mockApi }) => {
  const many = Array.from({ length: 201 }, (_, index) => ({
    ...mockApi.plans[0],
    id: `bulk_${String(index + 1).padStart(3, '0')}`,
    name: `Bulk ${index + 1}`,
    sortOrder: index + 10,
  }));
  let failSecondPage = true;
  mockApi.setOverride('AdminPlans', (payload) => {
    const offset = payload.variables?.offset ?? 0;
    if (offset > 0 && failSecondPage) return { errors: [{ message: 'page 2 unavailable' }] };
    return { data: { adminPlans: many.slice(offset, offset + 200) } };
  });
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Table View' }).click();
  await expect(page.getByTestId('partial-list-warning')).toContainText('Only the first 200 plans could be loaded: page 2 unavailable');
  await expect(page.getByText('bulk_201')).toHaveCount(0);

  failSecondPage = false;
  await page.getByTestId('partial-list-warning').getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('bulk_201', { exact: true })).toBeVisible();
  await expect(page.getByTestId('partial-list-warning')).toHaveCount(0);
  // 200 at a time (the API's largest page), not the default 50.
  expect((mockApi.requests.get('AdminPlans') ?? []).map((v) => [v.limit, v.offset])).toContainEqual([200, 200]);
});

test('applying re-checks the preview first and stops when it changed', async ({ adminPage: page, mockApi }) => {
  // Set once the preview is on screen: another company moved onto the old
  // version meanwhile, so the re-check finds it.
  let changedMeanwhile = false;
  mockApi.setOverride('AdminApplyPlanToSubscribers', (payload) => {
    const companies = [
      { companyId: 12, companyName: 'Acme Labs', currentVersion: 1, wasUnrestricted: false, gains: ['pj_projects'], losses: [], __typename: 'AdminSubscriberChange' },
      ...(changedMeanwhile ? [{ companyId: 14, companyName: 'Late Joiner', currentVersion: 1, wasUnrestricted: false, gains: ['pj_projects'], losses: [], __typename: 'AdminSubscriberChange' }] : []),
    ];
    return {
      data: {
        adminApplyPlanToSubscribers: {
          success: true, message: 'ok', dryRun: payload.variables?.dryRun !== false,
          appliedCount: payload.variables?.dryRun === false ? companies.length : 0,
          companies, __typename: 'AdminApplyPlanToSubscribersPayload',
        },
      },
    };
  });
  await page.getByRole('button', { name: 'Plans' }).click();
  await page.getByTestId('apply-subscribers-premium').click();
  const dialog = page.getByTestId('apply-subscribers-dialog');
  await expect(dialog.getByTestId('apply-subscribers-preview')).toContainText('Acme Labs');
  await expect(dialog.getByTestId('apply-subscribers-preview')).not.toContainText('Late Joiner');
  await dialog.getByTestId('apply-subscribers-reason').fill('Projects added');
  changedMeanwhile = true;
  await dialog.getByTestId('apply-subscribers-submit').click();
  await expect(page.getByText('The package or its subscribers changed since this preview.')).toBeVisible();
  await expect(dialog.getByTestId('apply-subscribers-preview')).toContainText('Late Joiner');
  expect((mockApi.requests.get('AdminApplyPlanToSubscribers') ?? []).some((v) => v.dryRun === false)).toBe(false);

  await dialog.getByTestId('apply-subscribers-submit').click();
  await expect.poll(() => mockApi.lastVariables('AdminApplyPlanToSubscribers')?.dryRun).toBe(false);
});

test('a trial of one month says "1 month"', async ({ adminPage: page, mockApi }) => {
  mockApi.plans[1].trialMonths = 1;
  await page.getByRole('button', { name: 'Plans' }).click();
  await expect(page.getByText('Free for 1 month', { exact: true })).toBeVisible();
});
