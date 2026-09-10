import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  ADMIN_PAYMENTS_QUERY,
  ADMIN_UPDATE_PAYMENT_STATUS_MUTATION,
  ADMIN_COMPANIES_QUERY,
  ADMIN_UPDATE_COMPANY_SUBSCRIPTION_MUTATION,
  ADMIN_SUSPEND_COMPANY_MUTATION,
  ADMIN_RESUME_COMPANY_MUTATION,
  ADMIN_MANUAL_SUBSCRIPTION_MUTATION,
} from '../../../lib/graphql';
import { formatPrice, formatDate, formatDateTime, toDateTimeLocalValue } from '../../../lib/admin-utils';
import {
  Building2,
  CalendarDays,
  Clipboard,
  CreditCard,
  Download,
  Edit2,
  Eye,
  Filter,
  Landmark,
  Printer,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { buildColumnFilterOptions, ColumnFilter, matchesColumnFilter } from '../ColumnFilter';

type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded' | null;
type SortDirection = 'asc' | 'desc' | null;
type PaymentSortKey = 'displayCompanyName' | 'email' | 'planName' | 'amount' | 'dueDate' | 'trialEndsAt' | 'status' | 'createdAt';

interface PaymentType {
  invoiceNumber?: string | null;
  receiptNumber?: string | null;
  paymentIntentId: string;
  email: string;
  planId?: string | null;
  planName?: string | null;
  employeeCountSnapshot?: number | null;
  originalAmountCents?: number | null;
  discountAmountCents?: number | null;
  finalAmountCents?: number | null;
  billingInterval?: string | null;
  promoCode?: string | null;
  promoLabel?: string | null;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  nextBillingDate?: string | null;
  amount: number;
  currency: string;
  status: string;
  companyId?: number;
  companyName?: string;
  source?: string | null;
  deniedReason?: string | null;
  createdAt: string;
  updatedAt?: string;
  dueDate?: string | null;
  recurringDate?: string | null;
  gatewayMethod?: string | null;
  gatewayRefReceiverMedium?: string | null;
  gatewayRefSenderMedium?: string | null;
  gatewayPayload?: Record<string, unknown> | string | null;
  paymentGatewayStatus?: string | null;
}

const getCardSummary = (payload: PaymentType['gatewayPayload']) => {
  let parsed: unknown = payload;
  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload);
    } catch {
      return '';
    }
  }
  const card = parsed && typeof parsed === 'object' ? (parsed as { card?: Record<string, unknown> }).card : null;
  if (!card || typeof card !== 'object' || !card.last4) return '';
  const brand = String(card.brand || 'Card');
  const expiry = card.exp_month && card.exp_year ? ` · exp ${card.exp_month}/${card.exp_year}` : '';
  return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} •••• ${card.last4}${expiry}`;
};

interface IndexedPaymentType extends PaymentType {
  searchableText: string;
  displayCompanyName: string;
}

interface CompanyType {
  id: number;
  company: string;
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const downloadTextFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const paymentStatusOptions = ['pending', 'succeeded', 'failed', 'refunded'];
const manualPaymentMethodOptions = [
  { value: 'paypal', label: 'PayPal' },
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
];
const manualPaymentMethodValues = manualPaymentMethodOptions.map((option) => option.value);
const paymentMethodLabel = (value?: string | null) => {
  if (!value) return '';
  const option = manualPaymentMethodOptions.find((method) => method.value === value.toLowerCase());
  if (option) return option.label;
  if (value.toLowerCase() === 'card') return 'Card';
  if (value.toLowerCase() === 'stripe') return 'Stripe';
  return value;
};

const getPaymentStatusClass = (status: string) => {
  switch (status) {
    case 'succeeded':
      return 'bg-emerald-50 text-emerald-700';
    case 'pending':
      return 'bg-yellow-50 text-yellow-700';
    case 'failed':
      return 'bg-red-50 text-red-700';
    case 'refunded':
      return 'bg-blue-50 text-blue-700';
    default:
      return 'bg-slate-50 text-slate-700';
  }
};

const toIsoDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

export const Subscriptions: React.FC<{
  onToast: (type: 'success'|'error', msg: string) => void;
  initialCompanyId?: number | null;
  initialCompanySearch?: string;
}> = ({ onToast, initialCompanyId = null, initialCompanySearch = '' }) => {
  const [companySelections, setCompanySelections] = useState<string[]>([]);
  const [emailSelections, setEmailSelections] = useState<string[]>([]);
  const [planSelections, setPlanSelections] = useState<string[]>([]);
  const [amountSelections, setAmountSelections] = useState<string[]>([]);
  const [dueDateSelections, setDueDateSelections] = useState<string[]>([]);
  const [trialEndSelections, setTrialEndSelections] = useState<string[]>([]);
  const [statusSelections, setStatusSelections] = useState<string[]>([]);
  const [gatewaySelections, setGatewaySelections] = useState<string[]>([]);
  const [createdSelections, setCreatedSelections] = useState<string[]>([]);
  const [companyIdFilter, setCompanyIdFilter] = useState<number | null>(initialCompanyId);
  const [companySearch, setCompanySearch] = useState(initialCompanySearch);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [dueOnly, setDueOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sortKey, setSortKey] = useState<PaymentSortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewingPayment, setViewingPayment] = useState<IndexedPaymentType | null>(null);
  const [editingPayment, setEditingPayment] = useState<IndexedPaymentType | null>(null);
  const [editStatus, setEditStatus] = useState('pending');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDueReason, setEditDueReason] = useState('');
  const [suspendScope, setSuspendScope] = useState('billing_only');
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendUntil, setSuspendUntil] = useState('');
  const [resumeReason, setResumeReason] = useState('');
  const [manualSource, setManualSource] = useState('manual');
  const [manualPaymentMethod, setManualPaymentMethod] = useState('paypal');
  const [manualReceiver, setManualReceiver] = useState('');
  const [manualSender, setManualSender] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualReason, setManualReason] = useState('');

  useEffect(() => {
    setCompanyIdFilter(initialCompanyId);
  }, [initialCompanyId]);

  useEffect(() => {
    setCompanySearch(initialCompanySearch || '');
  }, [initialCompanySearch]);

  const paymentQueryVariables = {
    status: null,
    companyId: companyIdFilter,
    dateFrom: null,
    dateTo: null,
    search: companySearch.trim() || null,
  };

  const { data, loading, error, refetch } = useQuery<
    { adminPayments: PaymentType[] },
    { status: PaymentStatus; companyId: number | null; dateFrom: string | null; dateTo: string | null; search: string | null },
    any
  >(ADMIN_PAYMENTS_QUERY, {
    variables: paymentQueryVariables,
  });

  const { data: companiesData } = useQuery<
    { adminCompanies: CompanyType[] },
    { search: string | null; status: string | null; subscriptionStatus: string | null; dueDateFrom: string | null; dueDateTo: string | null; recurringDateFrom: string | null; recurringDateTo: string | null },
    any
  >(ADMIN_COMPANIES_QUERY, {
    variables: {
      search: null,
      status: null,
      subscriptionStatus: null,
      dueDateFrom: null,
      dueDateTo: null,
      recurringDateFrom: null,
      recurringDateTo: null,
    },
  });

  const [updatePaymentStatus] = useMutation(ADMIN_UPDATE_PAYMENT_STATUS_MUTATION);
  const [updateCompanySubscription] = useMutation(ADMIN_UPDATE_COMPANY_SUBSCRIPTION_MUTATION);
  const [suspendCompany] = useMutation(ADMIN_SUSPEND_COMPANY_MUTATION);
  const [resumeCompany] = useMutation(ADMIN_RESUME_COMPANY_MUTATION);
  const [manualSubscriptionAction] = useMutation(ADMIN_MANUAL_SUBSCRIPTION_MUTATION);

  const openEditPayment = (payment: IndexedPaymentType) => {
    setEditingPayment(payment);
    setEditStatus(payment.status || 'pending');
    setEditDueDate(toDateTimeLocalValue(payment.dueDate || null));
    setEditDueReason('');
    setSuspendScope('billing_only');
    setSuspendReason('');
    setSuspendUntil('');
    setResumeReason('');
    const gatewayMethod = (payment.gatewayMethod || '').toLowerCase();
    setManualSource('manual');
    setManualPaymentMethod(manualPaymentMethodValues.includes(gatewayMethod) ? gatewayMethod : 'paypal');
    setManualReceiver(payment.gatewayRefReceiverMedium || '');
    setManualSender(payment.gatewayRefSenderMedium || '');
    setManualNote('');
    setManualReason('');
  };

  const closeEditPayment = () => {
    setEditingPayment(null);
    setEditDueReason('');
    setSuspendReason('');
    setResumeReason('');
    setManualNote('');
    setManualReason('');
  };

  const handleStatusChange = async (paymentIntentId: string, newStatus: string) => {
    setStatusOverrides((current) => ({ ...current, [paymentIntentId]: newStatus }));
    try {
      await updatePaymentStatus({
        variables: {
          paymentIntentId,
          status: newStatus,
          reason: newStatus === 'failed' ? 'manual_update_failed' : null,
        },
        refetchQueries: [
          {
            query: ADMIN_PAYMENTS_QUERY,
            variables: paymentQueryVariables,
          },
          {
            query: ADMIN_COMPANIES_QUERY,
            variables: {
              search: null,
              status: null,
              subscriptionStatus: null,
              dueDateFrom: null,
              dueDateTo: null,
              recurringDateFrom: null,
              recurringDateTo: null,
            },
          },
        ],
        awaitRefetchQueries: true,
      });
      onToast('success', 'Payment status updated');
      await refetch(paymentQueryVariables);
      setStatusOverrides((current) => {
        const next = { ...current };
        delete next[paymentIntentId];
        return next;
      });
      return true;
    } catch (err: any) {
      setStatusOverrides((current) => {
        const next = { ...current };
        delete next[paymentIntentId];
        return next;
      });
      onToast('error', err.message || 'Failed to update payment status');
      return false;
    }
  };

  const handleDueDateChange = async (payment: PaymentType, nextDate: string, reason: string) => {
    if (!payment.companyId) {
      onToast('error', 'This payment is not linked to a company yet');
      return;
    }
    const subscriptionDueDate = toIsoDateTime(nextDate);
    if (!subscriptionDueDate) {
      onToast('error', 'Enter a valid due date');
      return;
    }
    if (!reason.trim()) {
      onToast('error', 'Reason is required to change due date');
      return;
    }
    try {
      await updateCompanySubscription({
        variables: {
          input: {
            companyId: payment.companyId,
            subscriptionDueDate,
            reason: reason.trim(),
          },
        },
      });
      onToast('success', 'Due date updated');
      await refetch(paymentQueryVariables);
      closeEditPayment();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to update due date');
    }
  };

  const handleSuspendCompany = async (payment: PaymentType, scope: string, reason: string, until: string) => {
    if (!payment.companyId) {
      onToast('error', 'This payment is not linked to a company yet');
      return;
    }
    if (!scope.trim()) {
      onToast('error', 'Suspension scope is required');
      return;
    }
    if (!reason.trim()) {
      onToast('error', 'Reason is required to suspend a company');
      return;
    }
    const suspendedUntil = until ? toIsoDateTime(until) : null;
    if (until && !suspendedUntil) {
      onToast('error', 'Enter a valid suspended-until date');
      return;
    }
    try {
      await suspendCompany({
        variables: {
          companyId: payment.companyId,
          scope: scope.trim(),
          reason: reason.trim(),
          suspendedUntil,
        },
      });
      onToast('success', 'Company suspended');
      await refetch(paymentQueryVariables);
      closeEditPayment();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to suspend company');
    }
  };

  const handleResumeCompany = async (payment: PaymentType, reason: string) => {
    if (!payment.companyId) {
      onToast('error', 'This payment is not linked to a company yet');
      return;
    }
    if (!reason.trim()) {
      onToast('error', 'Reason is required to resume a company');
      return;
    }
    try {
      await resumeCompany({
        variables: {
          companyId: payment.companyId,
          reason: reason.trim(),
        },
      });
      onToast('success', 'Company resumed');
      await refetch(paymentQueryVariables);
      closeEditPayment();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to resume company');
    }
  };

  const submitStatusChange = async () => {
    if (!editingPayment) return;
    const updated = await handleStatusChange(editingPayment.paymentIntentId, editStatus);
    if (updated) closeEditPayment();
  };

  const submitDueDateChange = async () => {
    if (!editingPayment) return;
    await handleDueDateChange(editingPayment, editDueDate, editDueReason);
  };

  const submitSuspendCompany = async () => {
    if (!editingPayment) return;
    await handleSuspendCompany(editingPayment, suspendScope, suspendReason, suspendUntil);
  };

  const submitResumeCompany = async () => {
    if (!editingPayment) return;
    await handleResumeCompany(editingPayment, resumeReason);
  };

  const submitManualPayment = async () => {
    if (!editingPayment) return;
    if (!editingPayment.companyId) {
      onToast('error', 'This payment is not linked to a company yet');
      return;
    }
    if (!manualPaymentMethod.trim()) {
      onToast('error', 'Payment method is required');
      return;
    }
    if (!manualReason.trim()) {
      onToast('error', 'Reason is required to record a manual payment');
      return;
    }
    try {
      await manualSubscriptionAction({
        variables: {
          companyId: editingPayment.companyId,
          subscriptionId: editingPayment.paymentIntentId,
          source: manualSource,
          paymentMethod: manualPaymentMethod,
          receiverMedium: manualReceiver.trim() || null,
          senderMedium: manualSender.trim() || null,
          gatewayPayload: JSON.stringify({
            method: manualPaymentMethod,
            source: manualSource,
            receiverMedium: manualReceiver.trim() || null,
            senderMedium: manualSender.trim() || null,
            note: manualNote.trim(),
            paymentIntentId: editingPayment.paymentIntentId,
            recordedFrom: 'supreme_dashboard',
          }),
          reason: manualReason.trim(),
        },
        refetchQueries: [
          {
            query: ADMIN_PAYMENTS_QUERY,
            variables: paymentQueryVariables,
          },
          {
            query: ADMIN_COMPANIES_QUERY,
            variables: {
              search: null,
              status: null,
              subscriptionStatus: null,
              dueDateFrom: null,
              dueDateTo: null,
              recurringDateFrom: null,
              recurringDateTo: null,
            },
          },
        ],
        awaitRefetchQueries: true,
      });
      onToast('success', 'Manual payment recorded');
      await refetch(paymentQueryVariables);
      closeEditPayment();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to record manual payment');
    }
  };

  const payments = data?.adminPayments || [];
  const companyNameById = useMemo(() => new Map(
    (companiesData?.adminCompanies || [])
      .filter((company) => company.company?.trim())
      .map((company) => [company.id, company.company.trim()] as const)
  ), [companiesData]);
  const getGatewayLabel = (payment: PaymentType) =>
    paymentMethodLabel(payment.gatewayMethod) || paymentMethodLabel(payment.source) || '-';
  const getAmountFilterValue = (payment: PaymentType) =>
    formatPrice(payment.finalAmountCents ?? payment.amount ?? 0, payment.currency || 'USD');
  const getPaymentStatus = (payment: PaymentType) => statusOverrides[payment.paymentIntentId] || payment.status;
  const getCompanyName = (payment: PaymentType) => {
    const paymentCompanyName = payment.companyName?.trim();
    if (paymentCompanyName && paymentCompanyName !== '-') return paymentCompanyName;
    if (payment.companyId !== undefined && payment.companyId !== null) {
      return companyNameById.get(payment.companyId) || `Company #${payment.companyId}`;
    }
    return 'Unknown company';
  };
  const normalizedCompanySearch = companySearch.trim().toLowerCase();
  const indexedPayments = useMemo<IndexedPaymentType[]>(() => payments.map((payment) => {
    const displayCompanyName = getCompanyName(payment);
    const effectiveStatus = getPaymentStatus(payment);
    const planText = [payment.planId, payment.planName, payment.employeeCountSnapshot]
      .filter(Boolean)
      .join(' ');
    const searchableText = [
      displayCompanyName,
      payment.email,
      payment.paymentIntentId,
      effectiveStatus,
      planText,
      payment.gatewayMethod,
      payment.source,
      payment.paymentGatewayStatus,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return {
      ...payment,
      status: effectiveStatus,
      displayCompanyName,
      searchableText,
    };
  }), [payments, companyNameById, statusOverrides]);
  const companyOptions = useMemo(
    () => buildColumnFilterOptions(indexedPayments, (payment) => payment.displayCompanyName),
    [indexedPayments],
  );
  const emailOptions = useMemo(
    () => buildColumnFilterOptions(indexedPayments, (payment) => payment.email || '-'),
    [indexedPayments],
  );
  const planOptions = useMemo(
    () => buildColumnFilterOptions(indexedPayments, (payment) => payment.planName || payment.planId || '-'),
    [indexedPayments],
  );
  const amountOptions = useMemo(
    () => buildColumnFilterOptions(indexedPayments, (payment) => getAmountFilterValue(payment)),
    [indexedPayments],
  );
  const dueDateOptions = useMemo(
    () => buildColumnFilterOptions(indexedPayments, (payment) => formatDate(payment.dueDate)),
    [indexedPayments],
  );
  const trialEndOptions = useMemo(
    () => buildColumnFilterOptions(indexedPayments, (payment) => formatDate(payment.trialEndsAt)),
    [indexedPayments],
  );
  const statusOptions = useMemo(
    () => buildColumnFilterOptions(indexedPayments, (payment) => payment.status),
    [indexedPayments],
  );
  const gatewayOptions = useMemo(
    () => buildColumnFilterOptions(indexedPayments, (payment) => getGatewayLabel(payment)),
    [indexedPayments],
  );
  const createdOptions = useMemo(
    () => buildColumnFilterOptions(indexedPayments, (payment) => formatDate(payment.createdAt)),
    [indexedPayments],
  );

  const filteredPayments = useMemo(() => {
    const seen = new Set<string>();
    const dedupedPayments = indexedPayments.filter((payment) => {
      if (seen.has(payment.paymentIntentId)) return false;
      seen.add(payment.paymentIntentId);
      return true;
    });

    const searched = normalizedCompanySearch
      ? dedupedPayments.filter((payment) => payment.searchableText.includes(normalizedCompanySearch))
      : dedupedPayments;
    const statusFiltered = searched.filter((payment) => (
      matchesColumnFilter(companySelections, payment.displayCompanyName) &&
      matchesColumnFilter(emailSelections, payment.email || '-') &&
      matchesColumnFilter(planSelections, payment.planName || payment.planId || '-') &&
      matchesColumnFilter(amountSelections, getAmountFilterValue(payment)) &&
      matchesColumnFilter(dueDateSelections, formatDate(payment.dueDate)) &&
      matchesColumnFilter(trialEndSelections, formatDate(payment.trialEndsAt)) &&
      matchesColumnFilter(statusSelections, payment.status) &&
      matchesColumnFilter(gatewaySelections, getGatewayLabel(payment)) &&
      matchesColumnFilter(createdSelections, formatDate(payment.createdAt))
    ));
    const dueFiltered = !dueOnly ? statusFiltered : statusFiltered.filter((payment) => {
      if (!payment.dueDate) return false;
      return new Date(payment.dueDate).getTime() <= Date.now() && payment.status !== 'succeeded';
    });
    if (!sortDirection) return dueFiltered;
    return [...dueFiltered].sort((a, b) => {
      const left = sortKey === 'amount' ? (a.finalAmountCents ?? a.amount ?? 0) : a[sortKey];
      const right = sortKey === 'amount' ? (b.finalAmountCents ?? b.amount ?? 0) : b[sortKey];
      const leftValue = typeof left === 'string' ? left.toLowerCase() : Number(left ?? 0);
      const rightValue = typeof right === 'string' ? right.toLowerCase() : Number(right ?? 0);
      if (leftValue < rightValue) return sortDirection === 'asc' ? -1 : 1;
      if (leftValue > rightValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [indexedPayments, normalizedCompanySearch, companySelections, emailSelections, planSelections, amountSelections, dueDateSelections, trialEndSelections, statusSelections, gatewaySelections, createdSelections, dueOnly, sortKey, sortDirection]);

  const cycleSort = (key: PaymentSortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
      return;
    }
    setSortDirection((current) => current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc');
  };

  const SortHeader = ({ label, column }: { label: string; column: PaymentSortKey }) => (
    <button
      type="button"
      onClick={() => cycleSort(column)}
      className={`inline-flex w-full items-center gap-1 text-left text-sm font-semibold ${
        sortKey === column && sortDirection ? 'text-cyan-700' : 'text-slate-700'
      }`}
    >
      <span>{label}</span>
      <span className="text-[10px]">{sortKey === column && sortDirection ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
    </button>
  );

  const exportPayments = () => {
    if (!filteredPayments.length) {
      onToast('error', 'No data available to download');
      return;
    }
    const rows = filteredPayments.map((payment) => (
      `<tr><td>${escapeHtml(payment.displayCompanyName)}</td><td>${escapeHtml(payment.email)}</td><td>${escapeHtml(payment.planName || payment.planId || '-')}</td><td>${escapeHtml(formatPrice(payment.finalAmountCents ?? payment.amount, payment.currency))}</td><td>${escapeHtml(payment.status)}</td><td>${escapeHtml(formatDate(payment.dueDate || null))}</td><td>${escapeHtml(formatDate(payment.createdAt))}</td></tr>`
    )).join('');
    downloadTextFile(
      'superadmin-subscriptions.xls',
      `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr><th>Company</th><th>Email</th><th>Plan</th><th>Amount</th><th>Status</th><th>Due Date</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table></body></html>`,
      'application/vnd.ms-excel;charset=utf-8',
    );
    onToast('success', 'Excel file downloaded successfully!');
  };

  const printPayments = () => {
    if (!filteredPayments.length) {
      onToast('error', 'No data available to print');
      return;
    }
    const rows = filteredPayments.map((payment) => (
      `<tr><td>${escapeHtml(payment.displayCompanyName)}</td><td>${escapeHtml(payment.email)}</td><td>${escapeHtml(payment.planName || payment.planId || '-')}</td><td>${escapeHtml(formatPrice(payment.finalAmountCents ?? payment.amount, payment.currency))}</td><td>${escapeHtml(payment.status)}</td><td>${escapeHtml(formatDate(payment.dueDate || null))}</td></tr>`
    )).join('');
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>Subscriptions</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#0f172a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left}th{background:#f1f5f9}</style></head><body><h1>Subscriptions & Payments</h1><table><thead><tr><th>Company</th><th>Email</th><th>Plan</th><th>Amount</th><th>Status</th><th>Due Date</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (loading) return <div className="text-center py-12 text-slate-500">Loading subscriptions...</div>;
  if (error) return <div className="text-center py-12 text-red-600">Error: {error.message}</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Subscriptions & Payments</h2>
          <p className="text-slate-600">Monitor plan billing, trial snapshots, and payment transactions</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 rounded-lg font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
        {companyIdFilter !== null && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center justify-between gap-3 text-sm text-blue-700">
            <div>Filtering subscriptions for Company ID: {companyIdFilter}</div>
            <button
              type="button"
              onClick={() => {
                setCompanyIdFilter(null);
                setCompanySearch('');
              }}
              className="inline-flex items-center gap-1 px-3 py-1 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
            >
              <X className="w-3.5 h-3.5" /> Clear company filter
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] max-w-[320px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={companySearch}
              onChange={(event) => setCompanySearch(event.target.value)}
              placeholder="Search company, plan, email..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-50"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => {
              if (open) {
                setCompanySelections([]);
                setEmailSelections([]);
                setPlanSelections([]);
                setAmountSelections([]);
                setDueDateSelections([]);
                setTrialEndSelections([]);
                setStatusSelections([]);
                setGatewaySelections([]);
                setCreatedSelections([]);
                setDueOnly(false);
              }
              return !open;
            })}
            aria-pressed={filtersOpen}
            title="Filters"
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
              filtersOpen
                ? 'border-cyan-400 bg-cyan-50 text-cyan-600'
                : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-cyan-300 hover:text-cyan-500'
            }`}
          >
            <Filter className="h-4 w-4" />
          </button>
          <button onClick={exportPayments} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" /> Excel
          </button>
          <button onClick={printPayments} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3"><SortHeader label="Company" column="displayCompanyName" /></th>
                  <th className="py-3 px-3"><SortHeader label="Email" column="email" /></th>
                  <th className="py-3 px-3"><SortHeader label="Plan" column="planName" /></th>
                  <th className="py-3 px-3"><SortHeader label="Amount" column="amount" /></th>
                  <th className="py-3 px-3"><SortHeader label="Due Date" column="dueDate" /></th>
                  <th className="py-3 px-3"><SortHeader label="Trial End" column="trialEndsAt" /></th>
                  <th className="py-3 px-3"><SortHeader label="Status" column="status" /></th>
                  <th className="text-left py-3 px-3 font-semibold text-slate-700">Gateway</th>
                  <th className="py-3 px-3"><SortHeader label="Created" column="createdAt" /></th>
                  <th className="text-right py-3 px-3 font-semibold text-slate-700">Action</th>
                </tr>
                {filtersOpen ? (
                <tr className="border-t border-slate-200 bg-white">
                  <th className="px-3 py-2">
                    <ColumnFilter
                      label="Company"
                      options={companyOptions}
                      selectedValues={companySelections}
                      onChange={setCompanySelections}
                    />
                  </th>
                  <th className="px-3 py-2">
                    <ColumnFilter
                      label="Email"
                      options={emailOptions}
                      selectedValues={emailSelections}
                      onChange={setEmailSelections}
                    />
                  </th>
                  <th className="px-3 py-2">
                    <ColumnFilter
                      label="Plan"
                      options={planOptions}
                      selectedValues={planSelections}
                      onChange={setPlanSelections}
                    />
                  </th>
                  <th className="px-3 py-2">
                    <ColumnFilter
                      label="Amount"
                      options={amountOptions}
                      selectedValues={amountSelections}
                      onChange={setAmountSelections}
                    />
                  </th>
                  <th className="px-3 py-2">
                    <div className="space-y-2">
                      <ColumnFilter
                        label="Due Date"
                        options={dueDateOptions}
                        selectedValues={dueDateSelections}
                        onChange={setDueDateSelections}
                      />
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={dueOnly}
                          onChange={(event) => setDueOnly(event.target.checked)}
                        />
                        Due only
                      </label>
                    </div>
                  </th>
                  <th className="px-3 py-2">
                    <ColumnFilter
                      label="Trial End"
                      options={trialEndOptions}
                      selectedValues={trialEndSelections}
                      onChange={setTrialEndSelections}
                    />
                  </th>
                  <th className="px-3 py-2">
                    <ColumnFilter
                      label="Status"
                      options={statusOptions}
                      selectedValues={statusSelections}
                      onChange={setStatusSelections}
                    />
                  </th>
                  <th className="px-3 py-2">
                    <ColumnFilter
                      label="Gateway"
                      options={gatewayOptions}
                      selectedValues={gatewaySelections}
                      onChange={setGatewaySelections}
                    />
                  </th>
                  <th className="px-3 py-2">
                    <ColumnFilter
                      label="Created"
                      options={createdOptions}
                      selectedValues={createdSelections}
                      onChange={setCreatedSelections}
                    />
                  </th>
                  <th className="px-3 py-2"></th>
                </tr>
                ) : null}
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                      {payments.length === 0 ? 'No payments found' : 'No payments match your filters'}
                    </td>
                  </tr>
                ) : filteredPayments.map((payment) => (
                    <tr key={payment.paymentIntentId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-3 font-medium text-slate-800">
                        <div className="max-w-[150px] truncate" title={payment.displayCompanyName}>{payment.displayCompanyName}</div>
                        <div className="max-w-[150px] truncate text-xs font-mono font-semibold text-cyan-700" title={payment.invoiceNumber || payment.paymentIntentId}>
                          {payment.invoiceNumber ? payment.invoiceNumber : payment.paymentIntentId}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700"><div className="max-w-[160px] truncate" title={payment.email}>{payment.email}</div></td>
                      <td className="py-3 px-3 text-slate-700">
                        <div className="font-semibold text-slate-800">{payment.planName || payment.planId || '-'}</div>
                        {payment.employeeCountSnapshot !== null && payment.employeeCountSnapshot !== undefined ? (
                          <div className="text-xs text-slate-500">{payment.employeeCountSnapshot} employees</div>
                        ) : null}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        <div>{formatPrice(payment.finalAmountCents ?? payment.amount, payment.currency)}</div>
                        {payment.originalAmountCents !== null && payment.originalAmountCents !== undefined && payment.originalAmountCents !== (payment.finalAmountCents ?? payment.amount) ? (
                          <div className="text-xs font-normal text-slate-500">
                            Original {formatPrice(payment.originalAmountCents, payment.currency)}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-sm">
                        <div>{formatDate(payment.dueDate || null)}</div>
                        <div className="text-xs text-slate-400">Recurring {formatDate(payment.recurringDate || null)}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-sm">
                        {formatDate(payment.trialEndsAt || null)}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusClass(payment.status)}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <div>{getGatewayLabel(payment)}</div>
                        <div className="text-xs text-slate-500">{payment.paymentGatewayStatus || '-'}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-sm">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewingPayment(payment)}
                            title="View subscription"
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View subscription</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditPayment(payment)}
                            title="Edit subscription"
                            className="rounded-lg p-2 text-cyan-700 hover:bg-cyan-50"
                          >
                            <Edit2 className="h-4 w-4" />
                            <span className="sr-only">Edit subscription</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>

      {viewingPayment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-3 sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscription-payment-detail-title"
            className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <h3
                  id="subscription-payment-detail-title"
                  className="text-[22px] font-bold tracking-[-0.3px] text-slate-800"
                >
                  Subscription Payment Detail
                </h3>
                <p className="mt-1 truncate text-[13px] text-slate-400">
                  {viewingPayment.displayCompanyName} &bull; {viewingPayment.paymentIntentId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPayment(null)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="Close subscription payment detail"
                aria-label="Close subscription payment detail"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Final amount</p>
                  <p className="mt-1.5 text-xl font-bold text-slate-900">
                    {formatPrice(viewingPayment.finalAmountCents ?? viewingPayment.amount, viewingPayment.currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Payment status</p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getPaymentStatusClass(viewingPayment.status)}`}>
                    {viewingPayment.status}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Subscription plan</p>
                  <p className="mt-1.5 text-base font-bold text-slate-800">
                    {viewingPayment.planName || viewingPayment.planId || '-'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {viewingPayment.employeeCountSnapshot ?? '-'} employees
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {[
                  {
                    title: 'Company information',
                    subtitle: 'Tenant and billing contact',
                    icon: Building2,
                    iconClass: 'bg-blue-100 text-blue-600',
                    rows: [
                      ['Company', viewingPayment.displayCompanyName],
                      ['Company ID', String(viewingPayment.companyId ?? '-')],
                      ['Billing email', viewingPayment.email || '-'],
                      ['Employees', String(viewingPayment.employeeCountSnapshot ?? '-')],
                    ],
                  },
                  {
                    title: 'Payment information',
                    subtitle: 'Transaction value and activity',
                    icon: CreditCard,
                    iconClass: 'bg-pink-100 text-pink-600',
                    rows: [
                      ['Invoice / Receipt #', viewingPayment.invoiceNumber || viewingPayment.paymentIntentId],
                      ['Payment ID', viewingPayment.paymentIntentId],
                      ['Original amount', viewingPayment.originalAmountCents !== null && viewingPayment.originalAmountCents !== undefined ? formatPrice(viewingPayment.originalAmountCents, viewingPayment.currency) : '-'],
                      ['Discount', viewingPayment.discountAmountCents ? formatPrice(viewingPayment.discountAmountCents, viewingPayment.currency) : '-'],
                      ['Promo code', viewingPayment.promoCode ? `${viewingPayment.promoCode}${viewingPayment.promoLabel && viewingPayment.promoLabel !== viewingPayment.promoCode ? ` (${viewingPayment.promoLabel})` : ''}` : '-'],
                      ['Created', formatDateTime(viewingPayment.createdAt || null)],
                      ['Updated', formatDateTime(viewingPayment.updatedAt || null)],
                    ],
                  },
                  {
                    title: 'Billing schedule',
                    subtitle: 'Subscription dates and renewal',
                    icon: CalendarDays,
                    iconClass: 'bg-amber-100 text-amber-600',
                    rows: [
                      ['Billing interval', viewingPayment.billingInterval || '-'],
                      ['Due date', formatDateTime(viewingPayment.dueDate || null)],
                      ['Recurring date', formatDateTime(viewingPayment.recurringDate || null)],
                      ['Trial start', formatDateTime(viewingPayment.trialStartsAt || null)],
                      ['Trial end', formatDateTime(viewingPayment.trialEndsAt || null)],
                      ['Next billing date', formatDateTime(viewingPayment.nextBillingDate || null)],
                    ],
                  },
                  {
                    title: 'Gateway information',
                    subtitle: 'Provider status and references',
                    icon: Landmark,
                    iconClass: 'bg-violet-100 text-violet-600',
                    rows: [
                      ['Method', getGatewayLabel(viewingPayment)],
                      ['Card', getCardSummary(viewingPayment.gatewayPayload) || '-'],
                      ['Gateway status', viewingPayment.paymentGatewayStatus || '-'],
                      ['Receiver reference', viewingPayment.gatewayRefReceiverMedium || '-'],
                      ['Sender reference', viewingPayment.gatewayRefSenderMedium || '-'],
                      ['Denied reason', viewingPayment.deniedReason || '-'],
                    ],
                  },
                ].map((section) => {
                  const Icon = section.icon;
                  return (
                    <section key={section.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                      <div className="mb-4 flex items-center gap-2.5">
                        <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg ${section.iconClass}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <h4 className="text-[13px] font-bold uppercase tracking-[0.5px] text-slate-800">
                            {section.title}
                          </h4>
                          <p className="mt-0.5 text-xs text-slate-400">{section.subtitle}</p>
                        </div>
                      </div>
                      <dl>
                        {section.rows.map(([label, value]) => (
                          <div key={label} className="flex flex-col gap-1 border-b border-slate-200/80 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                            <dd className="min-w-0 break-words text-sm font-semibold text-slate-700 sm:max-w-[65%] sm:text-right">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={() => setViewingPayment(null)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800 sm:w-auto"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  openEditPayment(viewingPayment);
                  setViewingPayment(null);
                }}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-500 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:from-cyan-600 hover:to-sky-600 sm:w-auto"
              >
                <Edit2 className="h-4 w-4" />
                Edit Payment
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingPayment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Edit Subscription Payment</h3>
                <p className="text-sm text-slate-500">{editingPayment.displayCompanyName} / {editingPayment.paymentIntentId}</p>
              </div>
              <button
                type="button"
                onClick={closeEditPayment}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-3 font-semibold text-slate-800">Payment Status</h4>
                <label className="mb-3 block text-sm font-medium text-slate-700">
                  Status
                  <select
                    value={editStatus}
                    onChange={(event) => setEditStatus(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  >
                    {paymentStatusOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={submitStatusChange}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
                >
                  Save status
                </button>
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-3 font-semibold text-slate-800">Due Date</h4>
                <label className="mb-3 block text-sm font-medium text-slate-700">
                  Due date
                  <input
                    type="datetime-local"
                    value={editDueDate}
                    onChange={(event) => setEditDueDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <label className="mb-3 block text-sm font-medium text-slate-700">
                  Reason
                  <textarea
                    value={editDueReason}
                    onChange={(event) => setEditDueReason(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="Reason for due date change"
                  />
                </label>
                <button
                  type="button"
                  onClick={submitDueDateChange}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
                >
                  Save due date
                </button>
              </section>

              <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <h4 className="mb-3 font-semibold text-slate-800">Suspend Company</h4>
                <label className="mb-3 block text-sm font-medium text-slate-700">
                  Scope
                  <select
                    value={suspendScope}
                    onChange={(event) => setSuspendScope(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="billing_only">billing_only</option>
                    <option value="feature_limited">feature_limited</option>
                    <option value="full_access_block">full_access_block</option>
                  </select>
                </label>
                <label className="mb-3 block text-sm font-medium text-slate-700">
                  Suspended until
                  <input
                    type="datetime-local"
                    value={suspendUntil}
                    onChange={(event) => setSuspendUntil(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <label className="mb-3 block text-sm font-medium text-slate-700">
                  Reason
                  <textarea
                    value={suspendReason}
                    onChange={(event) => setSuspendReason(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="Reason for suspension"
                  />
                </label>
                <button
                  type="button"
                  onClick={submitSuspendCompany}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Suspend
                </button>
              </section>

              <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                <h4 className="mb-3 font-semibold text-slate-800">Resume Company</h4>
                <label className="mb-3 block text-sm font-medium text-slate-700">
                  Reason
                  <textarea
                    value={resumeReason}
                    onChange={(event) => setResumeReason(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="Reason for resuming company"
                  />
                </label>
                <button
                  type="button"
                  onClick={submitResumeCompany}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Resume
                </button>
              </section>

              <section className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 lg:col-span-2">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-800">Manual Payment</h4>
                    <p className="text-xs text-slate-500">Record an admin payment by PayPal, check, or cash.</p>
                  </div>
                  {!editingPayment.companyId && (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      No linked company
                    </span>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Source
                    <input
                      value={manualSource}
                      onChange={(event) => setManualSource(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      placeholder="manual"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Payment method
                    <select
                      value={manualPaymentMethod}
                      onChange={(event) => setManualPaymentMethod(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    >
                      {manualPaymentMethodOptions.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Receiver reference
                    <input
                      value={manualReceiver}
                      onChange={(event) => setManualReceiver(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      placeholder="PayPal account, check number, register"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Sender reference
                    <input
                      value={manualSender}
                      onChange={(event) => setManualSender(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      placeholder="Customer account, check issuer, payer"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Reason
                    <textarea
                      value={manualReason}
                      onChange={(event) => setManualReason(event.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      placeholder="Reason for recording this payment"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Note
                    <textarea
                      value={manualNote}
                      onChange={(event) => setManualNote(event.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      placeholder="Optional admin note"
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={submitManualPayment}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <Clipboard className="h-4 w-4" />
                    Record manual payment
                  </button>
                </div>
              </section>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeEditPayment}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
