import React, { useEffect, useMemo, useState } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { AlertTriangle, ChevronDown, ChevronRight, Layers, X } from 'lucide-react';
import {
  ADMIN_APPLY_PLAN_TO_SUBSCRIBERS_MUTATION,
  ADMIN_ASSIGN_COMPANY_PLAN_MUTATION,
  ADMIN_COMPANY_PACKAGES_QUERY,
  ADMIN_PACKAGE_MODULES_QUERY,
  ADMIN_PLANS_PACKAGING_QUERY,
} from '../../../lib/graphql';
import { amountFromCents, centsFromAmount, currencyDecimals, formatPrice } from '../../../lib/admin-utils';

/**
 * Packages (dynamic packages): the admin sets the package price; modules carry
 * no price and only decide what the package unlocks. Modules form a two-level
 * tree -- a feature area and its parts. Selecting a feature area includes all
 * of its parts (only the area id is sent); a partly selected area sends the
 * chosen parts.
 */
export type PricingMode = 'fixed' | 'sum_modules' | 'sum_modules_disc' | 'base_plus_modules';
export type PackageBillingInterval = 'monthly' | 'yearly' | 'both';

export interface PackageModuleSelection {
  moduleId: string;
  /** Kept for API compatibility; always blank (no per-module pricing). */
  priceOverride: string;
}

export interface PackageDraft {
  pricingMode: PricingMode;
  basePriceCents: number;
  currency: string;
  billingInterval: PackageBillingInterval;
  bundleDiscountPct: number;
  yearlyPriceOverride: string;
  yearlyDiscountPct: number;
  isPublic: boolean;
  modules: PackageModuleSelection[];
}

export interface PackageModuleOption {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  sortOrder: number;
  category?: string | null;
  isCore?: boolean | null;
  icon?: string | null;
  dependsOn?: string[] | null;
  parentId?: string | null;
}

export interface PlanPackagingInfo {
  id: string;
  name?: string | null;
  active?: boolean | null;
  billingInterval?: string | null;
  version: number;
  isPublic: boolean;
  subscribersCount?: number | null;
  outdatedSubscribersCount?: number | null;
  modules: { moduleId: string; name: string; category?: string | null; parentId?: string | null }[];
  pricing: {
    currency: string;
    monthlyPriceCents: number | null;
    yearlyPriceCents: number | null;
    savingsPct: number;
    availableIntervals?: string[] | null;
  } | null;
}

export interface CompanyPackageInfo {
  companyId: number;
  planId?: string | null;
  planName?: string | null;
  billingInterval?: string | null;
  planVersion?: number | null;
  latestVersion?: number | null;
  updateAvailable?: boolean | null;
  activeModules: string[];
  unrestricted: boolean;
  access?: string | null;
}

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  fixed: 'Package price',
  sum_modules: 'Package price',
  sum_modules_disc: 'Package price',
  base_plus_modules: 'Package price',
};

// ---------------------------------------------------------------------------
// Module tree helpers
// ---------------------------------------------------------------------------
export interface ModuleTreeNode {
  module: PackageModuleOption;
  children: PackageModuleOption[];
}

const bySortOrder = (a: PackageModuleOption, b: PackageModuleOption) =>
  (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name);

/** Feature areas (modules without a parent) with their parts, in sort order. */
export const buildModuleTree = (options: PackageModuleOption[]): ModuleTreeNode[] => {
  const ids = new Set(options.map((o) => o.id));
  const roots = options.filter((o) => !o.parentId || !ids.has(o.parentId)).sort(bySortOrder);
  return roots.map((module) => ({
    module,
    children: options.filter((o) => o.parentId === module.id).sort(bySortOrder),
  }));
};

/** The selected ids plus every part of each selected feature area. */
export const expandModuleIds = (ids: Iterable<string>, options: PackageModuleOption[]): Set<string> => {
  const result = new Set(ids);
  options.forEach((o) => {
    if (o.parentId && result.has(o.parentId)) result.add(o.id);
  });
  return result;
};

/**
 * Smallest id list for a set of covered modules: a feature area whose parts
 * are all covered is sent as the area alone.
 */
export const normalizeModuleIds = (covered: Set<string>, options: PackageModuleOption[]): string[] => {
  const result: string[] = [];
  buildModuleTree(options).forEach(({ module, children }) => {
    if (children.length === 0) {
      if (covered.has(module.id)) result.push(module.id);
      return;
    }
    const chosen = children.filter((c) => covered.has(c.id));
    if (covered.has(module.id) || chosen.length === children.length) {
      result.push(module.id);
    } else {
      chosen.forEach((c) => result.push(c.id));
    }
  });
  return result;
};

export interface FeatureAreaSummary {
  id: string;
  name: string;
  /** e.g. "2 of 3 parts" when only some parts are included, else null. */
  partial: string | null;
}

/** Module ids summarised per feature area (for chips and gain/loss lists). */
export const summarizeFeatureAreas = (ids: Iterable<string>, options: PackageModuleOption[]): FeatureAreaSummary[] => {
  const covered = expandModuleIds(ids, options);
  const summary: FeatureAreaSummary[] = [];
  buildModuleTree(options).forEach(({ module, children }) => {
    const chosen = children.filter((c) => covered.has(c.id));
    if (covered.has(module.id) || (children.length > 0 && chosen.length === children.length)) {
      summary.push({ id: module.id, name: module.name, partial: null });
    } else if (chosen.length > 0) {
      summary.push({
        id: module.id,
        name: module.name,
        partial: chosen.length === 1 ? chosen[0].name : `${chosen.length} of ${children.length} parts`,
      });
    }
  });
  return summary;
};

/** Gains and losses (feature-area level) when a company moves from `before` to `after`. */
export const moduleDiff = (before: Set<string>, after: Set<string>, options: PackageModuleOption[]) => {
  const describe = (ids: string[]) => summarizeFeatureAreas(ids, options).map((a) => (a.partial ? `${a.name} (${a.partial})` : a.name));
  return {
    gains: describe([...after].filter((id) => !before.has(id))),
    losses: describe([...before].filter((id) => !after.has(id))),
  };
};

// ---------------------------------------------------------------------------
// Draft <-> API
// ---------------------------------------------------------------------------
/** Fields sent with adminSavePlan. Pricing is always the admin-entered package price. */
export const draftToPlanInputFields = (draft: PackageDraft) => ({
  pricingMode: 'fixed' as PricingMode,
  bundleDiscountPct: 0,
  billingInterval: draft.billingInterval,
  yearlyPriceCents:
    draft.billingInterval === 'both' && draft.yearlyPriceOverride.trim()
      ? centsFromAmount(Number(draft.yearlyPriceOverride) || 0, draft.currency)
      : null,
  yearlyDiscountPct: draft.billingInterval === 'both' ? Number(draft.yearlyDiscountPct) || 0 : 0,
  isPublic: draft.isPublic,
  modules: draft.modules.map((m) => ({ moduleId: m.moduleId, priceOverrideCents: null })),
});

/** The yearly amount the customer will see for a "monthly or yearly" package. */
export const derivedYearlyCents = (draft: PackageDraft): number | null => {
  if (draft.billingInterval !== 'both') return null;
  if (draft.yearlyPriceOverride.trim()) return centsFromAmount(Number(draft.yearlyPriceOverride) || 0, draft.currency);
  const pct = Math.min(Math.max(Number(draft.yearlyDiscountPct) || 0, 0), 100);
  return Math.round((draft.basePriceCents * 12 * (100 - pct)) / 100);
};

export const validatePackageDraft = (draft: PackageDraft, options: PackageModuleOption[]): string | null => {
  if (draft.modules.length === 0) return 'Select the modules this package unlocks.';
  if (draft.basePriceCents < 0) return 'Package price cannot be negative.';
  if (draft.yearlyDiscountPct < 0 || draft.yearlyDiscountPct > 100) return 'Yearly discount must be between 0 and 100%.';
  if (draft.billingInterval === 'both' && draft.yearlyPriceOverride.trim()) {
    const yearly = Number(draft.yearlyPriceOverride);
    if (!Number.isFinite(yearly)) return 'Yearly price must be a number.';
    if (yearly < 0) return 'Yearly price cannot be negative.';
  }
  // A paid package must not become free on the yearly option (a 0 price or a
  // 100% discount).
  const yearlyCents = derivedYearlyCents(draft);
  if (draft.basePriceCents > 0 && yearlyCents !== null && yearlyCents <= 0) {
    return 'Yearly price must be above 0 for a paid package.';
  }
  const covered = expandModuleIds(draft.modules.map((m) => m.moduleId), options);
  const byId = new Map(options.map((o) => [o.id, o]));
  for (const id of covered) {
    const option = byId.get(id);
    if (!option) continue;
    const missing = (option.dependsOn || []).filter((dep) => !covered.has(dep) && !covered.has(byId.get(dep)?.parentId || ''));
    if (missing.length) return `${option.name} requires: ${missing.map((dep) => byId.get(dep)?.name || dep).join(', ')}`;
  }
  return null;
};

const ADMIN_PAGE_LIMIT = 200; // the backend's largest page

/**
 * Every row of a 200-per-page admin list (adminModules, adminPlans): pages are
 * read with `offset` until a short page, so nothing past 200 is cut off.
 */
export const useAllAdminPages = <T,>(query: any, field: string) => {
  const client = useApolloClient();
  const [rows, setRows] = useState<T[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const all: T[] = [];
      for (let offset = 0; ; offset += ADMIN_PAGE_LIMIT) {
        const result = await client.query<any, { offset: number }, any>({
          query,
          variables: { offset },
          fetchPolicy: 'network-only',
        });
        const page: T[] = result.data?.[field] || [];
        all.push(...page);
        if (page.length < ADMIN_PAGE_LIMIT) break;
      }
      return all;
    })()
      .then((all) => {
        if (cancelled) return;
        setRows(all);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, query, field, version]);

  return { rows, loading, error, refetch: () => setVersion((v) => v + 1) };
};

export const usePackageModuleOptions = () => {
  const { rows, loading, error } = useAllAdminPages<PackageModuleOption>(ADMIN_PACKAGE_MODULES_QUERY, 'adminModules');
  const options = useMemo(() => [...(rows || [])].sort(bySortOrder), [rows]);
  return { options, loading, error };
};

// ---------------------------------------------------------------------------
// Package editor (modules + yearly pricing)
// ---------------------------------------------------------------------------
const TreeCheckbox: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  testId: string;
}> = ({ checked, indeterminate = false, onChange, testId }) => {
  const ref = React.useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" className="mt-1" checked={checked} onChange={onChange} data-testid={testId} />;
};

type YearlyPriceMode = 'fixed' | 'percent';

/**
 * Yearly offer for a package: a fixed yearly price (e.g. $100 instead of
 * 12 x $12) or a % off twelve monthly payments. A yearly discount needs a
 * monthly price to compare with, so it applies to "Monthly or yearly"
 * packages; a Monthly package can be switched to that from here.
 */
export const YearlyPricingFields: React.FC<{
  value: PackageDraft;
  onChange: (next: PackageDraft) => void;
}> = ({ value, onChange }) => {
  const currency = value.currency || 'USD';
  const step = currencyDecimals(currency) === 0 ? '1' : '0.01';
  const [mode, setMode] = useState<YearlyPriceMode>(value.yearlyPriceOverride.trim() ? 'fixed' : 'percent');
  const fullYear = value.basePriceCents * 12;
  const yearly = derivedYearlyCents(value);
  const savingPct = yearly !== null && fullYear > 0 ? Math.round(((fullYear - yearly) / fullYear) * 100) : 0;

  if (value.billingInterval === 'monthly') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 md:col-span-2">
        <span>Sold monthly only. Want a cheaper yearly price as well?</span>
        <button
          type="button"
          className="font-semibold text-sky-700 hover:underline"
          onClick={() => onChange({ ...value, billingInterval: 'both' })}
          data-testid="add-yearly-price"
        >
          + Add a yearly price
        </button>
      </div>
    );
  }

  if (value.billingInterval === 'yearly') {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 md:col-span-2">
        Sold yearly only: the package price above is the yearly price. To show customers a saving against a
        monthly price, choose “Monthly or yearly”.
      </p>
    );
  }

  const switchMode = (next: YearlyPriceMode) => {
    if (next === mode) return;
    setMode(next);
    if (next === 'fixed') {
      // Start from what the current discount gives, so nothing jumps.
      onChange({ ...value, yearlyPriceOverride: String(amountFromCents(yearly ?? fullYear, currency)), yearlyDiscountPct: 0 });
    } else {
      onChange({ ...value, yearlyPriceOverride: '' });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 md:col-span-2" data-testid="yearly-pricing">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800">Yearly price (discount for paying yearly)</span>
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-semibold" role="radiogroup">
          {(['fixed', 'percent'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={mode === option}
              onClick={() => switchMode(option)}
              className={`rounded-md px-2.5 py-1 ${mode === option ? 'bg-sky-600 text-white' : 'text-slate-600'}`}
              data-testid={`yearly-mode-${option}`}
            >
              {option === 'fixed' ? 'Fixed yearly price' : '% off 12 months'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'fixed' ? (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Yearly price ({currency} / year)</span>
          <input
            type="number"
            min="0"
            step={step}
            value={value.yearlyPriceOverride}
            placeholder={`e.g. ${amountFromCents(Math.round(fullYear * 0.8), currency)}`}
            onChange={(event) => onChange({ ...value, yearlyPriceOverride: event.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            data-testid="yearly-price"
          />
        </label>
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Discount off 12 monthly payments (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={value.yearlyDiscountPct}
            onChange={(event) => onChange({ ...value, yearlyDiscountPct: Number(event.target.value) || 0 })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            data-testid="yearly-discount"
          />
        </label>
      )}
      <p className="text-xs text-slate-600" data-testid="yearly-calculation">
        12 × {formatPrice(value.basePriceCents, currency)} = {formatPrice(fullYear, currency)} → customers pay{' '}
        <span className="font-semibold text-slate-900">{formatPrice(yearly ?? fullYear, currency)} / year</span>
        {savingPct > 0 ? <span className="ml-1 font-semibold text-emerald-700">(save {savingPct}%)</span> : null}
      </p>
      {yearly !== null && yearly > fullYear && fullYear > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" /> The yearly price is more than 12 monthly payments.
        </p>
      ) : null}
    </div>
  );
};

export const PackageBuilder: React.FC<{
  value: PackageDraft;
  onChange: (next: PackageDraft) => void;
}> = ({ value, onChange }) => {
  const { options, loading: modulesLoading, error: modulesError } = usePackageModuleOptions();
  const tree = useMemo(() => buildModuleTree(options), [options]);
  const covered = useMemo(() => expandModuleIds(value.modules.map((m) => m.moduleId), options), [value.modules, options]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const setCovered = (next: Set<string>) =>
    onChange({ ...value, modules: normalizeModuleIds(next, options).map((moduleId) => ({ moduleId, priceOverride: '' })) });

  const toggle = (node: ModuleTreeNode, child?: PackageModuleOption) => {
    const next = new Set(covered);
    if (child) {
      if (next.has(child.id)) {
        next.delete(child.id);
        next.delete(node.module.id);
      } else {
        next.add(child.id);
      }
    } else {
      const on = !next.has(node.module.id) && !(node.children.length && node.children.every((c) => next.has(c.id)));
      [node.module, ...node.children].forEach((m) => (on ? next.add(m.id) : next.delete(m.id)));
    }
    setCovered(next);
  };

  const setAll = (on: boolean) => setCovered(on ? new Set(options.map((o) => o.id)) : new Set());

  const validation = validatePackageDraft(value, options);
  const currency = value.currency || 'USD';
  const yearly = derivedYearlyCents(value);
  const monthlyEquivalent = value.basePriceCents * 12;
  const selectedAreas = summarizeFeatureAreas(value.modules.map((m) => m.moduleId), options);

  return (
    <section className="space-y-4 rounded-xl border border-sky-100 bg-sky-50/40 p-4" data-testid="package-builder">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-600" />
          <h4 className="text-sm font-bold uppercase tracking-wide text-sky-700">Modules in this package</h4>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={value.isPublic}
            onChange={(event) => onChange({ ...value, isPublic: event.target.checked })}
            data-testid="package-public"
          />
          Show in onboarding (public)
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            Included feature areas{' '}
            <span className="text-slate-400" data-testid="selected-areas-count">
              ({selectedAreas.length} of {tree.length})
            </span>
          </span>
          {options.length ? (
            <span className="flex gap-2 text-xs">
              <button type="button" className="font-semibold text-sky-700 hover:underline" onClick={() => setAll(true)}>
                Select all
              </button>
              <button type="button" className="font-semibold text-slate-500 hover:underline" onClick={() => setAll(false)}>
                Clear
              </button>
            </span>
          ) : null}
        </div>
        {modulesLoading && !options.length ? <p className="text-sm text-slate-500">Loading modules…</p> : null}
        {modulesError ? <p className="text-sm text-rose-600">Could not load modules: {modulesError.message}</p> : null}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {tree.map((node) => {
            const { module, children } = node;
            const chosen = children.filter((c) => covered.has(c.id)).length;
            const full = covered.has(module.id) || (children.length > 0 && chosen === children.length);
            const partial = !full && chosen > 0;
            const open = expanded[module.id] ?? partial;
            return (
              <div
                key={module.id}
                className={`rounded-lg border p-3 transition-colors ${full || partial ? 'border-sky-300 bg-white' : 'border-slate-200 bg-white/60'}`}
                data-testid={`module-area-${module.id}`}
              >
                <div className="flex items-start gap-2">
                  <TreeCheckbox
                    checked={full}
                    indeterminate={partial}
                    onChange={() => toggle(node)}
                    testId={`module-checkbox-${module.id}`}
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-slate-800">
                      {module.name}
                      {!module.active ? <span className="ml-1 text-[11px] font-normal text-slate-400">(inactive)</span> : null}
                    </span>
                    {module.description ? <span className="mt-0.5 block text-xs text-slate-500">{module.description}</span> : null}
                    {children.length ? (
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {full ? 'All parts' : `${chosen} of ${children.length} parts`}
                      </span>
                    ) : null}
                  </span>
                  {children.length ? (
                    <button
                      type="button"
                      className="rounded p-1 text-slate-500 hover:bg-slate-100"
                      aria-label={open ? `Hide parts of ${module.name}` : `Show parts of ${module.name}`}
                      onClick={() => setExpanded((prev) => ({ ...prev, [module.id]: !open }))}
                      data-testid={`module-expand-${module.id}`}
                    >
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  ) : null}
                </div>
                {open && children.length ? (
                  <div className="mt-2 space-y-1.5 border-l border-slate-200 pl-6">
                    {children.map((child) => (
                      <label key={child.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                        <TreeCheckbox
                          checked={covered.has(child.id)}
                          onChange={() => toggle(node, child)}
                          testId={`module-checkbox-${child.id}`}
                        />
                        <span>
                          {child.name}
                          {child.dependsOn?.length ? (
                            <span className="block text-[11px] text-amber-700">Requires: {child.dependsOn.join(', ')}</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3" data-testid="price-preview">
        <span className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500">Customers will pay</span>
        <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-900">
          {value.billingInterval !== 'yearly' ? (
            <span data-testid="preview-monthly">{formatPrice(value.basePriceCents, currency)} / month</span>
          ) : (
            <span data-testid="preview-yearly">{formatPrice(value.basePriceCents, currency)} / year</span>
          )}
          {yearly !== null ? (
            <span data-testid="preview-yearly">
              {formatPrice(yearly, currency)} / year
              {monthlyEquivalent > yearly && monthlyEquivalent > 0 ? (
                <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">
                  save {Math.round(((monthlyEquivalent - yearly) / monthlyEquivalent) * 100)}%
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Customers can pay in their own currency; prices are converted from {currency} at the rates on the Currencies page.
        </p>
      </div>

      {validation ? (
        <p className="flex items-center gap-2 text-sm text-amber-700" data-testid="package-validation">
          <AlertTriangle className="h-4 w-4" /> {validation}
        </p>
      ) : null}
    </section>
  );
};

/** Chips: one per feature area of a package ("Area · 2 of 3 parts" when partial). */
export const FeatureAreaChips: React.FC<{ moduleIds: string[]; options: PackageModuleOption[]; testId?: string }> = ({
  moduleIds,
  options,
  testId,
}) => {
  const areas = summarizeFeatureAreas(moduleIds, options);
  if (!areas.length) return <span className="text-xs text-slate-400">No modules</span>;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {areas.map((area) => (
        <span key={area.id} className="rounded-md border border-sky-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-700">
          {area.name}
          {area.partial ? <span className="font-normal text-slate-500"> · {area.partial}</span> : null}
        </span>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Company packages (Companies + Subscriptions pages)
// ---------------------------------------------------------------------------
const PACKAGE_BATCH = 500; // adminCompanyPackages reads at most 500 ids per call

/** Package rows for the given company ids, fetched in batches of 500. */
export const useCompanyPackages = (companyIds: number[]) => {
  const client = useApolloClient();
  const [rows, setRows] = useState<Map<number, CompanyPackageInfo>>(new Map());
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set());
  const [version, setVersion] = useState(0);
  const key = useMemo(() => [...new Set(companyIds.filter((id) => Number.isFinite(id)))].sort((a, b) => a - b).join(','), [companyIds]);

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(',').map(Number) : [];
    if (!ids.length) {
      setRows(new Map());
      setFailedIds(new Set());
      return undefined;
    }
    const batches: number[][] = [];
    for (let i = 0; i < ids.length; i += PACKAGE_BATCH) batches.push(ids.slice(i, i + PACKAGE_BATCH));
    Promise.all(
      batches.map((batch) =>
        client
          .query<{ adminCompanyPackages: CompanyPackageInfo[] }, { companyIds: number[] }, any>({
            query: ADMIN_COMPANY_PACKAGES_QUERY,
            variables: { companyIds: batch },
            fetchPolicy: 'network-only',
          })
          .then((result) => ({ batch, rows: result.data?.adminCompanyPackages || [], failed: false }))
          .catch(() => ({ batch, rows: [] as CompanyPackageInfo[], failed: true })),
      ),
    ).then((results) => {
      if (cancelled) return;
      setRows(new Map(results.flatMap((r) => r.rows).map((row) => [row.companyId, row])));
      // Say so instead of showing "-" when a batch could not be read.
      setFailedIds(new Set(results.filter((r) => r.failed).flatMap((r) => r.batch)));
    });
    return () => {
      cancelled = true;
    };
  }, [client, key, version]);

  return { packages: rows, failedIds, refetch: () => setVersion((v) => v + 1) };
};

export const PackageCell: React.FC<{ info?: CompanyPackageInfo; companyId: number; failed?: boolean }> = ({
  info,
  companyId,
  failed = false,
}) => {
  if (!info && failed) {
    return (
      <span className="text-xs text-rose-600" data-testid={`package-cell-error-${companyId}`}>
        Couldn't load
      </span>
    );
  }
  if (!info) return <span className="text-xs text-slate-400">-</span>;
  return (
    <div className="space-y-0.5" data-testid={`package-cell-${companyId}`}>
      <div className="text-sm font-semibold text-slate-800">{info.planName || info.planId || 'No package'}</div>
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
        {info.billingInterval ? <span>{info.billingInterval}</span> : null}
        {info.planVersion ? <span>· v{info.planVersion}</span> : null}
        {info.unrestricted ? (
          <span className="rounded bg-amber-50 px-1.5 text-amber-700">All modules (legacy)</span>
        ) : null}
        {info.access === 'suspended' ? <span className="rounded bg-rose-50 px-1.5 text-rose-700">Core only (suspended)</span> : null}
        {info.updateAvailable ? (
          <span className="rounded bg-sky-50 px-1.5 text-sky-700" data-testid={`package-update-${companyId}`}>
            update available
          </span>
        ) : null}
      </div>
    </div>
  );
};

const intervalLabel = (interval: string) => (interval === 'yearly' ? 'Yearly' : 'Monthly');

export const ChangePackageDialog: React.FC<{
  companyId: number;
  companyName: string;
  current?: CompanyPackageInfo;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}> = ({ companyId, companyName, current: listedCurrent, onClose, onDone, onError }) => {
  const { options } = usePackageModuleOptions();
  const { rows: allPlans, error: plansError } = useAllAdminPages<PlanPackagingInfo>(ADMIN_PLANS_PACKAGING_QUERY, 'adminPlans');
  // The company's package, read fresh: the list's copy can be missing (its
  // fetch failed) or stale, and the change preview must never guess.
  const {
    data: currentData,
    loading: currentLoading,
    error: currentError,
  } = useQuery<{ adminCompanyPackages: CompanyPackageInfo[] }, { companyIds: number[] }, any>(ADMIN_COMPANY_PACKAGES_QUERY, {
    variables: { companyIds: [companyId] },
    fetchPolicy: 'network-only',
  });
  const liveCurrent = currentData?.adminCompanyPackages?.find((row) => row.companyId === companyId);
  const current = liveCurrent ?? (currentError ? undefined : listedCurrent);
  const currentReady = !!liveCurrent && !currentLoading && !currentError;
  const plansLoaded = !!allPlans;
  const plans = useMemo(() => (allPlans || []).filter((p) => p.active !== false || p.id === current?.planId), [allPlans, current]);
  const [planId, setPlanId] = useState(listedCurrent?.planId || '');
  const plan = plans.find((p) => p.id === planId);
  const intervals = plan?.pricing?.availableIntervals?.length ? plan.pricing.availableIntervals : ['monthly'];
  const [billingInterval, setBillingInterval] = useState(listedCurrent?.billingInterval || '');
  const touched = React.useRef(false);
  const [reason, setReason] = useState('');
  const [assign, { loading }] = useMutation<
    { adminAssignCompanyPlan: { success: boolean; message?: string | null } },
    { companyId: number; planId: string; billingInterval: string; reason: string },
    any,
    any
  >(ADMIN_ASSIGN_COMPANY_PLAN_MUTATION);

  // Start from the company's real package and interval once they are known.
  useEffect(() => {
    if (!liveCurrent || touched.current) return;
    setPlanId(liveCurrent.planId || '');
    setBillingInterval(liveCurrent.billingInterval || '');
  }, [liveCurrent]);
  useEffect(() => {
    if (!planId && plans.length && currentReady) setPlanId(plans[0].id);
  }, [planId, plans, currentReady]);
  useEffect(() => {
    // Only once the package's intervals are known: before the plans load the
    // fallback ['monthly'] would silently move a yearly company to monthly.
    if (!plansLoaded || !plan) return;
    if (!intervals.includes(billingInterval)) setBillingInterval(intervals[0]);
  }, [plansLoaded, plan, intervals, billingInterval]);

  const allIds = useMemo(() => new Set(options.map((o) => o.id)), [options]);
  const before = current?.unrestricted ? allIds : expandModuleIds(current?.activeModules || [], options);
  const planModules = plan?.modules.map((m) => m.moduleId) || [];
  // Same rule as the server: a paid package without modules (an old plan)
  // leaves a pre-package company as it is; Free never keeps every module.
  // Without a server price (pricing null) a plan is not assumed free.
  const planIsFree =
    !!plan &&
    (plan.id === 'free' || (!!plan.pricing && !(plan.pricing.monthlyPriceCents || 0) && !(plan.pricing.yearlyPriceCents || 0)));
  const keepsLegacy = !!current?.unrestricted && !planModules.length && !planIsFree;
  const after = keepsLegacy ? allIds : expandModuleIds(planModules, options);
  const diff = moduleDiff(before, after, options);

  const submit = async () => {
    if (!plan || !currentReady) return;
    if (!reason.trim()) {
      onError('A reason is required to change a package');
      return;
    }
    try {
      const result = await assign({
        variables: { companyId, planId: plan.id, billingInterval, reason: reason.trim() },
      });
      const payload = result.data?.adminAssignCompanyPlan;
      if (!payload?.success) {
        onError(payload?.message || 'Package could not be changed');
        return;
      }
      onDone(`${companyName} moved to ${plan.name || plan.id}`);
    } catch (err: any) {
      onError(err?.message || 'Package could not be changed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" data-testid="change-package-dialog">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-lg font-bold text-slate-800">Change package · {companyName}</h3>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {plansError ? (
            <p className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" data-testid="change-package-plans-error">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              Packages could not be loaded. Close and try again.
            </p>
          ) : null}
          {currentError ? (
            <p className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" data-testid="change-package-current-error">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              This company's current package could not be loaded, so the change can't be previewed. Close and try again.
            </p>
          ) : null}
          <p className="text-sm text-slate-600">
            Current:{' '}
            <span className="font-semibold">
              {currentReady ? current?.planName || current?.planId || 'No package' : currentError ? 'Unknown' : 'Loading…'}
            </span>
            {current?.unrestricted ? ' (every module — legacy access)' : ''}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Package</span>
              <select
                value={planId}
                onChange={(event) => {
                  touched.current = true;
                  setPlanId(event.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                data-testid="change-package-plan"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.id}
                    {p.isPublic ? '' : ' (private)'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Billing interval</span>
              <select
                value={billingInterval}
                onChange={(event) => {
                  touched.current = true;
                  setBillingInterval(event.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                data-testid="change-package-interval"
              >
                {intervals.map((i) => (
                  <option key={i} value={i}>
                    {intervalLabel(i)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {current?.unrestricted && plan && !keepsLegacy ? (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800" data-testid="change-package-legacy-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              This company has every module (it registered before packages). After this change it will only have the
              modules of the new package.
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="change-package-diff">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
              <p className="mb-1 text-xs font-black uppercase text-emerald-700">Gains</p>
              {diff.gains.length ? (
                <ul className="space-y-0.5 text-sm text-slate-700">{diff.gains.map((g) => <li key={g}>+ {g}</li>)}</ul>
              ) : (
                <p className="text-sm text-slate-400">Nothing new</p>
              )}
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-3">
              <p className="mb-1 text-xs font-black uppercase text-rose-700">Loses</p>
              {diff.losses.length ? (
                <ul className="space-y-0.5 text-sm text-slate-700" data-testid="change-package-losses">
                  {diff.losses.map((l) => <li key={l}>− {l}</li>)}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">Nothing</p>
              )}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Reason</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Why is the package changing?"
              data-testid="change-package-reason"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading || !plan || !currentReady}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            data-testid="change-package-submit"
          >
            {loading ? 'Saving…' : 'Change package'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Apply an edited package to its existing subscribers
// ---------------------------------------------------------------------------
interface SubscriberChange {
  companyId: number;
  companyName: string;
  currentVersion: number;
  wasUnrestricted: boolean;
  gains: string[];
  losses: string[];
}

type ApplyResult = {
  adminApplyPlanToSubscribers: {
    success: boolean;
    message?: string | null;
    appliedCount?: number | null;
    companies?: SubscriberChange[] | null;
  };
};

export const ApplyToSubscribersDialog: React.FC<{
  planId: string;
  planName: string;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}> = ({ planId, planName, onClose, onDone, onError }) => {
  const { options } = usePackageModuleOptions();
  const [run, { loading }] = useMutation<
    ApplyResult,
    { planId: string; dryRun: boolean; onlyOutdated: boolean; includeUnrestricted: boolean; reason?: string },
    any,
    any
  >(ADMIN_APPLY_PLAN_TO_SUBSCRIBERS_MUTATION);
  const [preview, setPreview] = useState<SubscriberChange[] | null>(null);
  const [reason, setReason] = useState('');
  // Pre-package companies (full access today) are left alone unless the admin opts in.
  const [includeUnrestricted, setIncludeUnrestricted] = useState(false);
  const nameOf = useMemo(() => new Map(options.map((o) => [o.id, o.name])), [options]);
  const describe = (ids: string[]) => summarizeFeatureAreas(ids, options).map((a) => (a.partial ? `${a.name} (${a.partial})` : a.name)).join(', ') || ids.map((id) => nameOf.get(id) || id).join(', ');

  useEffect(() => {
    // Toggling the checkbox quickly can leave an older preview arriving last;
    // only the answer for the current setting may be shown (and applied).
    let current = true;
    setPreview(null);
    run({ variables: { planId, dryRun: true, onlyOutdated: true, includeUnrestricted } })
      .then((result) => {
        if (!current) return;
        const payload = result.data?.adminApplyPlanToSubscribers;
        if (!payload?.success) {
          onError(payload?.message || 'Could not preview the change');
          onClose();
          return;
        }
        setPreview(payload.companies || []);
      })
      .catch((err) => {
        if (!current) return;
        onError(err?.message || 'Could not preview the change');
        onClose();
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, includeUnrestricted]);

  const apply = async () => {
    if (!reason.trim()) {
      onError('A reason is required');
      return;
    }
    try {
      const result = await run({
        variables: { planId, dryRun: false, onlyOutdated: true, includeUnrestricted, reason: reason.trim() },
      });
      const payload = result.data?.adminApplyPlanToSubscribers;
      if (!payload?.success) {
        onError(payload?.message || 'Could not apply the package');
        return;
      }
      onDone(`${payload.appliedCount ?? 0} company(s) now have the current ${planName} modules`);
    } catch (err: any) {
      onError(err?.message || 'Could not apply the package');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" data-testid="apply-subscribers-dialog">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-lg font-bold text-slate-800">Apply {planName} to existing subscribers</h3>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <p className="text-sm text-slate-600">
            These companies are on an older version of the package. Applying gives them the package's current modules;
            their price, billing interval and dates stay as they are.
          </p>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeUnrestricted}
              onChange={(event) => setIncludeUnrestricted(event.target.checked)}
              className="mt-0.5"
              data-testid="apply-subscribers-include-legacy"
            />
            <span>
              Also move companies that joined before packages (they have every module today and would lose what this
              package does not include)
            </span>
          </label>
          {preview === null ? <p className="text-sm text-slate-500">Loading preview…</p> : null}
          {preview && preview.length === 0 ? <p className="text-sm text-slate-500">Every subscriber already has the current version.</p> : null}
          {preview && preview.length > 0 ? (
            <table className="w-full text-sm" data-testid="apply-subscribers-preview">
              <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Company</th>
                  <th className="py-2 pr-3">Gains</th>
                  <th className="py-2">Loses</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.companyId} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 font-semibold text-slate-800">
                      {row.companyName}
                      <span className="block text-[11px] font-normal text-slate-500">
                        {row.wasUnrestricted ? 'Had every module (legacy)' : `on v${row.currentVersion}`}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-emerald-700">{row.gains.length ? describe(row.gains) : '-'}</td>
                    <td className="py-2 text-rose-700">{row.losses.length ? describe(row.losses) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {preview && preview.length > 0 ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Reason</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                data-testid="apply-subscribers-reason"
              />
            </label>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            {preview && preview.length ? 'Not now' : 'Close'}
          </button>
          {preview && preview.length > 0 ? (
            <button
              type="button"
              onClick={apply}
              disabled={loading}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              data-testid="apply-subscribers-submit"
            >
              {loading ? 'Applying…' : `Apply to ${preview.length} company(s)`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/** Monthly/yearly price lines of a package card (no "/ yr" label on a missing price). */
export const packagePriceLines = (pricing: PlanPackagingInfo['pricing'], fallbackCents: number, currency: string, interval: string) => {
  if (!pricing) {
    return [`${formatPrice(fallbackCents, currency)} / ${interval === 'yearly' ? 'yr' : 'mo'}`];
  }
  const lines: string[] = [];
  if (pricing.monthlyPriceCents !== null && pricing.monthlyPriceCents !== undefined) {
    lines.push(`${formatPrice(pricing.monthlyPriceCents, pricing.currency)} / mo`);
  }
  if (pricing.yearlyPriceCents !== null && pricing.yearlyPriceCents !== undefined) {
    lines.push(`${formatPrice(pricing.yearlyPriceCents, pricing.currency)} / yr${pricing.savingsPct ? ` (save ${pricing.savingsPct}%)` : ''}`);
  }
  return lines.length ? lines : ['Pricing unavailable'];
};
