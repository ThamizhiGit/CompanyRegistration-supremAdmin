import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { Coins, Edit2, Lock, Plus, RefreshCw, Save, Search, X } from 'lucide-react';
import {
  ADMIN_CURRENCY_RATES_QUERY,
  ADMIN_REFRESH_CURRENCY_RATES_MUTATION,
  ADMIN_SAVE_CURRENCY_RATE_MUTATION,
} from '../../../lib/graphql';
import { formatDateTime } from '../../../lib/admin-utils';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';

/**
 * Packages are priced in USD. Onboarding shows and charges each customer in their own
 * currency using these rates; the server rounds the converted price to each currency's
 * rounding step. Rates refresh daily from the FX source; a pinned rate is left alone.
 */

export interface CurrencyRate {
  code: string;
  name: string | null;
  symbol: string | null;
  ratePerUsd: string;
  zeroDecimal: boolean;
  roundingUnitMinor: number;
  isManual: boolean;
  active: boolean;
  source: string | null;
  updatedAt: string | null;
  isBase: boolean;
  /** The preview USD amount converted exactly as checkout converts it. */
  convert: number | null;
}

interface Overview {
  baseCurrency: string;
  lastRefreshedAt: string | null;
  sourceUrl: string | null;
  rates: CurrencyRate[];
}

interface RateForm {
  code: string;
  name: string;
  symbol: string;
  ratePerUsd: string;
  /** In whole units of the currency (e.g. 100 = round LKR prices to the nearest Rs 100). */
  roundTo: string;
  isManual: boolean;
  active: boolean;
}

/** Format a converted amount (minor units, or whole units for zero-decimal currencies). */
export const formatLocal = (amount: number | null | undefined, rate: Pick<CurrencyRate, 'code' | 'symbol' | 'zeroDecimal'>) => {
  if (amount === null || amount === undefined) return '-';
  const value = rate.zeroDecimal ? amount : amount / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: rate.code }).format(value);
  } catch {
    return `${rate.symbol || rate.code} ${value.toLocaleString('en-US')}`;
  }
};

const roundToLabel = (rate: CurrencyRate) => {
  const units = rate.roundingUnitMinor / 100;
  if (units <= 0.01) return 'None';
  return `Nearest ${units.toLocaleString('en-US')}`;
};

const toForm = (rate?: CurrencyRate): RateForm => ({
  code: rate?.code || '',
  name: rate?.name || '',
  symbol: rate?.symbol || '',
  ratePerUsd: rate?.ratePerUsd || '',
  roundTo: rate ? String(rate.roundingUnitMinor / 100) : '1',
  isManual: rate?.isManual ?? true,
  active: rate?.active ?? true,
});

export const Currencies: React.FC<{ onToast: (type: 'success' | 'error', msg: string) => void }> = ({ onToast }) => {
  const [previewUsd, setPreviewUsd] = useState('25.50');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; form: RateForm; original?: CurrencyRate } | null>(null);

  const debouncedPreviewUsd = useDebouncedValue(previewUsd, 300);
  const previewUsdCents = Math.max(0, Math.round((Number(debouncedPreviewUsd) || 0) * 100));
  const { data, loading, error, refetch } = useQuery<{ adminCurrencyRates: Overview }, { previewUsdCents: number }, any>(
    ADMIN_CURRENCY_RATES_QUERY,
    { variables: { previewUsdCents }, fetchPolicy: 'cache-and-network' },
  );
  const [saveRate, { loading: saving }] = useMutation<
    { adminSaveCurrencyRate: { success: boolean; message?: string | null } },
    { input: Record<string, unknown>; previewUsdCents: number },
    any,
    any
  >(ADMIN_SAVE_CURRENCY_RATE_MUTATION);
  const [refreshRates, { loading: refreshing }] = useMutation<
    { adminRefreshCurrencyRates: { success: boolean; message?: string | null; updatedCount: number } },
    Record<string, never>,
    any,
    any
  >(ADMIN_REFRESH_CURRENCY_RATES_MUTATION);

  const overview = data?.adminCurrencyRates;
  const rates = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = overview?.rates || [];
    return term ? all.filter((r) => `${r.code} ${r.name || ''}`.toLowerCase().includes(term)) : all;
  }, [overview, search]);

  const handleRefresh = async () => {
    try {
      const res = await refreshRates();
      const payload = res.data?.adminRefreshCurrencyRates;
      if (!payload?.success) return onToast('error', payload?.message || 'Could not refresh rates');
      onToast('success', payload.message || `Updated ${payload.updatedCount} rate(s)`);
      refetch();
    } catch (err: any) {
      onToast('error', err.message || 'Could not refresh rates');
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    const { form, mode, original } = editing;
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return onToast('error', 'Currency code must be 3 letters (e.g. LKR)');
    const rate = Number(form.ratePerUsd);
    if (!form.ratePerUsd.trim() || !Number.isFinite(rate) || rate <= 0) return onToast('error', 'Rate must be a number greater than 0');
    const roundTo = Number(form.roundTo);
    if (!Number.isFinite(roundTo) || roundTo < 0.01) return onToast('error', 'Rounding must be at least 0.01');

    const input: Record<string, unknown> = {
      code,
      name: form.name.trim(),
      symbol: form.symbol.trim(),
      ratePerUsd: form.ratePerUsd.trim(),
      roundingUnitMinor: Math.round(roundTo * 100),
      active: form.active,
    };
    // Only send isManual when the admin touched it; the server pins a hand-edited rate itself.
    if (mode === 'create' || form.isManual !== original?.isManual) input.isManual = form.isManual;
    try {
      const res = await saveRate({ variables: { input, previewUsdCents } });
      const payload = res.data?.adminSaveCurrencyRate;
      if (!payload?.success) return onToast('error', payload?.message || 'Could not save the rate');
      onToast('success', payload.message || `${code} saved`);
      setEditing(null);
      refetch();
    } catch (err: any) {
      onToast('error', err.message || 'Could not save the rate');
    }
  };

  const setForm = (patch: Partial<RateForm>) => setEditing((current) => (current ? { ...current, form: { ...current.form, ...patch } } : current));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Currency Rates</h1>
          <p className="text-slate-600">Packages are priced in USD; customers see and pay in their own currency using these rates.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing({ mode: 'create', form: toForm() })}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" /> Add currency
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0ea5b7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b8fa0] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing…' : 'Refresh rates now'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Base currency</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{overview?.baseCurrency || 'USD'}</p>
          <p className="text-xs text-slate-500">Admins set package prices in this currency</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Last automatic refresh</p>
          <p className="mt-1 text-xl font-bold text-slate-900" data-testid="last-refreshed">
            {overview?.lastRefreshedAt ? formatDateTime(overview.lastRefreshedAt) : 'Never'}
          </p>
          <p className="truncate text-xs text-slate-500" title={overview?.sourceUrl || ''}>Daily job · pinned rates are kept</p>
        </div>
        <label className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Preview a USD price</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-bold text-slate-400">$</span>
            <input
              aria-label="Preview USD amount"
              type="number"
              min="0"
              step="0.01"
              value={previewUsd}
              onChange={(e) => setPreviewUsd(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-lg font-bold text-slate-900"
            />
          </div>
          <span className="text-xs text-slate-500">Shown per currency, rounded as at checkout</span>
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search currency"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-700">
              <tr>
                <th className="px-3 py-3 font-semibold">Currency</th>
                <th className="px-3 py-3 font-semibold">1 USD =</th>
                <th className="px-3 py-3 font-semibold">${(previewUsdCents / 100).toFixed(2)} becomes</th>
                <th className="px-3 py-3 font-semibold">Rounding</th>
                <th className="px-3 py-3 font-semibold">Source</th>
                <th className="px-3 py-3 font-semibold">Updated</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-red-600">Could not load rates: {error.message}</td></tr>
              ) : rates.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-500">{loading ? 'Loading…' : 'No currencies found'}</td></tr>
              ) : rates.map((rate) => (
                <tr key={rate.code} className={`border-t border-slate-100 ${rate.active ? '' : 'opacity-60'}`}>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-900">{rate.code} <span className="font-normal text-slate-400">{rate.symbol}</span></div>
                    <div className="text-xs text-slate-500">{rate.name}</div>
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-800">{rate.ratePerUsd}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{formatLocal(rate.convert, rate)}</td>
                  <td className="px-3 py-3 text-slate-600">{roundToLabel(rate)}</td>
                  <td className="px-3 py-3">
                    {rate.isBase ? (
                      <span className="text-xs text-slate-500">Base</span>
                    ) : rate.isManual ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700" title="The daily refresh leaves this rate alone">
                        <Lock className="h-3 w-3" /> Pinned
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Auto{rate.source ? ` · ${rate.source}` : ''}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDateTime(rate.updatedAt)}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${rate.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {rate.active ? 'Active' : 'Off'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing({ mode: 'edit', form: toForm(rate), original: rate })}
                      title={`Edit ${rate.code}`}
                      className="rounded-lg p-2 text-cyan-700 hover:bg-cyan-50"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="sr-only">Edit {rate.code}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="currency-dialog-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <h3 id="currency-dialog-title" className="flex items-center gap-2 text-lg font-bold text-slate-800">
                <Coins className="h-5 w-5 text-sky-600" />
                {editing.mode === 'create' ? 'Add currency' : `Edit ${editing.form.code}`}
              </h3>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Code</span>
                <input aria-label="Code" value={editing.form.code} disabled={editing.mode === 'edit'} maxLength={3}
                  onChange={(e) => setForm({ code: e.target.value.toUpperCase() })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase disabled:bg-slate-50" placeholder="LKR" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Symbol</span>
                <input aria-label="Symbol" value={editing.form.symbol} onChange={(e) => setForm({ symbol: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Rs" />
              </label>
              <label className="col-span-2 block">
                <span className="text-sm font-semibold text-slate-700">Name</span>
                <input aria-label="Name" value={editing.form.name} onChange={(e) => setForm({ name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Sri Lankan Rupee" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">1 USD =</span>
                <input aria-label="Rate per USD" value={editing.form.ratePerUsd} disabled={editing.original?.isBase}
                  onChange={(e) => setForm({ ratePerUsd: e.target.value, isManual: true })}
                  inputMode="decimal" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm disabled:bg-slate-50" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Round prices to</span>
                <input aria-label="Round prices to" value={editing.form.roundTo} onChange={(e) => setForm({ roundTo: e.target.value })}
                  inputMode="decimal" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              {!editing.original?.isBase ? (
                <>
                  <label className="col-span-2 flex items-start gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={editing.form.isManual} onChange={(e) => setForm({ isManual: e.target.checked })} className="mt-0.5" />
                    <span><strong>Pin this rate</strong> — the daily refresh will not overwrite it. Untick to follow the market rate again.</span>
                  </label>
                  <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={editing.form.active} onChange={(e) => setForm({ active: e.target.checked })} />
                    Offer this currency at checkout
                  </label>
                </>
              ) : (
                <p className="col-span-2 text-xs text-slate-500">USD is the base currency: its rate is always 1.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0ea5b7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b8fa0] disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
