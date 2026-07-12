import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  ADMIN_COMPANIES_QUERY,
  ADMIN_MODULES_QUERY,
  ADMIN_SET_COMPANY_MODULES_MUTATION,
  ADMIN_ASSIGN_COMPANY_PLAN_MUTATION,
  ADMIN_UPDATE_COMPANY_DETAIL_MUTATION,
  ADMIN_COMPANY_PAYMENT_HISTORY_QUERY,
  ADMIN_UPDATE_PAYMENT_STATUS_MUTATION,
  ADMIN_REQUEST_REFUND_MUTATION,
  ADMIN_MANUAL_SUBSCRIPTION_MUTATION,
} from '../../../lib/graphql';
import { buildPayload, formatDate, formatDateTime, formatPrice, toDateTimeLocalValue, parseModules } from '../../../lib/admin-utils';
import { Download, Edit2, Save, X, ClipboardList, Eye, Filter, HandCoins, Clipboard, Printer, Search } from 'lucide-react';
import { buildColumnFilterOptions, ColumnFilter, matchesColumnFilter } from '../ColumnFilter';

interface EditingCompanyDetail {
  id: number;
  company: string;
  planId: string;
  originalPlanId: string;
  modules: string[];
  originalSubscriptionStatus: string;
  subscriptionStatus: string;
  isActive?: boolean | null;
  isSuspended?: boolean | null;
  suspensionScope?: string | null;
  suspensionReason?: string | null;
  suspendedFrom?: string | null;
  suspendedUntil?: string | null;
  subscriptionStatusReason: string;
  subscriptionDueDate: string;
  subscriptionRecurringDate: string;
  isMultiLocationEnabled: boolean;
}

interface CompanyType {
  id: number;
  company: string;
  planId?: string | null;
  planName?: string | null;
  employeeCount?: number | null;
  activeModules: string;
  latestPaymentModules?: string | null;
  createdAt: string;
  isMultiLocationEnabled: boolean;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  nextBillingDate?: string | null;
  nextBillingAmountCents?: number | null;
  subscriptionDueDate: string | null;
  subscriptionRecurringDate: string | null;
  paymentHistoryCount?: number;
  latestPaymentStatus?: string | null;
  latestPaymentIntentId?: string | null;
  latestPaymentEmail?: string | null;
  latestPaymentAmount?: number | null;
  latestPaymentPlanId?: string | null;
  latestPaymentPlanName?: string | null;
  latestPaymentEmployeeCountSnapshot?: number | null;
  latestPaymentFinalAmountCents?: number | null;
  latestPaymentCurrency?: string | null;
  latestPaymentSource?: string | null;
  latestPaymentDeniedReason?: string | null;
  latestPaymentGatewayMethod?: string | null;
  latestPaymentGatewayRefReceiverMedium?: string | null;
  latestPaymentGatewayRefSenderMedium?: string | null;
  latestPaymentGatewayStatus?: string | null;
  latestPaymentCreatedAt?: string | null;
}

interface ModuleType {
  id: string;
  name: string;
  description?: string;
}

interface CompanyPaymentType {
  paymentIntentId: string;
  email: string;
  planId?: string | null;
  planName?: string | null;
  employeeCountSnapshot?: number | null;
  originalAmountCents?: number | null;
  finalAmountCents?: number | null;
  trialEndsAt?: string | null;
  modules?: string;
  status: string;
  amount: number;
  currency: string;
  companyId?: number;
  companyName?: string;
  source?: string;
  updatedAt?: string;
  createdAt: string;
  dueDate: string | null;
  recurringDate: string | null;
  deniedReason: string | null;
  gatewayMethod?: string | null;
  gatewayRefReceiverMedium?: string | null;
  gatewayRefSenderMedium?: string | null;
  gatewayPayload?: string | null;
  paymentGatewayStatus?: string | null;
}

type CompanySortKey =
  | 'company'
  | 'subscriptionStatus'
  | 'planName'
  | 'latestPaymentEmail'
  | 'subscriptionDueDate'
  | 'subscriptionRecurringDate'
  | 'latestPaymentGatewayMethod'
  | 'createdAt';
type SortDirection = 'asc' | 'desc' | null;

const planOptions = [
  { id: 'free', name: 'Free' },
  { id: 'premium', name: 'Premium' },
];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const downloadTextFile = (filename: string, mimeType: string, content: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const Companies: React.FC<{onToast: (type: 'success'|'error', msg: string) => void}> = ({ onToast }) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<CompanySortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusSelections, setStatusSelections] = useState<string[]>([]);
  const [planSelections, setPlanSelections] = useState<string[]>([]);
  const [emailSelections, setEmailSelections] = useState<string[]>([]);
  const [dueDateSelections, setDueDateSelections] = useState<string[]>([]);
  const [recurringDateSelections, setRecurringDateSelections] = useState<string[]>([]);
  const [gatewaySelections, setGatewaySelections] = useState<string[]>([]);
  const [moduleSelections, setModuleSelections] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [viewingCompany, setViewingCompany] = useState<CompanyType | null>(null);
  const [editingDetail, setEditingDetail] = useState<EditingCompanyDetail | null>(null);
  const [selectedHistoryFor, setSelectedHistoryFor] = useState<number | null>(null);
  const [historyStatus, setHistoryStatus] = useState('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<CompanyPaymentType | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [manualSource, setManualSource] = useState('portal');
  const [manualMethod, setManualMethod] = useState('card');
  const [manualReceiver, setManualReceiver] = useState('');
  const [manualSender, setManualSender] = useState('');
  const [manualReason, setManualReason] = useState('');
  const subscriptionStatusOptions = [
    { value: 'trial', label: 'Trial', description: 'Temporary access before paid activation' },
    { value: 'active', label: 'Active', description: 'Paid or approved subscription access' },
    { value: 'pending', label: 'Pending', description: 'Payment or approval is still in progress' },
    { value: 'past_due', label: 'Past due', description: 'Payment is overdue or needs attention' },
    { value: 'suspended', label: 'Suspended', description: 'Temporarily blocked or limited by superadmin' },
    { value: 'failed', label: 'Failed', description: 'Latest subscription payment failed' },
    { value: 'refunded', label: 'Refunded', description: 'Subscription payment was refunded' },
    { value: 'canceled', label: 'Canceled', description: 'Subscription access is canceled' },
  ];
  const companyQueryVariables = useMemo(() => ({
    search: search.trim() || null,
    status: null,
    subscriptionStatus: null,
    dueDateFrom: null,
    dueDateTo: null,
    recurringDateFrom: null,
    recurringDateTo: null,
  }), [search]);

  const { data: companiesData, loading: companiesLoading, error: companiesError, refetch: refetchCompanies } = useQuery<
    { adminCompanies: CompanyType[] },
    {
      search: string | null;
      status: string | null;
      subscriptionStatus: string | null;
      dueDateFrom: string | null;
      dueDateTo: string | null;
      recurringDateFrom: string | null;
      recurringDateTo: string | null;
    },
    any
  >(ADMIN_COMPANIES_QUERY, {
    fetchPolicy: 'cache-and-network',
    variables: companyQueryVariables,
  });

  const { data: modulesData, loading: modulesLoading, error: modulesError } = useQuery<
    { adminModules: ModuleType[] },
    { includeInactive: boolean },
    any
  >(ADMIN_MODULES_QUERY, {
    variables: { includeInactive: false }
  });

  const { data: historyData, loading: historyLoading, refetch: refetchHistory } = useQuery<
    { adminCompanyPaymentHistory: CompanyPaymentType[] },
    { companyId: number; dateFrom: string | null; dateTo: string | null; status: string | null },
    any
  >(ADMIN_COMPANY_PAYMENT_HISTORY_QUERY, {
    variables: {
      companyId: selectedHistoryFor || -1,
      dateFrom: historyDateFrom || null,
      dateTo: historyDateTo || null,
      status: historyStatus === 'all' ? null : historyStatus,
    },
    skip: selectedHistoryFor === null,
  });

  const [setCompanyModules] = useMutation(ADMIN_SET_COMPANY_MODULES_MUTATION);
  const [assignCompanyPlan] = useMutation(ADMIN_ASSIGN_COMPANY_PLAN_MUTATION);
  const [updateCompanyDetail] = useMutation(ADMIN_UPDATE_COMPANY_DETAIL_MUTATION);
  const [updatePaymentStatus] = useMutation(ADMIN_UPDATE_PAYMENT_STATUS_MUTATION);
  const [requestRefund] = useMutation(ADMIN_REQUEST_REFUND_MUTATION);
  const [manualProcess] = useMutation(ADMIN_MANUAL_SUBSCRIPTION_MUTATION);

  const rawCompanies = companiesData?.adminCompanies || [];
  const allModules = modulesData?.adminModules || [];
  const historyItems = historyData?.adminCompanyPaymentHistory || [];
  const paymentStatuses = ['pending', 'succeeded', 'failed', 'refunded'] as const;
  const normalizeStatus = (status?: string | null) => (status || '').trim().toLowerCase();
  const getEffectiveSubscriptionStatus = (company: CompanyType) => {
    const latestPaymentStatus = normalizeStatus(company.latestPaymentStatus);
    const subscriptionStatus = normalizeStatus(company.subscriptionStatus);
    if (latestPaymentStatus === 'succeeded') return 'active';
    if (latestPaymentStatus) return latestPaymentStatus;
    return subscriptionStatus || 'trial';
  };
  const getModuleName = (moduleId: string) => allModules.find((module) => module.id === moduleId)?.name || moduleId;
  const getCompanyPlanId = (company: CompanyType) =>
    company.planId || company.latestPaymentPlanId || (parseModules(company.activeModules).length > 0 ? 'premium' : 'free');
  const getCompanyPlanName = (company: CompanyType) =>
    company.planName || company.latestPaymentPlanName || planOptions.find((plan) => plan.id === getCompanyPlanId(company))?.name || '-';
  const renderModulePills = (moduleIds: string[], tone: 'active' | 'payment' = 'active') => {
    if (moduleIds.length === 0) return <span className="text-slate-400 text-sm">No modules</span>;

    const className =
      tone === 'payment'
        ? 'inline-block px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full leading-tight'
        : 'inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full leading-tight';

    return moduleIds.map((moduleId) => (
      <span key={moduleId} className={className}>
        {getModuleName(moduleId)}
      </span>
    ));
  };
  const getStatusBadgeClass = (status: string) => {
    if (status === 'active' || status === 'succeeded') return 'bg-emerald-50 text-emerald-700';
    if (status === 'pending' || status === 'trial') return 'bg-yellow-50 text-yellow-700';
    if (status === 'failed' || status === 'past_due') return 'bg-red-50 text-red-700';
    return 'bg-slate-100 text-slate-700';
  };
  const getCompanyGatewayLabel = (company: CompanyType) =>
    company.latestPaymentGatewayMethod || company.latestPaymentSource || '-';
  const getPaymentGatewayLabel = (payment: CompanyPaymentType) =>
    payment.gatewayMethod || payment.source || '-';
  const getCompanyModuleFilterValue = (company: CompanyType) => {
    const moduleIds = parseModules(company.activeModules);
    const latestPaymentModuleIds = parseModules(company.latestPaymentModules || '');
    const effectiveModuleIds = moduleIds.length > 0 ? moduleIds : latestPaymentModuleIds;
    return effectiveModuleIds.map((moduleId) => getModuleName(moduleId)).join(', ') || 'No entitlements';
  };
  const clearFilters = () => {
    setSearch('');
    setStatusSelections([]);
    setPlanSelections([]);
    setEmailSelections([]);
    setDueDateSelections([]);
    setRecurringDateSelections([]);
    setGatewaySelections([]);
    setModuleSelections([]);
  };
  const normalizedSearch = search.trim().toLowerCase();
  const companyStatusOptions = useMemo(
    () => buildColumnFilterOptions(rawCompanies, (company) => getEffectiveSubscriptionStatus(company)),
    [rawCompanies],
  );
  const companyPlanOptions = useMemo(
    () => buildColumnFilterOptions(rawCompanies, (company) => getCompanyPlanName(company)),
    [rawCompanies],
  );
  const companyEmailOptions = useMemo(
    () => buildColumnFilterOptions(rawCompanies, (company) => company.latestPaymentEmail || '-'),
    [rawCompanies],
  );
  const companyDueOptions = useMemo(
    () => buildColumnFilterOptions(rawCompanies, (company) => formatDate(company.subscriptionDueDate)),
    [rawCompanies],
  );
  const companyRecurringOptions = useMemo(
    () => buildColumnFilterOptions(rawCompanies, (company) => formatDate(company.subscriptionRecurringDate)),
    [rawCompanies],
  );
  const companyGatewayOptions = useMemo(
    () => buildColumnFilterOptions(rawCompanies, (company) => getCompanyGatewayLabel(company)),
    [rawCompanies],
  );
  const companyModuleOptions = useMemo(
    () => buildColumnFilterOptions(rawCompanies, (company) => getCompanyModuleFilterValue(company)),
    [rawCompanies, allModules],
  );
  const companies = useMemo(() => (
    rawCompanies.filter((company) => {
      const moduleIds = parseModules(company.activeModules);
      const latestPaymentModuleIds = parseModules(company.latestPaymentModules || '');
      const moduleText = [...moduleIds, ...latestPaymentModuleIds]
        .map((moduleId) => getModuleName(moduleId))
        .join(' ')
        .toLowerCase();
      const planText = [getCompanyPlanId(company), getCompanyPlanName(company)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const gatewayText = [
        company.latestPaymentGatewayMethod,
        company.latestPaymentSource,
        company.latestPaymentGatewayStatus,
        company.latestPaymentGatewayRefReceiverMedium,
        company.latestPaymentGatewayRefSenderMedium,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const searchableText = [
        company.company,
        company.id,
        company.latestPaymentEmail,
        company.latestPaymentIntentId,
        getEffectiveSubscriptionStatus(company),
        planText,
        gatewayText,
        moduleText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (normalizedSearch && !searchableText.includes(normalizedSearch)) return false;
      if (!matchesColumnFilter(statusSelections, getEffectiveSubscriptionStatus(company))) return false;
      if (!matchesColumnFilter(planSelections, getCompanyPlanName(company))) return false;
      if (!matchesColumnFilter(emailSelections, company.latestPaymentEmail || '-')) return false;
      if (!matchesColumnFilter(dueDateSelections, formatDate(company.subscriptionDueDate))) return false;
      if (!matchesColumnFilter(recurringDateSelections, formatDate(company.subscriptionRecurringDate))) return false;
      if (!matchesColumnFilter(gatewaySelections, getCompanyGatewayLabel(company))) return false;
      if (!matchesColumnFilter(moduleSelections, getCompanyModuleFilterValue(company))) return false;
      return true;
    }).sort((left, right) => {
      if (!sortKey || !sortDirection) return 0;

      const readValue = (company: CompanyType): string | number => {
        switch (sortKey) {
          case 'company':
            return company.company || '';
          case 'subscriptionStatus':
            return getEffectiveSubscriptionStatus(company);
          case 'planName':
            return getCompanyPlanName(company);
          case 'latestPaymentEmail':
            return company.latestPaymentEmail || '';
          case 'subscriptionDueDate':
            return company.subscriptionDueDate ? new Date(company.subscriptionDueDate).getTime() : 0;
          case 'subscriptionRecurringDate':
            return company.subscriptionRecurringDate ? new Date(company.subscriptionRecurringDate).getTime() : 0;
          case 'latestPaymentGatewayMethod':
            return getCompanyGatewayLabel(company);
          case 'createdAt':
            return company.createdAt ? new Date(company.createdAt).getTime() : 0;
          default:
            return '';
        }
      };

      const leftValue = readValue(left);
      const rightValue = readValue(right);
      const comparison =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: 'base' });

      return sortDirection === 'asc' ? comparison : -comparison;
    })
  ), [
    rawCompanies,
    normalizedSearch,
    statusSelections,
    planSelections,
    emailSelections,
    dueDateSelections,
    recurringDateSelections,
    gatewaySelections,
    moduleSelections,
    allModules,
    sortKey,
    sortDirection,
  ]);

  const cycleSort = (key: CompanySortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
      return;
    }
    if (sortDirection === 'asc') {
      setSortDirection('desc');
      return;
    }
    if (sortDirection === 'desc') {
      setSortDirection(null);
      return;
    }
    setSortDirection('asc');
  };

  const SortHeader = ({ label, sort }: { label: string; sort: CompanySortKey }) => {
    const active = sortKey === sort && sortDirection;
    return (
      <button
        type="button"
        onClick={() => cycleSort(sort)}
        className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-cyan-700"
      >
        <span>{label}</span>
        <span className={`text-xs ${active ? 'text-cyan-700' : 'text-slate-400'}`}>
          {active ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    );
  };

  const exportCompanies = () => {
    const rows = companies.map((company) => [
      company.company,
      getEffectiveSubscriptionStatus(company),
      getCompanyPlanName(company),
      company.latestPaymentEmail || '-',
      formatDate(company.subscriptionDueDate),
      formatDate(company.subscriptionRecurringDate),
      getCompanyGatewayLabel(company),
      formatPrice(company.latestPaymentFinalAmountCents ?? company.latestPaymentAmount ?? 0, company.latestPaymentCurrency || 'USD'),
    ]);
    const header = ['Company', 'Subscription Status', 'Plan', 'Email', 'Due Date', 'Recurring Date', 'Gateway', 'Latest Amount'];
    const table = [header, ...rows]
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ''))}</td>`).join('')}</tr>`)
      .join('');
    downloadTextFile(
      `companies-${new Date().toISOString().slice(0, 10)}.xls`,
      'application/vnd.ms-excel',
      `<table>${table}</table>`
    );
  };

  const printCompanies = () => {
    const rows = companies.map((company) => `
      <tr>
        <td>${escapeHtml(company.company)}</td>
        <td>${escapeHtml(getEffectiveSubscriptionStatus(company))}</td>
        <td>${escapeHtml(getCompanyPlanName(company))}</td>
        <td>${escapeHtml(company.latestPaymentEmail || '-')}</td>
        <td>${escapeHtml(formatDate(company.subscriptionDueDate))}</td>
        <td>${escapeHtml(formatDate(company.subscriptionRecurringDate))}</td>
        <td>${escapeHtml(getCompanyGatewayLabel(company))}</td>
      </tr>
    `).join('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      onToast('error', 'Popup blocked. Please allow popups to print companies.');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Companies</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 20px; margin-bottom: 16px; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Companies</h1>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Subscription Status</th>
                <th>Plan</th>
                <th>Email</th>
                <th>Due Date</th>
                <th>Recurring Date</th>
                <th>Gateway</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (companiesLoading || modulesLoading) {
    return <div className="text-center py-12 text-slate-500">Loading companies...</div>;
  }

  if (companiesError) {
    return <div className="text-center py-12 text-red-600">Error: {companiesError.message}</div>;
  }

  if (modulesError) {
    return <div className="text-center py-12 text-red-600">Error loading modules: {modulesError.message}</div>;
  }

  const handleSaveCompany = async () => {
    if (!editingDetail) return;
    const statusChanged = normalizeStatus(editingDetail.subscriptionStatus) !== normalizeStatus(editingDetail.originalSubscriptionStatus);
    if (statusChanged && !editingDetail.subscriptionStatusReason.trim()) {
      onToast('error', 'Please add a reason for changing subscription status');
      return;
    }
    try {
      await updateCompanyDetail({
        variables: {
          input: {
            id: editingDetail.id,
            company: editingDetail.company,
            subscriptionStatus: editingDetail.subscriptionStatus,
            subscriptionDueDate: editingDetail.subscriptionDueDate || null,
            subscriptionRecurringDate: editingDetail.subscriptionRecurringDate || null,
            isMultiLocationEnabled: editingDetail.isMultiLocationEnabled,
          },
        },
      });
      if (editingDetail.planId !== editingDetail.originalPlanId) {
        await assignCompanyPlan({
          variables: {
            companyId: editingDetail.id,
            planId: editingDetail.planId,
            reason: editingDetail.subscriptionStatusReason || 'Admin plan change',
          },
        });
      }
      await setCompanyModules({
        variables: {
          companyId: editingDetail.id,
          modules: editingDetail.modules,
        },
      });
      onToast('success', 'Company detail updated');
      setEditingDetail(null);
      refetchCompanies();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to update company details');
    }
  };

  const handleOpenHistory = (companyId: number) => {
    setSelectedHistoryFor(companyId);
    setSelectedPayment(null);
    setRefundReason('');
    setRefundAmount('');
    setManualReason('');
    setManualReceiver('');
    setManualSender('');
  };

  const closeCompanyView = () => {
    setViewingCompany(null);
    setSelectedHistoryFor(null);
    setSelectedPayment(null);
  };

  const handlePaymentStatusChange = async (paymentIntentId: string, status: string) => {
    try {
      await updatePaymentStatus({
        variables: {
          paymentIntentId,
          status,
          reason: status === 'failed' ? 'manual_update_failed' : null,
        },
      });
      onToast('success', 'Payment status updated');
      refetchHistory();
      refetchCompanies();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to update payment status');
    }
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;
    try {
      await requestRefund({
        variables: {
          paymentIntentId: selectedPayment.paymentIntentId,
          reason: refundReason || 'Admin requested refund',
          amount: refundAmount ? Math.round(parseFloat(refundAmount) * 100) : null,
        },
      });
      onToast('success', 'Refund requested');
      setSelectedPayment(null);
      setRefundReason('');
      setRefundAmount('');
      refetchHistory();
      refetchCompanies();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to request refund');
    }
  };

  const handleManualSubscription = async () => {
    if (!selectedPayment || !selectedHistoryFor) return;
    try {
      await manualProcess({
        variables: {
          companyId: selectedPayment.companyId || selectedHistoryFor,
          subscriptionId: selectedPayment.paymentIntentId,
          source: manualSource,
          paymentMethod: manualMethod,
          receiverMedium: manualReceiver,
          senderMedium: manualSender,
          gatewayPayload: JSON.stringify({
            paymentIntentId: selectedPayment.paymentIntentId,
            method: manualMethod,
            reason: manualReason,
            source: manualSource,
          }),
          reason: manualReason,
        },
      });
      onToast('success', 'Manual subscription action submitted');
      setManualReason('');
      setManualReceiver('');
      setManualSender('');
      refetchHistory();
      refetchCompanies();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to process manual subscription action');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Companies</h2>
        <p className="text-slate-600">Manage tenants, plan assignments, subscriptions, and legacy entitlements</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
            <div className="relative md:min-w-[280px] md:flex-[1_1_320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <label htmlFor="company-search" className="sr-only">Search companies</label>
              <input
                id="company-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies, email, payment..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => {
                if (open) {
                  setStatusSelections([]);
                  setPlanSelections([]);
                  setEmailSelections([]);
                  setDueDateSelections([]);
                  setRecurringDateSelections([]);
                  setGatewaySelections([]);
                  setModuleSelections([]);
                }
                return !open;
              })}
              aria-pressed={filtersOpen}
              title="Filters"
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${
                filtersOpen
                  ? 'border-cyan-400 bg-cyan-50 text-cyan-600'
                  : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-cyan-300 hover:text-cyan-500'
              }`}
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={exportCompanies}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <Download className="h-4 w-4" />
              Excel
            </button>
            <button
              type="button"
              onClick={printCompanies}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              <Printer className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {companies.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {search || statusSelections.length > 0 || planSelections.length > 0 || emailSelections.length > 0 || dueDateSelections.length > 0 || recurringDateSelections.length > 0 || gatewaySelections.length > 0 || moduleSelections.length > 0
              ? 'No companies match your filters'
              : 'No companies found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4"><SortHeader label="Company" sort="company" /></th>
                  <th className="text-left py-3 px-4"><SortHeader label="Subscription Status" sort="subscriptionStatus" /></th>
                  <th className="text-left py-3 px-4"><SortHeader label="Plan" sort="planName" /></th>
                  <th className="text-left py-3 px-4"><SortHeader label="Email" sort="latestPaymentEmail" /></th>
                  <th className="text-left py-3 px-4"><SortHeader label="Due Date" sort="subscriptionDueDate" /></th>
                  <th className="text-left py-3 px-4"><SortHeader label="Recurring Date" sort="subscriptionRecurringDate" /></th>
                  <th className="text-left py-3 px-4"><SortHeader label="Gateway" sort="latestPaymentGatewayMethod" /></th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Entitlements</th>
                  <th className="sticky right-0 z-10 bg-slate-50 text-right py-3 px-4 font-semibold text-slate-700">Actions</th>
                </tr>
                {filtersOpen ? (
                <tr className="border-t border-slate-200 bg-white">
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2">
                    <ColumnFilter
                      label="Subscription Status"
                      options={companyStatusOptions}
                      selectedValues={statusSelections}
                      onChange={setStatusSelections}
                    />
                  </th>
                  <th className="px-4 py-2">
                    <ColumnFilter
                      label="Plan"
                      options={companyPlanOptions}
                      selectedValues={planSelections}
                      onChange={setPlanSelections}
                    />
                  </th>
                  <th className="px-4 py-2">
                    <ColumnFilter
                      label="Email"
                      options={companyEmailOptions}
                      selectedValues={emailSelections}
                      onChange={setEmailSelections}
                    />
                  </th>
                  <th className="px-4 py-2">
                    <ColumnFilter
                      label="Due Date"
                      options={companyDueOptions}
                      selectedValues={dueDateSelections}
                      onChange={setDueDateSelections}
                    />
                  </th>
                  <th className="px-4 py-2">
                    <ColumnFilter
                      label="Recurring Date"
                      options={companyRecurringOptions}
                      selectedValues={recurringDateSelections}
                      onChange={setRecurringDateSelections}
                    />
                  </th>
                  <th className="px-4 py-2">
                    <ColumnFilter
                      label="Gateway"
                      options={companyGatewayOptions}
                      selectedValues={gatewaySelections}
                      onChange={setGatewaySelections}
                    />
                  </th>
                  <th className="px-4 py-2">
                    <ColumnFilter
                      label="Entitlements"
                      options={companyModuleOptions}
                      selectedValues={moduleSelections}
                      onChange={setModuleSelections}
                    />
                  </th>
                  <th className="sticky right-0 z-10 bg-white px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Clear
                    </button>
                  </th>
                </tr>
                ) : null}
              </thead>
              <tbody>
                {companies.map((company) => {
                  const moduleIds = parseModules(company.activeModules);
                  const latestPaymentModuleIds = parseModules(company.latestPaymentModules || '');
                  const shouldShowLatestPaidModules =
                    moduleIds.length === 0 && company.latestPaymentStatus === 'succeeded' && latestPaymentModuleIds.length > 0;
                  const effectiveSubscriptionStatus = getEffectiveSubscriptionStatus(company);
                  const planName = getCompanyPlanName(company);
                  return (
                    <tr key={company.id} className="group border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-800 max-w-[180px] truncate" title={company.company}>{company.company}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm ${getStatusBadgeClass(effectiveSubscriptionStatus)}`}>
                          {effectiveSubscriptionStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-semibold text-slate-800">{planName}</div>
                        {company.employeeCount ?? company.latestPaymentEmployeeCountSnapshot ? (
                          <div className="text-xs text-slate-500">
                            {company.employeeCount ?? company.latestPaymentEmployeeCountSnapshot} employees
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-[200px] truncate" title={company.latestPaymentEmail || '-'}>{company.latestPaymentEmail || '-'}</td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{formatDate(company.subscriptionDueDate)}</td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{formatDate(company.subscriptionRecurringDate)}</td>
                      <td className="py-3 px-4 text-slate-700">
                        <div>{getCompanyGatewayLabel(company)}</div>
                        <div className="text-xs text-slate-500">{company.latestPaymentGatewayStatus || '-'}</div>
                      </td>
                      <td className="py-3 px-4 max-w-[280px]">
                        <div className="flex flex-wrap gap-1">
                          {shouldShowLatestPaidModules ? renderModulePills(latestPaymentModuleIds, 'payment') : renderModulePills(moduleIds)}
                        </div>
                        {shouldShowLatestPaidModules && (
                          <div className="text-xs text-amber-700 mt-1">Latest paid modules</div>
                        )}
                      </td>
                      <td className="sticky right-0 bg-white py-3 px-4 group-hover:bg-slate-50">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        <button
                          title="View Company"
                          onClick={() => {
                            setViewingCompany(company);
                            handleOpenHistory(company.id);
                          }}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          title="Edit Company"
                          onClick={() =>
                            setEditingDetail({
                              id: company.id,
                              company: company.company,
                              planId: getCompanyPlanId(company),
                              originalPlanId: getCompanyPlanId(company),
                              modules: moduleIds,
                              originalSubscriptionStatus: getEffectiveSubscriptionStatus(company),
                              subscriptionStatus: getEffectiveSubscriptionStatus(company),
                              subscriptionStatusReason: '',
                              subscriptionDueDate: company.subscriptionDueDate || '',
                              subscriptionRecurringDate: company.subscriptionRecurringDate || '',
                              isMultiLocationEnabled: company.isMultiLocationEnabled,
                            })
                          }
                          className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingDetail && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-700">Edit Company</h3>
              <button
                className="px-2 py-1 text-slate-500 hover:text-slate-700"
                onClick={() => setEditingDetail(null)}
                title="Close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="company-name" className="block text-sm text-slate-700 mb-1">Company Name</label>
                <input
                  id="company-name"
                  type="text"
                  value={editingDetail.company}
                  onChange={(event) => setEditingDetail({ ...editingDetail, company: event.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="company-subscription-status" className="block text-sm text-slate-700 mb-1">Subscription Status</label>
                <select
                  id="company-subscription-status"
                  value={editingDetail.subscriptionStatus}
                  onChange={(event) =>
                    setEditingDetail({
                      ...editingDetail,
                      subscriptionStatus: event.target.value,
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  {subscriptionStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {subscriptionStatusOptions.find((status) => status.value === editingDetail.subscriptionStatus)?.description}
                </p>
              </div>
              <div>
                <label htmlFor="company-plan" className="block text-sm text-slate-700 mb-1">Subscription Plan</label>
                <select
                  id="company-plan"
                  value={editingDetail.planId}
                  onChange={(event) =>
                    setEditingDetail({
                      ...editingDetail,
                      planId: event.target.value,
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  {planOptions.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Plan drives billing. Legacy modules below remain available during migration.
                </p>
              </div>
              {normalizeStatus(editingDetail.subscriptionStatus) !== normalizeStatus(editingDetail.originalSubscriptionStatus) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-800">Status change</span>
                    <span className="px-2 py-1 rounded-full bg-white text-slate-700 border border-amber-200">
                      {editingDetail.originalSubscriptionStatus}
                    </span>
                    <span className="text-amber-700">to</span>
                    <span className="px-2 py-1 rounded-full bg-white text-slate-700 border border-amber-200">
                      {editingDetail.subscriptionStatus}
                    </span>
                  </div>
                  <label className="block">
                    <span className="block text-sm font-medium text-slate-700 mb-1">Reason for change</span>
                    <textarea
                      aria-label="Reason for change"
                      rows={3}
                      value={editingDetail.subscriptionStatusReason}
                      onChange={(event) =>
                        setEditingDetail({ ...editingDetail, subscriptionStatusReason: event.target.value })
                      }
                      placeholder="Example: Payment confirmed by bank transfer, customer requested cancellation, refund completed..."
                      className="w-full border border-amber-200 rounded-lg px-3 py-2 bg-white"
                    />
                  </label>
                  <p className="text-xs text-amber-700">
                    This reason is required before saving. Backend audit storage needs support to persist it.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="company-subscription-due-date" className="block text-sm text-slate-700 mb-1">Due Date</label>
                  <input
                    id="company-subscription-due-date"
                    type="datetime-local"
                    value={toDateTimeLocalValue(editingDetail.subscriptionDueDate)}
                    onChange={(event) =>
                      setEditingDetail({
                        ...editingDetail,
                        subscriptionDueDate: event.target.value ? new Date(event.target.value).toISOString() : '',
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="company-subscription-recurring-date" className="block text-sm text-slate-700 mb-1">Recurring Date</label>
                  <input
                    id="company-subscription-recurring-date"
                    type="datetime-local"
                    value={toDateTimeLocalValue(editingDetail.subscriptionRecurringDate)}
                    onChange={(event) =>
                      setEditingDetail({
                        ...editingDetail,
                        subscriptionRecurringDate: event.target.value ? new Date(event.target.value).toISOString() : '',
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <label className="flex items-center gap-2 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={editingDetail.isMultiLocationEnabled}
                    onChange={(event) =>
                      setEditingDetail({ ...editingDetail, isMultiLocationEnabled: event.target.checked })
                    }
                  />
                  <span className="text-sm text-slate-700">Multi-location enabled</span>
                </label>
              </div>
              <div>
                <p className="font-semibold text-slate-700 mb-2">Legacy Entitlements</p>
                <div className="space-y-2 max-h-[32vh] overflow-auto border border-slate-200 rounded-lg p-2">
                  {allModules.map((module) => (
                    <label key={module.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingDetail.modules.includes(module.id)}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setEditingDetail({
                              ...editingDetail,
                              modules: [...editingDetail.modules, module.id],
                            });
                          } else {
                            setEditingDetail({
                              ...editingDetail,
                              modules: editingDetail.modules.filter((moduleId) => moduleId !== module.id),
                            });
                          }
                        }}
                      />
                      <div>
                        <p className="font-medium text-slate-800">{module.name}</p>
                        <p className="text-sm text-slate-500">{module.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100"
                  onClick={() => setEditingDetail(null)}
                >
                  Cancel
                </button>
                <button
                  className={`px-4 py-2 text-white rounded-lg ${
                    normalizeStatus(editingDetail.subscriptionStatus) !== normalizeStatus(editingDetail.originalSubscriptionStatus) &&
                    !editingDetail.subscriptionStatusReason.trim()
                      ? 'opacity-60 cursor-not-allowed'
                      : ''
                  }`}
                  style={{ background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)' }}
                  disabled={
                    normalizeStatus(editingDetail.subscriptionStatus) !== normalizeStatus(editingDetail.originalSubscriptionStatus) &&
                    !editingDetail.subscriptionStatusReason.trim()
                  }
                  onClick={handleSaveCompany}
                >
                  <Save className="w-4 h-4 inline-block mr-1" /> Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedHistoryFor !== null && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-6xl max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg">{viewingCompany ? 'Company 360' : 'Company Payment History'}</h3>
              <button
                className="px-2 py-1 text-slate-500 hover:text-slate-700"
                onClick={closeCompanyView}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {viewingCompany && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                    <h4 className="font-semibold text-slate-800">Company</h4>
                    <p><strong>Name:</strong> {viewingCompany.company}</p>
                    <p><strong>ID:</strong> {viewingCompany.id}</p>
                    <p><strong>Created:</strong> {formatDate(viewingCompany.createdAt)}</p>
                    <p><strong>Multi-location:</strong> {viewingCompany.isMultiLocationEnabled ? 'Yes' : 'No'}</p>
                    <p><strong>Plan:</strong> {getCompanyPlanName(viewingCompany)}</p>
                    <p><strong>Employees:</strong> {viewingCompany.employeeCount ?? viewingCompany.latestPaymentEmployeeCountSnapshot ?? '-'}</p>
                    <div>
                      <p className="font-semibold text-slate-700">Legacy entitlements</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {renderModulePills(parseModules(viewingCompany.activeModules))}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Latest payment entitlements</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {renderModulePills(parseModules(viewingCompany.latestPaymentModules || ''), 'payment')}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                    <h4 className="font-semibold text-slate-800">Subscription</h4>
                    <p><strong>Status:</strong> {getEffectiveSubscriptionStatus(viewingCompany)}</p>
                    <p><strong>Raw status:</strong> {viewingCompany.subscriptionStatus || '-'}</p>
                    <p><strong>Trial ends:</strong> {formatDateTime(viewingCompany.trialEndsAt || '')}</p>
                    <p><strong>Next billing:</strong> {formatDateTime(viewingCompany.nextBillingDate || '')}</p>
                    <p><strong>Next amount:</strong> {viewingCompany.nextBillingAmountCents !== null && viewingCompany.nextBillingAmountCents !== undefined ? formatPrice(viewingCompany.nextBillingAmountCents, viewingCompany.latestPaymentCurrency || 'USD') : '-'}</p>
                    <p><strong>Due:</strong> {formatDateTime(viewingCompany.subscriptionDueDate || '')}</p>
                    <p><strong>Recurring:</strong> {formatDateTime(viewingCompany.subscriptionRecurringDate || '')}</p>
                    <p><strong>Payment count:</strong> {viewingCompany.paymentHistoryCount ?? 0}</p>
                    <p><strong>Latest payment status:</strong> {viewingCompany.latestPaymentStatus || '-'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                    <h4 className="font-semibold text-slate-800">Latest Payment</h4>
                    <p><strong>Payment ID:</strong> {viewingCompany.latestPaymentIntentId || '-'}</p>
                    <p><strong>Email:</strong> {viewingCompany.latestPaymentEmail || '-'}</p>
                    <p><strong>Plan:</strong> {viewingCompany.latestPaymentPlanName || getCompanyPlanName(viewingCompany)}</p>
                    <p><strong>Employees:</strong> {viewingCompany.latestPaymentEmployeeCountSnapshot ?? viewingCompany.employeeCount ?? '-'}</p>
                    <p><strong>Amount:</strong> {viewingCompany.latestPaymentFinalAmountCents !== null && viewingCompany.latestPaymentFinalAmountCents !== undefined ? formatPrice(viewingCompany.latestPaymentFinalAmountCents, viewingCompany.latestPaymentCurrency || 'USD') : viewingCompany.latestPaymentAmount !== null && viewingCompany.latestPaymentAmount !== undefined ? formatPrice(viewingCompany.latestPaymentAmount, viewingCompany.latestPaymentCurrency || 'USD') : '-'}</p>
                    <p><strong>Source:</strong> {viewingCompany.latestPaymentSource || '-'}</p>
                    <p><strong>Denied reason:</strong> {viewingCompany.latestPaymentDeniedReason || '-'}</p>
                    <p><strong>Gateway:</strong> {getCompanyGatewayLabel(viewingCompany)} / {viewingCompany.latestPaymentGatewayStatus || '-'}</p>
                    <p><strong>Receiver ref:</strong> {viewingCompany.latestPaymentGatewayRefReceiverMedium || '-'}</p>
                    <p><strong>Sender ref:</strong> {viewingCompany.latestPaymentGatewayRefSenderMedium || '-'}</p>
                    <p><strong>Created:</strong> {formatDateTime(viewingCompany.latestPaymentCreatedAt || '')}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-slate-700 mb-1">Payment Status</label>
                  <select
                    value={historyStatus}
                    onChange={(event) => setHistoryStatus(event.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="all">All</option>
                    {paymentStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1">Date From</label>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocalValue(historyDateFrom)}
                    onChange={(event) => setHistoryDateFrom(event.target.value ? new Date(event.target.value).toISOString() : '')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1">Date To</label>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocalValue(historyDateTo)}
                    onChange={(event) => setHistoryDateTo(event.target.value ? new Date(event.target.value).toISOString() : '')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {historyLoading ? (
                <div className="text-center py-8 text-slate-500">Loading payment history...</div>
              ) : historyItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No payment history</div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left py-3 px-4">Payment</th>
                        <th className="text-left py-3 px-4">Email</th>
                        <th className="text-left py-3 px-4">Plan</th>
                        <th className="text-left py-3 px-4">Entitlements</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-left py-3 px-4">Amount</th>
                        <th className="text-left py-3 px-4">Denied reason</th>
                        <th className="text-left py-3 px-4">Source</th>
                        <th className="text-left py-3 px-4">Gateway</th>
                        <th className="text-left py-3 px-4">Refs</th>
                        <th className="text-left py-3 px-4">Due</th>
                        <th className="text-left py-3 px-4">Recurring</th>
                        <th className="text-left py-3 px-4">Created</th>
                        <th className="text-right py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.map((payment) => {
                        const modules = parseModules(payment.modules || '');
                        return (
                          <tr key={payment.paymentIntentId} className="border-t border-slate-100">
                            <td className="py-3 px-4 text-slate-700">{payment.paymentIntentId}</td>
                            <td className="py-3 px-4 text-slate-700">{payment.email}</td>
                            <td className="py-3 px-4 text-slate-700">
                              <div className="font-medium">{payment.planName || payment.planId || '-'}</div>
                              <div className="text-xs text-slate-500">
                                {payment.employeeCountSnapshot ?? '-'} employees
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {modules.length === 0 ? (
                                  <span className="text-slate-400 text-sm">-</span>
                                ) : (
                                  modules.map((moduleId) => (
                                    <span key={moduleId} className="inline-block px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded">
                                      {moduleId}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-block px-2 py-1 rounded-full text-sm ${
                                payment.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' :
                                payment.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                                payment.status === 'failed' ? 'bg-red-50 text-red-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {payment.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-700">{formatPrice(payment.finalAmountCents ?? payment.amount, payment.currency)}</td>
                            <td className="py-3 px-4 text-slate-700 max-w-[220px] truncate" title={payment.deniedReason || ''}>
                              {payment.deniedReason || '-'}
                            </td>
                            <td className="py-3 px-4 text-slate-700">{payment.source || '-'}</td>
                            <td className="py-3 px-4 text-slate-700">
                              <div>{getPaymentGatewayLabel(payment)}</div>
                              <div className="text-xs text-slate-500">{payment.paymentGatewayStatus || '-'}</div>
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              <div className="text-xs">Receiver: {payment.gatewayRefReceiverMedium || '-'}</div>
                              <div className="text-xs">Sender: {payment.gatewayRefSenderMedium || '-'}</div>
                            </td>
                            <td className="py-3 px-4 text-slate-700">{formatDateTime(payment.dueDate)}</td>
                            <td className="py-3 px-4 text-slate-700">{formatDateTime(payment.recurringDate)}</td>
                            <td className="py-3 px-4 text-slate-700">{formatDateTime(payment.createdAt)}</td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <button
                                title="Open payment detail"
                                onClick={() => setSelectedPayment(payment)}
                                className="inline-flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-100"
                              >
                                <Eye className="w-4 h-4" /> Detail
                              </button>
                              <select
                                value={payment.status}
                                onChange={(event) => handlePaymentStatusChange(payment.paymentIntentId, event.target.value)}
                                className="px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                              >
                                {paymentStatuses.map((status) => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end">
              <button
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100"
                onClick={closeCompanyView}
              >
                <ClipboardList className="w-4 h-4 inline-block mr-1" /> Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-700">Payment Detail</h3>
              <button onClick={() => setSelectedPayment(null)} className="px-2 py-1 rounded border border-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm text-slate-700">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Payment Id:</strong> {selectedPayment.paymentIntentId}</p>
                  <p><strong>Company:</strong> {selectedPayment.companyName || selectedHistoryFor || '-'}</p>
                  <p><strong>Email:</strong> {selectedPayment.email}</p>
                  <p><strong>Plan:</strong> {selectedPayment.planName || selectedPayment.planId || '-'}</p>
                  <p><strong>Employees:</strong> {selectedPayment.employeeCountSnapshot ?? '-'}</p>
                  <p><strong>Original amount:</strong> {selectedPayment.originalAmountCents !== null && selectedPayment.originalAmountCents !== undefined ? formatPrice(selectedPayment.originalAmountCents, selectedPayment.currency) : '-'}</p>
                  <p><strong>Final amount:</strong> {formatPrice(selectedPayment.finalAmountCents ?? selectedPayment.amount, selectedPayment.currency)}</p>
                  <p><strong>Trial ends:</strong> {formatDateTime(selectedPayment.trialEndsAt || '')}</p>
                  <p><strong>Status:</strong> {selectedPayment.status}</p>
                  <p><strong>Source:</strong> {selectedPayment.source || '-'}</p>
                  <p><strong>Gateway method:</strong> {getPaymentGatewayLabel(selectedPayment)}</p>
                  <p><strong>Ref receiver:</strong> {selectedPayment.gatewayRefReceiverMedium || '-'}</p>
                  <p><strong>Ref sender:</strong> {selectedPayment.gatewayRefSenderMedium || '-'}</p>
                  <p><strong>Due:</strong> {formatDateTime(selectedPayment.dueDate || '')}</p>
                  <p><strong>Recurring:</strong> {formatDateTime(selectedPayment.recurringDate || '')}</p>
                  <p><strong>Gateway status:</strong> {selectedPayment.paymentGatewayStatus || '-'}</p>
                  <p><strong>Denied reason:</strong> {selectedPayment.deniedReason || '-'}</p>
                </div>
                <div className="space-y-3">
                  <label className="block">
                    <span className="block text-slate-700 mb-1">Refund reason</span>
                    <input
                      value={refundReason}
                      onChange={(event) => setRefundReason(event.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      placeholder="Refund reason"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-slate-700 mb-1">Refund amount (USD)</span>
                    <input
                      value={refundAmount}
                      onChange={(event) => setRefundAmount(event.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      placeholder="Amount"
                      type="number"
                      step="0.01"
                    />
                  </label>
                  <button
                    className="w-full px-4 py-2 rounded-lg text-white"
                    style={{ background: 'linear-gradient(135deg, #e11d48 0%, #db2777 100%)' }}
                    onClick={handleRefund}
                  >
                    <HandCoins className="w-4 h-4 inline-block mr-1" /> Apply refund
                  </button>
                </div>
              </div>

              <div className="rounded border border-slate-200 p-3">
                <p className="font-semibold mb-2">Raw gateway details</p>
                <pre className="text-xs bg-slate-50 border border-slate-100 p-3 rounded overflow-auto">{buildPayload(selectedPayment.gatewayPayload || '')}</pre>
              </div>

              <div className="rounded border border-slate-200 p-3 space-y-2">
                <p className="font-semibold">Manual subscription trigger</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    value={manualSource}
                    onChange={(event) => setManualSource(event.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2"
                    placeholder="Source"
                  />
                  <input
                    value={manualMethod}
                    onChange={(event) => setManualMethod(event.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2"
                    placeholder="Payment method"
                  />
                  <input
                    value={manualReceiver}
                    onChange={(event) => setManualReceiver(event.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2"
                    placeholder="Receiver medium"
                  />
                  <input
                    value={manualSender}
                    onChange={(event) => setManualSender(event.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2"
                    placeholder="Sender medium"
                  />
                  <textarea
                    rows={2}
                    className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2"
                    placeholder="Reason / notes"
                    value={manualReason}
                    onChange={(event) => setManualReason(event.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    className="px-4 py-2 rounded-lg text-white"
                    style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0891b2 100%)' }}
                    onClick={handleManualSubscription}
                  >
                    <Clipboard className="w-4 h-4 inline-block mr-1" /> Trigger Manual
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
