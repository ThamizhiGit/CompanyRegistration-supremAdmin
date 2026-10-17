import React, { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { AlertTriangle, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { ADMIN_PACKAGE_MODULES_QUERY } from '../../../lib/graphql';
import { centsFromDollars, formatPrice } from '../../../lib/admin-utils';

/**
 * Packages are priced by the admin in USD and sold monthly, yearly, or both (the
 * CUSTOMER picks the interval at checkout); onboarding converts the price into the
 * customer's own currency.
 *
 * Backend convention (registration/pricing.py): `basePriceCents` is the price for the
 * package's own interval -- a yearly-only package stores its YEARLY price there;
 * monthly and "both" packages store the monthly price. A "both" package's yearly price
 * is the explicit `yearlyPriceCents`, or is derived from `yearlyDiscountPct`.
 *
 * Modules are a two-level tree: ticking a feature area includes every part of it.
 */
export type PricingMode = 'fixed' | 'sum_modules' | 'sum_modules_disc' | 'base_plus_modules';
export type PackageBillingInterval = 'monthly' | 'yearly' | 'both';

export interface PackageModuleSelection {
  moduleId: string;
  /** Kept for API compatibility; always blank (modules carry no price). */
  priceOverride: string;
}

export interface PackageDraft {
  pricingMode: PricingMode;
  /** Price in cents (USD) for the package's own interval: yearly for a yearly-only package, else monthly. */
  basePriceCents: number;
  currency: string;
  billingInterval: PackageBillingInterval;
  bundleDiscountPct: number;
  /** Explicit yearly price in dollars for a "both" package; blank = derived from yearlyDiscountPct. */
  yearlyPriceOverride: string;
  /** Legacy: derives the yearly price of a "both" package when no explicit one is set. */
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

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  fixed: 'Package price',
  sum_modules: 'Package price',
  sum_modules_disc: 'Package price',
  base_plus_modules: 'Package price',
};

const roundHalfUp = (value: number) => Math.floor(value + 0.5);

/**
 * (monthly, yearly) cents a package is sold at -- mirrors registration/pricing.py
 * plan_interval_prices; either is null when the package is not sold on that interval.
 */
export const planIntervalPrices = (plan: {
  basePriceCents: number;
  billingInterval?: string | null;
  yearlyPriceCents?: number | null;
  yearlyDiscountPct?: number | null;
}): [number | null, number | null] => {
  const base = Number(plan.basePriceCents) || 0;
  const explicitYearly = plan.yearlyPriceCents ?? null;
  if (plan.billingInterval === 'yearly' && explicitYearly === null) return [null, base];
  if (explicitYearly !== null) return [base, explicitYearly];
  const pct = Number(plan.yearlyDiscountPct) || 0;
  if (pct > 0) return [base, roundHalfUp((base * 12 * (100 - pct)) / 100)];
  return [base, null];
};

/** The interval to show in the editor: what the package is actually sold on today. */
export const effectiveBillingInterval = (
  monthly: number | null,
  yearly: number | null,
): PackageBillingInterval => (monthly === null && yearly !== null ? 'yearly' : yearly !== null ? 'both' : 'monthly');

const explicitYearlyCentsOf = (draft: PackageDraft): number | null =>
  draft.yearlyPriceOverride.trim() ? centsFromDollars(Number(draft.yearlyPriceOverride) || 0) : null;

/** Yearly price the customer would pay, or null when the package is not sold yearly. */
export const yearlyPriceCentsOf = (draft: PackageDraft): number | null => {
  if (draft.billingInterval === 'monthly') return null;
  if (draft.billingInterval === 'yearly') return draft.basePriceCents;
  return planIntervalPrices({ ...draft, billingInterval: 'both', yearlyPriceCents: explicitYearlyCentsOf(draft) })[1];
};

/** Monthly price the customer would pay, or null when the package is yearly only. */
export const monthlyPriceCentsOf = (draft: PackageDraft): number | null =>
  draft.billingInterval === 'yearly' ? null : draft.basePriceCents;

/**
 * Fields sent with adminSavePlan. The package's billing interval and legacy yearly
 * discount are kept as they are, so an unedited package saves back unchanged.
 */
export const draftToPlanInputFields = (draft: PackageDraft) => {
  const both = draft.billingInterval === 'both';
  return {
    pricingMode: 'fixed' as PricingMode,
    bundleDiscountPct: 0,
    basePriceCents: draft.basePriceCents,
    // a yearly-only package keeps its yearly price in basePriceCents (see above)
    yearlyPriceCents: both ? explicitYearlyCentsOf(draft) : null,
    // the backend derives a yearly price from this even on a monthly package, so clear it there
    yearlyDiscountPct: draft.billingInterval === 'monthly' ? 0 : Number(draft.yearlyDiscountPct) || 0,
    billingInterval: draft.billingInterval,
    isPublic: draft.isPublic,
    modules: draft.modules.map((m) => ({ moduleId: m.moduleId, priceOverrideCents: null })),
  };
};

export const validatePackageDraft = (draft: PackageDraft, options: PackageModuleOption[]): string | null => {
  if (draft.modules.length === 0) return 'Select the modules this package unlocks.';
  if (draft.basePriceCents < 0) return 'Package price cannot be negative.';
  const explicitYearly = draft.billingInterval === 'both' ? explicitYearlyCentsOf(draft) : null;
  if (explicitYearly !== null && explicitYearly < 0) return 'Yearly price cannot be negative.';
  if (draft.billingInterval === 'both' && yearlyPriceCentsOf(draft) === null) {
    return 'Set a yearly price, or choose Monthly only.';
  }
  const selected = new Set(draft.modules.map((m) => m.moduleId));
  for (const option of options) {
    if (!selected.has(option.id)) continue;
    const missing = (option.dependsOn || []).filter((dep) => !selected.has(dep));
    if (missing.length) return `${option.name} requires: ${missing.join(', ')}`;
  }
  return null;
};

export const PackageBuilder: React.FC<{
  value: PackageDraft;
  onChange: (next: PackageDraft) => void;
}> = ({ value, onChange }) => {
  const { data: moduleData, loading: modulesLoading, error: modulesError } = useQuery<
    { adminModules: PackageModuleOption[] },
    Record<string, never>,
    any
  >(ADMIN_PACKAGE_MODULES_QUERY, { fetchPolicy: 'cache-and-network' });

  const options = useMemo(
    () => [...(moduleData?.adminModules || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [moduleData],
  );
  /** Top-level feature areas with their child modules, in catalog order. */
  const tree = useMemo(
    () =>
      options
        .filter((option) => !option.parentId)
        .map((parent) => ({ parent, children: options.filter((child) => child.parentId === parent.id) })),
    [options],
  );
  const selected = useMemo(() => new Set(value.modules.map((m) => m.moduleId)), [value.modules]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const setSelection = (ids: string[]) =>
    onChange({ ...value, modules: ids.map((moduleId) => ({ moduleId, priceOverride: '' })) });

  const toggle = (option: PackageModuleOption, children: PackageModuleOption[] = []) => {
    const family = [option.id, ...children.map((c) => c.id)];
    const next = new Set(selected);
    if (selected.has(option.id)) {
      family.forEach((id) => next.delete(id));
      // unticking a child leaves the parent partially selected, so drop the parent flag
      if (option.parentId) next.delete(option.parentId);
    } else {
      family.forEach((id) => next.add(id));
      (option.dependsOn || []).forEach((dep) => next.add(dep));
      // all children ticked -> tick the parent too
      if (option.parentId) {
        const siblings = options.filter((o) => o.parentId === option.parentId);
        if (siblings.every((s) => s.id === option.id || next.has(s.id))) next.add(option.parentId);
      }
    }
    setSelection(options.filter((o) => next.has(o.id)).map((o) => o.id));
  };

  const setAll = (on: boolean) => setSelection(on ? options.map((o) => o.id) : []);

  const validation = validatePackageDraft(value, options);
  const currency = value.currency || 'USD';
  const yearly = yearlyPriceCentsOf(value);
  const monthly = monthlyPriceCentsOf(value);
  const monthlyTimes12 = (monthly ?? 0) * 12;
  const discountPct = Number(value.yearlyDiscountPct) || 0;
  const yearlyOnly = value.billingInterval === 'yearly';
  /** Typing a yearly price offers yearly too; clearing it (no discount) goes back to monthly only. */
  const setYearlyPrice = (text: string) => {
    let billingInterval = value.billingInterval;
    if (text.trim() && billingInterval === 'monthly') billingInterval = 'both';
    if (!text.trim() && billingInterval === 'both' && discountPct <= 0) billingInterval = 'monthly';
    onChange({ ...value, yearlyPriceOverride: text, billingInterval });
  };
  const selectedCount = value.modules.length;

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
          />
          Show in onboarding (public)
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
          {yearlyOnly ? (
            <>
              Yearly price <span className="font-semibold normal-case text-slate-400">— yearly only; set it in Package price</span>
            </>
          ) : (
            <>
              Yearly offer price{' '}
              <span className="font-semibold normal-case text-slate-400">
                {discountPct > 0 && value.billingInterval === 'both'
                  ? `— leave blank to use the ${discountPct}% yearly discount`
                  : '— leave blank for monthly only'}
              </span>
            </>
          )}
        </p>
        <div className="flex flex-wrap items-end gap-4">
          {!yearlyOnly ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Yearly price ($)</span>
              <input
                type="number" min="0" step="0.01"
                value={value.yearlyPriceOverride}
                placeholder={yearly !== null ? (yearly / 100).toFixed(2) : (monthlyTimes12 / 100).toFixed(2)}
                onChange={(event) => setYearlyPrice(event.target.value)}
                className="w-44 rounded-lg border border-slate-300 px-3 py-2"
                data-testid="yearly-price"
              />
            </label>
          ) : null}
          <div className="text-sm text-slate-600" data-testid="price-preview">
            {monthly !== null ? (
              <div className="font-bold text-slate-900" data-testid="preview-monthly">
                {formatPrice(monthly, currency)} / month
              </div>
            ) : null}
            {yearly !== null ? (
              <div className="font-bold text-slate-900" data-testid="preview-yearly">
                {formatPrice(yearly, currency)} / year
                {monthlyTimes12 > yearly && monthlyTimes12 > 0 ? (
                  <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                    save {Math.round(((monthlyTimes12 - yearly) / monthlyTimes12) * 100)}%
                  </span>
                ) : null}
              </div>
            ) : null}
            {yearlyOnly ? (
              <div className="text-xs text-slate-500">Yearly only — the customer sees no monthly option.</div>
            ) : yearly === null ? (
              <div className="text-xs text-slate-500">Monthly only — the customer sees no yearly option.</div>
            ) : null}
            <p className="mt-1 text-[11px] text-slate-400">
              Prices are in USD; customers are shown and charged their own currency.
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            Included modules <span className="text-slate-400">({selectedCount} of {options.length} selected)</span>
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

        <div className="space-y-2">
          {tree.map(({ parent, children }) => {
            const childSelected = children.filter((child) => selected.has(child.id)).length;
            const isOpen = !collapsed[parent.id];
            return (
              <div key={parent.id} className="rounded-lg border border-slate-200 bg-white">
                <div className="flex items-start gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => setCollapsed((prev) => ({ ...prev, [parent.id]: isOpen }))}
                    className="mt-0.5 text-slate-400 hover:text-slate-700"
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                    disabled={!children.length}
                  >
                    {children.length ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block h-4 w-4" />}
                  </button>
                  <label className="flex flex-1 cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(parent.id)}
                      ref={(el) => {
                        if (el) el.indeterminate = !selected.has(parent.id) && childSelected > 0;
                      }}
                      onChange={() => toggle(parent, children)}
                      data-testid={`module-checkbox-${parent.id}`}
                    />
                    <span className="flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">{parent.name}</span>
                        {children.length ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                            {childSelected}/{children.length}
                          </span>
                        ) : null}
                        {!parent.active ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                            Not sold separately
                          </span>
                        ) : null}
                      </span>
                      {parent.description ? (
                        <span className="mt-0.5 block text-xs text-slate-500">{parent.description}</span>
                      ) : null}
                    </span>
                  </label>
                </div>

                {children.length && isOpen ? (
                  <div className="grid grid-cols-1 gap-1 border-t border-slate-100 bg-slate-50/60 p-3 pl-10 md:grid-cols-2">
                    {children.map((child) => (
                      <label key={child.id} className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-white">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.has(child.id)}
                          onChange={() => toggle(child)}
                          data-testid={`module-checkbox-${child.id}`}
                        />
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-slate-700">{child.name}</span>
                          {child.description ? (
                            <span className="mt-0.5 block text-xs text-slate-500">{child.description}</span>
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

      {validation ? (
        <p className="flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" /> {validation}
        </p>
      ) : null}
    </section>
  );
};
