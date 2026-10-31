import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { AlertTriangle, ChevronDown, ChevronRight, Layers, X } from 'lucide-react';
import {
  ADMIN_APPLY_PLAN_TO_SUBSCRIBERS_MUTATION,
  ADMIN_ASSIGN_COMPANY_PLAN_MUTATION,
  ADMIN_COMPANY_PACKAGES_QUERY,
  ADMIN_PACKAGE_MODULES_QUERY,
  ADMIN_PLANS_PACKAGING_QUERY,
} from '../../../lib/graphql';
import {
  amountFromCents,
  centsFromAmount,
  currencyInputStep,
  formatPrice,
  formatPriceOrUnavailable,
  moneyInputError,
  wholeNumberError,
} from '../../../lib/admin-utils';

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

export type YearlyPriceMode = 'fixed' | 'percent';

export interface PackageDraft {
  pricingMode: PricingMode;
  basePriceCents: number;
  currency: string;
  billingInterval: PackageBillingInterval;
  bundleDiscountPct: number;
  yearlyPriceOverride: string;
  yearlyDiscountPct: number;
  /**
   * How the yearly price of a "monthly or yearly" package is set. Kept in the
   * draft (not in the yearly fields' own state) so it always matches what is
   * saved. Unset: a typed yearly price means 'fixed'.
   */
  yearlyMode?: YearlyPriceMode;
  isPublic: boolean;
  modules: PackageModuleSelection[];
  /** Editing a package that has no modules today (an old plan, Free): it may be saved without. */
  allowEmptyModules?: boolean;
}

export const yearlyModeOf = (draft: Pick<PackageDraft, 'yearlyMode' | 'yearlyPriceOverride'>): YearlyPriceMode =>
  draft.yearlyMode ?? (draft.yearlyPriceOverride.trim() ? 'fixed' : 'percent');

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
  perEmployee?: boolean | null;
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
export const draftToPlanInputFields = (draft: PackageDraft) => {
  const both = draft.billingInterval === 'both';
  const mode = yearlyModeOf(draft);
  return {
    pricingMode: 'fixed' as PricingMode,
    bundleDiscountPct: 0,
    billingInterval: draft.billingInterval,
    // The typed text is converted here, once (no float error: "1.005" -> 101).
    yearlyPriceCents:
      both && mode === 'fixed' && draft.yearlyPriceOverride.trim()
        ? centsFromAmount(draft.yearlyPriceOverride, draft.currency)
        : null,
    yearlyDiscountPct: both && mode === 'percent' ? Number(draft.yearlyDiscountPct) || 0 : 0,
    isPublic: draft.isPublic,
    modules: draft.modules.map((m) => ({ moduleId: m.moduleId, priceOverrideCents: null })),
  };
};

/** The yearly amount the customer will see for a "monthly or yearly" package. */
export const derivedYearlyCents = (draft: PackageDraft): number | null => {
  if (draft.billingInterval !== 'both') return null;
  const mode = yearlyModeOf(draft);
  if (mode === 'fixed' && draft.yearlyPriceOverride.trim()) {
    const cents = centsFromAmount(draft.yearlyPriceOverride, draft.currency);
    return Number.isFinite(cents) ? cents : 0;
  }
  // No yearly price saved: the server charges 12 monthly payments less the discount.
  const pct = mode === 'percent' ? Math.min(Math.max(Number(draft.yearlyDiscountPct) || 0, 0), 100) : 0;
  return Math.round((draft.basePriceCents * 12 * (100 - pct)) / 100);
};

/** The ids adminSavePlan checks: a part whose feature area is also chosen is covered by the area. */
const sentModuleIds = (draft: PackageDraft, byId: Map<string, PackageModuleOption>) => {
  const selected = new Set(draft.modules.map((m) => m.moduleId));
  return [...selected].filter((id) => !selected.has(byId.get(id)?.parentId || ''));
};

export const validatePackageDraft = (draft: PackageDraft, options: PackageModuleOption[]): string | null => {
  if (draft.modules.length === 0 && !draft.allowEmptyModules) return 'Select the modules this package unlocks.';
  if (draft.basePriceCents < 0) return 'Package price cannot be negative.';
  if (draft.billingInterval === 'both') {
    if (yearlyModeOf(draft) === 'percent') {
      // An Int on the server: 12.5 would fail the whole save with a GraphQL error.
      const problem = wholeNumberError(draft.yearlyDiscountPct, 'Yearly discount (%)', 0, 100);
      if (problem) return problem;
    } else {
      if (!draft.yearlyPriceOverride.trim()) return 'Enter the yearly price, or choose “% off 12 months”.';
      const problem = moneyInputError(draft.yearlyPriceOverride, draft.currency || 'USD', 'Yearly price');
      if (problem) return problem;
    }
  }
  // A paid package must not become free on the yearly option (a 0 price or a
  // 100% discount).
  const yearlyCents = derivedYearlyCents(draft);
  if (draft.basePriceCents > 0 && yearlyCents !== null && yearlyCents <= 0) {
    return 'Yearly price must be above 0 for a paid package.';
  }
  // Same rule as the server (adminSavePlan): every module sent must have what it
  // depends on in the package; parts covered by a chosen feature area are not
  // checked one by one.
  const byId = new Map(options.map((o) => [o.id, o]));
  const sent = sentModuleIds(draft, byId);
  const covered = expandModuleIds(sent, options);
  for (const id of sent) {
    const option = byId.get(id);
    if (!option) continue;
    const missing = (option.dependsOn || []).filter((dep) => !covered.has(dep) && !covered.has(byId.get(dep)?.parentId || ''));
    if (missing.length) return `${option.name} requires: ${missing.map((dep) => byId.get(dep)?.name || dep).join(', ')}`;
  }
  return null;
};

const ADMIN_PAGE_LIMIT = 200; // the backend's largest page
/** Safety stop: 50 pages (10,000 rows). A server that ignores `offset` would otherwise loop forever. */
const ADMIN_MAX_PAGES = 50;
/**
 * A full list loaded this recently is reused (e.g. a dialog opened again right
 * away) instead of downloaded again. Short, so a change another admin made
 * shows up the next time a dialog opens.
 */
const ADMIN_LIST_REUSE_MS = 30 * 1000;

interface AdminListEntry {
  rows?: unknown[];
  loadedAt: number;
  inFlight?: Promise<unknown[]>;
  listeners: Set<(rows: unknown[]) => void>;
}

// One entry per (Apollo client, query, field), shared by every hook using that
// client while the app is open (a new client -- e.g. after signing in again --
// starts empty).
const adminListCache = new WeakMap<object, Map<any, Map<string, AdminListEntry>>>();

const adminListEntry = (client: object, query: any, field: string): AdminListEntry => {
  let byQuery = adminListCache.get(client);
  if (!byQuery) {
    byQuery = new Map();
    adminListCache.set(client, byQuery);
    // Signing out clears the Apollo store: drop these lists with it, so the
    // next admin never sees the previous session's packages.
    (client as { onClearStore?: (cb: () => Promise<unknown>) => unknown }).onClearStore?.(async () => {
      adminListCache.delete(client);
    });
  }
  let byField = byQuery.get(query);
  if (!byField) {
    byField = new Map();
    byQuery.set(query, byField);
  }
  let entry = byField.get(field);
  if (!entry) {
    entry = { loadedAt: 0, listeners: new Set() };
    byField.set(field, entry);
  }
  return entry;
};

const loadAllAdminPages = async (client: any, query: any, field: string): Promise<unknown[]> => {
  const all: unknown[] = [];
  for (let pageIndex = 0; ; pageIndex += 1) {
    if (pageIndex >= ADMIN_MAX_PAGES) {
      throw new Error(`The list is longer than ${ADMIN_MAX_PAGES * ADMIN_PAGE_LIMIT} rows and could not be loaded in full.`);
    }
    const result = await client.query({
      query,
      variables: { offset: pageIndex * ADMIN_PAGE_LIMIT },
      fetchPolicy: 'network-only',
      // The app's default errorPolicy is 'all', which resolves a failed page
      // with no data: that read as "no more rows" and showed an empty or cut
      // list. A failed page is an error.
      errorPolicy: 'none',
    });
    if (result.error) throw result.error;
    const page = result.data?.[field];
    if (!Array.isArray(page)) throw new Error(`The server returned no ${field} list.`);
    all.push(...page);
    if (page.length < ADMIN_PAGE_LIMIT) return all;
  }
};

/**
 * Every row of a 200-per-page admin list (adminModules, adminPlans): pages are
 * read with `offset` until a short page (at most ADMIN_MAX_PAGES), so nothing
 * past 200 is cut off. A list loaded in the last few minutes is reused by every
 * component that asks for it; `refetch()` downloads it again for all of them.
 */
export const useAllAdminPages = <T,>(query: any, field: string) => {
  const client = useApolloClient();
  const entry = adminListEntry(client, query, field);
  const fresh = entry.rows !== undefined && Date.now() - entry.loadedAt < ADMIN_LIST_REUSE_MS;
  const [rows, setRows] = useState<T[] | undefined>(fresh ? (entry.rows as T[]) : undefined);
  const [loading, setLoading] = useState(!fresh);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  // Another component reloaded the same list: show the new rows here too.
  useEffect(() => {
    const listener = (next: unknown[]) => setRows(next as T[]);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
    };
  }, [entry]);

  useEffect(() => {
    let cancelled = false;
    const reusable = version === 0 && entry.rows !== undefined && Date.now() - entry.loadedAt < ADMIN_LIST_REUSE_MS;
    if (reusable) {
      setRows(entry.rows as T[]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    // One download at a time per list; a refetch waits for it and starts a new one.
    const previous = entry.inFlight;
    const request = (async () => {
      if (previous && version === 0) return previous;
      if (previous) await previous.catch(() => undefined);
      const all = await loadAllAdminPages(client, query, field);
      entry.rows = all;
      entry.loadedAt = Date.now();
      entry.listeners.forEach((listener) => listener(all));
      return all;
    })();
    entry.inFlight = request;
    request
      .then((all) => {
        if (cancelled) return;
        setRows(all as T[]);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (entry.inFlight === request) entry.inFlight = undefined;
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, query, field, version, entry]);

  return { rows, loading, error, refetch: () => setVersion((v) => v + 1) };
};

export const usePackageModuleOptions = () => {
  const { rows, loading, error } = useAllAdminPages<PackageModuleOption>(ADMIN_PACKAGE_MODULES_QUERY, 'adminModules');
  const options = useMemo(() => [...(rows || [])].sort(bySortOrder), [rows]);
  // `ready`: the full module list is known (gains/losses and dependency checks need it).
  return { options, loading, error, ready: rows !== undefined && !error };
};

// ---------------------------------------------------------------------------
// Package editor (modules + yearly pricing)
// ---------------------------------------------------------------------------
const TreeCheckbox: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
  testId: string;
}> = ({ checked, indeterminate = false, disabled = false, onChange, testId }) => {
  const ref = React.useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="mt-1 disabled:cursor-not-allowed"
      checked={checked}
      disabled={disabled}
      title={disabled ? 'Switched off: it cannot be added to a package' : undefined}
      onChange={onChange}
      data-testid={testId}
    />
  );
};

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
  // 1 for JPY and for ISK/UGX (whole units), else 0.01.
  const step = String(currencyInputStep(currency));
  // Read from the draft on every render: a local copy went stale when the
  // draft changed underneath it (another plan, or packaging loaded later).
  const mode = yearlyModeOf(value);
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
    if (next === 'fixed') {
      // Start from what the current discount gives, so nothing jumps.
      onChange({
        ...value,
        yearlyMode: 'fixed',
        yearlyPriceOverride: String(amountFromCents(yearly ?? fullYear, currency)),
        yearlyDiscountPct: 0,
      });
    } else {
      onChange({ ...value, yearlyMode: 'percent', yearlyPriceOverride: '' });
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

  // "Select all" adds the active modules: the server refuses a switched-off
  // module newly added to a package (ones already in it stay).
  const setAll = (on: boolean) =>
    setCovered(on ? new Set(options.filter((o) => o.active || covered.has(o.id)).map((o) => o.id)) : new Set());
  const nameOf = useMemo(() => new Map(options.map((o) => [o.id, o.name])), [options]);
  const requiresLabel = (module: PackageModuleOption) =>
    module.dependsOn?.length ? (
      <span className="block text-[11px] text-amber-700">
        Requires: {module.dependsOn.map((dep) => nameOf.get(dep) || dep).join(', ')}
      </span>
    ) : null;
  // A switched-off module can stay in a package but can't be newly added.
  const blocked = (module: PackageModuleOption) => !module.active && !covered.has(module.id);

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
                    disabled={blocked(module) && !partial}
                    onChange={() => toggle(node)}
                    testId={`module-checkbox-${module.id}`}
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-slate-800">
                      {module.name}
                      {!module.active ? <span className="ml-1 text-[11px] font-normal text-slate-400">(inactive)</span> : null}
                    </span>
                    {module.description ? <span className="mt-0.5 block text-xs text-slate-500">{module.description}</span> : null}
                    {requiresLabel(module)}
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
                          disabled={blocked(child)}
                          onChange={() => toggle(node, child)}
                          testId={`module-checkbox-${child.id}`}
                        />
                        <span>
                          {child.name}
                          {!child.active ? <span className="ml-1 text-[11px] text-slate-400">(inactive)</span> : null}
                          {requiresLabel(child)}
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

      {!value.modules.length && value.allowEmptyModules ? (
        <p className="text-xs text-slate-500" data-testid="package-no-modules">
          This package has no modules and can be saved as it is: companies registered before packages keep every
          module; new sign-ups get core features only.
        </p>
      ) : null}
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

/**
 * Package rows for the given company ids, fetched in batches of 500. Rows
 * already loaded are kept when the list changes (a search, a filter): only
 * companies not seen yet are asked for. refetch() reloads them all.
 */
export const useCompanyPackages = (companyIds: number[]) => {
  const client = useApolloClient();
  const [rows, setRows] = useState<Map<number, CompanyPackageInfo>>(new Map());
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set());
  const [version, setVersion] = useState(0);
  // One cache per version: rows read so far, the reads still running (so a
  // list that changes while a read is out waits for it instead of dropping
  // those companies), and the ids whose last read failed.
  type PackageCache = {
    version: number;
    rows: Map<number, CompanyPackageInfo>;
    read: Set<number>;
    pending: Map<number, Promise<void>>;
    failed: Set<number>;
  };
  const loaded = useRef<PackageCache>({ version: 0, rows: new Map(), read: new Set(), pending: new Map(), failed: new Set() });
  const key = useMemo(() => [...new Set(companyIds.filter((id) => Number.isFinite(id)))].sort((a, b) => a - b).join(','), [companyIds]);

  useEffect(() => {
    let cancelled = false;
    if (loaded.current.version !== version) {
      loaded.current = { version, rows: new Map(), read: new Set(), pending: new Map(), failed: new Set() };
    }
    const cache = loaded.current;
    const ids = key ? key.split(',').map(Number) : [];
    const show = () => {
      if (cancelled) return;
      setRows(new Map(ids.filter((id) => cache.rows.has(id)).map((id) => [id, cache.rows.get(id)!])));
      setFailedIds(new Set(ids.filter((id) => cache.failed.has(id))));
    };
    // Not read yet, or the last read failed (asked again).
    const missing = ids.filter((id) => !cache.pending.has(id) && (!cache.read.has(id) || cache.failed.has(id)));
    for (let i = 0; i < missing.length; i += PACKAGE_BATCH) {
      const batch = missing.slice(i, i + PACKAGE_BATCH);
      const read = client
        .query<{ adminCompanyPackages: CompanyPackageInfo[] }, { companyIds: number[] }, any>({
          query: ADMIN_COMPANY_PACKAGES_QUERY,
          variables: { companyIds: batch },
          fetchPolicy: 'network-only',
          // With the app default ('all') a failed read resolved with no rows and
          // every company showed "-" instead of "Couldn't load".
          errorPolicy: 'none',
        })
        .then((result) => {
          if (result.error) throw result.error;
          const packageRows = result.data?.adminCompanyPackages;
          if (!Array.isArray(packageRows)) throw new Error('The server returned no package list.');
          packageRows.forEach((row) => cache.rows.set(row.companyId, row));
          // A company with no package row is still read (shown as "-").
          batch.forEach((id) => {
            cache.failed.delete(id);
            cache.read.add(id);
          });
        })
        .catch(() => {
          // Say so instead of showing "-"; asked again next time.
          batch.forEach((id) => cache.failed.add(id));
        })
        .finally(() => batch.forEach((id) => cache.pending.delete(id)));
      batch.forEach((id) => cache.pending.set(id, read));
    }
    const waiting = [...new Set(ids.map((id) => cache.pending.get(id)).filter(Boolean))] as Promise<void>[];
    if (!waiting.length) {
      show();
    } else {
      Promise.all(waiting).then(show);
    }
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
  const { options, ready: modulesReady, error: modulesError } = usePackageModuleOptions();
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
  // One request at a time: Apollo's `loading` only disables the button after a re-render.
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  // Start from the company's real package and interval once they are known.
  // A company without a package gets no pre-selected package: the admin picks one.
  useEffect(() => {
    if (!liveCurrent || touched.current) return;
    setPlanId(liveCurrent.planId || '');
    setBillingInterval(liveCurrent.billingInterval || '');
  }, [liveCurrent]);
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
  // Gains/losses are only right once every module is known (a part shows under
  // its feature area, and "every module" means the full list).
  const previewReady = modulesReady && currentReady && !!plan;
  const canSubmit = previewReady && plansLoaded && !loading && !submitting;

  const priceOf = (target: PlanPackagingInfo | undefined, interval: string | null | undefined) => {
    if (!target) return null;
    if (!target.pricing) return 'Pricing unavailable';
    const yearly = interval === 'yearly';
    const cents = yearly ? target.pricing.yearlyPriceCents : target.pricing.monthlyPriceCents;
    if (cents === null || cents === undefined) return 'Pricing unavailable';
    return `${formatPriceOrUnavailable(cents, target.pricing.currency)} / ${yearly ? 'year' : 'month'}${target.perEmployee ? ' per employee' : ''}`;
  };
  const currentPlan = (allPlans || []).find((p) => p.id === current?.planId);
  const newPrice = priceOf(plan, billingInterval);
  const currentPrice = priceOf(currentPlan, current?.billingInterval);

  const submit = async () => {
    if (!canSubmit || !plan || inFlight.current) return;
    if (!reason.trim()) {
      onError('A reason is required to change a package');
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
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
    } finally {
      inFlight.current = false;
      setSubmitting(false);
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
          {modulesError ? (
            <p className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" data-testid="change-package-modules-error">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              Modules could not be loaded, so the change can't be previewed. Close and try again.
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
            {currentReady && currentPrice ? (
              <span className="text-slate-500" data-testid="change-package-current-price">
                {' '}· {currentPrice}
              </span>
            ) : null}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Package</span>
              <select
                value={plan ? planId : ''}
                onChange={(event) => {
                  touched.current = true;
                  setPlanId(event.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                data-testid="change-package-plan"
              >
                {!plan ? (
                  <option value="" disabled>
                    {plansLoaded ? 'Choose a package…' : 'Loading packages…'}
                  </option>
                ) : null}
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
          {plan ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              New price:{' '}
              <span className="font-semibold text-slate-900" data-testid="change-package-price">
                {newPrice}
              </span>
            </p>
          ) : null}
          {current?.unrestricted && plan && !keepsLegacy ? (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800" data-testid="change-package-legacy-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              This company has every module (it registered before packages). After this change it will only have the
              modules of the new package.
            </p>
          ) : null}
          {previewReady ? (
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
          ) : (
            <p className="text-sm text-slate-500" data-testid="change-package-diff-pending">
              {!plan && plansLoaded
                ? 'Choose a package to see what the company gains and loses.'
                : modulesError || currentError
                  ? 'The change cannot be previewed.'
                  : 'Loading the change preview…'}
            </p>
          )}
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
            disabled={!canSubmit}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            data-testid="change-package-submit"
          >
            {loading || submitting ? 'Saving…' : 'Change package'}
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
    /** The package version the answer is for (the apply sends it back as expectedVersion). */
    planVersion?: number | null;
  };
};

/** What a preview promised, order-independent: a fresh dry run must match it before applying. */
const previewSignature = (companies: SubscriberChange[] | null | undefined) =>
  JSON.stringify(
    [...(companies || [])]
      .map((c) => [c.companyId, c.currentVersion, c.wasUnrestricted, [...c.gains].sort(), [...c.losses].sort()])
      .sort((a, b) => Number(a[0]) - Number(b[0])),
  );

export const ApplyToSubscribersDialog: React.FC<{
  planId: string;
  planName: string;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
  /** Some companies may have been moved before a failure: the caller reloads its counts. */
  onRefresh?: () => void;
}> = ({ planId, planName, onClose, onDone, onError, onRefresh }) => {
  const { options } = usePackageModuleOptions();
  const [run, { loading }] = useMutation<
    ApplyResult,
    {
      planId: string;
      dryRun: boolean;
      onlyOutdated: boolean;
      includeUnrestricted: boolean;
      reason?: string;
      expectedVersion?: number | null;
    },
    any,
    any
  >(ADMIN_APPLY_PLAN_TO_SUBSCRIBERS_MUTATION);
  const [preview, setPreview] = useState<SubscriberChange[] | null>(null);
  const [reason, setReason] = useState('');
  // Pre-package companies (full access today) are left alone unless the admin opts in.
  const [includeUnrestricted, setIncludeUnrestricted] = useState(false);
  // Bumped to load the preview again (after a failed or partial apply).
  const [previewRun, setPreviewRun] = useState(0);
  // One apply at a time: Apollo's `loading` only disables the button after a re-render.
  const inFlight = useRef(false);
  const [applying, setApplying] = useState(false);
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
  }, [planId, includeUnrestricted, previewRun]);

  // A failure can come after some companies were already moved: reload the
  // caller's counts and this preview (it then lists the companies still left).
  const refreshAfterFailure = () => {
    onRefresh?.();
    setPreviewRun((value) => value + 1);
  };

  const apply = async () => {
    if (inFlight.current || preview === null) return;
    if (!reason.trim()) {
      onError('A reason is required');
      return;
    }
    inFlight.current = true;
    setApplying(true);
    try {
      // The package may have been edited (a new version) or companies moved
      // since this preview: check again first, so nothing is applied that the
      // admin did not see. The server refuses too if the version moved after this check.
      const check = await run({ variables: { planId, dryRun: true, onlyOutdated: true, includeUnrestricted } });
      const fresh = check.data?.adminApplyPlanToSubscribers;
      if (!fresh?.success) {
        onError(fresh?.message || 'Could not check the change again');
        return;
      }
      if (previewSignature(fresh.companies) !== previewSignature(preview)) {
        setPreview(fresh.companies || []);
        onError('The package or its subscribers changed since this preview. Check the updated list and apply again.');
        return;
      }
      const result = await run({
        variables: {
          planId,
          dryRun: false,
          onlyOutdated: true,
          includeUnrestricted,
          reason: reason.trim(),
          expectedVersion: fresh.planVersion ?? null,
        },
      });
      const payload = result.data?.adminApplyPlanToSubscribers;
      if (!payload?.success) {
        onError(payload?.message || 'Could not apply the package');
        refreshAfterFailure();
        return;
      }
      onDone(`${payload.appliedCount ?? 0} company(s) now have the current ${planName} modules`);
    } catch (err: any) {
      onError(err?.message || 'Could not apply the package');
      refreshAfterFailure();
    } finally {
      inFlight.current = false;
      setApplying(false);
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
              disabled={loading || applying}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              data-testid="apply-subscribers-submit"
            >
              {applying ? 'Applying…' : `Apply to ${preview.length} company(s)`}
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
