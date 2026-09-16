import React, { useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { AlertTriangle, Layers } from 'lucide-react';
import { ADMIN_PACKAGE_MODULES_QUERY } from '../../../lib/graphql';
import { centsFromDollars, formatPrice } from '../../../lib/admin-utils';

/**
 * Package pricing is set by the admin on the package itself (fixed price).
 * Modules carry no price here — they only decide what the package unlocks.
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
}

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  fixed: 'Package price',
  sum_modules: 'Package price',
  sum_modules_disc: 'Package price',
  base_plus_modules: 'Package price',
};

/** Fields sent with adminSavePlan. Pricing is always the admin-entered package price. */
export const draftToPlanInputFields = (draft: PackageDraft) => ({
  pricingMode: 'fixed' as PricingMode,
  bundleDiscountPct: 0,
  yearlyPriceCents:
    draft.billingInterval === 'both' && draft.yearlyPriceOverride.trim()
      ? centsFromDollars(Number(draft.yearlyPriceOverride) || 0)
      : null,
  yearlyDiscountPct: draft.billingInterval === 'both' ? Number(draft.yearlyDiscountPct) || 0 : 0,
  isPublic: draft.isPublic,
  modules: draft.modules.map((m) => ({ moduleId: m.moduleId, priceOverrideCents: null })),
});

/** The yearly amount the customer will see for a "monthly or yearly" package. */
export const derivedYearlyCents = (draft: PackageDraft): number | null => {
  if (draft.billingInterval !== 'both') return null;
  if (draft.yearlyPriceOverride.trim()) return centsFromDollars(Number(draft.yearlyPriceOverride) || 0);
  const pct = Math.min(Math.max(Number(draft.yearlyDiscountPct) || 0, 0), 100);
  return Math.round(draft.basePriceCents * 12 * (100 - pct) / 100);
};

export const validatePackageDraft = (draft: PackageDraft, options: PackageModuleOption[]): string | null => {
  if (draft.modules.length === 0) return 'Select the modules this package unlocks.';
  if (draft.basePriceCents < 0) return 'Package price cannot be negative.';
  if (draft.yearlyDiscountPct < 0 || draft.yearlyDiscountPct > 100) return 'Yearly discount must be between 0 and 100%.';
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
  const grouped = useMemo(() => {
    const groups = new Map<string, PackageModuleOption[]>();
    options.forEach((option) => {
      const key = (option.category || 'other').toLowerCase();
      groups.set(key, [...(groups.get(key) || []), option]);
    });
    return Array.from(groups.entries());
  }, [options]);
  const selected = useMemo(() => new Set(value.modules.map((m) => m.moduleId)), [value.modules]);

  const toggleModule = (option: PackageModuleOption) => {
    if (selected.has(option.id)) {
      const dependants = options.filter((o) => selected.has(o.id) && (o.dependsOn || []).includes(option.id));
      const removeIds = new Set([option.id, ...dependants.map((d) => d.id)]);
      onChange({ ...value, modules: value.modules.filter((m) => !removeIds.has(m.moduleId)) });
      return;
    }
    const additions = [option.id, ...(option.dependsOn || [])].filter((id) => !selected.has(id));
    onChange({ ...value, modules: [...value.modules, ...additions.map((moduleId) => ({ moduleId, priceOverride: '' }))] });
  };

  const setAll = (on: boolean) =>
    onChange({ ...value, modules: on ? options.map((o) => ({ moduleId: o.id, priceOverride: '' })) : [] });

  const validation = validatePackageDraft(value, options);
  const currency = value.currency || 'USD';
  const yearly = derivedYearlyCents(value);
  const monthlyEquivalent = value.basePriceCents * 12;

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

      {value.billingInterval === 'both' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Yearly price ($)</span>
            <input
              type="number" min="0" step="0.01"
              value={value.yearlyPriceOverride}
              placeholder="Leave blank to use monthly × 12 − discount"
              onChange={(event) => onChange({ ...value, yearlyPriceOverride: event.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              data-testid="yearly-price"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Yearly discount (%)</span>
            <input
              type="number" min="0" max="100" step="0.5"
              value={value.yearlyDiscountPct}
              disabled={Boolean(value.yearlyPriceOverride.trim())}
              onChange={(event) => onChange({ ...value, yearlyDiscountPct: Number(event.target.value) || 0 })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
            />
          </label>
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            Included modules <span className="text-slate-400">({value.modules.length} of {options.length} selected)</span>
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
        <div className="space-y-3">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500">{category}</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {items.map((option) => {
                  const isSelected = selected.has(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors ${
                        isSelected ? 'border-sky-300 bg-white' : 'border-slate-200 bg-white/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={isSelected}
                        onChange={() => toggleModule(option)}
                        data-testid={`module-checkbox-${option.id}`}
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-slate-800">{option.name}</span>
                        {option.description ? (
                          <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
                        ) : null}
                        {option.dependsOn?.length ? (
                          <span className="mt-0.5 block text-[11px] text-amber-700">Requires: {option.dependsOn.join(', ')}</span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
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
      </div>

      {validation ? (
        <p className="flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" /> {validation}
        </p>
      ) : null}
    </section>
  );
};
