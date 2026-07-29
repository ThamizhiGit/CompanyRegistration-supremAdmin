import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  ADMIN_COMPANIES_QUERY,
  ADMIN_ASSIGN_COMPANY_PLAN_MUTATION,
  ADMIN_UPDATE_COMPANY_DETAIL_MUTATION,
  ADMIN_COMPANY_PAYMENT_HISTORY_QUERY,
  ADMIN_UPDATE_PAYMENT_STATUS_MUTATION,
  ADMIN_REQUEST_REFUND_MUTATION,
  ADMIN_MANUAL_SUBSCRIPTION_MUTATION,
} from '../../../lib/graphql';
import { buildPayload, formatDate, formatDateTime, formatPrice, toDateTimeLocalValue } from '../../../lib/admin-utils';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  CreditCard,
  Download,
  Edit2,
  Eye,
  Filter,
  HandCoins,
  Landmark,
  MapPin,
  Printer,
  ReceiptText,
  Save,
  Search,
  Users,
  X,
} from 'lucide-react';
import { buildColumnFilterOptions, ColumnFilter, matchesColumnFilter } from '../ColumnFilter';
import { DateRangePicker, DateRangeValue } from '../DateRangePicker';

interface EditingCompanyDetail {
  id: number;
  company: string;
  planId: string;
  originalPlanId: string;
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

interface CompanyPaymentType {
  paymentIntentId: string;
  email: string;
  planId?: string | null;
  planName?: string | null;
  employeeCountSnapshot?: number | null;
  originalAmountCents?: number | null;
  finalAmountCents?: number | null;
  trialEndsAt?: string | null;
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

const paidSubscriptionStatuses = new Set(['trial', 'active', 'pending']);
const datedSubscriptionStatuses = new Set(['trial', 'active', 'pending']);

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
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [viewingCompany, setViewingCompany] = useState<CompanyType | null>(null);
  const [company360Tab, setCompany360Tab] = useState<'overview' | 'subscription' | 'payments'>('overview');
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

  const [assignCompanyPlan] = useMutation(ADMIN_ASSIGN_COMPANY_PLAN_MUTATION);
  const [updateCompanyDetail] = useMutation(ADMIN_UPDATE_COMPANY_DETAIL_MUTATION);
  const [updatePaymentStatus] = useMutation(ADMIN_UPDATE_PAYMENT_STATUS_MUTATION);
  const [requestRefund] = useMutation(ADMIN_REQUEST_REFUND_MUTATION);
  const [manualProcess] = useMutation(ADMIN_MANUAL_SUBSCRIPTION_MUTATION);

  const rawCompanies = companiesData?.adminCompanies || [];
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
  const getCompanyPlanId = (company: CompanyType) =>
    company.planId || company.latestPaymentPlanId || 'free';
  const getCompanyPlanName = (company: CompanyType) =>
    company.planName || company.latestPaymentPlanName || planOptions.find((plan) => plan.id === getCompanyPlanId(company))?.name || '-';
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
  const getStatusLabel = (value: string) =>
    subscriptionStatusOptions.find((status) => status.value === value)?.label || value;
  const syncEditingStatus = (detail: EditingCompanyDetail, nextStatus: string): EditingCompanyDetail => {
    const normalizedStatus = normalizeStatus(nextStatus);
    return {
      ...detail,
      subscriptionStatus: nextStatus,
      planId: paidSubscriptionStatuses.has(normalizedStatus) ? 'premium' : detail.planId,
    };
  };
  const syncEditingPlan = (detail: EditingCompanyDetail, nextPlanId: string): EditingCompanyDetail => {
    if (nextPlanId === 'free') {
      return {
        ...detail,
        planId: nextPlanId,
        subscriptionStatus: 'active',
        subscriptionDueDate: '',
        subscriptionRecurringDate: '',
      };
    }

    return {
      ...detail,
      planId: nextPlanId,
      subscriptionStatus: detail.planId === 'free' ? 'trial' : detail.subscriptionStatus,
    };
  };
  const getEditValidationError = (detail: EditingCompanyDetail): string => {
    const normalizedStatus = normalizeStatus(detail.subscriptionStatus);
    if (detail.planId === 'free') return '';
    if (!datedSubscriptionStatuses.has(normalizedStatus)) return '';

    if (!detail.subscriptionDueDate || !detail.subscriptionRecurringDate) {
      return `${getStatusLabel(detail.subscriptionStatus)} subscriptions need both due and recurring dates.`;
    }

    const dueTime = new Date(detail.subscriptionDueDate).getTime();
    const recurringTime = new Date(detail.subscriptionRecurringDate).getTime();
    if (Number.isNaN(dueTime) || Number.isNaN(recurringTime)) {
      return 'Enter valid due and recurring dates.';
    }
    if (recurringTime <= dueTime) {
      return 'Recurring date must be after the due date.';
    }

    return '';
  };
  const getPlanSyncHint = (detail: EditingCompanyDetail) => {
    if (detail.planId === 'free') {
      return 'Free plan uses Active status and does not carry billing dates.';
    }
    if (paidSubscriptionStatuses.has(normalizeStatus(detail.subscriptionStatus))) {
      return `${getStatusLabel(detail.subscriptionStatus)} status uses the Premium plan and requires billing dates.`;
    }
    return 'Plan drives billing and subscription pricing.';
  };
  const clearFilters = () => {
    setSearch('');
    setStatusSelections([]);
    setPlanSelections([]);
    setEmailSelections([]);
    setDueDateSelections([]);
    setRecurringDateSelections([]);
    setGatewaySelections([]);
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
  const companies = useMemo(() => (
    rawCompanies.filter((company) => {
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

  if (companiesLoading) {
    return <div className="text-center py-12 text-slate-500">Loading companies...</div>;
  }

  if (companiesError) {
    return <div className="text-center py-12 text-red-600">Error: {companiesError.message}</div>;
  }

  const handleSaveCompany = async () => {
    if (!editingDetail) return;
    const statusChanged = normalizeStatus(editingDetail.subscriptionStatus) !== normalizeStatus(editingDetail.originalSubscriptionStatus);
    const validationError = getEditValidationError(editingDetail);
    if (validationError) {
      onToast('error', validationError);
      return;
    }
    if (statusChanged && !editingDetail.subscriptionStatusReason.trim()) {
      onToast('error', 'Please add a reason for changing subscription status');
      return;
    }
    const shouldClearBillingDates = editingDetail.planId === 'free';
    try {
      await updateCompanyDetail({
        variables: {
          input: {
            id: editingDetail.id,
            company: editingDetail.company,
            subscriptionStatus: editingDetail.subscriptionStatus,
            subscriptionDueDate: shouldClearBillingDates ? null : editingDetail.subscriptionDueDate || null,
            subscriptionRecurringDate: shouldClearBillingDates ? null : editingDetail.subscriptionRecurringDate || null,
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
      onToast('success', 'Company detail updated');
      setEditingDetail(null);
      refetchCompanies();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to update company details');
    }
  };

  const handleOpenHistory = (companyId: number) => {
    setSelectedHistoryFor(companyId);
    setCompany360Tab('overview');
    setHistoryDateFrom('');
    setHistoryDateTo('');
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
    setCompany360Tab('overview');
  };

  const applyHistoryDateRange = ({ from, to }: DateRangeValue) => {
    setHistoryDateFrom(new Date(`${from}T00:00:00`).toISOString());
    setHistoryDateTo(new Date(`${to}T23:59:59.999`).toISOString());
  };

  const clearHistoryDateFilter = () => {
    setHistoryDateFrom('');
    setHistoryDateTo('');
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

  const editValidationError = editingDetail ? getEditValidationError(editingDetail) : '';
  const editStatusReasonMissing = Boolean(
    editingDetail &&
      normalizeStatus(editingDetail.subscriptionStatus) !== normalizeStatus(editingDetail.originalSubscriptionStatus) &&
      !editingDetail.subscriptionStatusReason.trim(),
  );
  const companySaveDisabled = Boolean(editValidationError) || editStatusReasonMissing;
  const editingFreePlan = editingDetail?.planId === 'free';

  return (
    <div className="space-y-8">
      {!viewingCompany && (
        <>
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Companies</h2>
        <p className="text-slate-600">Manage tenants, plan assignments, subscriptions, and payment history</p>
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
            {search || statusSelections.length > 0 || planSelections.length > 0 || emailSelections.length > 0 || dueDateSelections.length > 0 || recurringDateSelections.length > 0 || gatewaySelections.length > 0
              ? 'No companies match your filters'
              : 'No companies found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4"><SortHeader label="Company" sort="company" /></th>
                  <th className="text-left py-3 px-4"><SortHeader label="Subscription Status" sort="subscriptionStatus" /></th>
                  <th className="text-left py-3 px-4"><SortHeader label="Plan" sort="planName" /></th>
                  <th className="text-left py-3 px-4"><SortHeader label="Email" sort="latestPaymentEmail" /></th>
                  <th className="text-left py-3 px-4"><SortHeader label="Due Date" sort="subscriptionDueDate" /></th>
                  <th className="text-left py-3 px-4"><SortHeader label="Recurring Date" sort="subscriptionRecurringDate" /></th>
                  <th className="text-left py-3 px-4"><SortHeader label="Gateway" sort="latestPaymentGatewayMethod" /></th>
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
	                    setEditingDetail(syncEditingStatus(editingDetail, event.target.value))
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
	                    setEditingDetail(syncEditingPlan(editingDetail, event.target.value))
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
	                  {getPlanSyncHint(editingDetail)}
	                </p>
	              </div>
	              {editValidationError && (
	                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
	                  {editValidationError}
	                </div>
	              )}
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
	                    value={editingFreePlan ? '' : toDateTimeLocalValue(editingDetail.subscriptionDueDate)}
	                    onChange={(event) =>
	                      setEditingDetail({
	                        ...editingDetail,
	                        subscriptionDueDate: event.target.value ? new Date(event.target.value).toISOString() : '',
	                      })
	                    }
	                    disabled={editingFreePlan}
	                    className={`w-full border border-slate-300 rounded-lg px-3 py-2 ${editingFreePlan ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
	                  />
	                  {editingFreePlan && (
	                    <p className="mt-1 text-xs text-slate-500">Free plan has no billing due date.</p>
	                  )}
	                </div>
	                <div>
	                  <label htmlFor="company-subscription-recurring-date" className="block text-sm text-slate-700 mb-1">Recurring Date</label>
	                  <input
	                    id="company-subscription-recurring-date"
	                    type="datetime-local"
	                    value={editingFreePlan ? '' : toDateTimeLocalValue(editingDetail.subscriptionRecurringDate)}
	                    onChange={(event) =>
	                      setEditingDetail({
	                        ...editingDetail,
	                        subscriptionRecurringDate: event.target.value ? new Date(event.target.value).toISOString() : '',
	                      })
	                    }
	                    disabled={editingFreePlan}
	                    className={`w-full border border-slate-300 rounded-lg px-3 py-2 ${editingFreePlan ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
	                  />
	                  {editingFreePlan && (
	                    <p className="mt-1 text-xs text-slate-500">Free plan has no recurring billing date.</p>
	                  )}
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
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100"
                  onClick={() => setEditingDetail(null)}
                >
                  Cancel
	                </button>
	                <button
	                  className={`px-4 py-2 text-white rounded-lg ${
	                    companySaveDisabled
	                      ? 'opacity-60 cursor-not-allowed'
	                      : ''
	                  }`}
	                  style={{ background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)' }}
	                  disabled={companySaveDisabled}
	                  onClick={handleSaveCompany}
	                >
                  <Save className="w-4 h-4 inline-block mr-1" /> Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {viewingCompany && selectedHistoryFor !== null && (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <button
                    type="button"
                    onClick={closeCompanyView}
                    className="hover:text-cyan-600 transition-colors"
                  >
                    Companies
                  </button>
                  <span>/</span>
                  <span className="text-slate-700">Company 360</span>
                </div>
                <h2 className="font-bold text-2xl text-slate-950">Company 360</h2>
                <p className="text-sm text-slate-500 mt-0.5">Company, subscription and payment information</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:text-cyan-700 hover:border-cyan-200 hover:bg-cyan-50 transition-colors"
                onClick={closeCompanyView}
                title="Back to Companies"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Companies
              </button>
            </div>

            <div>
              {viewingCompany && (
                <>
                  <section className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm px-5 py-5 sm:px-7 sm:py-6 mb-5">
                    <div className="absolute inset-x-0 top-0 h-1 bg-cyan-500" />
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex items-start gap-4 sm:gap-5 min-w-0">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
                          <Building2 className="w-10 h-10 sm:w-12 sm:h-12" strokeWidth={1.7} />
                        </div>
                        <div className="min-w-0 pt-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h2 className="text-2xl font-bold text-slate-950 tracking-tight truncate">
                              {viewingCompany.company}
                            </h2>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${getStatusBadgeClass(getEffectiveSubscriptionStatus(viewingCompany))}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {getEffectiveSubscriptionStatus(viewingCompany)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1.5">
                            Company ID #{viewingCompany.id} &bull; Created {formatDate(viewingCompany.createdAt)}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-4">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                              <Landmark className="w-4 h-4 text-cyan-500" />
                              {getCompanyPlanName(viewingCompany)} plan
                            </span>
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                              <MapPin className="w-4 h-4 text-cyan-500" />
                              {viewingCompany.isMultiLocationEnabled ? 'Multi-location' : 'Single location'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div className="min-w-[96px] rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
                          <Users className="w-5 h-5 text-violet-500 mb-2" />
                          <p className="text-lg font-bold text-slate-900">{viewingCompany.employeeCount ?? viewingCompany.latestPaymentEmployeeCountSnapshot ?? '-'}</p>
                          <p className="text-[11px] text-slate-500">Employees</p>
                        </div>
                        <div className="min-w-[96px] rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
                          <ReceiptText className="w-5 h-5 text-blue-500 mb-2" />
                          <p className="text-lg font-bold text-slate-900">{viewingCompany.paymentHistoryCount ?? historyItems.length}</p>
                          <p className="text-[11px] text-slate-500">Payments</p>
                        </div>
                        <div className="min-w-[96px] rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
                          <CreditCard className="w-5 h-5 text-emerald-500 mb-2" />
                          <p className="text-lg font-bold text-slate-900">
                            {viewingCompany.latestPaymentFinalAmountCents !== null && viewingCompany.latestPaymentFinalAmountCents !== undefined
                              ? formatPrice(viewingCompany.latestPaymentFinalAmountCents, viewingCompany.latestPaymentCurrency || 'USD')
                              : viewingCompany.latestPaymentAmount !== null && viewingCompany.latestPaymentAmount !== undefined
                                ? formatPrice(viewingCompany.latestPaymentAmount, viewingCompany.latestPaymentCurrency || 'USD')
                                : '-'}
                          </p>
                          <p className="text-[11px] text-slate-500">Latest amount</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <nav className="flex overflow-x-auto whitespace-nowrap border-b border-slate-200 mb-6" aria-label="Company 360 sections">
                    {([
                      { id: 'overview', label: 'Overview', icon: Building2 },
                      { id: 'subscription', label: 'Subscription', icon: CalendarDays },
                      { id: 'payments', label: 'Payment History', icon: ReceiptText },
                    ] as const).map((tab) => {
                      const Icon = tab.icon;
                      const active = company360Tab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setCompany360Tab(tab.id)}
                          className={`flex-1 min-w-fit px-5 py-3 inline-flex justify-center items-center gap-2 border-b-[3px] text-sm transition-colors ${
                            active
                              ? 'text-cyan-600 border-cyan-500 font-semibold'
                              : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                          }`}
                          aria-current={active ? 'page' : undefined}
                        >
                          <Icon className="w-[18px] h-[18px]" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </nav>

                  {company360Tab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">Company Overview</h4>
                            <p className="text-xs text-slate-500">Core company details</p>
                          </div>
                        </div>
                        <dl className="px-5 divide-y divide-slate-100">
                          {[
                            ['Company name', viewingCompany.company],
                            ['Company ID', `#${viewingCompany.id}`],
                            ['Created', formatDate(viewingCompany.createdAt)],
                            ['Location setup', viewingCompany.isMultiLocationEnabled ? 'Multi-location enabled' : 'Single location'],
                            ['Current plan', getCompanyPlanName(viewingCompany)],
                            ['Employees', String(viewingCompany.employeeCount ?? viewingCompany.latestPaymentEmployeeCountSnapshot ?? '-')],
                          ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between gap-4 py-3.5">
                              <dt className="text-sm text-slate-500">{label}</dt>
                              <dd className="text-sm font-semibold text-slate-800 text-right">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </section>

                      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                              <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900">Latest Payment</h4>
                              <p className="text-xs text-slate-500">Most recent billing activity</p>
                            </div>
                          </div>
                          {historyItems[0] && (
                            <button
                              type="button"
                              onClick={() => setSelectedPayment(historyItems[0])}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-cyan-700 border border-cyan-200 rounded-lg hover:bg-cyan-50"
                            >
                              <Eye className="w-4 h-4" /> Detail
                            </button>
                          )}
                        </div>
                        <dl className="px-5 divide-y divide-slate-100">
                          {[
                            ['Payment ID', viewingCompany.latestPaymentIntentId || '-'],
                            ['Billing email', viewingCompany.latestPaymentEmail || '-'],
                            ['Payment status', viewingCompany.latestPaymentStatus || '-'],
                            ['Gateway', `${getCompanyGatewayLabel(viewingCompany)} / ${viewingCompany.latestPaymentGatewayStatus || '-'}`],
                            ['Source', viewingCompany.latestPaymentSource || '-'],
                            ['Created', formatDateTime(viewingCompany.latestPaymentCreatedAt || '')],
                          ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between gap-4 py-3.5">
                              <dt className="text-sm text-slate-500">{label}</dt>
                              <dd className="text-sm font-semibold text-slate-800 text-right break-all">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    </div>
                  )}

                  {company360Tab === 'subscription' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      <section className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <CalendarDays className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">Subscription Details</h4>
                            <p className="text-xs text-slate-500">Plan status and billing schedule</p>
                          </div>
                        </div>
                        <dl className="px-5 grid sm:grid-cols-2 gap-x-8">
                          {[
                            ['Effective status', getEffectiveSubscriptionStatus(viewingCompany)],
                            ['Recorded status', viewingCompany.subscriptionStatus || '-'],
                            ['Plan', getCompanyPlanName(viewingCompany)],
                            ['Trial ends', formatDateTime(viewingCompany.trialEndsAt || '')],
                            ['Next billing date', formatDateTime(viewingCompany.nextBillingDate || '')],
                            ['Next billing amount', viewingCompany.nextBillingAmountCents !== null && viewingCompany.nextBillingAmountCents !== undefined ? formatPrice(viewingCompany.nextBillingAmountCents, viewingCompany.latestPaymentCurrency || 'USD') : '-'],
                            ['Due date', formatDateTime(viewingCompany.subscriptionDueDate || '')],
                            ['Recurring date', formatDateTime(viewingCompany.subscriptionRecurringDate || '')],
                          ].map(([label, value]) => (
                            <div key={label} className="py-4 border-b border-slate-100">
                              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
                              <dd className="text-sm font-semibold text-slate-800 mt-1.5">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <p className="text-sm text-slate-500">Latest payment status</p>
                        <p className="text-xl font-bold text-slate-900 mt-1 capitalize">{viewingCompany.latestPaymentStatus || 'No payment'}</p>
                        <div className="border-t border-slate-100 mt-5 pt-5 space-y-3">
                          <div>
                            <p className="text-xs text-slate-400">Payment records</p>
                            <p className="font-semibold text-slate-800">{viewingCompany.paymentHistoryCount ?? historyItems.length}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Latest plan</p>
                            <p className="font-semibold text-slate-800">{viewingCompany.latestPaymentPlanName || getCompanyPlanName(viewingCompany)}</p>
                          </div>
                        </div>
                      </section>
                    </div>
                  )}
                </>
              )}

              {company360Tab === 'payments' && (
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                      <ReceiptText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Payment History</h4>
                      <p className="text-xs text-slate-500">Transactions, gateway details and payment actions</p>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col lg:flex-row lg:items-end gap-3">
                <div className="w-full lg:w-52">
                  <label htmlFor="payment-history-status" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Payment Status
                  </label>
                  <select
                    id="payment-history-status"
                    value={historyStatus}
                    onChange={(event) => setHistoryStatus(event.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400"
                  >
                    <option value="all">All</option>
                    {paymentStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div className="pb-0.5">
                  <DateRangePicker
                    from={historyDateFrom ? toDateTimeLocalValue(historyDateFrom).slice(0, 10) : ''}
                    to={historyDateTo ? toDateTimeLocalValue(historyDateTo).slice(0, 10) : ''}
                    onChange={applyHistoryDateRange}
                    onClear={clearHistoryDateFilter}
                  />
                </div>
              </div>

              {historyLoading ? (
                <div className="mx-5 mb-5 text-center py-10 text-slate-500">Loading payment history...</div>
              ) : historyItems.length === 0 ? (
                <div className="mx-5 mb-5 text-center py-10 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-slate-500">
                  No payment history
                </div>
              ) : (
                <div className="custom-scrollbar mx-5 mb-5 overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left py-3 px-4">Payment</th>
                        <th className="text-left py-3 px-4">Email</th>
                        <th className="text-left py-3 px-4">Plan</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-left py-3 px-4">Amount</th>
                        <th className="text-left py-3 px-4">Method</th>
                        <th className="text-left py-3 px-4">Created</th>
                        <th className="min-w-[185px] text-right py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.map((payment) => (
                          <tr key={payment.paymentIntentId} className="border-t border-slate-100">
                            <td
                              className="max-w-[220px] py-3 px-4 text-slate-700 truncate"
                              title={payment.paymentIntentId}
                            >
                              {payment.paymentIntentId}
                            </td>
                            <td
                              className="max-w-[220px] py-3 px-4 text-slate-700 truncate"
                              title={payment.email}
                            >
                              {payment.email}
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              <div className="font-medium">{payment.planName || payment.planId || '-'}</div>
                              <div className="text-xs text-slate-500">
                                {payment.employeeCountSnapshot ?? '-'} employees
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
                            <td className="py-3 px-4 text-slate-700">
                              <div className="font-medium capitalize">{getPaymentGatewayLabel(payment)}</div>
                              <div className="text-xs text-slate-500">
                                {[payment.source, payment.paymentGatewayStatus]
                                  .filter((value, index, values) => value && value !== getPaymentGatewayLabel(payment) && values.indexOf(value) === index)
                                  .join(' · ') || '-'}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-700">{formatDateTime(payment.createdAt)}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                <button
                                  title="Open payment detail"
                                  aria-label={`Open details for ${payment.paymentIntentId}`}
                                  onClick={() => setSelectedPayment(payment)}
                                  className="w-9 h-9 inline-flex shrink-0 items-center justify-center border border-slate-200 rounded-full text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <select
                                  aria-label={`Update status for ${payment.paymentIntentId}`}
                                  value={payment.status}
                                  onChange={(event) => handlePaymentStatusChange(payment.paymentIntentId, event.target.value)}
                                  className="h-9 min-w-[120px] shrink-0 px-3 border border-slate-300 rounded-lg text-sm bg-white"
                                >
                                  {paymentStatuses.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                  ))}
                                </select>
                              </div>
                            </td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
                </section>
              )}
            </div>
        </div>
      )}

      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-detail-title"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 id="payment-detail-title" className="text-[22px] font-bold tracking-[-0.3px] text-slate-800">
                  Payment Detail
                </h3>
                <p className="mt-1 text-[13px] text-slate-400 truncate">
                  Transaction {selectedPayment.paymentIntentId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Close payment detail"
                aria-label="Close payment detail"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Final amount</p>
                  <p className="mt-1.5 text-xl font-bold text-slate-900">
                    {formatPrice(selectedPayment.finalAmountCents ?? selectedPayment.amount, selectedPayment.currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Payment status</p>
                  <span className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                    selectedPayment.status === 'succeeded' ? 'bg-emerald-100 text-emerald-700' :
                    selectedPayment.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    selectedPayment.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {selectedPayment.status}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Gateway</p>
                  <p className="mt-1.5 text-base font-bold text-slate-800 capitalize">
                    {getPaymentGatewayLabel(selectedPayment)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{selectedPayment.paymentGatewayStatus || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
                <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="w-[30px] h-[30px] shrink-0 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-[13px] font-bold uppercase tracking-[0.5px] text-slate-800">Payment information</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Transaction and billing details</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                    {[
                      ['Payment ID', selectedPayment.paymentIntentId],
                      ['Company', selectedPayment.companyName || String(selectedHistoryFor || '-')],
                      ['Billing email', selectedPayment.email],
                      ['Plan', selectedPayment.planName || selectedPayment.planId || '-'],
                      ['Employees', String(selectedPayment.employeeCountSnapshot ?? '-')],
                      ['Original amount', selectedPayment.originalAmountCents !== null && selectedPayment.originalAmountCents !== undefined ? formatPrice(selectedPayment.originalAmountCents, selectedPayment.currency) : '-'],
                      ['Trial ends', formatDateTime(selectedPayment.trialEndsAt || '')],
                      ['Source', selectedPayment.source || '-'],
                      ['Receiver reference', selectedPayment.gatewayRefReceiverMedium || '-'],
                      ['Sender reference', selectedPayment.gatewayRefSenderMedium || '-'],
                      ['Due date', formatDateTime(selectedPayment.dueDate || '')],
                      ['Recurring date', formatDateTime(selectedPayment.recurringDate || '')],
                      ['Denied reason', selectedPayment.deniedReason || '-'],
                    ].map(([label, value]) => (
                      <div key={label} className="py-3 border-b border-slate-200/80 min-w-0">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-700 break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="w-[30px] h-[30px] shrink-0 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center">
                      <HandCoins className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-[13px] font-bold uppercase tracking-[0.5px] text-slate-800">Request refund</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Refund all or part of this payment</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="block">
                      <span className="block text-xs font-semibold text-slate-600 mb-1.5">Refund reason</span>
                    <input
                      value={refundReason}
                      onChange={(event) => setRefundReason(event.target.value)}
                      className="w-full h-10 border border-slate-300 bg-white rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-pink-400"
                      placeholder="Refund reason"
                    />
                  </label>
                  <label className="block">
                      <span className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Refund amount ({selectedPayment.currency?.toUpperCase() || 'USD'})
                      </span>
                    <input
                      value={refundAmount}
                      onChange={(event) => setRefundAmount(event.target.value)}
                      className="w-full h-10 border border-slate-300 bg-white rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-pink-400"
                      placeholder="Amount"
                      type="number"
                      step="0.01"
                      min="0"
                    />
                  </label>
                  <button
                      type="button"
                      className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-600 to-rose-500 text-white text-sm font-semibold shadow-sm hover:from-pink-700 hover:to-rose-600 transition-colors"
                    onClick={handleRefund}
                  >
                      <HandCoins className="w-4 h-4" /> Apply refund
                  </button>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                    Leave the amount empty to request a full refund.
                  </p>
                </section>
              </div>

              <section className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-[30px] h-[30px] shrink-0 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                    <ReceiptText className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-[13px] font-bold uppercase tracking-[0.5px] text-slate-800">Gateway details</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Raw response received from the payment provider</p>
                  </div>
                </div>
                <pre className="custom-scrollbar max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-600 bg-white border border-slate-200 p-4 rounded-lg">
                  {buildPayload(selectedPayment.gatewayPayload || '')}
                </pre>
              </section>

              <section className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-[30px] h-[30px] shrink-0 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center">
                    <Clipboard className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-[13px] font-bold uppercase tracking-[0.5px] text-slate-800">Manual subscription action</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Record a verified subscription event manually</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-600 mb-1.5">Source</span>
                    <input
                    value={manualSource}
                    onChange={(event) => setManualSource(event.target.value)}
                      className="w-full h-10 border border-slate-300 bg-white rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400"
                    placeholder="Source"
                  />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-600 mb-1.5">Payment method</span>
                    <input
                    value={manualMethod}
                    onChange={(event) => setManualMethod(event.target.value)}
                      className="w-full h-10 border border-slate-300 bg-white rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400"
                    placeholder="Payment method"
                  />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-600 mb-1.5">Receiver medium</span>
                    <input
                    value={manualReceiver}
                    onChange={(event) => setManualReceiver(event.target.value)}
                      className="w-full h-10 border border-slate-300 bg-white rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400"
                    placeholder="Receiver medium"
                  />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-600 mb-1.5">Sender medium</span>
                    <input
                    value={manualSender}
                    onChange={(event) => setManualSender(event.target.value)}
                      className="w-full h-10 border border-slate-300 bg-white rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400"
                    placeholder="Sender medium"
                  />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="block text-xs font-semibold text-slate-600 mb-1.5">Reason / notes</span>
                  <textarea
                      rows={3}
                      className="w-full resize-y border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400"
                    placeholder="Reason / notes"
                    value={manualReason}
                    onChange={(event) => setManualReason(event.target.value)}
                  />
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="w-full sm:w-auto h-10 inline-flex items-center justify-center gap-2 px-5 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-500 text-white text-sm font-semibold shadow-sm hover:from-cyan-600 hover:to-sky-600 transition-colors"
                    onClick={handleManualSubscription}
                  >
                    <Clipboard className="w-4 h-4" /> Trigger Manual
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
