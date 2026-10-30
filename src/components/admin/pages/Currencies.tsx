import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { Edit2, Plus, RefreshCw, X } from 'lucide-react';
import {
  ADMIN_CURRENCY_RATES_QUERY,
  ADMIN_REFRESH_CURRENCY_RATES_MUTATION,
  ADMIN_SAVE_CURRENCY_RATE_MUTATION,
} from '../../../lib/graphql';
import { centsFromAmount, formatDateTime, formatPrice } from '../../../lib/admin-utils';

interface CurrencyRateRow {
  code: string;
  name: string;
  symbol: string;
  ratePerUsd: string;
  roundTo: number;
  active: boolean;
  isManual: boolean;
  source: string;
  decimals: number;
  updatedAt: string | null;
  updatedBy: string | null;
  previewCents: number | null;
}

interface CurrencyRatesData {
  adminCurrencyRates: {
    baseCurrency: string;
    lastRefreshedAt: string | null;
    sourceUrl: string;
    rates: CurrencyRateRow[];
  } | null;
}

interface EditingRate {
  isNew: boolean;
  code: string;
  name: string;
  symbol: string;
  ratePerUsd: string;
  originalRate: string;
  roundTo: number;
  active: boolean;
  isManual: boolean;
  /** As loaded (an existing row): switched on, and where its rate came from. */
  originalActive: boolean;
  source: string;
}

/** A typed rate further than this from the current one asks for confirmation (300 typed as 3.0...). */
const RATE_CHANGE_CONFIRM_RATIO = 0.2;

const SOURCE_LABELS: Record<string, string> = {
  auto: 'Automatic',
  manual: 'Typed by admin',
  seed: 'Placeholder (not checked yet)',
  base: 'Base currency',
};

/**
 * Exchange rates used to show and charge package prices in a customer's own
 * currency. A currency is offered at checkout only while it is switched on.
 * Rates refresh automatically every day; a pinned rate is kept as typed.
 */
export const Currencies: React.FC<{ onToast: (type: 'success' | 'error', msg: string) => void }> = ({ onToast }) => {
  const [previewUsd, setPreviewUsd] = useState('12');
  // Ask the server for a new preview only once typing pauses, not per keystroke.
  const [debouncedPreviewUsd, setDebouncedPreviewUsd] = useState(previewUsd);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPreviewUsd(previewUsd), 400);
    return () => clearTimeout(timer);
  }, [previewUsd]);
  // Kept within 1,000,000 USD (the server clamps to the same range).
  const previewUsdCents = Math.min(Math.max(centsFromAmount(Number(debouncedPreviewUsd) || 0, 'USD'), 0), 100_000_000);
  const { data, loading, error, refetch } = useQuery<CurrencyRatesData, { previewUsdCents: number }, any>(ADMIN_CURRENCY_RATES_QUERY, {
    variables: { previewUsdCents },
    fetchPolicy: 'cache-and-network',
  });
  const [refreshRates, { loading: refreshing }] = useMutation<
    { adminRefreshCurrencyRates: { success: boolean; message?: string | null; updated?: string[]; skipped?: string[] } },
    Record<string, never>,
    any,
    any
  >(ADMIN_REFRESH_CURRENCY_RATES_MUTATION);
  const [saveRate, { loading: saving }] = useMutation<
    { adminSaveCurrencyRate: { success: boolean; message?: string | null } },
    Record<string, unknown>,
    any,
    any
  >(ADMIN_SAVE_CURRENCY_RATE_MUTATION);
  const [editing, setEditing] = useState<EditingRate | null>(null);

  const info = data?.adminCurrencyRates;
  const rates = info?.rates || [];

  // A seed rate is a placeholder nobody has checked: customers would be
  // charged at it as soon as the currency is switched on.
  const confirmPlaceholderRate = (code: string, ratePerUsd: string) =>
    window.confirm(
      `${code} still has a placeholder rate (1 USD = ${ratePerUsd} ${code}) that has not been checked. ` +
        'Customers will be charged at this rate. Switch it on anyway? (Refresh or type the rate first to be safe.)',
    );

  const handleRefresh = async () => {
    try {
      const result = await refreshRates();
      const payload = result.data?.adminRefreshCurrencyRates;
      if (!payload?.success) {
        onToast('error', payload?.message || 'Rates could not be refreshed');
        return;
      }
      const skipped = payload.skipped?.length ? ` Kept old rate (moved too far): ${payload.skipped.join(', ')}.` : '';
      onToast('success', `${payload.message || 'Rates refreshed.'}${skipped}`);
      refetch();
    } catch (err: any) {
      onToast('error', err?.message || 'Rates could not be refreshed');
    }
  };

  const toggleActive = async (row: CurrencyRateRow) => {
    // Switching off removes the currency from checkout at once: make sure it was meant.
    if (
      row.active &&
      !window.confirm(
        `Switch ${row.code} off? Customers will no longer be able to pay in it, and companies billed in it ` +
          'move to their package currency at their next renewal.',
      )
    ) {
      return;
    }
    const placeholder = !row.active && row.source === 'seed';
    if (placeholder && !confirmPlaceholderRate(row.code, row.ratePerUsd)) return;
    try {
      // The server refuses a placeholder rate unless the admin confirmed it.
      // Switching off is confirmed above too (the server asks when companies are billed in it).
      const result = await saveRate({ variables: { code: row.code, active: !row.active, confirmed: placeholder || row.active } });
      const payload = result.data?.adminSaveCurrencyRate;
      if (!payload?.success) {
        onToast('error', payload?.message || 'Currency could not be updated');
        return;
      }
      onToast('success', `${row.code} ${row.active ? 'switched off' : 'offered to customers'}`);
      refetch();
    } catch (err: any) {
      onToast('error', err?.message || 'Currency could not be updated');
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    const code = editing.code.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      onToast('error', 'Currency code must be 3 letters, e.g. LKR');
      return;
    }
    // Saving is an upsert: adding a code that already exists would overwrite it.
    if (editing.isNew && (code === 'USD' || rates.some((rate) => rate.code === code))) {
      onToast('error', `${code} is already in the list. Edit that row instead.`);
      return;
    }
    const rateChanged = editing.ratePerUsd.trim() !== editing.originalRate;
    if ((editing.isNew || rateChanged) && !(Number(editing.ratePerUsd) > 0)) {
      onToast('error', 'Rate must be a positive number');
      return;
    }
    const oldRate = Number(editing.originalRate);
    const newRate = Number(editing.ratePerUsd);
    // Set once the admin confirmed a check below; the server asks for it too.
    let confirmed = false;
    if (!editing.isNew && rateChanged && oldRate > 0 && Math.abs(newRate - oldRate) / oldRate > RATE_CHANGE_CONFIRM_RATIO) {
      const change = Math.round(((newRate - oldRate) / oldRate) * 100);
      const confirmedChange = window.confirm(
        `The new ${code} rate is ${change > 0 ? '+' : ''}${change}% from the current one.\n\n` +
          `Current: 1 USD = ${editing.originalRate} ${code}\nNew: 1 USD = ${editing.ratePerUsd.trim()} ${code}\n\nSave this rate?`,
      );
      if (!confirmedChange) return;
      confirmed = true;
    }
    // Switched off from the edit form: same question as the On/Off button.
    if (!editing.isNew && !editing.active && editing.originalActive) {
      if (
        !window.confirm(
          `Switch ${code} off? Customers will no longer be able to pay in it, and companies billed in it ` +
            'move to their package currency at their next renewal.',
        )
      ) {
        return;
      }
      confirmed = true;
    }
    // Switching on a currency whose (unchanged) rate is still a placeholder.
    if (!editing.isNew && editing.active && !editing.originalActive && editing.source === 'seed' && !rateChanged) {
      if (!confirmPlaceholderRate(code, editing.originalRate)) return;
      confirmed = true;
    }
    try {
      const result = await saveRate({
        variables: {
          code,
          name: editing.name.trim(),
          symbol: editing.symbol.trim(),
          ratePerUsd: editing.isNew || rateChanged ? editing.ratePerUsd.trim() : null,
          roundTo: Number(editing.roundTo) || 0,
          active: editing.active,
          isManual: editing.isManual,
          // The server refuses to overwrite an existing code from the Add form too.
          createOnly: editing.isNew,
          confirmed,
        },
      });
      const payload = result.data?.adminSaveCurrencyRate;
      if (!payload?.success) {
        onToast('error', payload?.message || 'Currency could not be saved');
        return;
      }
      onToast('success', `${code} saved`);
      setEditing(null);
      refetch();
    } catch (err: any) {
      onToast('error', err?.message || 'Currency could not be saved');
    }
  };

  const openEdit = (row: CurrencyRateRow) =>
    setEditing({
      isNew: false,
      code: row.code,
      name: row.name,
      symbol: row.symbol,
      ratePerUsd: row.ratePerUsd,
      originalRate: row.ratePerUsd,
      roundTo: row.roundTo,
      active: row.active,
      isManual: row.isManual,
      originalActive: row.active,
      source: row.source,
    });

  return (
    <div className="space-y-4" data-testid="currencies-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Currencies</h2>
          <p className="text-sm text-slate-500">
            Package prices are set in {info?.baseCurrency || 'USD'}. Customers see and pay them in a currency listed here
            while it is switched on. Last automatic refresh:{' '}
            <span className="font-semibold" data-testid="currencies-last-refresh">
              {info?.lastRefreshedAt ? formatDateTime(info.lastRefreshedAt) : 'never'}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            data-testid="currencies-refresh"
          >
            <RefreshCw className="h-4 w-4" /> {refreshing ? 'Refreshing…' : 'Refresh rates now'}
          </button>
          <button
            type="button"
            onClick={() =>
              setEditing({
                isNew: true, code: '', name: '', symbol: '', ratePerUsd: '', originalRate: '', roundTo: 0, active: false,
                isManual: true, originalActive: false, source: 'manual',
              })
            }
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-700"
            data-testid="currencies-add"
          >
            <Plus className="h-4 w-4" /> Add currency
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        Preview a price of
        <input
          type="number"
          min="0"
          step="0.01"
          value={previewUsd}
          onChange={(event) => setPreviewUsd(event.target.value)}
          className="w-28 rounded-lg border border-slate-300 px-2 py-1"
          data-testid="currencies-preview-input"
        />
        USD (rounded exactly as at checkout)
      </label>

      {error ? <p className="text-sm text-rose-600">Could not load currencies: {error.message}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm" data-testid="currencies-table">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Currency</th>
              <th className="px-3 py-3">Rate (per 1 USD)</th>
              <th className="px-3 py-3">Round up to</th>
              <th className="px-3 py-3">Preview</th>
              <th className="px-3 py-3">Rate source</th>
              <th className="px-3 py-3">Offered</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rates.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">Loading…</td>
              </tr>
            ) : null}
            {rates.map((row) => (
              <tr key={row.code} className="border-b border-slate-100" data-testid={`currency-row-${row.code}`}>
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-800">
                    {row.code} <span className="font-normal text-slate-500">{row.symbol}</span>
                  </div>
                  <div className="text-xs text-slate-500">{row.name}</div>
                </td>
                <td className="px-3 py-2 font-mono">{row.ratePerUsd}</td>
                <td className="px-3 py-2">{row.roundTo ? `${row.roundTo} ${row.code}` : '-'}</td>
                <td className="px-3 py-2 font-semibold" data-testid={`currency-preview-${row.code}`}>
                  {row.previewCents !== null && row.previewCents !== undefined ? formatPrice(row.previewCents, row.code) : '-'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {SOURCE_LABELS[row.source] || row.source || '-'}
                  {row.isManual && row.code !== 'USD' ? (
                    <span className="ml-1 rounded bg-amber-50 px-1.5 text-amber-700">pinned</span>
                  ) : null}
                  {row.updatedAt ? <div className="text-slate-400">{formatDateTime(row.updatedAt)}</div> : null}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={row.code === 'USD' || saving}
                    onClick={() => toggleActive(row)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      row.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    } disabled:cursor-not-allowed`}
                    data-testid={`currency-toggle-${row.code}`}
                  >
                    {row.active ? 'On' : 'Off'}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="rounded-lg p-2 text-sky-700 hover:bg-sky-50"
                    title={`Edit ${row.code}`}
                    data-testid={`currency-edit-${row.code}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" data-testid="currency-dialog">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="text-lg font-bold text-slate-800">{editing.isNew ? 'Add currency' : `Edit ${editing.code}`}</h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Code</span>
                <input
                  value={editing.code}
                  disabled={!editing.isNew}
                  maxLength={3}
                  onChange={(event) => setEditing({ ...editing, code: event.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  data-testid="currency-code"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Symbol</span>
                <input
                  value={editing.symbol}
                  onChange={(event) => setEditing({ ...editing, symbol: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
                <input
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Rate (units per 1 USD)</span>
                <input
                  value={editing.ratePerUsd}
                  disabled={editing.code === 'USD'}
                  inputMode="decimal"
                  onChange={(event) =>
                    // A typed rate is pinned so the daily refresh keeps it.
                    setEditing({ ...editing, ratePerUsd: event.target.value, isManual: true })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  data-testid="currency-rate"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Round prices up to (whole units)</span>
                <input
                  type="number"
                  min="0"
                  value={editing.roundTo}
                  onChange={(event) => setEditing({ ...editing, roundTo: Number(event.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editing.isManual}
                  disabled={editing.code === 'USD'}
                  onChange={(event) => setEditing({ ...editing, isManual: event.target.checked })}
                  data-testid="currency-pinned"
                />
                Pin this rate (the daily refresh keeps it)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editing.active}
                  disabled={editing.code === 'USD'}
                  onChange={(event) => setEditing({ ...editing, active: event.target.checked })}
                  data-testid="currency-active"
                />
                Offer to customers
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                data-testid="currency-save"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
