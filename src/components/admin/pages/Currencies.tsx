import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { Edit2, RefreshCw, X } from 'lucide-react';
import {
  ADMIN_CURRENCY_RATES_QUERY,
  ADMIN_REFRESH_CURRENCY_RATES_MUTATION,
  ADMIN_SAVE_CURRENCY_RATE_MUTATION,
} from '../../../lib/graphql';
import { centsFromAmount, formatDateTime, formatPrice, wholeNumberError } from '../../../lib/admin-utils';
import { DataTable, RowActionButton } from '../ui/DataTable';
import { useConfirmDialog } from '../ui/FormKit';

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
  /** As typed (an Int on the server: 2.5 failed the whole save with a GraphQL error). */
  roundTo: string;
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
  // In-app confirm / reason questions (not the browser's "localhost says").
  const { confirm, askReason, dialog } = useConfirmDialog();
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
    confirm({
      title: `Switch ${code} on with an unchecked rate?`,
      message:
        `${code} still has a placeholder rate (1 USD = ${ratePerUsd} ${code}) that has not been checked. ` +
        'Customers will be charged at this rate. Switch it on anyway? (Refresh or type the rate first to be safe.)',
      confirmLabel: 'Switch on',
    });
  // A rate typed by hand while the currency was off may be long out of date.
  const confirmUncheckedRate = (code: string, ratePerUsd: string, source: string) =>
    source === 'manual'
      ? confirm({
          title: `Switch ${code} on?`,
          message:
            `${code}'s rate (1 USD = ${ratePerUsd} ${code}) was typed by hand and may be out of date. ` +
            'Customers will be charged at this rate. Switch it on anyway?',
          confirmLabel: 'Switch on',
        })
      : confirmPlaceholderRate(code, ratePerUsd);
  const confirmSwitchOff = (code: string) =>
    confirm({
      title: `Switch ${code} off?`,
      message:
        `Switch ${code} off? Customers will no longer be able to pay in it, and companies billed in it ` +
        'move to their package currency at their next renewal.',
      confirmLabel: 'Switch off',
      tone: 'danger',
    });
  const needsRateCheck = (source: string) => source === 'seed' || source === 'manual';

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
      !(await confirmSwitchOff(row.code))
    ) {
      return;
    }
    const placeholder = !row.active && needsRateCheck(row.source);
    if (placeholder && !(await confirmUncheckedRate(row.code, row.ratePerUsd, row.source))) return;
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
    const roundProblem = wholeNumberError(editing.roundTo, 'Round prices up to', 0);
    if (roundProblem) {
      onToast('error', roundProblem);
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
      const confirmedChange = await confirm({
        title: `Save the new ${code} rate?`,
        message:
          `The new ${code} rate is ${change > 0 ? '+' : ''}${change}% from the current one.\n\n` +
          `Current: 1 USD = ${editing.originalRate} ${code}\nNew: 1 USD = ${editing.ratePerUsd.trim()} ${code}\n\nSave this rate?`,
        confirmLabel: 'Save rate',
      });
      if (!confirmedChange) return;
      confirmed = true;
    }
    // A new currency switched on: there is no current rate to compare with,
    // so the admin checks the typed one (3.0 for 300 would price everything
    // in it 100 times too low). The server asks for this too.
    if (editing.isNew && editing.active) {
      const ok = await confirm({
        title: `Add ${code}?`,
        message: `Check the rate before ${code} is switched on:\n\n1 USD = ${editing.ratePerUsd.trim()} ${code}\n\nAdd it?`,
        confirmLabel: 'Add currency',
      });
      if (!ok) return;
      confirmed = true;
    }
    // Switched off from the edit form: same question as the On/Off button.
    if (!editing.isNew && !editing.active && editing.originalActive) {
      if (!(await confirmSwitchOff(code))) {
        return;
      }
      confirmed = true;
    }
    // Switching on a currency whose (unchanged) rate is still a placeholder.
    if (!editing.isNew && editing.active && !editing.originalActive && needsRateCheck(editing.source) && !rateChanged) {
      if (!(await confirmUncheckedRate(code, editing.originalRate, editing.source))) return;
      confirmed = true;
    }
    try {
      const result = await saveRate({
        variables: {
          code,
          name: editing.name.trim(),
          symbol: editing.symbol.trim(),
          ratePerUsd: editing.isNew || rateChanged ? editing.ratePerUsd.trim() : null,
          roundTo: Number(editing.roundTo.trim() || 0),
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
      roundTo: String(row.roundTo ?? 0),
      active: row.active,
      isManual: row.isManual,
      originalActive: row.active,
      source: row.source,
    });

  return (
    <div className="space-y-4" data-testid="currencies-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-700">Currencies</h2>
          <p className="text-sm text-slate-500">
            Package prices are set in {info?.baseCurrency || 'USD'}. Customers see and pay them in a currency listed here
            while it is switched on. Last automatic refresh:{' '}
            <span className="font-semibold" data-testid="currencies-last-refresh">
              {info?.lastRefreshedAt ? formatDateTime(info.lastRefreshedAt) : 'never'}
            </span>
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">Could not load currencies: {error.message}</p> : null}
      <DataTable<CurrencyRateRow>
        testId="currencies-table"
        rows={rates}
        rowKey={(row) => row.code}
        rowTestId={(row) => `currency-row-${row.code}`}
        searchPlaceholder="Search currencies"
        headerExtra={(
          <label className="flex items-center gap-2 text-[13px] text-slate-500">
            Preview
            <input
              type="number"
              min="0"
              step="0.01"
              value={previewUsd}
              onChange={(event) => setPreviewUsd(event.target.value)}
              className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none transition-all focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              data-testid="currencies-preview-input"
              aria-label="Preview price in USD"
            />
            USD
          </label>
        )}
        headerActions={(
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200/60 bg-slate-50 px-3 text-[13px] font-medium text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            data-testid="currencies-refresh"
          >
            <RefreshCw className="h-[15px] w-[15px]" /> {refreshing ? 'Refreshing…' : 'Refresh rates now'}
          </button>
        )}
        createLabel="Add currency"
        createTestId="currencies-add"
        onCreate={() =>
          setEditing({
            isNew: true, code: '', name: '', symbol: '', ratePerUsd: '', originalRate: '', roundTo: '0', active: false,
            isManual: true, originalActive: false, source: 'manual',
          })
        }
        exportName="Currencies"
        loading={loading}
        loadingText="Loading…"
        emptyMessage="No currencies"
        minWidth="900px"
        pageSize={0}
        columns={[
          {
            key: 'code',
            header: 'Currency',
            value: (row) => `${row.code} ${row.name}`,
            sortable: true,
            render: (row) => (
              <>
                <div className="font-semibold">
                  {row.code} <span className="font-normal text-slate-500">{row.symbol}</span>
                </div>
                <div className="text-xs text-slate-500">{row.name}</div>
              </>
            ),
          },
          { key: 'ratePerUsd', header: 'Rate (per 1 USD)', value: (row) => Number(row.ratePerUsd), sortable: true, render: (row) => <span className="font-mono">{row.ratePerUsd}</span> },
          { key: 'roundTo', header: 'Round up to', value: (row) => row.roundTo || 0, render: (row) => (row.roundTo ? `${row.roundTo} ${row.code}` : '-') },
          {
            key: 'preview',
            header: 'Preview',
            value: (row) => (row.previewCents !== null && row.previewCents !== undefined ? formatPrice(row.previewCents, row.code) : '-'),
            render: (row) => (
              <span className="font-semibold" data-testid={`currency-preview-${row.code}`}>
                {row.previewCents !== null && row.previewCents !== undefined ? formatPrice(row.previewCents, row.code) : '-'}
              </span>
            ),
          },
          {
            key: 'source',
            header: 'Rate source',
            value: (row) => SOURCE_LABELS[row.source] || row.source || '-',
            filterable: true,
            render: (row) => (
              <div className="text-xs text-slate-600">
                {SOURCE_LABELS[row.source] || row.source || '-'}
                {row.isManual && row.code !== 'USD' ? (
                  <span className="ml-1 rounded bg-amber-50 px-1.5 text-amber-700">pinned</span>
                ) : null}
                {row.updatedAt ? <div className="text-slate-400">{formatDateTime(row.updatedAt)}</div> : null}
              </div>
            ),
          },
          {
            key: 'active',
            header: 'Offered',
            value: (row) => (row.active ? 'On' : 'Off'),
            filterable: true,
            render: (row) => (
              <button
                type="button"
                disabled={row.code === 'USD' || saving}
                onClick={() => toggleActive(row)}
                title={row.active ? `Stop offering ${row.code}` : `Offer ${row.code}`}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60 ${
                  row.active ? 'bg-sky-500' : 'bg-slate-200'
                }`}
                data-testid={`currency-toggle-${row.code}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-all duration-200 ${row.active ? 'translate-x-4' : 'translate-x-1'}`} />
                <span className="sr-only">{row.active ? 'On' : 'Off'}</span>
              </button>
            ),
          },
        ]}
        rowActions={(row) => (
          <RowActionButton title={`Edit ${row.code}`} icon={<Edit2 />} testId={`currency-edit-${row.code}`} onClick={() => openEdit(row)} />
        )}
      />

      {editing ? (
        <div onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" data-testid="currency-dialog">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="m-0 text-[22px] font-bold tracking-[-0.3px] text-slate-800">{editing.isNew ? 'Add currency' : `Edit ${editing.code}`}</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.02em] text-slate-500">Code</span>
                <input
                  value={editing.code}
                  disabled={!editing.isNew}
                  maxLength={3}
                  onChange={(event) => setEditing({ ...editing, code: event.target.value.toUpperCase() })}
                  className="w-full min-h-9 rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-[7px] text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:shadow-[0_0_0_2.5px_rgba(14,165,233,0.08)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  data-testid="currency-code"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.02em] text-slate-500">Symbol</span>
                <input
                  value={editing.symbol}
                  onChange={(event) => setEditing({ ...editing, symbol: event.target.value })}
                  className="w-full min-h-9 rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-[7px] text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:shadow-[0_0_0_2.5px_rgba(14,165,233,0.08)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.02em] text-slate-500">Name</span>
                <input
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  className="w-full min-h-9 rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-[7px] text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:shadow-[0_0_0_2.5px_rgba(14,165,233,0.08)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.02em] text-slate-500">Rate (units per 1 USD)</span>
                <input
                  value={editing.ratePerUsd}
                  disabled={editing.code === 'USD'}
                  inputMode="decimal"
                  onChange={(event) =>
                    // A typed rate is pinned so the daily refresh keeps it.
                    setEditing({ ...editing, ratePerUsd: event.target.value, isManual: true })
                  }
                  className="w-full min-h-9 rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-[7px] text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:shadow-[0_0_0_2.5px_rgba(14,165,233,0.08)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  data-testid="currency-rate"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.02em] text-slate-500">Round prices up to (whole units)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editing.roundTo}
                  onChange={(event) => setEditing({ ...editing, roundTo: event.target.value })}
                  className="w-full min-h-9 rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-[7px] text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:shadow-[0_0_0_2.5px_rgba(14,165,233,0.08)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  data-testid="currency-round-to"
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
              <button type="button" onClick={() => setEditing(null)} className="h-[42px] rounded-[10px] border-[1.5px] border-slate-300 bg-white px-8 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-55">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-sky-500 to-cyan-400 px-9 text-sm font-bold text-white shadow-[0_2px_8px_rgba(14,165,233,0.25)] transition hover:from-sky-600 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="currency-save"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {dialog}
    </div>
  );
};
