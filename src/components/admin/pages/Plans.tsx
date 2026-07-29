import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { Check, Download, Edit2, Filter, Plus, Printer, RotateCcw, Save, Search, Trash2, X } from 'lucide-react';
import {
  ADMIN_DELETE_PLAN_MUTATION,
  ADMIN_DEACTIVATE_PROMO_CODE_MUTATION,
  ADMIN_PLANS_QUERY,
  ADMIN_PROMO_CODES_QUERY,
  ADMIN_SAVE_PROMO_CODE_MUTATION,
  ADMIN_SAVE_PLAN_MUTATION,
} from '../../../lib/graphql';
import { centsFromDollars, formatPrice } from '../../../lib/admin-utils';
import { buildColumnFilterOptions, ColumnFilter, matchesColumnFilter } from '../ColumnFilter';

type BillingInterval = 'monthly' | 'yearly';
type SortDirection = 'asc' | 'desc' | null;
type PlanSortKey = 'sortOrder' | 'name' | 'basePriceCents' | 'billingInterval' | 'trialMonths' | 'active';
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
  discountValue: number;
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

const canonicalPlans: PlanType[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Everything you need to get started - no credit card, no commitment.',
    basePriceCents: 0,
    currency: 'USD',
    billingInterval: 'monthly',
    perEmployee: false,
    trialMonths: 0,
    employeeLimit: 10,
    recommended: false,
    active: true,
    sortOrder: 1,
    features: [
      'Up to 10 employees',
      'Core HR & Payroll',
      'Time & Attendance tracking',
      'Basic reporting (5 templates)',
      'Employee self-service portal',
      '2 integrations',
      'Email support',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Full AI power across every department. Unlimited scale, zero friction.',
    basePriceCents: 1200,
    currency: 'USD',
    billingInterval: 'monthly',
    perEmployee: true,
    trialMonths: 6,
    employeeLimit: null,
    recommended: true,
    active: true,
    sortOrder: 2,
    features: [
      'Unlimited employees',
      'Full AI Workforce intelligence',
      'Multi-rate & multi-entity payroll',
      'AI Talent & ATS (unlimited jobs)',
      'AI Performance & 360 feedback',
      'AI Accounting & self-reconciliation',
      'AI CRM - full pipeline',
      '100+ analytics report templates',
      'Unlimited integrations',
      'Dedicated success manager',
      '24 / 7 priority support & SLA',
      'Custom onboarding & training',
    ],
  },
];

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

const toEditingPlan = (plan: PlanType): EditingPlan => ({
  id: plan.id,
  name: plan.name,
  description: plan.description || '',
  basePriceCents: plan.basePriceCents,
  currency: normalizeCurrency(plan.currency || 'USD'),
  billingInterval: plan.billingInterval || 'monthly',
  perEmployee: Boolean(plan.perEmployee),
  trialMonths: plan.trialMonths || 0,
  employeeLimit: plan.employeeLimit === null || plan.employeeLimit === undefined ? '' : String(plan.employeeLimit),
  featuresText: parseFeatures(plan.features).join('\n'),
  recommended: Boolean(plan.recommended),
  active: Boolean(plan.active),
  sortOrder: plan.sortOrder || 0,
});

const newEditingPlan = (plans: PlanType[]): EditingPlan => ({
  id: '',
  name: '',
  description: '',
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
  discountValue: 10,
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
  discountValue: promo.discountValue,
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
      : String((promo.minimumAmountCents / 100).toFixed(2)),
  appliesToPlanIds: promo.appliesToPlanIds || [],
  applicableBillingIntervals: (promo.applicableBillingIntervals || []).filter((item): item is BillingInterval => item === 'monthly' || item === 'yearly'),
});

const planToInput = (plan: EditingPlan) => ({
  id: plan.id,
  name: plan.name.trim(),
  description: plan.description.trim(),
  basePriceCents: plan.basePriceCents,
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
});

const promoToInput = (promo: EditingPromo) => ({
  id: promo.id,
  code: promo.code.trim().toUpperCase(),
  name: promo.name.trim(),
  discountType: promo.discountType,
  discountValue: Number(promo.discountValue) || 0,
  currency: normalizeCurrency(promo.currency || 'USD'),
  active: promo.active,
  startsAt: fromDateTimeLocal(promo.startsAt),
  endsAt: fromDateTimeLocal(promo.endsAt),
  maxRedemptions: promo.maxRedemptions.trim() ? Number(promo.maxRedemptions) : null,
  perEmailLimit: promo.perEmailLimit.trim() ? Number(promo.perEmailLimit) : null,
  perCompanyLimit: promo.perCompanyLimit.trim() ? Number(promo.perCompanyLimit) : null,
  firstTimeCustomerOnly: promo.firstTimeCustomerOnly,
  minimumAmountCents: promo.minimumAmountDollars.trim() ? centsFromDollars(Number(promo.minimumAmountDollars)) : null,
  appliesToPlanIds: promo.appliesToPlanIds,
  applicableBillingIntervals: promo.applicableBillingIntervals,
});

const billingCopy = (plan: PlanType) => {
  if (plan.basePriceCents === 0) return 'forever';
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
  const [activeTab, setActiveTab] = useState<PlanAdminTab>('plans');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [planStatusSelections, setPlanStatusSelections] = useState<string[]>([]);
  const [editing, setEditing] = useState<EditingPlan | null>(null);
  const [editingMode, setEditingMode] = useState<'create' | 'edit'>('edit');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [planFiltersOpen, setPlanFiltersOpen] = useState(true);
  const [sortKey, setSortKey] = useState<PlanSortKey>('sortOrder');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [promoSearch, setPromoSearch] = useState('');
  const [promoStatusSelections, setPromoStatusSelections] = useState<string[]>([]);
  const [promoFiltersOpen, setPromoFiltersOpen] = useState(true);
  const [editingPromo, setEditingPromo] = useState<EditingPromo | null>(null);
  const [editingPromoMode, setEditingPromoMode] = useState<'create' | 'edit'>('create');

  const { data, loading, error, refetch } = useQuery<
    { adminPlans: PlanType[] },
    { includeInactive: boolean; search: string | null; active: boolean | null },
    any
  >(ADMIN_PLANS_QUERY, {
    variables: {
      includeInactive: true,
      search: search.trim() || null,
      active: null,
    },
    fetchPolicy: 'cache-and-network',
  });
  const { data: promoData, loading: promoLoading, refetch: refetchPromos } = useQuery<
    { adminPromoCodes: PromoCodeType[] },
    { includeInactive: boolean; search: string | null; active: boolean | null; planId: string | null },
    any
  >(ADMIN_PROMO_CODES_QUERY, {
    variables: {
      includeInactive: true,
      search: promoSearch.trim() || null,
      active: null,
      planId: null,
    },
    fetchPolicy: 'cache-and-network',
  });

  const [savePlan, { loading: saving }] = useMutation(ADMIN_SAVE_PLAN_MUTATION);
  const [deletePlan, { loading: deleting }] = useMutation<DeletePlanMutationData, { id: string; reason: string }, any, any>(ADMIN_DELETE_PLAN_MUTATION);
  const [savePromoCode, { loading: savingPromo }] = useMutation<SavePromoCodeMutationData, { input: ReturnType<typeof promoToInput> }, any, any>(ADMIN_SAVE_PROMO_CODE_MUTATION);
  const [deactivatePromoCode, { loading: deactivatingPromo }] = useMutation<DeactivatePromoCodeMutationData, { id: string; reason: string }, any, any>(ADMIN_DEACTIVATE_PROMO_CODE_MUTATION);

  const backendPlans = data?.adminPlans || [];
  const sourcePlans = backendPlans.length > 0 ? backendPlans : canonicalPlans;
  const backendReady = !error && backendPlans.length > 0;
  const promoCodes = promoData?.adminPromoCodes || [];
  const premiumPlans = sourcePlans.filter((plan) => plan.active && plan.basePriceCents > 0);
  const planStatusOptions = useMemo(
    () => buildColumnFilterOptions(sourcePlans, (plan) => (plan.active ? 'Active' : 'Inactive')),
    [sourcePlans],
  );
  const promoStatusOptions = useMemo(
    () => buildColumnFilterOptions(promoCodes, (promo) => (promo.active ? 'Active' : 'Inactive')),
    [promoCodes],
  );

  const plans = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = sourcePlans
      .filter((plan) => {
        if (viewMode === 'card' && activeFilter !== 'all' && plan.active !== (activeFilter === 'active')) return false;
        if (!matchesColumnFilter(planStatusSelections, plan.active ? 'Active' : 'Inactive')) return false;
        if (!needle) return true;
        return [plan.id, plan.name, plan.description, ...parseFeatures(plan.features)]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      });
    if (!sortDirection) return filtered;
    return [...filtered].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const leftValue = typeof left === 'string' ? left.toLowerCase() : Number(left ?? 0);
      const rightValue = typeof right === 'string' ? right.toLowerCase() : Number(right ?? 0);
      if (leftValue < rightValue) return sortDirection === 'asc' ? -1 : 1;
      if (leftValue > rightValue) return sortDirection === 'asc' ? 1 : -1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }, [sourcePlans, search, activeFilter, planStatusSelections, sortKey, sortDirection, viewMode]);

  const displayedPromoCodes = useMemo(
    () => promoCodes.filter((promo) => matchesColumnFilter(promoStatusSelections, promo.active ? 'Active' : 'Inactive')),
    [promoCodes, promoStatusSelections],
  );

  const cycleSort = (key: PlanSortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
      return;
    }
    setSortDirection((current) => current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc');
  };

  const SortHeader = ({ label, column, align = 'left' }: { label: string; column: PlanSortKey; align?: 'left' | 'right' }) => (
    <button
      type="button"
      onClick={() => cycleSort(column)}
      className={`inline-flex w-full items-center gap-1 text-[13px] font-extrabold uppercase tracking-wide ${
        align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
      } ${sortKey === column && sortDirection ? 'text-sky-700' : 'text-sky-600'}`}
    >
      <span>{label}</span>
      <span className="text-[10px]">{sortKey === column && sortDirection ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
    </button>
  );

  const openCreatePlan = () => {
    setEditingMode('create');
    setEditing(newEditingPlan(sourcePlans));
  };

  const openEditPlan = (plan: PlanType) => {
    setEditingMode('edit');
    setEditing(toEditingPlan(plan));
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

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.id.trim() || !editing.name.trim()) {
      onToast('error', 'Plan id and name are required');
      return;
    }

    try {
      await savePlan({ variables: { input: planToInput(editing) } });
      onToast('success', `Plan "${editing.name}" ${editingMode === 'create' ? 'created' : 'saved'}`);
      closePlanWindow();
      refetch();
    } catch (err: any) {
      onToast('error', err.message || 'Backend plan API is not ready yet');
    }
  };

  const handleSavePromo = async () => {
    if (!editingPromo) return;
    if (!editingPromo.code.trim()) {
      onToast('error', 'Promo code is required');
      return;
    }
    if (editingPromo.discountType === 'percent' && (editingPromo.discountValue <= 0 || editingPromo.discountValue > 100)) {
      onToast('error', 'Percent discount must be between 1 and 100');
      return;
    }
    if (editingPromo.discountType === 'amount' && editingPromo.discountValue <= 0) {
      onToast('error', 'Fixed discount amount must be greater than 0');
      return;
    }
    if (editingPromo.appliesToPlanIds.length === 0) {
      onToast('error', 'Choose at least one applicable paid plan');
      return;
    }

    try {
      const { data } = await savePromoCode({ variables: { input: promoToInput(editingPromo) } });
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

  const handleDeletePlan = async (plan: PlanType) => {
    const reason = window.prompt(`Reason for deleting ${plan.name}`, 'Admin deleted unused plan');
    if (!reason?.trim()) {
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
      await refetch();
    } catch (err: any) {
      onToast('error', err.message || 'Plan could not be deleted');
    }
  };

  const handleDeactivatePromo = async (promo: PromoCodeType) => {
    const reason = window.prompt(`Reason for deactivating ${promo.code}`, 'Admin deactivated promo code');
    if (!reason?.trim()) {
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
      `<tr><td>${escapeHtml(plan.id)}</td><td>${escapeHtml(plan.name)}</td><td>${plan.basePriceCents / 100}</td><td>${escapeHtml(plan.currency)}</td><td>${escapeHtml(plan.billingInterval)}</td><td>${escapeHtml(plan.active ? 'Active' : 'Inactive')}</td></tr>`
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
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
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
          <h2 className="text-2xl font-bold text-slate-800">Plans & Pricing</h2>
          <p className="text-slate-600">
            Manage paid registration plans and promo codes used at checkout.
          </p>
          {!backendReady ? (
            <p className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Showing canonical fallback plans until backend adminPlans is available.
            </p>
          ) : null}
        </div>
        {activeTab === 'plans' ? (
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
                setPlanStatusSelections([]);
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
        ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
          <div className="relative min-w-[220px] max-w-[320px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
              value={promoSearch}
              onChange={(event) => setPromoSearch(event.target.value)}
              placeholder="Search promo codes"
            />
          </div>
          <button
            type="button"
            onClick={() => setPromoFiltersOpen((open) => {
              if (open) setPromoStatusSelections([]);
              return !open;
            })}
            aria-pressed={promoFiltersOpen}
            title="Filters"
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
              promoFiltersOpen
                ? 'border-sky-400 bg-sky-50 text-sky-500'
                : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-sky-300 hover:text-sky-400'
            }`}
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => refetchPromos()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200/60 bg-slate-50 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <RotateCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreatePromo}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:from-sky-600 hover:to-cyan-500"
          >
            <Plus className="h-4 w-4" />
            New promo
          </button>
        </div>
        )}
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

      {activeTab === 'plans' && loading && backendPlans.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500">
          Loading plans...
        </div>
      ) : null}

      {activeTab === 'plans' && (viewMode === 'table' ? (
        <div className="relative overflow-x-clip overflow-y-visible rounded-lg border border-gray-200 bg-white p-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="sticky top-0 z-10 bg-white">
                  <th className="px-3 py-3.5 align-top"><SortHeader label="Plan" column="name" /></th>
                  <th className="px-3 py-3.5 align-top"><SortHeader label="Price" column="basePriceCents" /></th>
                  <th className="px-3 py-3.5 align-top"><SortHeader label="Billing" column="billingInterval" /></th>
                  <th className="px-3 py-3.5 align-top"><SortHeader label="Trial" column="trialMonths" /></th>
                  <th className="px-3 py-3.5 align-top"><SortHeader label="Status" column="active" /></th>
                  <th className="px-3 py-3.5 text-right text-[13px] font-extrabold uppercase tracking-wide text-sky-600">Actions</th>
                </tr>
                {planFiltersOpen ? (
                <tr className="border-t border-slate-200 bg-white">
                  <th className="px-3 py-1.5"></th>
                  <th className="px-3 py-1.5"></th>
                  <th className="px-3 py-1.5"></th>
                  <th className="px-3 py-1.5"></th>
                  <th className="px-3 py-1.5">
                    <ColumnFilter
                      label="Status"
                      options={planStatusOptions}
                      selectedValues={planStatusSelections}
                      onChange={setPlanStatusSelections}
                    />
                  </th>
                  <th className="px-3 py-1.5"></th>
                </tr>
                ) : null}
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-500">No plans found</td>
                  </tr>
                ) : plans.map((plan) => (
                  <tr key={plan.id} className="h-[52px] border-t border-slate-100 transition-colors even:bg-sky-50/[0.18] hover:bg-sky-50">
                    <td className="px-3 py-3 align-top text-[14px] text-slate-950">
                      <div className="font-bold text-slate-950">{plan.name}</div>
                      <div className="text-xs text-slate-500">{plan.id}</div>
                      <div className="mt-1 max-w-md truncate text-xs text-slate-500">{plan.description}</div>
                    </td>
                    <td className="px-3 py-3 align-top text-[14px] font-semibold text-slate-950">
                      {formatPrice(plan.basePriceCents, plan.currency)}
                    </td>
                    <td className="px-3 py-3 align-top text-[14px] text-slate-950">
                      <div>{plan.billingInterval}</div>
                      <div className="text-xs text-slate-500">{plan.perEmployee ? 'Per employee' : 'Flat'}</div>
                    </td>
                    <td className="px-3 py-3 align-top text-[14px] text-slate-950">{plan.trialMonths} months</td>
                    <td className="px-3 py-3 align-top">
                      <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        plan.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {plan.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditPlan(plan)}
                          title={`Edit ${plan.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-none text-slate-400 transition hover:bg-sky-400/10 hover:text-sky-500"
                        >
                          <Edit2 className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePlan(plan)}
                          disabled={deleting}
                          title={`Delete ${plan.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-none text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
                      {isPremium ? (
                        <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-tight text-sky-700">
                          Free for 6 months
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
                    <div className="text-lg font-black leading-tight text-gray-800">
                      {formatPrice(plan.basePriceCents, plan.currency).replace('.00', '')}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{billingCopy(plan)}</p>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2.5">
                    <span className="mb-0.5 block text-[11px] font-black uppercase tracking-tight text-amber-600">Trial</span>
                    <div className="text-sm font-bold text-gray-800">{plan.trialMonths} months</div>
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

              <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => openEditPlan(plan)}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-3 text-[13px] font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
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
        <div className="relative overflow-x-clip overflow-y-visible rounded-lg border border-gray-200 bg-white p-2">
          {promoLoading ? (
            <div className="p-8 text-center text-slate-500">Loading promo codes...</div>
          ) : displayedPromoCodes.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No promo codes found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className="sticky top-0 z-10 bg-white">
                    <th className="px-3 py-3.5 text-left text-[13px] font-extrabold uppercase tracking-wide text-sky-600">Code</th>
                    <th className="px-3 py-3.5 text-left text-[13px] font-extrabold uppercase tracking-wide text-sky-600">Discount</th>
                    <th className="px-3 py-3.5 text-left text-[13px] font-extrabold uppercase tracking-wide text-sky-600">Applies To</th>
                    <th className="px-3 py-3.5 text-left text-[13px] font-extrabold uppercase tracking-wide text-sky-600">Limits</th>
                    <th className="px-3 py-3.5 text-left text-[13px] font-extrabold uppercase tracking-wide text-sky-600">Window</th>
                    <th className="px-3 py-3.5 text-left text-[13px] font-extrabold uppercase tracking-wide text-sky-600">Status</th>
                    <th className="px-3 py-3.5 text-right text-[13px] font-extrabold uppercase tracking-wide text-sky-600">Actions</th>
                  </tr>
                  {promoFiltersOpen ? (
                  <tr className="border-t border-slate-200 bg-white">
                    <th className="px-3 py-1.5"></th>
                    <th className="px-3 py-1.5"></th>
                    <th className="px-3 py-1.5"></th>
                    <th className="px-3 py-1.5"></th>
                    <th className="px-3 py-1.5"></th>
                    <th className="px-3 py-1.5">
                      <ColumnFilter
                        label="Status"
                        options={promoStatusOptions}
                        selectedValues={promoStatusSelections}
                        onChange={setPromoStatusSelections}
                      />
                    </th>
                    <th className="px-3 py-1.5"></th>
                  </tr>
                  ) : null}
                </thead>
                <tbody>
                  {displayedPromoCodes.map((promo) => (
                    <tr key={promo.id} className="h-[52px] border-t border-slate-100 transition-colors even:bg-sky-50/[0.18] hover:bg-sky-50">
                      <td className="px-3 py-3 align-top text-[14px] text-slate-950">
                        <div className="font-bold text-slate-950">{promo.code}</div>
                        <div className="text-xs text-slate-500">{promo.name || 'No label'}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-[14px] font-semibold text-slate-950">
                        {promo.discountType === 'percent'
                          ? `${promo.discountValue}%`
                          : formatPrice(promo.discountValue, promo.currency || 'USD')}
                      </td>
                      <td className="px-3 py-3 align-top text-[14px] text-slate-950">
                        <div>{promo.appliesToPlanIds.length ? promo.appliesToPlanIds.join(', ') : 'All paid plans'}</div>
                        <div className="text-xs text-slate-500">
                          {promo.applicableBillingIntervals.length ? promo.applicableBillingIntervals.join(', ') : 'All billing intervals'}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-[14px] text-slate-950">
                        <div>{promo.redeemedCount}{promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ''} redeemed</div>
                        <div className="text-xs text-slate-500">
                          {promo.perEmailLimit ? `${promo.perEmailLimit}/email` : 'No email limit'}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-[14px] text-slate-950">
                        <div>{promo.startsAt ? new Date(promo.startsAt).toLocaleDateString() : 'Any start'}</div>
                        <div className="text-xs text-slate-500">{promo.endsAt ? new Date(promo.endsAt).toLocaleDateString() : 'No end'}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          promo.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {promo.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditPromo(promo)}
                            title={`Edit ${promo.code}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-none text-slate-400 transition hover:bg-sky-400/10 hover:text-sky-500"
                          >
                            <Edit2 className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeactivatePromo(promo)}
                            disabled={!promo.active || deactivatingPromo}
                            title={`Deactivate ${promo.code}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-none text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Deactivate</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="text-lg font-bold text-slate-800">{editingMode === 'create' ? 'Create Plan' : 'Edit Plan'}</h3>
              <button
                type="button"
                onClick={closePlanWindow}
                className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
                aria-label="Close plan window"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Plan ID</span>
                  <input
                    value={editing.id}
                    disabled={editingMode === 'edit'}
                    onChange={(event) => setEditing({ ...editing, id: event.target.value })}
                    placeholder="starter"
                    className={`w-full rounded-lg border border-slate-300 px-3 py-2 ${
                      editingMode === 'edit' ? 'bg-slate-100' : ''
                    }`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
                  <input
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Base price ($)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editing.basePriceCents / 100}
                    onChange={(event) =>
                      setEditing({ ...editing, basePriceCents: centsFromDollars(Number(event.target.value) || 0) })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Currency</span>
                  <input
                    value={editing.currency}
                    onChange={(event) => setEditing({ ...editing, currency: normalizeCurrency(event.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Billing interval</span>
                  <select
                    value={editing.billingInterval}
                    onChange={(event) => setEditing({ ...editing, billingInterval: event.target.value as BillingInterval })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Trial months</span>
                  <input
                    type="number"
                    min="0"
                    value={editing.trialMonths}
                    onChange={(event) => setEditing({ ...editing, trialMonths: Number(event.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Employee limit</span>
                  <input
                    value={editing.employeeLimit}
                    onChange={(event) => setEditing({ ...editing, employeeLimit: event.target.value })}
                    placeholder="Blank for unlimited"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="flex items-center gap-2 pt-7 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editing.perEmployee}
                    onChange={(event) => setEditing({ ...editing, perEmployee: event.target.checked })}
                  />
                  Price is per employee
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editing.recommended}
                    onChange={(event) => setEditing({ ...editing, recommended: event.target.checked })}
                  />
                  Recommended plan
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(event) => setEditing({ ...editing, active: event.target.checked })}
                  />
                  Active
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
                <textarea
                  rows={2}
                  value={editing.description}
                  onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Features</span>
                <textarea
                  rows={8}
                  value={editing.featuresText}
                  onChange={(event) => setEditing({ ...editing, featuresText: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>

            <div className="shrink-0 flex justify-end gap-2 border-t border-slate-100 bg-white p-4">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                onClick={closePlanWindow}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0ea5b7] px-4 py-2 font-semibold text-white hover:bg-[#0b8fa0] disabled:opacity-50"
                onClick={handleSave}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : editingMode === 'create' ? 'Create plan' : 'Save plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPromo && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="text-lg font-bold text-slate-800">
                {editingPromoMode === 'create' ? 'Create Promo Code' : 'Edit Promo Code'}
              </h3>
              <button
                type="button"
                onClick={closePromoWindow}
                className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
                aria-label="Close promo window"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Code</span>
                  <input
                    value={editingPromo.code}
                    onChange={(event) => setEditingPromo({ ...editingPromo, code: event.target.value.toUpperCase() })}
                    placeholder="SAVE20"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Label</span>
                  <input
                    value={editingPromo.name}
                    onChange={(event) => setEditingPromo({ ...editingPromo, name: event.target.value })}
                    placeholder="Launch offer"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Discount type</span>
                  <select
                    value={editingPromo.discountType}
                    onChange={(event) => setEditingPromo({ ...editingPromo, discountType: event.target.value as DiscountType })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="percent">Percent</option>
                    <option value="amount">Fixed amount</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    {editingPromo.discountType === 'percent' ? 'Discount %' : 'Discount cents'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={editingPromo.discountValue}
                    onChange={(event) => setEditingPromo({ ...editingPromo, discountValue: Number(event.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Currency</span>
                  <input
                    value={editingPromo.currency}
                    onChange={(event) => setEditingPromo({ ...editingPromo, currency: normalizeCurrency(event.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Starts at</span>
                  <input
                    type="datetime-local"
                    value={editingPromo.startsAt}
                    onChange={(event) => setEditingPromo({ ...editingPromo, startsAt: event.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Ends at</span>
                  <input
                    type="datetime-local"
                    value={editingPromo.endsAt}
                    onChange={(event) => setEditingPromo({ ...editingPromo, endsAt: event.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="flex items-center gap-2 pt-7 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingPromo.active}
                    onChange={(event) => setEditingPromo({ ...editingPromo, active: event.target.checked })}
                  />
                  Active
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Max redemptions</span>
                  <input
                    type="number"
                    value={editingPromo.maxRedemptions}
                    onChange={(event) => setEditingPromo({ ...editingPromo, maxRedemptions: event.target.value })}
                    placeholder="Unlimited"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Per email</span>
                  <input
                    type="number"
                    value={editingPromo.perEmailLimit}
                    onChange={(event) => setEditingPromo({ ...editingPromo, perEmailLimit: event.target.value })}
                    placeholder="Unlimited"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Per company</span>
                  <input
                    type="number"
                    value={editingPromo.perCompanyLimit}
                    onChange={(event) => setEditingPromo({ ...editingPromo, perCompanyLimit: event.target.value })}
                    placeholder="Unlimited"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Minimum amount ($)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editingPromo.minimumAmountDollars}
                    onChange={(event) => setEditingPromo({ ...editingPromo, minimumAmountDollars: event.target.value })}
                    placeholder="None"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="mb-3 text-sm font-bold text-slate-800">Applicable plans</p>
                  <div className="space-y-2">
                    {premiumPlans.map((plan) => (
                      <label key={plan.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={editingPromo.appliesToPlanIds.includes(plan.id)}
                          onChange={(event) => {
                            const selected = event.target.checked
                              ? [...editingPromo.appliesToPlanIds, plan.id]
                              : editingPromo.appliesToPlanIds.filter((id) => id !== plan.id);
                            setEditingPromo({ ...editingPromo, appliesToPlanIds: selected });
                          }}
                        />
                        {plan.name} ({plan.billingInterval})
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="mb-3 text-sm font-bold text-slate-800">Billing intervals</p>
                  <div className="space-y-2">
                    {(['monthly', 'yearly'] as BillingInterval[]).map((interval) => (
                      <label key={interval} className="flex items-center gap-2 text-sm capitalize text-slate-700">
                        <input
                          type="checkbox"
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
                  <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={editingPromo.firstTimeCustomerOnly}
                      onChange={(event) => setEditingPromo({ ...editingPromo, firstTimeCustomerOnly: event.target.checked })}
                    />
                    First-time customer only
                  </label>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex justify-end gap-2 border-t border-slate-100 bg-white p-4">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                onClick={closePromoWindow}
                disabled={savingPromo}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingPromo}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0ea5b7] px-4 py-2 font-semibold text-white hover:bg-[#0b8fa0] disabled:opacity-50"
                onClick={handleSavePromo}
              >
                <Save className="h-4 w-4" />
                {savingPromo ? 'Saving...' : editingPromoMode === 'create' ? 'Create promo' : 'Save promo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const Packages = Plans;
