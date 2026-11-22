import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { CalendarDays, Check, CreditCard, Download, Edit2, FileText, Filter, Gauge, ListChecks, Plus, Printer, RotateCcw, Save, Search, Trash2 } from 'lucide-react';
import { FormActions, FormDialog, FormField, FormSection, checkboxClass, formControlClass, useConfirmDialog } from '../ui/FormKit';
import { DataTable, RowActionButton } from '../ui/DataTable';
import {
  ADMIN_DELETE_PLAN_MUTATION,
  ADMIN_DEACTIVATE_PROMO_CODE_MUTATION,
  ADMIN_PLANS_QUERY,
  ADMIN_PROMO_CODES_QUERY,
  ADMIN_SAVE_PROMO_CODE_MUTATION,
  ADMIN_SAVE_PLAN_MUTATION,
  ADMIN_PLANS_PACKAGING_QUERY,
  ADMIN_CURRENCY_RATES_QUERY,
} from '../../../lib/graphql';
import {
  ApplyToSubscribersDialog,
  FeatureAreaChips,
  PackageBuilder,
  YearlyPricingFields,
  PackageModuleSelection,
  PlanPackagingInfo,
  PricingMode,
  draftToPlanInputFields,
  packagePriceLines,
  useAllAdminPages,
  usePackageModuleOptions,
  validatePackageDraft,
  type YearlyPriceMode,
} from './PackageBuilder';
import {
  amountFromCents,
  amountInputFromCents,
  centsFromAmount,
  currencyDecimals,
  currencyInputStep,
  formatPrice,
  MAX_INT32,
  moneyInputError,
  wholeNumberError,
} from '../../../lib/admin-utils';
import { PartialListWarning, useAllPagesQuery } from '../../../lib/useAllPagesQuery';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';

type BillingInterval = 'monthly' | 'yearly' | 'both';

interface PlanPackaging extends PlanPackagingInfo {
  pricingMode: PricingMode;
  bundleDiscountPct: number;
  yearlyPriceCents: number | null;
  yearlyDiscountPct: number;
  companiesCount?: number | null;
}
type PlanAdminTab = 'plans' | 'promos';
type DiscountType = 'percent' | 'amount';

interface PlanType {
  id: string;
  name: string;
  description: string;
  basePriceCents: number;
  currency: string;
  billingInterval: BillingInterval;
  perEmployee: boolean;
  trialMonths: number;
  employeeLimit: number | null;
  features: string[] | string;
  recommended: boolean;
  active: boolean;
  sortOrder: number;
}

interface EditingPlan {
  id: string;
  name: string;
  description: string;
  /**
   * The price as typed. Kept as text and converted only when saved, so
   * changing the currency never changes it (10.50 USD -> JPY -> USD stays 10.50).
   */
  basePriceInput: string;
  /** Minor units of basePriceInput in `currency` (for the live previews). */
  basePriceCents: number;
  currency: string;
  billingInterval: BillingInterval;
  perEmployee: boolean;
  trialMonths: number;
  employeeLimit: string;
  featuresText: string;
  recommended: boolean;
  active: boolean;
  sortOrder: number;
  // Dynamic package fields
  pricingMode: PricingMode;
  bundleDiscountPct: number;
  yearlyPriceOverride: string;
  yearlyDiscountPct: number;
  yearlyMode?: YearlyPriceMode;
  isPublic: boolean;
  modules: PackageModuleSelection[];
  allowEmptyModules?: boolean;
}

interface PromoCodeType {
  id: string;
  code: string;
  name?: string | null;
  discountType: DiscountType;
  discountValue: number;
  currency?: string | null;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  maxRedemptions?: number | null;
  perEmailLimit?: number | null;
  perCompanyLimit?: number | null;
  firstTimeCustomerOnly?: boolean | null;
  minimumAmountCents?: number | null;
  redeemedCount: number;
  appliesToPlanIds: string[];
  applicableBillingIntervals: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

interface EditingPromo {
  id?: string;
  code: string;
  name: string;
  discountType: DiscountType;
  /**
   * The discount as typed: a percentage, or an amount in `currency`. Kept as
   * text and converted to minor units only when saved, so switching the
   * currency back and forth never changes it.
   */
  discountInput: string;
  currency: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  perEmailLimit: string;
  perCompanyLimit: string;
  firstTimeCustomerOnly: boolean;
  minimumAmountDollars: string;
  appliesToPlanIds: string[];
  applicableBillingIntervals: BillingInterval[];
}

interface MutationPayload {
  success: boolean;
  message?: string | null;
}

type SavePromoCodeMutationData = {
  adminSavePromoCode: MutationPayload & {
    promoCode?: Partial<PromoCodeType> | null;
  };
};

type DeletePlanMutationData = {
  adminDeletePlan: MutationPayload & {
    deletedId?: string | null;
  };
};

type DeactivatePromoCodeMutationData = {
  adminDeactivatePromoCode: MutationPayload & {
    promoCode?: Pick<PromoCodeType, 'id' | 'active'> | null;
  };
};

const normalizeCurrency = (currency: string) => currency.trim().toUpperCase();

const parseFeatures = (features: PlanType['features']): string[] => {
  if (Array.isArray(features)) return features.filter(Boolean);
  if (!features) return [];
  try {
    const parsed = JSON.parse(features);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return features
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

/**
 * The edit form for a plan. Needs its packaging row (modules, visibility,
 * yearly price): editing without it saved a private plan as public, dropped
 * its yearly price and its modules -- the caller waits until it is loaded.
 */
const toEditingPlan = (plan: PlanType, packaging: PlanPackaging): EditingPlan => ({
  pricingMode: packaging.pricingMode || 'fixed',
  bundleDiscountPct: Number(packaging.bundleDiscountPct) || 0,
  yearlyPriceOverride: amountInputFromCents(packaging.yearlyPriceCents, plan.currency || 'USD'),
  yearlyDiscountPct: Number(packaging.yearlyDiscountPct) || 0,
  yearlyMode: packaging.yearlyPriceCents === null || packaging.yearlyPriceCents === undefined ? 'percent' : 'fixed',
  isPublic: packaging.isPublic ?? true,
  modules: (packaging.modules || []).map((m) => ({ moduleId: m.moduleId, priceOverride: '' })),
  // An old plan (or Free) without modules can still be edited and saved as it is.
  allowEmptyModules: !(packaging.modules || []).length,
  id: plan.id,
  name: plan.name,
  description: plan.description || '',
  basePriceInput: amountInputFromCents(plan.basePriceCents, plan.currency || 'USD'),
  basePriceCents: plan.basePriceCents,
  currency: normalizeCurrency(plan.currency || 'USD'),
  // The interval the package is actually sold on (a yearly-only package stays yearly).
  billingInterval: (packaging.billingInterval as BillingInterval) || plan.billingInterval || 'monthly',
  perEmployee: Boolean(plan.perEmployee),
  trialMonths: plan.trialMonths || 0,
  employeeLimit: plan.employeeLimit === null || plan.employeeLimit === undefined ? '' : String(plan.employeeLimit),
  featuresText: parseFeatures(plan.features).join('\n'),
  recommended: Boolean(plan.recommended),
  active: Boolean(plan.active),
  sortOrder: plan.sortOrder || 0,
});

const newEditingPlan = (plans: PlanType[]): EditingPlan => ({
  pricingMode: 'fixed',
  bundleDiscountPct: 0,
  yearlyPriceOverride: '',
  yearlyDiscountPct: 0,
  isPublic: true,
  modules: [],
  id: '',
  name: '',
  description: '',
  basePriceInput: '0',
  basePriceCents: 0,
  currency: 'USD',
  billingInterval: 'monthly',
  perEmployee: false,
  trialMonths: 0,
  employeeLimit: '',
  featuresText: '',
  recommended: false,
  active: true,
  sortOrder: (plans.reduce((max, plan) => Math.max(max, plan.sortOrder || 0), 0) || 0) + 1,
});

const newEditingPromo = (defaultPlanId: string | null = null): EditingPromo => ({
  code: '',
  name: '',
  discountType: 'percent',
  discountInput: '10',
  currency: 'USD',
  active: true,
  startsAt: '',
  endsAt: '',
  maxRedemptions: '',
  perEmailLimit: '',
  perCompanyLimit: '',
  firstTimeCustomerOnly: false,
  minimumAmountDollars: '',
  appliesToPlanIds: defaultPlanId ? [defaultPlanId] : [],
  applicableBillingIntervals: [],
});

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromDateTimeLocal = (value: string) => (value ? new Date(value).toISOString() : null);

const toEditingPromo = (promo: PromoCodeType): EditingPromo => ({
  id: promo.id,
  code: promo.code,
  name: promo.name || '',
  discountType: promo.discountType,
  discountInput:
    promo.discountType === 'amount'
      ? amountInputFromCents(promo.discountValue, promo.currency || 'USD')
      : String(promo.discountValue ?? ''),
  currency: normalizeCurrency(promo.currency || 'USD'),
  active: promo.active,
  startsAt: toDateTimeLocal(promo.startsAt),
  endsAt: toDateTimeLocal(promo.endsAt),
  maxRedemptions: promo.maxRedemptions === null || promo.maxRedemptions === undefined ? '' : String(promo.maxRedemptions),
  perEmailLimit: promo.perEmailLimit === null || promo.perEmailLimit === undefined ? '' : String(promo.perEmailLimit),
  perCompanyLimit: promo.perCompanyLimit === null || promo.perCompanyLimit === undefined ? '' : String(promo.perCompanyLimit),
  firstTimeCustomerOnly: Boolean(promo.firstTimeCustomerOnly),
  minimumAmountDollars:
    promo.minimumAmountCents === null || promo.minimumAmountCents === undefined
      ? ''
      : // Same currency rule as the save (centsFromAmount), so a JPY minimum isn't cut 100x.
        amountFromCents(promo.minimumAmountCents, promo.currency || 'USD').toFixed(currencyDecimals(promo.currency || 'USD')),
  appliesToPlanIds: promo.appliesToPlanIds || [],
  applicableBillingIntervals: (promo.applicableBillingIntervals || []).filter((item): item is BillingInterval => item === 'monthly' || item === 'yearly'),
});

// Same rule as the backend (new plan ids only; older ids stay editable).
const PLAN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const PLAN_ID_MAX_LENGTH = 50;
/** As the backend's plan validation (PLAN_MAX_TRIAL_MONTHS in admin_dashboard.py). */
const PLAN_MAX_TRIAL_MONTHS = 120;

/** `createOnly`: the backend refuses instead of overwriting an existing plan with this id. */
const planToInput = (plan: EditingPlan, createOnly = false) => ({
  id: plan.id.trim(),
  createOnly,
  name: plan.name.trim(),
  description: plan.description.trim(),
  // Converted from the typed text here, once, in the plan's final currency.
  basePriceCents: centsFromAmount(plan.basePriceInput || '0', plan.currency || 'USD'),
  currency: normalizeCurrency(plan.currency || 'USD'),
  billingInterval: plan.billingInterval,
  perEmployee: plan.perEmployee,
  trialMonths: plan.trialMonths,
  employeeLimit: plan.employeeLimit.trim() ? Number(plan.employeeLimit) : null,
  features: plan.featuresText
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean),
  recommended: plan.recommended,
  active: plan.active,
  sortOrder: plan.sortOrder,
  ...draftToPlanInputFields(plan),
});

/** `createOnly`: the backend refuses instead of overwriting an existing promo with this code. */
const promoToInput = (promo: EditingPromo, createOnly = false) => ({
  id: promo.id,
  createOnly,
  code: promo.code.trim().toUpperCase(),
  name: promo.name.trim(),
  discountType: promo.discountType,
  // A percentage as typed; an amount converted once, in the promo's final currency.
  discountValue:
    promo.discountType === 'amount'
      ? centsFromAmount(promo.discountInput || '0', promo.currency || 'USD')
      : Number(promo.discountInput) || 0,
  currency: normalizeCurrency(promo.currency || 'USD'),
  active: promo.active,
  startsAt: fromDateTimeLocal(promo.startsAt),
  endsAt: fromDateTimeLocal(promo.endsAt),
  maxRedemptions: promo.maxRedemptions.trim() ? Number(promo.maxRedemptions) : null,
  perEmailLimit: promo.perEmailLimit.trim() ? Number(promo.perEmailLimit) : null,
  perCompanyLimit: promo.perCompanyLimit.trim() ? Number(promo.perCompanyLimit) : null,
  firstTimeCustomerOnly: promo.firstTimeCustomerOnly,
  minimumAmountCents: promo.minimumAmountDollars.trim()
    ? centsFromAmount(promo.minimumAmountDollars, promo.currency || 'USD')
    : null,
  appliesToPlanIds: promo.appliesToPlanIds,
  applicableBillingIntervals: promo.applicableBillingIntervals,
});

const monthsLabel = (months: number) => `${months} month${months === 1 ? '' : 's'}`;

const billingCopy = (plan: PlanType) => {
  if (plan.basePriceCents === 0) return 'forever';
  if (plan.billingInterval === 'both') return plan.perEmployee ? 'per employee / mo or yr' : 'monthly or yearly';
  return plan.perEmployee ? `per employee / ${plan.billingInterval === 'yearly' ? 'yr' : 'mo'}` : `per ${plan.billingInterval}`;
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const downloadTextFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const Plans: React.FC<{ onToast: (type: 'success' | 'error', msg: string) => void }> = ({ onToast }) => {
  // In-app confirm / reason questions (not the browser's "localhost says").
  const { confirm, askReason, dialog } = useConfirmDialog();
  const [activeTab, setActiveTab] = useState<PlanAdminTab>('plans');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<EditingPlan | null>(null);
  const [editingMode, setEditingMode] = useState<'create' | 'edit'>('edit');
  // Table first (as in the portal); Board View is one click away.
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [planFiltersOpen, setPlanFiltersOpen] = useState(true);
  const [promoSearch, setPromoSearch] = useState('');
  const [editingPromo, setEditingPromo] = useState<EditingPromo | null>(null);
  const [editingPromoMode, setEditingPromoMode] = useState<'create' | 'edit'>('create');
  const [applyFor, setApplyFor] = useState<{ planId: string; planName: string } | null>(null);
  const { options: moduleOptions } = usePackageModuleOptions();
  // Typed searches go to the server once typing pauses: one request per search, not per key.
  const debouncedSearch = useDebouncedValue(search);
  const debouncedPromoSearch = useDebouncedValue(promoSearch);

  // Every plan, not the API's first page of 50.
  const {
    rows: planRows,
    loading,
    error,
    pageError: planPageError,
    loadingMore: plansLoadingMore,
    refetch,
  } = useAllPagesQuery<PlanType, { includeInactive: boolean; search: string | null; active: boolean | null }>(
    ADMIN_PLANS_QUERY,
    'adminPlans',
    {
      variables: {
        includeInactive: true,
        search: debouncedSearch.trim() || null,
        active: null,
      },
      fetchPolicy: 'cache-and-network',
    },
  );
  // The plan and promo editors pick their currency from the stored currencies.
  // Read fresh each time an editor opens: one added on the Currencies page shows up.
  const { data: currencyData } = useQuery<
    { adminCurrencyRates: { rates: { code: string; name?: string | null }[] } },
    { previewUsdCents: number },
    any
  >(ADMIN_CURRENCY_RATES_QUERY, {
    variables: { previewUsdCents: 0 },
    skip: !editingPromo && !editing,
    fetchPolicy: 'cache-and-network',
  });
  const currencyOptionsWith = (current: string) => {
    const codes = (currencyData?.adminCurrencyRates?.rates || []).map((rate) => normalizeCurrency(rate.code)).filter(Boolean);
    return Array.from(new Set(['USD', ...codes, normalizeCurrency(current || 'USD')])).sort();
  };
  const promoCurrencyOptions = currencyOptionsWith(editingPromo?.currency || 'USD');
  const planCurrencyOptions = currencyOptionsWith(editing?.currency || 'USD');
  const {
    rows: promoRows,
    loading: promoLoading,
    error: promoError,
    pageError: promoPageError,
    loadingMore: promosLoadingMore,
    refetch: refetchPromos,
  } = useAllPagesQuery<
    PromoCodeType,
    { includeInactive: boolean; search: string | null; active: boolean | null; planId: string | null }
  >(ADMIN_PROMO_CODES_QUERY, 'adminPromoCodes', {
    variables: {
      includeInactive: true,
      search: debouncedPromoSearch.trim() || null,
      active: null,
      planId: null,
    },
    fetchPolicy: 'cache-and-network',
  });

  // Modules + computed prices live in a separate document so the base plan query stays stable.
  // Every page of packages (the API returns at most 200 per call).
  const {
    rows: packagingRows,
    loading: packagingLoading,
    error: packagingError,
    refetch: refetchPackaging,
  } = useAllAdminPages<PlanPackaging>(ADMIN_PLANS_PACKAGING_QUERY, 'adminPlans');
  // Plans deleted here, hidden until the packaging list is read again (so the
  // id can be used again for a new plan right away).
  const [deletedPlanIds, setDeletedPlanIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setDeletedPlanIds(new Set());
  }, [packagingRows]);
  const packagingById = useMemo(
    () => new Map((packagingRows || []).filter((item) => !deletedPlanIds.has(item.id)).map((item) => [item.id, item])),
    [packagingRows, deletedPlanIds],
  );
  const [savePlan, { loading: saving }] = useMutation<
    {
      adminSavePlan: {
        success: boolean;
        message?: string | null;
        plan?: { id: string; version?: number | null; outdatedSubscribersCount?: number | null } | null;
      };
    },
    { input: ReturnType<typeof planToInput> },
    any,
    any
  >(ADMIN_SAVE_PLAN_MUTATION);
  const [deletePlan, { loading: deleting }] = useMutation<DeletePlanMutationData, { id: string; reason: string }, any, any>(ADMIN_DELETE_PLAN_MUTATION);
  // One request per action at a time: Apollo's `loading` only disables a
  // button after a re-render, so a quick double click could send twice.
  const busy = useRef<Set<string>>(new Set());
  const once = async (key: string, action: () => Promise<void>) => {
    if (busy.current.has(key)) return;
    busy.current.add(key);
    try {
      await action();
    } finally {
      busy.current.delete(key);
    }
  };
  const [savePromoCode, { loading: savingPromo }] = useMutation<SavePromoCodeMutationData, { input: ReturnType<typeof promoToInput> }, any, any>(ADMIN_SAVE_PROMO_CODE_MUTATION);
  const [deactivatePromoCode, { loading: deactivatingPromo }] = useMutation<DeactivatePromoCodeMutationData, { id: string; reason: string }, any, any>(ADMIN_DEACTIVATE_PROMO_CODE_MUTATION);

  const backendPlans = planRows || [];
  // Only real plans: when the list can't be loaded the page says so (with
  // Try again) instead of showing built-in plans that look editable.
  const sourcePlans = backendPlans;
  const promoCodes = promoRows || [];
  // Every active paid plan for the promo form. adminPlans is searched server-side
  // with the Plans search box, so the unfiltered packaging list is used instead.
  const premiumPlans = useMemo(() => {
    const all = packagingRows;
    if (!all?.length) {
      return sourcePlans
        .filter((plan) => plan.active && plan.basePriceCents > 0)
        .map((plan) => ({ id: plan.id, name: plan.name, billingInterval: plan.billingInterval }));
    }
    return all
      .filter((plan) => plan.active && ((plan.pricing?.monthlyPriceCents || 0) > 0 || (plan.pricing?.yearlyPriceCents || 0) > 0))
      .map((plan) => ({ id: plan.id, name: plan.name || plan.id, billingInterval: plan.billingInterval || '' }));
  }, [packagingRows, sourcePlans]);
  const plans = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = sourcePlans
      .filter((plan) => {
        if (viewMode === 'card' && activeFilter !== 'all' && plan.active !== (activeFilter === 'active')) return false;
        if (!needle) return true;
        return [plan.id, plan.name, plan.description, ...parseFeatures(plan.features)]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      });
    return [...filtered].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));
  }, [sourcePlans, search, activeFilter, viewMode]);

  const openCreatePlan = () => {
    setEditingMode('create');
    setEditing(newEditingPlan(sourcePlans));
  };

  // Editing needs the plan's packaging row; Edit stays disabled while it loads.
  const packagingPending = (plan: PlanType) => !packagingById.has(plan.id) && packagingLoading && !packagingError;
  const openEditPlan = (plan: PlanType) => {
    const packaging = packagingById.get(plan.id);
    if (!packaging) {
      onToast(
        'error',
        packagingError
          ? `The package details of "${plan.name}" could not be loaded (${packagingError.message}). Try again.`
          : `The package details of "${plan.name}" are still loading. Try again in a moment.`,
      );
      if (!packagingLoading) refetchPackaging();
      return;
    }
    setEditingMode('edit');
    setEditing(toEditingPlan(plan, packaging));
  };

  const closePlanWindow = () => {
    setEditing(null);
    setEditingMode('edit');
  };

  const openCreatePromo = () => {
    setEditingPromoMode('create');
    setEditingPromo(newEditingPromo(premiumPlans[0]?.id || null));
  };

  const openEditPromo = (promo: PromoCodeType) => {
    setEditingPromoMode('edit');
    setEditingPromo(toEditingPromo(promo));
  };

  const closePromoWindow = () => {
    setEditingPromo(null);
    setEditingPromoMode('create');
  };

  const handleSave = () => once('save-plan', savePlanNow);
  const savePlanNow = async () => {
    if (!editing) return;
    if (!editing.id.trim() || !editing.name.trim()) {
      onToast('error', 'Plan id and name are required');
      return;
    }
    // Checked before the request: the server takes whole numbers (an Int) and
    // whole units for JPY / ISK / UGX, and refuses the whole save otherwise.
    const fieldProblem =
      moneyInputError(editing.basePriceInput, editing.currency || 'USD', 'Package price') ||
      wholeNumberError(editing.trialMonths, 'Trial months', 0, PLAN_MAX_TRIAL_MONTHS) ||
      // Blank means unlimited; when set, at least one employee (as the server requires).
      wholeNumberError(editing.employeeLimit, 'Employee limit', 1, MAX_INT32);
    if (fieldProblem) {
      onToast('error', fieldProblem);
      return;
    }

    const creating = editingMode === 'create';
    if (creating) {
      const id = editing.id.trim();
      if (id.length > PLAN_ID_MAX_LENGTH) {
        onToast('error', `Plan ID must be at most ${PLAN_ID_MAX_LENGTH} characters`);
        return;
      }
      if (!PLAN_ID_PATTERN.test(id)) {
        onToast('error', "Plan ID may only use lowercase letters, numbers, '-' and '_', and must start with a letter or number");
        return;
      }
      if (packagingById.has(id)) {
        onToast('error', `A plan with ID "${id}" already exists. Choose another ID or edit that plan.`);
        return;
      }
    }

    const problem = validatePackageDraft(editing, moduleOptions);
    if (problem) {
      onToast('error', problem);
      return;
    }

    try {
      const result = await savePlan({ variables: { input: planToInput(editing, creating) } });
      const payload = result.data?.adminSavePlan;
      if (payload && payload.success === false) {
        onToast('error', payload.message || 'Could not save package');
        return;
      }
      onToast('success', `Plan "${editing.name}" ${editingMode === 'create' ? 'created' : 'saved'}`);
      const saved = { planId: editing.id.trim(), planName: editing.name };
      closePlanWindow();
      refetch();
      refetchPackaging();
      // The modules changed and companies are on the older version: offer to
      // give them the new modules now (dry-run preview first).
      if (editingMode === 'edit' && (payload?.plan?.outdatedSubscribersCount || 0) > 0) {
        setApplyFor(saved);
      }
    } catch (err: any) {
      onToast('error', err.message || 'Backend plan API is not ready yet');
    }
  };

  const handleSavePromo = () => once('save-promo', savePromoNow);
  const savePromoNow = async () => {
    if (!editingPromo) return;
    if (!editingPromo.code.trim()) {
      onToast('error', 'Promo code is required');
      return;
    }
    const currency = editingPromo.currency || 'USD';
    if (editingPromo.discountType === 'percent') {
      // An Int on the server: 12.5 failed the whole save with a GraphQL error.
      const value = Number(editingPromo.discountInput);
      if (!editingPromo.discountInput.trim() || !Number.isInteger(value) || value < 1 || value > 100) {
        onToast('error', 'Percent discount must be a whole number between 1 and 100');
        return;
      }
    } else {
      const problem = moneyInputError(editingPromo.discountInput, currency, 'Discount amount');
      if (problem) {
        onToast('error', problem);
        return;
      }
      if (!(centsFromAmount(editingPromo.discountInput || '0', currency) > 0)) {
        onToast('error', 'Fixed discount amount must be greater than 0');
        return;
      }
    }
    const limitProblem =
      moneyInputError(editingPromo.minimumAmountDollars, currency, 'Minimum amount') ||
      // Blank = unlimited; a limit of 0 could never be used (the server refuses it).
      wholeNumberError(editingPromo.maxRedemptions, 'Max redemptions', 1, MAX_INT32) ||
      wholeNumberError(editingPromo.perEmailLimit, 'Per email limit', 1, MAX_INT32) ||
      wholeNumberError(editingPromo.perCompanyLimit, 'Per company limit', 1, MAX_INT32);
    if (limitProblem) {
      onToast('error', limitProblem);
      return;
    }
    if (editingPromo.appliesToPlanIds.length === 0) {
      onToast('error', 'Choose at least one applicable paid plan');
      return;
    }

    try {
      const { data } = await savePromoCode({
        variables: { input: promoToInput(editingPromo, editingPromoMode === 'create') },
      });
      const payload = data?.adminSavePromoCode;
      if (!payload?.success) {
        onToast('error', payload?.message || 'Promo code could not be saved');
        return;
      }
      onToast('success', `Promo code "${editingPromo.code.toUpperCase()}" ${editingPromoMode === 'create' ? 'created' : 'saved'}`);
      closePromoWindow();
      await refetchPromos();
    } catch (err: any) {
      onToast('error', err.message || 'Promo code could not be saved');
    }
  };

  const handleDeletePlan = (plan: PlanType) => once(`delete-plan-${plan.id}`, () => deletePlanNow(plan));
  const deletePlanNow = async (plan: PlanType) => {
    const reason = await askReason({
      title: `Delete ${plan.name}?`,
      message: 'Customers can no longer choose this plan at registration. Companies already on it keep it.',
      label: 'Reason for deleting',
      defaultValue: 'Admin deleted unused plan',
      confirmLabel: 'Delete plan',
      tone: 'danger',
    });
    if (reason === null) return;
    if (!reason.trim()) {
      onToast('error', 'Reason is required to delete a plan');
      return;
    }
    try {
      const { data } = await deletePlan({
        variables: {
          id: plan.id,
          reason: reason.trim(),
        },
      });
      const payload = data?.adminDeletePlan;
      if (!payload?.success) {
        onToast('error', payload?.message || 'Plan could not be deleted');
        return;
      }
      onToast('success', `Plan "${plan.name}" deleted`);
      // The packaging list (subscriber counts, promo plan list, the
      // "id already exists" check) must forget the plan too, so its id can be
      // used again right away.
      setDeletedPlanIds((current) => new Set(current).add(plan.id));
      refetchPackaging();
      await refetch();
    } catch (err: any) {
      onToast('error', err.message || 'Plan could not be deleted');
    }
  };

  const handleDeactivatePromo = (promo: PromoCodeType) => once(`deactivate-promo-${promo.id}`, () => deactivatePromoNow(promo));
  const deactivatePromoNow = async (promo: PromoCodeType) => {
    const reason = await askReason({
      title: `Deactivate ${promo.code}?`,
      message: 'Customers can no longer use this code at checkout.',
      label: 'Reason for deactivating',
      defaultValue: 'Admin deactivated promo code',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });
    if (reason === null) return;
    if (!reason.trim()) {
      onToast('error', 'Reason is required to deactivate a promo code');
      return;
    }
    try {
      const { data } = await deactivatePromoCode({
        variables: {
          id: promo.id,
          reason: reason.trim(),
        },
      });
      const payload = data?.adminDeactivatePromoCode;
      if (!payload?.success) {
        onToast('error', payload?.message || 'Promo code could not be deactivated');
        return;
      }
      onToast('success', `Promo code "${promo.code}" deactivated`);
      await refetchPromos();
    } catch (err: any) {
      onToast('error', err.message || 'Promo code could not be deactivated');
    }
  };

  const exportPlans = () => {
    if (!plans.length) {
      onToast('error', 'No data available to download');
      return;
    }
    const rows = plans.map((plan) => (
      `<tr><td>${escapeHtml(plan.id)}</td><td>${escapeHtml(plan.name)}</td><td>${amountFromCents(plan.basePriceCents, plan.currency || 'USD')}</td><td>${escapeHtml(plan.currency)}</td><td>${escapeHtml(plan.billingInterval)}</td><td>${escapeHtml(plan.active ? 'Active' : 'Inactive')}</td></tr>`
    )).join('');
    downloadTextFile(
      'superadmin-plans.xls',
      `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr><th>ID</th><th>Name</th><th>Price</th><th>Currency</th><th>Billing</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`,
      'application/vnd.ms-excel;charset=utf-8',
    );
    onToast('success', 'Excel file downloaded successfully!');
  };

  const printPlans = () => {
    if (!plans.length) {
      onToast('error', 'No data available to print');
      return;
    }
    const rows = plans.map((plan) => (
      `<tr><td>${escapeHtml(plan.id)}</td><td>${escapeHtml(plan.name)}</td><td>${escapeHtml(formatPrice(plan.basePriceCents, plan.currency))}</td><td>${escapeHtml(plan.billingInterval)}</td><td>${escapeHtml(plan.active ? 'Active' : 'Inactive')}</td></tr>`
    )).join('');
    const printWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>Plans</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#0f172a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left}th{background:#f1f5f9}</style></head><body><h1>Plans</h1><table><thead><tr><th>ID</th><th>Name</th><th>Price</th><th>Billing</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-700">Plans & Pricing</h2>
          <p className="text-slate-600">
            Manage paid registration plans and promo codes used at checkout.
          </p>
          {error && !backendPlans.length ? (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" data-testid="plans-load-error">
              Plans could not be loaded: {error.message}{' '}
              <button type="button" className="font-semibold underline" onClick={() => refetch()}>
                Try again
              </button>
            </p>
          ) : null}
        </div>
        {activeTab === 'plans' && viewMode === 'card' ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
          <div className="relative min-w-[180px] max-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plans"
            />
          </div>
          <button
            type="button"
            onClick={() => setPlanFiltersOpen((open) => {
              if (open) {
                setActiveFilter('all');
              }
              return !open;
            })}
            aria-pressed={planFiltersOpen}
            title="Filters"
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
              planFiltersOpen
                ? 'border-sky-400 bg-sky-50 text-sky-500'
                : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-sky-300 hover:text-sky-400'
            }`}
          >
            <Filter className="h-4 w-4" />
          </button>
          {planFiltersOpen && viewMode === 'card' ? (
          <select
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          ) : null}
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200/60 bg-slate-50 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <RotateCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportPlans}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200/60 bg-slate-50 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={printPlans}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200/60 bg-slate-50 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            type="button"
            onClick={openCreatePlan}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:from-sky-600 hover:to-cyan-500"
          >
            <Plus className="h-4 w-4" />
            New plan
          </button>
        </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className={`rounded-md px-4 py-2 text-sm font-bold transition ${activeTab === 'plans' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Plans
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('promos')}
            className={`rounded-md px-4 py-2 text-sm font-bold transition ${activeTab === 'promos' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Promo Codes
          </button>
        </div>
        {activeTab === 'plans' ? (
          <div className="inline-flex h-10 self-start overflow-hidden rounded-full border border-sky-500 bg-white shadow-sm sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`inline-flex h-full min-w-[116px] items-center justify-center px-5 text-sm font-semibold transition-colors duration-200 ${
                viewMode === 'card' ? 'bg-sky-500 text-white' : 'bg-white text-sky-500 hover:text-sky-500'
              }`}
            >
              Board View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex h-full min-w-[116px] items-center justify-center px-5 text-sm font-semibold transition-colors duration-200 ${
                viewMode === 'table' ? 'bg-sky-500 text-white' : 'bg-white text-sky-500 hover:text-sky-500'
              }`}
            >
              Table View
            </button>
          </div>
        ) : null}
      </div>

      {activeTab === 'plans' ? (
        <PartialListWarning
          error={planPageError}
          loadingMore={plansLoadingMore}
          shown={backendPlans.length}
          what="plans"
          onRetry={() => refetch()}
        />
      ) : null}
      {activeTab === 'plans' && packagingError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="packaging-load-error">
          Package details (modules, yearly prices) could not be loaded: {packagingError.message}{' '}
          <button type="button" className="font-semibold underline" onClick={() => refetchPackaging()}>
            Try again
          </button>
        </p>
      ) : null}
      {activeTab === 'plans' && viewMode === 'card' && loading && backendPlans.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500">
          Loading plans...
        </div>
      ) : null}

      {activeTab === 'plans' && (viewMode === 'table' ? (
        <DataTable<PlanType>
          testId="plans-table"
          rows={plans}
          rowKey={(plan) => plan.id}
          searchPlaceholder="Search plans"
          searchValue={search}
          onSearchChange={setSearch}
          onRefresh={() => refetch()}
          onExport={exportPlans}
          onPrint={printPlans}
          createLabel="New plan"
          onCreate={openCreatePlan}
          loading={loading}
          loadingText="Loading plans..."
          emptyMessage="No plans found"
          minWidth="880px"
          columns={[
            {
              key: 'name',
              header: 'Plan',
              value: (plan) => plan.name,
              sortable: true,
              render: (plan) => (
                <>
                  <div className="font-bold text-slate-950">{plan.name}</div>
                  <div className="text-xs text-slate-500">{plan.id}</div>
                  <div className="mt-1 max-w-md truncate text-xs text-slate-500">{plan.description}</div>
                </>
              ),
            },
            {
              key: 'price',
              header: 'Price',
              value: (plan) => plan.basePriceCents,
              sortable: true,
              render: (plan) => (
                <div className="font-semibold">
                  {packagePriceLines(packagingById.get(plan.id)?.pricing || null, plan.basePriceCents, plan.currency, plan.billingInterval).map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              ),
            },
            {
              key: 'billing',
              header: 'Billing',
              value: (plan) => plan.billingInterval,
              sortable: true,
              filterable: true,
              render: (plan) => (
                <>
                  <div className="capitalize">{plan.billingInterval}</div>
                  <div className="text-xs text-slate-500">{plan.perEmployee ? 'Per employee' : 'Flat'}</div>
                </>
              ),
            },
            { key: 'trial', header: 'Trial', value: (plan) => plan.trialMonths || 0, sortable: true, render: (plan) => monthsLabel(plan.trialMonths || 0) },
            { key: 'employees', header: 'Employees', value: (plan) => plan.employeeLimit ?? 'Unlimited', sortable: true },
            { key: 'status', header: 'Status', value: (plan) => (plan.active ? 'Active' : 'Inactive'), sortable: true, filterable: true, status: true },
          ]}
          rowActions={(plan) => (
            <>
              <RowActionButton
                title={packagingPending(plan) ? 'Loading package details…' : `Edit ${plan.name}`}
                label="Edit"
                icon={<Edit2 />}
                onClick={() => openEditPlan(plan)}
                disabled={packagingPending(plan)}
              />
              <RowActionButton
                title={`Delete ${plan.name}`}
                label="Delete"
                icon={<Trash2 />}
                danger
                onClick={() => handleDeletePlan(plan)}
                disabled={deleting}
              />
            </>
          )}
        />
      ) : (
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {plans.map((plan) => {
          const features = parseFeatures(plan.features);
          const isPremium = plan.id === 'premium' || plan.recommended;

          return (
            <article
              key={plan.id}
              className={`group relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md ${
                isPremium ? 'border-sky-300 ring-2 ring-sky-50' : 'border-gray-100 hover:border-sky-200'
              } ${plan.active ? '' : 'opacity-70'}`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        {isPremium ? 'Recommended plan' : 'Plan'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black leading-tight text-gray-800 transition-colors group-hover:text-sky-600">{plan.name}</h3>
                      {plan.trialMonths > 0 ? (
                        <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-tight text-sky-700">
                          Free for {monthsLabel(plan.trialMonths)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-gray-500">{plan.description}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      plan.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {plan.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-2.5">
                    <span className="mb-0.5 block text-[11px] font-black uppercase tracking-tight text-sky-600">Price</span>
                    {packagePriceLines(packagingById.get(plan.id)?.pricing || null, plan.basePriceCents, plan.currency, plan.billingInterval).map((line, index) => (
                      <div
                        key={line}
                        className={index === 0 ? 'text-lg font-black leading-tight text-gray-800' : 'mt-0.5 text-xs text-gray-500'}
                        data-testid={index === 0 ? `plan-price-${plan.id}` : undefined}
                      >
                        {line}
                      </div>
                    ))}
                    <p className="mt-0.5 text-xs text-gray-500">{billingCopy(plan)}</p>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2.5">
                    <span className="mb-0.5 block text-[11px] font-black uppercase tracking-tight text-amber-600">Trial</span>
                    <div className="text-sm font-bold text-gray-800">{monthsLabel(plan.trialMonths || 0)}</div>
                    {plan.trialMonths > 0 ? (
                      <p className="mt-0.5 text-xs font-semibold text-amber-700">after free period</p>
                    ) : null}
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-2.5">
                    <span className="mb-0.5 block text-[11px] font-black uppercase tracking-tight text-indigo-600">Employees</span>
                    <div className="text-sm font-bold text-gray-800">{plan.employeeLimit ?? 'Unlimited'}</div>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5">
                    <span className="mb-0.5 block text-[11px] font-black uppercase tracking-tight text-emerald-600">Billing</span>
                    <div className="text-sm font-bold text-gray-800">{plan.perEmployee ? 'Per employee' : 'Flat'}</div>
                    <p className="mt-0.5 text-xs text-gray-500">{plan.currency}</p>
                  </div>
                </div>

                {packagingById.get(plan.id) ? (
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-black uppercase tracking-tight text-slate-500">
                      <span>Modules</span>
                      <span className="font-semibold normal-case text-slate-400">
                        {packagingById.get(plan.id)!.isPublic ? '' : 'Private'}
                      </span>
                    </div>
                    {packagingById.get(plan.id)!.modules.length ? (
                      <FeatureAreaChips
                        moduleIds={packagingById.get(plan.id)!.modules.map((m) => m.moduleId)}
                        options={moduleOptions}
                        testId={`plan-modules-${plan.id}`}
                      />
                    ) : (
                      <p className="text-xs text-amber-700">
                        No modules configured — companies registered before packages keep every module; new sign-ups get core features only.
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-slate-500" data-testid={`plan-subscribers-${plan.id}`}>
                      v{packagingById.get(plan.id)!.version} · {packagingById.get(plan.id)!.subscribersCount || 0} subscriber(s)
                      {packagingById.get(plan.id)!.outdatedSubscribersCount
                        ? ` · ${packagingById.get(plan.id)!.outdatedSubscribersCount} on an older version`
                        : ''}
                    </p>
                  </div>
                ) : null}

                <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {features.slice(0, 6).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[13px] leading-5 text-slate-700">
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-sky-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {features.length > 6 ? (
                    <li className="text-[13px] font-semibold text-slate-500">
                      +{features.length - 6} more features
                    </li>
                  ) : null}
                </ul>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
                {packagingById.get(plan.id)?.outdatedSubscribersCount ? (
                  <button
                    type="button"
                    onClick={() => setApplyFor({ planId: plan.id, planName: plan.name })}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 text-[13px] font-semibold text-sky-700 transition hover:bg-sky-100"
                    data-testid={`apply-subscribers-${plan.id}`}
                  >
                    Apply to {packagingById.get(plan.id)!.outdatedSubscribersCount} subscriber(s)
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => openEditPlan(plan)}
                  disabled={packagingPending(plan)}
                  title={packagingPending(plan) ? 'Loading package details…' : undefined}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-3 text-[13px] font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600 disabled:opacity-50"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit plan
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePlan(plan)}
                  disabled={deleting}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-100 bg-white px-3 text-[13px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
              <div className={`absolute bottom-0 left-0 h-0.5 bg-sky-500 transition-all duration-500 ${isPremium ? 'w-full' : 'w-0 group-hover:w-full'}`} />
            </article>
          );
        })}
      </div>
      ))}

      {activeTab === 'promos' ? (
        <DataTable<PromoCodeType>
          testId="promos-table"
          rows={promoCodes}
          rowKey={(promo) => promo.id}
          searchPlaceholder="Search promo codes"
          searchValue={promoSearch}
          onSearchChange={setPromoSearch}
          onRefresh={() => refetchPromos()}
          createLabel="New promo"
          onCreate={openCreatePromo}
          notice={(
            <PartialListWarning
              error={promoPageError}
              loadingMore={promosLoadingMore}
              shown={promoCodes.length}
              what="promo codes"
              onRetry={() => refetchPromos()}
            />
          )}
          loading={promoLoading}
          loadingText="Loading promo codes..."
          error={promoError ? <span data-testid="promo-load-error">Promo codes could not be loaded: {promoError.message}</span> : null}
          emptyMessage="No promo codes found"
          minWidth="980px"
          columns={[
            {
              key: 'code',
              header: 'Code',
              value: (promo) => promo.code,
              sortable: true,
              render: (promo) => (
                <>
                  <div className="font-bold text-slate-950">{promo.code}</div>
                  <div className="text-xs text-slate-500">{promo.name || 'No label'}</div>
                </>
              ),
            },
            {
              key: 'discount',
              header: 'Discount',
              value: (promo) => (promo.discountType === 'percent' ? `${promo.discountValue}%` : formatPrice(promo.discountValue, promo.currency || 'USD')),
              className: 'font-semibold',
            },
            {
              key: 'appliesTo',
              header: 'Applies to',
              value: (promo) => (promo.appliesToPlanIds.length ? promo.appliesToPlanIds.join(', ') : 'All paid plans'),
              render: (promo) => (
                <>
                  <div>{promo.appliesToPlanIds.length ? promo.appliesToPlanIds.join(', ') : 'All paid plans'}</div>
                  <div className="text-xs text-slate-500">
                    {promo.applicableBillingIntervals.length ? promo.applicableBillingIntervals.join(', ') : 'All billing intervals'}
                  </div>
                </>
              ),
            },
            {
              key: 'limits',
              header: 'Limits',
              value: (promo) => promo.redeemedCount,
              sortable: true,
              render: (promo) => (
                <>
                  <div>{promo.redeemedCount}{promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ''} redeemed</div>
                  <div className="text-xs text-slate-500">{promo.perEmailLimit ? `${promo.perEmailLimit}/email` : 'No email limit'}</div>
                </>
              ),
            },
            {
              key: 'window',
              header: 'Window',
              value: (promo) => promo.startsAt || '',
              sortable: true,
              render: (promo) => (
                <>
                  <div>{promo.startsAt ? new Date(promo.startsAt).toLocaleDateString() : 'Any start'}</div>
                  <div className="text-xs text-slate-500">{promo.endsAt ? new Date(promo.endsAt).toLocaleDateString() : 'No end'}</div>
                </>
              ),
            },
            { key: 'status', header: 'Status', value: (promo) => (promo.active ? 'Active' : 'Inactive'), sortable: true, filterable: true, status: true },
          ]}
          rowActions={(promo) => (
            <>
              <RowActionButton title={`Edit ${promo.code}`} label="Edit" icon={<Edit2 />} onClick={() => openEditPromo(promo)} />
              <RowActionButton
                title={`Deactivate ${promo.code}`}
                label="Deactivate"
                icon={<Trash2 />}
                danger
                onClick={() => handleDeactivatePromo(promo)}
                disabled={!promo.active || deactivatingPromo}
              />
            </>
          )}
        />
      ) : null}

      {applyFor ? (
        <ApplyToSubscribersDialog
          planId={applyFor.planId}
          planName={applyFor.planName}
          onClose={() => setApplyFor(null)}
          onDone={(message) => {
            setApplyFor(null);
            onToast('success', message);
            refetchPackaging();
          }}
          onError={(message) => onToast('error', message)}
          onRefresh={() => {
            refetchPackaging();
            refetch();
          }}
        />
      ) : null}

      {editing && (
        <FormDialog
          title={editingMode === 'create' ? 'Create Plan' : 'Edit Plan'}
          subtitle="Fill out the details below. Customers see active public plans on the registration page."
          onClose={closePlanWindow}
          closeLabel="Close plan window"
          widthClass="max-w-5xl"
          footer={
            <FormActions
              onCancel={closePlanWindow}
              onSave={handleSave}
              saving={saving}
              saveLabel={<><Save className="h-4 w-4" />{editingMode === 'create' ? 'Create plan' : 'Save plan'}</>}
            />
          }
        >
          <FormSection title="Plan details" icon={<FileText />}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                label="Plan ID"
                required={editingMode === 'create'}
                disabled={editingMode === 'edit'}
                hint={editingMode === 'create' ? 'Lowercase letters, numbers, “-” and “_”. Can\'t be changed later.' : undefined}
              >
                <input
                  value={editing.id}
                  disabled={editingMode === 'edit'}
                  onChange={(event) => setEditing({ ...editing, id: event.target.value })}
                  placeholder="starter"
                  className={formControlClass}
                />
              </FormField>
              <FormField label="Name" required>
                <input
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  placeholder="Plan name shown to customers"
                  className={formControlClass}
                />
              </FormField>
            </div>
            <FormField label="Description" hint="One or two lines under the plan name on the registration page.">
              <textarea
                rows={2}
                value={editing.description}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                className={formControlClass}
              />
            </FormField>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <FormField label="Recommended plan" inline>
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={editing.recommended}
                  onChange={(event) => setEditing({ ...editing, recommended: event.target.checked })}
                />
              </FormField>
              <FormField label="Active" inline>
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={editing.active}
                  onChange={(event) => setEditing({ ...editing, active: event.target.checked })}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Pricing & billing" icon={<CreditCard />}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                label={`Package price (${editing.currency || 'USD'} / ${editing.billingInterval === 'yearly' ? 'year' : 'month'})`}
                required
              >
                <input
                  type="number"
                  min="0"
                  step={String(currencyInputStep(editing.currency))}
                  value={editing.basePriceInput}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      basePriceInput: event.target.value,
                      basePriceCents: centsFromAmount(event.target.value, editing.currency) || 0,
                    })
                  }
                  className={formControlClass}
                  data-testid="plan-price"
                />
              </FormField>
              <FormField label="Currency">
                {/* A list, not a text box (typing "JPY" letter by letter converted the
                    price at every keystroke). The typed price is kept as it is and
                    converted only when saved, so switching back and forth changes nothing. */}
                <select
                  value={normalizeCurrency(editing.currency || 'USD')}
                  onChange={(event) => {
                    const currency = normalizeCurrency(event.target.value);
                    setEditing({ ...editing, currency, basePriceCents: centsFromAmount(editing.basePriceInput, currency) || 0 });
                  }}
                  className={formControlClass}
                  data-testid="plan-currency"
                >
                  {planCurrencyOptions.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Billing interval">
                <select
                  data-testid="plan-billing-interval"
                  value={editing.billingInterval}
                  onChange={(event) => setEditing({ ...editing, billingInterval: event.target.value as BillingInterval })}
                  className={formControlClass}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="both">Monthly or yearly (customer chooses)</option>
                </select>
              </FormField>
              <FormField label="Trial months" hint="0 = no free period.">
                <input
                  type="number"
                  min="0"
                  max={PLAN_MAX_TRIAL_MONTHS}
                  step="1"
                  value={editing.trialMonths}
                  onChange={(event) => setEditing({ ...editing, trialMonths: Number(event.target.value) || 0 })}
                  className={formControlClass}
                />
              </FormField>
              <YearlyPricingFields value={editing} onChange={(next) => setEditing({ ...editing, ...next })} />
              <FormField label="Employee limit" hint="Blank for unlimited.">
                <input
                  value={editing.employeeLimit}
                  onChange={(event) => setEditing({ ...editing, employeeLimit: event.target.value })}
                  placeholder="Blank for unlimited"
                  className={formControlClass}
                />
              </FormField>
              <FormField label="Price is per employee" inline className="md:pt-6">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={editing.perEmployee}
                  onChange={(event) => setEditing({ ...editing, perEmployee: event.target.checked })}
                />
              </FormField>
            </div>
          </FormSection>

          <PackageBuilder value={editing} onChange={(next) => setEditing({ ...editing, ...next })} />

          <FormSection title="Features" icon={<ListChecks />} description="One per line. Shown under “Show features” on the registration page.">
            <FormField label="Features">
              <textarea
                rows={8}
                value={editing.featuresText}
                onChange={(event) => setEditing({ ...editing, featuresText: event.target.value })}
                placeholder={'Unlimited employees\nAI Workforce intelligence'}
                className={formControlClass}
              />
            </FormField>
          </FormSection>
        </FormDialog>
      )}

      {editingPromo && (
        <FormDialog
          title={editingPromoMode === 'create' ? 'Create Promo Code' : 'Edit Promo Code'}
          subtitle="Customers type this code at checkout on the registration page."
          onClose={closePromoWindow}
          closeLabel="Close promo window"
          widthClass="max-w-4xl"
          footer={(
            <FormActions
              onCancel={closePromoWindow}
              onSave={handleSavePromo}
              saving={savingPromo}
              saveLabel={<><Save className="h-4 w-4" />{editingPromoMode === 'create' ? 'Create promo' : 'Save promo'}</>}
              savingLabel="Saving..."
            />
          )}
        >
          <FormSection title="Code and discount" icon={<FileText />}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField label="Code" required>
                <input
                  value={editingPromo.code}
                  onChange={(event) => setEditingPromo({ ...editingPromo, code: event.target.value.toUpperCase() })}
                  placeholder="SAVE20"
                  className={`${formControlClass} font-mono uppercase`}
                />
              </FormField>
              <FormField label="Label" className="md:col-span-2">
                <input
                  value={editingPromo.name}
                  onChange={(event) => setEditingPromo({ ...editingPromo, name: event.target.value })}
                  placeholder="Launch offer"
                  className={formControlClass}
                />
              </FormField>
              <FormField label="Discount type">
                <select
                  value={editingPromo.discountType}
                  onChange={(event) => {
                    const discountType = event.target.value as DiscountType;
                    // A percent and an amount mean different things: start the new one empty.
                    setEditingPromo({
                      ...editingPromo,
                      discountType,
                      discountInput: discountType === editingPromo.discountType ? editingPromo.discountInput : '',
                    });
                  }}
                  className={formControlClass}
                >
                  <option value="percent">Percent</option>
                  <option value="amount">Fixed amount</option>
                </select>
              </FormField>
              {/* A fixed discount is typed as an amount ($10, ¥1000), kept as typed and
                  converted to minor units only when saved. */}
              <FormField
                label={editingPromo.discountType === 'percent'
                  ? 'Discount %'
                  : `Discount amount (${(editingPromo.currency || 'USD').toUpperCase()})`}
                required
              >
                <input
                  type="number"
                  min="0"
                  step={editingPromo.discountType === 'percent' ? '1' : String(currencyInputStep(editingPromo.currency || 'USD'))}
                  value={editingPromo.discountInput}
                  onChange={(event) => setEditingPromo({ ...editingPromo, discountInput: event.target.value })}
                  className={formControlClass}
                  data-testid="promo-discount"
                />
              </FormField>
              {/* A list, not a text box: typing "JPY" letter by letter converted the amount
                  at every keystroke. The typed amount is converted when saved. */}
              <FormField label="Currency">
                <select
                  value={normalizeCurrency(editingPromo.currency || 'USD')}
                  onChange={(event) => setEditingPromo({ ...editingPromo, currency: normalizeCurrency(event.target.value) })}
                  className={formControlClass}
                  data-testid="promo-currency"
                >
                  {promoCurrencyOptions.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Validity" icon={<CalendarDays />}>
            <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
              <FormField label="Starts at">
                <input
                  type="datetime-local"
                  value={editingPromo.startsAt}
                  onChange={(event) => setEditingPromo({ ...editingPromo, startsAt: event.target.value })}
                  className={formControlClass}
                />
              </FormField>
              <FormField label="Ends at">
                <input
                  type="datetime-local"
                  value={editingPromo.endsAt}
                  onChange={(event) => setEditingPromo({ ...editingPromo, endsAt: event.target.value })}
                  className={formControlClass}
                />
              </FormField>
              <FormField label="Active" inline className="pb-2">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={editingPromo.active}
                  onChange={(event) => setEditingPromo({ ...editingPromo, active: event.target.checked })}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Limits" icon={<Gauge />} description="Leave empty for no limit.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <FormField label="Max redemptions">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={editingPromo.maxRedemptions}
                  onChange={(event) => setEditingPromo({ ...editingPromo, maxRedemptions: event.target.value })}
                  placeholder="Unlimited"
                  className={formControlClass}
                />
              </FormField>
              <FormField label="Per email">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={editingPromo.perEmailLimit}
                  onChange={(event) => setEditingPromo({ ...editingPromo, perEmailLimit: event.target.value })}
                  placeholder="Unlimited"
                  className={formControlClass}
                />
              </FormField>
              <FormField label="Per company">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={editingPromo.perCompanyLimit}
                  onChange={(event) => setEditingPromo({ ...editingPromo, perCompanyLimit: event.target.value })}
                  placeholder="Unlimited"
                  className={formControlClass}
                />
              </FormField>
              <FormField label={`Minimum amount (${normalizeCurrency(editingPromo.currency || 'USD')})`}>
                <input
                  type="number"
                  min="0"
                  step={String(currencyInputStep(editingPromo.currency || 'USD'))}
                  value={editingPromo.minimumAmountDollars}
                  onChange={(event) => setEditingPromo({ ...editingPromo, minimumAmountDollars: event.target.value })}
                  placeholder="None"
                  className={formControlClass}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Who can use it" icon={<ListChecks />} description="No plan ticked means every paid plan.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.02em] text-slate-500">Applicable plans</p>
                <div className="space-y-2 rounded-lg border-[1.5px] border-slate-200 bg-white p-3">
                  {premiumPlans.map((plan) => (
                    <label key={plan.id} className="flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
                      <input
                        type="checkbox"
                        className={checkboxClass}
                        checked={editingPromo.appliesToPlanIds.includes(plan.id)}
                        onChange={(event) => {
                          const selected = event.target.checked
                            ? [...editingPromo.appliesToPlanIds, plan.id]
                            : editingPromo.appliesToPlanIds.filter((id) => id !== plan.id);
                          setEditingPromo({ ...editingPromo, appliesToPlanIds: selected });
                        }}
                      />
                      {plan.name} ({plan.billingInterval})
                      <span className="text-xs text-slate-400">{plan.id}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.02em] text-slate-500">Billing intervals</p>
                <div className="space-y-2 rounded-lg border-[1.5px] border-slate-200 bg-white p-3">
                  {(['monthly', 'yearly'] as BillingInterval[]).map((interval) => (
                    <label key={interval} className="flex cursor-pointer items-center gap-2.5 text-[13px] capitalize text-slate-700">
                      <input
                        type="checkbox"
                        className={checkboxClass}
                        checked={editingPromo.applicableBillingIntervals.includes(interval)}
                        onChange={(event) => {
                          const selected = event.target.checked
                            ? [...editingPromo.applicableBillingIntervals, interval]
                            : editingPromo.applicableBillingIntervals.filter((item) => item !== interval);
                          setEditingPromo({ ...editingPromo, applicableBillingIntervals: selected });
                        }}
                      />
                      {interval}
                    </label>
                  ))}
                </div>
                <FormField label="First-time customer only" inline className="mt-3">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={editingPromo.firstTimeCustomerOnly}
                    onChange={(event) => setEditingPromo({ ...editingPromo, firstTimeCustomerOnly: event.target.checked })}
                  />
                </FormField>
              </div>
            </div>
          </FormSection>
        </FormDialog>
      )}
      {dialog}
    </div>
  );
};

export const Packages = Plans;
