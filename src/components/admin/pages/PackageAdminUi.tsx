import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { AlertTriangle, ArrowRight, Package, RefreshCw, X } from 'lucide-react';
import {
  ADMIN_APPLY_PLAN_TO_SUBSCRIBERS_MUTATION,
  ADMIN_ASSIGN_COMPANY_PLAN_MUTATION,
  ADMIN_PACKAGE_MODULES_QUERY,
  ADMIN_PACKAGE_OPTIONS_QUERY,
} from '../../../lib/graphql';
import { formatPrice } from '../../../lib/admin-utils';
import type { PackageModuleOption } from './PackageBuilder';

/**
 * Package UI shared by the Subscriptions page (Package / Modules columns, Change package)
 * and the Plans page (apply an edited package to its existing subscribers).
 */

export interface CompanyLiveSubscription {
  id: string;
  planId: string | null;
  planName: string | null;
  planVersion: number | null;
  currentPlanVersion: number | null;
  isOutdated: boolean | null;
  status: string | null;
  billingInterval: string | null;
  moduleCodes: string[] | null;
  priceCents: number | null;
  currency: string | null;
  currentPeriodEnd?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
}

export interface CompanyPackage {
  companyId: number;
  companyName?: string | null;
  planId?: string | null;
  activeModules: string[] | null;
  unrestricted: boolean | null;
  liveSubscription: CompanyLiveSubscription | null;
}

interface PackageOption {
  id: string;
  name: string;
  active: boolean;
  version: number;
  availableIntervals: string[] | null;
  modules: { moduleId: string; name: string }[] | null;
  pricing: { currency: string; monthlyPriceCents: number | null; yearlyPriceCents: number | null } | null;
}

export const prettifyModuleCode = (code: string) =>
  code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Loads the module catalog once and exposes an id -> module map. */
export const useModuleCatalog = () => {
  const { data } = useQuery<{ adminModules: PackageModuleOption[] }, Record<string, never>, any>(ADMIN_PACKAGE_MODULES_QUERY, {
    fetchPolicy: 'cache-first',
  });
  return useMemo(() => new Map((data?.adminModules || []).map((m) => [m.id, m])), [data]);
};

/**
 * Collapse a company's module codes to what an admin wants to read: feature areas.
 * A child module is hidden when its parent is also present ("Time & Attendance", not
 * "Timesheets, Attendance, Leave"); a child on its own is shown by name.
 */
export const summarizeModules = (codes: string[], catalog: Map<string, PackageModuleOption>) => {
  const present = new Set(codes);
  return codes
    .filter((code) => {
      const parent = catalog.get(code)?.parentId;
      return !(parent && present.has(parent));
    })
    .map((code) => ({ code, name: catalog.get(code)?.name || prettifyModuleCode(code) }));
};

export const ModuleChips: React.FC<{
  codes: string[];
  catalog: Map<string, PackageModuleOption>;
  max?: number;
  unrestricted?: boolean | null;
}> = ({ codes, catalog, max = 3, unrestricted }) => {
  if (unrestricted && codes.length === 0) {
    return <span className="text-xs font-medium text-slate-500" title="Legacy company without a configured package">All modules (legacy)</span>;
  }
  const items = summarizeModules(codes, catalog);
  if (items.length === 0) return <span className="text-xs text-slate-400">-</span>;
  const shown = items.slice(0, max);
  const hidden = items.length - shown.length;
  return (
    <div className="flex max-w-[240px] flex-wrap gap-1" title={items.map((i) => i.name).join(', ')}>
      {shown.map((item) => (
        <span key={item.code} className="rounded-md border border-sky-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">
          {item.name}
        </span>
      ))}
      {hidden > 0 ? (
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">+{hidden} more</span>
      ) : null}
    </div>
  );
};

export const PackageCell: React.FC<{ pkg?: CompanyPackage | null }> = ({ pkg }) => {
  const sub = pkg?.liveSubscription;
  if (!sub) {
    return <span className="text-xs text-slate-400">{pkg ? 'No live package' : '-'}</span>;
  }
  return (
    <div>
      <div className="font-semibold text-slate-800">{sub.planName || sub.planId || '-'}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
        {sub.billingInterval ? <span className="capitalize">{sub.billingInterval}</span> : null}
        {sub.planVersion ? <span>· v{sub.planVersion}</span> : null}
        {sub.isOutdated ? (
          <span
            className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700"
            title={`Package is now v${sub.currentPlanVersion}; this company still has the v${sub.planVersion} modules`}
          >
            update available
          </span>
        ) : null}
      </div>
    </div>
  );
};

const Modal: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; labelId: string }> = ({
  title,
  subtitle,
  onClose,
  children,
  labelId,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:p-6">
    <div role="dialog" aria-modal="true" aria-labelledby={labelId} className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h3 id={labelId} className="text-lg font-bold text-slate-800">{title}</h3>
          {subtitle ? <p className="mt-0.5 truncate text-[13px] text-slate-400">{subtitle}</p> : null}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </div>
  </div>
);

const diffModules = (before: string[], after: string[]) => ({
  added: after.filter((c) => !before.includes(c)),
  removed: before.filter((c) => !after.includes(c)),
});

/** Admin override: move a company to another package (and interval). */
export const ChangePackageDialog: React.FC<{
  companyId: number;
  companyName: string;
  current?: CompanyPackage | null;
  onClose: () => void;
  onDone: () => void;
  onToast: (type: 'success' | 'error', msg: string) => void;
}> = ({ companyId, companyName, current, onClose, onDone, onToast }) => {
  const catalog = useModuleCatalog();
  const { data, loading } = useQuery<{ adminPlans: PackageOption[] }, Record<string, never>, any>(ADMIN_PACKAGE_OPTIONS_QUERY, { fetchPolicy: 'cache-and-network' });
  const [assign, { loading: saving }] = useMutation<
    { adminAssignCompanyPlan: { success: boolean; message?: string | null } },
    { companyId: number; planId: string; reason: string; billingInterval: string | null },
    any,
    any
  >(ADMIN_ASSIGN_COMPANY_PLAN_MUTATION);

  const options = data?.adminPlans || [];
  const [planId, setPlanId] = useState<string>(current?.liveSubscription?.planId || current?.planId || '');
  const [interval, setInterval] = useState<string>(current?.liveSubscription?.billingInterval || 'monthly');
  const [reason, setReason] = useState('');

  const selected = options.find((o) => o.id === planId) || null;
  const intervals = selected?.availableIntervals?.length ? selected.availableIntervals : ['monthly'];

  useEffect(() => {
    if (selected && !intervals.includes(interval)) setInterval(intervals[0]);
  }, [selected, intervals, interval]);

  // Children of a selected feature area are granted too; compare at feature-area level.
  const currentCodes = current?.activeModules || [];
  const nextCodes = (selected?.modules || []).map((m) => m.moduleId);
  const { added, removed } = diffModules(
    summarizeModules(currentCodes, catalog).map((m) => m.code),
    summarizeModules(nextCodes, catalog).map((m) => m.code),
  );
  const price =
    selected?.pricing && (interval === 'yearly' ? selected.pricing.yearlyPriceCents : selected.pricing.monthlyPriceCents);
  const nameOf = (code: string) => catalog.get(code)?.name || prettifyModuleCode(code);

  const submit = async () => {
    if (!planId) return onToast('error', 'Choose a package');
    if (!reason.trim()) return onToast('error', 'Reason is required to change the package');
    try {
      const res = await assign({ variables: { companyId, planId, reason: reason.trim(), billingInterval: interval } });
      const payload = res.data?.adminAssignCompanyPlan;
      if (!payload?.success) return onToast('error', payload?.message || 'Package could not be changed');
      onToast('success', `${companyName} moved to ${selected?.name || planId}`);
      onDone();
      onClose();
    } catch (err: any) {
      onToast('error', err.message || 'Package could not be changed');
    }
  };

  return (
    <Modal title="Change package" subtitle={companyName} onClose={onClose} labelId="change-package-title">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current</span>
          <div className="mt-1"><PackageCell pkg={current} /></div>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">New package</span>
          <select
            aria-label="New package"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={loading && options.length === 0}
          >
            <option value="">Select a package…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>

        {selected ? (
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700">Billing interval</legend>
            <div className="mt-1 flex gap-2">
              {intervals.map((value) => (
                <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm capitalize ${interval === value ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600'}`}>
                  <input type="radio" name="interval" value={value} checked={interval === value} onChange={() => setInterval(value)} className="sr-only" />
                  {value}
                </label>
              ))}
              {price != null ? (
                <span className="ml-auto self-center text-sm font-semibold text-slate-700">
                  {formatPrice(price, selected.pricing?.currency || 'USD')} / {interval === 'yearly' ? 'yr' : 'mo'}
                </span>
              ) : null}
            </div>
          </fieldset>
        ) : null}

        {selected ? (
          <div className="rounded-xl border border-slate-200 p-3 text-sm" data-testid="package-module-diff">
            {added.length === 0 && removed.length === 0 ? (
              <p className="text-slate-500">Modules stay the same.</p>
            ) : (
              <>
                {added.length ? <p className="text-emerald-700"><strong>Gains:</strong> {added.map(nameOf).join(', ')}</p> : null}
                {removed.length ? (
                  <p className="mt-1 flex items-start gap-1.5 text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                    <span><strong>Loses access to:</strong> {removed.map(nameOf).join(', ')} (data is kept, not deleted)</span>
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Reason</span>
          <textarea
            aria-label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. Customer upgraded by phone"
          />
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !planId}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <Package className="h-4 w-4" />
            {saving ? 'Saving…' : 'Change package'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface SubscriberChange {
  companyId: number;
  companyName: string;
  fromVersion: number;
  toVersion: number;
  added: string[];
  removed: string[];
}

interface ApplyPayload {
  success: boolean;
  message?: string | null;
  dryRun: boolean;
  updatedCount: number;
  changes: SubscriberChange[];
}

/** Preview (dry run) and then push a package's current modules to its existing subscribers. */
export const ApplyToSubscribersDialog: React.FC<{
  planId: string;
  planName: string;
  onClose: () => void;
  onDone: () => void;
  onToast: (type: 'success' | 'error', msg: string) => void;
}> = ({ planId, planName, onClose, onDone, onToast }) => {
  const catalog = useModuleCatalog();
  const [run, { loading }] = useMutation<
    { adminApplyPlanToSubscribers: ApplyPayload },
    { planId: string; reason?: string; onlyOutdated: boolean; dryRun: boolean },
    any,
    any
  >(ADMIN_APPLY_PLAN_TO_SUBSCRIBERS_MUTATION);
  const [preview, setPreview] = useState<ApplyPayload | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    run({ variables: { planId, onlyOutdated: true, dryRun: true } })
      .then((res) => setPreview(res.data?.adminApplyPlanToSubscribers || null))
      .catch((err) => onToast('error', err.message || 'Could not load subscribers'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const nameOf = (code: string) => catalog.get(code)?.name || prettifyModuleCode(code);
  const summarize = (codes: string[]) => summarizeModules(codes, catalog).map((m) => m.name).join(', ');

  const apply = async () => {
    try {
      const res = await run({ variables: { planId, reason: reason.trim() || undefined, onlyOutdated: true, dryRun: false } });
      const payload = res.data?.adminApplyPlanToSubscribers;
      if (!payload?.success) return onToast('error', payload?.message || 'Could not apply the package');
      onToast('success', payload.message || `Applied to ${payload.updatedCount} subscriber(s)`);
      onDone();
      onClose();
    } catch (err: any) {
      onToast('error', err.message || 'Could not apply the package');
    }
  };

  const changes = preview?.changes || [];
  return (
    <Modal title="Apply package to existing subscribers" subtitle={planName} onClose={onClose} labelId="apply-subscribers-title">
      {!preview ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" /> Checking subscribers…</p>
      ) : !preview.success ? (
        <p className="text-sm text-amber-700">{preview.message}</p>
      ) : changes.length === 0 ? (
        <p className="text-sm text-slate-600">Every subscriber already has the current version of this package.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <strong>{changes.length}</strong> compan{changes.length === 1 ? 'y is' : 'ies are'} still on an older version of <strong>{planName}</strong>.
            Their modules will be replaced with the package's current modules. <strong>Prices do not change.</strong>
          </p>
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 text-sm" data-testid="apply-subscriber-changes">
            {changes.map((c) => (
              <li key={c.companyId} className="px-3 py-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  {c.companyName}
                  <span className="ml-auto flex items-center gap-1 text-xs font-normal text-slate-500">
                    v{c.fromVersion} <ArrowRight className="h-3 w-3" /> v{c.toVersion}
                  </span>
                </div>
                {c.added.length ? <div className="text-xs text-emerald-700">+ {summarize(c.added) || c.added.map(nameOf).join(', ')}</div> : null}
                {c.removed.length ? <div className="text-xs text-red-700">− {summarize(c.removed) || c.removed.map(nameOf).join(', ')}</div> : null}
                {!c.added.length && !c.removed.length ? <div className="text-xs text-slate-500">Version bump only (modules unchanged)</div> : null}
              </li>
            ))}
          </ul>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Reason (optional)</span>
            <input
              aria-label="Apply reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Added Accounting to Growth"
            />
          </label>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          {changes.length ? 'Not now' : 'Close'}
        </button>
        {changes.length ? (
          <button
            type="button"
            onClick={apply}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            {loading ? 'Applying…' : `Apply to ${changes.length} subscriber${changes.length === 1 ? '' : 's'}`}
          </button>
        ) : null}
      </div>
    </Modal>
  );
};
