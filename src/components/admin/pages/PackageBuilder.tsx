import React, { useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { AlertTriangle, Layers } from 'lucide-react';
import { ADMIN_PACKAGE_MODULES_QUERY, ADMIN_PREVIEW_PLAN_PRICE_QUERY } from '../../../lib/graphql';
import { centsFromDollars, formatPrice } from '../../../lib/admin-utils';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';

export type PricingMode = 'fixed' | 'sum_modules' | 'sum_modules_disc' | 'base_plus_modules';
export type PackageBillingInterval = 'monthly' | 'yearly' | 'both';

export interface PackageModuleSelection {
  moduleId: string;
  /** Dollars as typed by the admin; blank = use the module's own price. */
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
  price: number;
  effectivePrice?: number | null;
  currency: string;
  active: boolean;
  sortOrder: number;
  category?: string | null;
  isCore?: boolean | null;
  icon?: string | null;
  dependsOn?: string[] | null;
}

interface PreviewData {
  adminPreviewPlanPrice: {
    currency: string;
    subtotalCents: number;
    discountCents: number;
    monthlyPriceCents: number | null;
    yearlyPriceCents: number | null;
    savingsPct: number;
    lines: { moduleId: string; name: string; unitCents: number }[];
  } | null;
}

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  fixed: 'Fixed price',
  sum_modules: 'Sum of module prices',
  sum_modules_disc: 'Module prices − bundle discount',
  base_plus_modules: 'Base price + module prices',
};

const usesModulePrices = (mode: PricingMode) => mode !== 'fixed';
const usesBasePrice = (mode: PricingMode) => mode === 'fixed' || mode === 'base_plus_modules';

export const draftToPlanInputFields = (draft: PackageDraft) => ({
  pricingMode: draft.pricingMode,
  bundleDiscountPct: draft.pricingMode === 'sum_modules_disc' ? Number(draft.bundleDiscountPct) || 0 : 0,
  yearlyPriceCents: draft.yearlyPriceOverride.trim() ? centsFromDollars(Number(draft.yearlyPriceOverride) || 0) : null,
  yearlyDiscountPct: Number(draft.yearlyDiscountPct) || 0,
  isPublic: draft.isPublic,
  modules: draft.modules.map((m) => ({
    moduleId: m.moduleId,
    priceOverrideCents: m.priceOverride.trim() ? centsFromDollars(Number(m.priceOverride) || 0) : null,
  })),
});

/** Client-side validation mirroring the backend rules (backend stays authoritative). */
export const validatePackageDraft = (draft: PackageDraft, options: PackageModuleOption[]): string | null => {
  if (usesModulePrices(draft.pricingMode) && draft.modules.length === 0) {
    return 'Select at least one module for module-based pricing.';
  }
  if (draft.bundleDiscountPct < 0 || draft.bundleDiscountPct > 100) return 'Bundle discount must be between 0 and 100%.';
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
  const { data: moduleData, loading: modulesLoading, error: modulesError } = useQuery<{ adminModules: PackageModuleOption[] }, Record<string, never>, any>(
    ADMIN_PACKAGE_MODULES_QUERY,
    { fetchPolicy: 'cache-and-network' },
  );
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

  const selected = useMemo(() => new Map(value.modules.map((m) => [m.moduleId, m])), [value.modules]);

  const previewVariables = useMemo(() => {
    const fields = draftToPlanInputFields(value);
    return {
      pricingMode: fields.pricingMode,
      billingInterval: value.billingInterval,
      basePriceCents: value.basePriceCents,
      bundleDiscountPct: fields.bundleDiscountPct,
      yearlyPriceCents: fields.yearlyPriceCents,
      yearlyDiscountPct: fields.yearlyDiscountPct,
      modules: fields.modules,
    };
  }, [value]);
  const debouncedVariables = useDebouncedValue(previewVariables, 300);
  const { data: previewData, loading: previewLoading, error: previewError } = useQuery<PreviewData, typeof debouncedVariables, any>(
    ADMIN_PREVIEW_PLAN_PRICE_QUERY,
    { variables: debouncedVariables, fetchPolicy: 'network-only' },
  );
  const preview = previewData?.adminPreviewPlanPrice;

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

  const setOverride = (moduleId: string, priceOverride: string) =>
    onChange({ ...value, modules: value.modules.map((m) => (m.moduleId === moduleId ? { ...m, priceOverride } : m)) });

  const validation = validatePackageDraft(value, options);
  const currency = value.currency || 'USD';

  return (
    <section className="space-y-4 rounded-xl border border-sky-100 bg-sky-50/40 p-4" data-testid="package-builder">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-sky-600" />
        <h4 className="text-sm font-bold uppercase tracking-wide text-sky-700">Modules &amp; pricing</h4>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Pricing mode</span>
          <select
            value={value.pricingMode}
            onChange={(event) => onChange({ ...value, pricingMode: event.target.value as PricingMode })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            data-testid="pricing-mode"
          >
            {(Object.keys(PRICING_MODE_LABELS) as PricingMode[]).map((mode) => (
              <option key={mode} value={mode}>{PRICING_MODE_LABELS[mode]}</option>
            ))}
          </select>
        </label>
        {value.pricingMode === 'sum_modules_disc' ? (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Bundle discount (%)</span>
            <input
              type="number" min="0" max="100" step="0.5"
              value={value.bundleDiscountPct}
              onChange={(event) => onChange({ ...value, bundleDiscountPct: Number(event.target.value) || 0 })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
        ) : null}
        {value.billingInterval !== 'monthly' ? (
          <>
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
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Yearly price override ($)</span>
              <input
                type="number" min="0" step="0.01"
                value={value.yearlyPriceOverride}
                placeholder="Derived from monthly"
                onChange={(event) => onChange({ ...value, yearlyPriceOverride: event.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>
          </>
        ) : null}
        <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={value.isPublic}
            onChange={(event) => onChange({ ...value, isPublic: event.target.checked })}
          />
          Show in onboarding (public)
        </label>
      </div>
      {!usesBasePrice(value.pricingMode) ? (
        <p className="text-xs text-slate-500">Base price is ignored for this pricing mode.</p>
      ) : null}

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">
          Included modules <span className="text-slate-400">({value.modules.length} of {options.length} selected)</span>
        </span>
        {modulesLoading && !options.length ? <p className="text-sm text-slate-500">Loading modules…</p> : null}
        {modulesError ? <p className="text-sm text-rose-600">Could not load modules: {modulesError.message}</p> : null}
        <div className="space-y-3">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500">{category}</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {items.map((option) => {
                  const selection = selected.get(option.id);
                  const unit = option.effectivePrice ?? option.price;
                  return (
                    <div
                      key={option.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        selection ? 'border-sky-300 bg-white' : 'border-slate-200 bg-white/60'
                      }`}
                    >
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={Boolean(selection)}
                          onChange={() => toggleModule(option)}
                          data-testid={`module-checkbox-${option.id}`}
                        />
                        <span className="flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-800">
                              {option.name}
                              {!option.active ? (
                                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                                  Not sold separately
                                </span>
                              ) : null}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">{formatPrice(unit, option.currency)}/mo</span>
                          </span>
                          {option.description ? (
                            <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
                          ) : null}
                          {option.dependsOn?.length ? (
                            <span className="mt-0.5 block text-[11px] text-amber-700">Requires: {option.dependsOn.join(', ')}</span>
                          ) : null}
                        </span>
                      </label>
                      {selection && usesModulePrices(value.pricingMode) ? (
                        <label className="mt-2 flex items-center gap-2 pl-6 text-xs text-slate-600">
                          Custom price ($/mo)
                          <input
                            type="number" min="0" step="0.01"
                            value={selection.priceOverride}
                            placeholder={(unit / 100).toFixed(2)}
                            onChange={(event) => setOverride(option.id, event.target.value)}
                            className="w-24 rounded-md border border-slate-300 px-2 py-1"
                          />
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3" data-testid="price-preview">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Live price preview</span>
          {previewLoading ? <span className="text-xs text-slate-400">Calculating…</span> : null}
        </div>
        {previewError ? <p className="text-sm text-rose-600">{previewError.message}</p> : null}
        {preview ? (
          <div className="space-y-1 text-sm">
            {usesModulePrices(value.pricingMode)
              ? preview.lines.map((line) => (
                  <div key={line.moduleId} className="flex justify-between text-slate-600">
                    <span>{line.name}</span>
                    <span>{formatPrice(line.unitCents, currency)}</span>
                  </div>
                ))
              : null}
            {preview.discountCents > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <span>Bundle discount</span>
                <span>−{formatPrice(preview.discountCents, currency)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-4 border-t border-dashed border-slate-200 pt-2 font-bold text-slate-900">
              {preview.monthlyPriceCents !== null ? (
                <span data-testid="preview-monthly">{formatPrice(preview.monthlyPriceCents, currency)} / month</span>
              ) : null}
              {preview.yearlyPriceCents !== null ? (
                <span data-testid="preview-yearly">
                  {formatPrice(preview.yearlyPriceCents, currency)} / year
                  {preview.savingsPct > 0 ? (
                    <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">save {preview.savingsPct}%</span>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {validation ? (
        <p className="flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" /> {validation}
        </p>
      ) : null}
    </section>
  );
};
