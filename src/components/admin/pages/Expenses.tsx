import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { Plus, Pencil, Eye, Save, X, Search, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import {
  ADMIN_EXPENSES_QUERY,
  ADMIN_EXPENSE_DETAIL_QUERY,
  ADMIN_CREATE_EXPENSE_MUTATION,
  ADMIN_UPDATE_EXPENSE_MUTATION,
  ADMIN_SET_EXPENSE_STATUS_MUTATION,
} from '../../../lib/graphql';
import { formatPrice, centsFromDollars } from '../../../lib/admin-utils';

type ExpenseStatus = 'draft' | 'pending' | 'approved' | 'paid' | 'rejected' | 'archived';
type ExpenseCategory = 'hosting' | 'service' | 'integration' | 'llm' | 'other';
type LineType = ExpenseCategory | 'custom';

type ExpenseLineItem = {
  id: string;
  expenseId: string;
  lineType: LineType;
  label: string;
  quantity: number;
  unitPriceCents: number;
  costCents: number;
  unit?: string | null;
  notes?: string | null;
  llmProvider?: string | null;
  llmModel?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
};

type Expense = {
  id: string;
  expenseRef: string;
  title: string;
  description?: string | null;
  category: ExpenseCategory;
  status: ExpenseStatus;
  vendor?: string | null;
  projectCode?: string | null;
  serviceCode?: string | null;
  incurredAt: string;
  dueAt?: string | null;
  paidAt?: string | null;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  approvedBy?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  referenceLink?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  lineItems: ExpenseLineItem[];
};

type ExpenseFeed = {
  totalCount: number;
  items: Expense[];
};

type ExpenseFilterInput = {
  search?: string | null;
  category?: string | null;
  status?: ExpenseStatus | null;
  vendor?: string | null;
  projectCode?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  currency?: string | null;
  minTotalCents?: number | null;
  maxTotalCents?: number | null;
  limit?: number | null;
  offset?: number | null;
};

type ExpenseSortInput = {
  field: string;
  direction: 'asc' | 'desc';
};

type ExpenseLineItemInput = {
  lineType: LineType;
  label: string;
  quantity: number;
  unitPriceCents: number;
  unit?: string;
  notes?: string;
  llmProvider?: string;
  llmModel?: string;
  inputTokens?: number;
  outputTokens?: number;
};

type ExpenseCreateInput = {
  title: string;
  description?: string | null;
  category: ExpenseCategory;
  vendor?: string;
  projectCode?: string;
  serviceCode?: string;
  incurredAt: string;
  dueAt?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  currency: string;
  status: ExpenseStatus;
  tags?: string[];
  referenceLink?: string;
  metadata?: Record<string, unknown>;
  lineItems: ExpenseLineItemInput[];
  taxCents: number;
};

type ExpenseUpdateInput = Omit<ExpenseCreateInput, 'status'> & { id: string };

type ExpensesQueryPayload = { adminExpenses: ExpenseFeed };

type ExpenseDetailPayload = { adminExpenseById: Expense };

type ExpensePayload = {
  success: boolean;
  message?: string | null;
  expense: Expense;
};

type ExpensesQueryVars = {
  filter: ExpenseFilterInput | null;
  sort: ExpenseSortInput | null;
};

type ExpenseResponse = { adminCreateExpense: ExpensePayload };

type ExpenseUpdateResponse = { adminUpdateExpense: ExpensePayload };

type ExpenseStatusResponse = { adminSetExpenseStatus: ExpensePayload };

type EditableLineItem = {
  id: string;
  lineType: LineType;
  label: string;
  quantity: string;
  unitPriceCents: string;
  unit: string;
  notes: string;
  llmProvider: string;
  llmModel: string;
  inputTokens: string;
  outputTokens: string;
};

type ExpenseForm = {
  id?: string;
  title: string;
  description: string;
  category: ExpenseCategory;
  status: ExpenseStatus;
  vendor: string;
  projectCode: string;
  serviceCode: string;
  incurredAt: string;
  dueAt: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  tags: string;
  referenceLink: string;
  metadata: string;
  taxInput: string;
  lineItems: EditableLineItem[];
};

const PAGE_SIZES = [10, 20, 50];
const CATEGORY_OPTIONS: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'hosting', label: 'Hosting' },
  { value: 'service', label: 'Service' },
  { value: 'integration', label: 'Integration' },
  { value: 'llm', label: 'LLM' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS: Array<{ value: ExpenseStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

const LINE_TYPES: Array<{ value: LineType; label: string }> = [
  { value: 'hosting', label: 'Hosting' },
  { value: 'service', label: 'Service' },
  { value: 'integration', label: 'Integration' },
  { value: 'llm', label: 'LLM' },
  { value: 'custom', label: 'Custom' },
  { value: 'other', label: 'Other' },
];

const STATUS_ACTIONS: Record<ExpenseStatus, ExpenseStatus[]> = {
  draft: ['pending', 'rejected', 'archived'],
  pending: ['approved', 'rejected', 'archived'],
  approved: ['paid', 'archived'],
  paid: ['archived'],
  rejected: ['draft', 'archived'],
  archived: ['draft'],
};

const statusLabel = (status: ExpenseStatus) =>
  STATUS_OPTIONS.find((option) => option.value === status)?.label || status;

const statusClasses: Record<ExpenseStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-yellow-50 text-yellow-700',
  approved: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-cyan-50 text-cyan-700',
  rejected: 'bg-rose-50 text-rose-700',
  archived: 'bg-slate-200 text-slate-600',
};

const toMoney = (value: number, currency = 'USD') => formatPrice(value, currency);

const buildPayloadFromJson = (value: string) => {
  if (!value || !value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const dollarsFromCents = (cents: number) => (cents / 100).toFixed(2);

const emptyLineItem = (): EditableLineItem => ({
  id: `${Date.now()}-${Math.random()}`,
  lineType: 'hosting',
  label: '',
  quantity: '1',
  unitPriceCents: '0.00',
  unit: '',
  notes: '',
  llmProvider: '',
  llmModel: '',
  inputTokens: '',
  outputTokens: '',
});

const emptyForm = (): ExpenseForm => ({
  title: '',
  description: '',
  category: 'other',
  status: 'draft',
  vendor: '',
  projectCode: '',
  serviceCode: '',
  incurredAt: new Date().toISOString().slice(0, 16),
  dueAt: '',
  invoiceNumber: '',
  invoiceDate: '',
  currency: 'USD',
  tags: '',
  referenceLink: '',
  metadata: '',
  taxInput: '0',
  lineItems: [emptyLineItem()],
});

const FieldLabel: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
    <span>{label}</span>
    {children}
  </label>
);

const MiniLabel: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <label className={`flex flex-col gap-1 text-xs font-medium text-slate-600 ${className}`}>
    <span>{label}</span>
    {children}
  </label>
);

export const Expenses: React.FC<{ onToast: (type: 'success' | 'error', msg: string) => void }> = ({ onToast }) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ExpenseCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ExpenseStatus>('all');
  const [vendorFilter, setVendorFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('incurredAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExpenseForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const formOverlayRef = useRef<HTMLDivElement | null>(null);

  const filterInput = useMemo<ExpenseFilterInput>(() => {
    const params: ExpenseFilterInput = {
      search: search.trim() || null,
      category: categoryFilter === 'all' ? null : categoryFilter,
      status: statusFilter === 'all' ? null : statusFilter,
      vendor: vendorFilter.trim() || null,
      projectCode: projectFilter.trim() || null,
      currency: currencyFilter.trim() || null,
      fromDate: fromDate || null,
      toDate: toDate || null,
      limit,
      offset: page * limit,
      minTotalCents: null,
      maxTotalCents: null,
    };
    return params;
  }, [search, categoryFilter, statusFilter, vendorFilter, projectFilter, currencyFilter, fromDate, toDate, limit, page]);

  const sortInput = useMemo<ExpenseSortInput>(() => ({
    field: sortBy,
    direction: sortDir,
  }), [sortBy, sortDir]);

  const { data, loading, error, refetch } = useQuery<ExpensesQueryPayload, ExpensesQueryVars, any>(
    ADMIN_EXPENSES_QUERY,
    {
      variables: { filter: filterInput, sort: sortInput },
      fetchPolicy: 'cache-and-network',
    },
  );

  const { data: detailData } = useQuery<ExpenseDetailPayload, { id: string }, any>(
    ADMIN_EXPENSE_DETAIL_QUERY,
    {
      variables: { id: selectedExpense?.id || '' },
      skip: !selectedExpense?.id,
      fetchPolicy: 'cache-and-network',
    },
  );

  const [createExpense] = useMutation(ADMIN_CREATE_EXPENSE_MUTATION);
  const [updateExpense] = useMutation(ADMIN_UPDATE_EXPENSE_MUTATION);
  const [setExpenseStatus] = useMutation(ADMIN_SET_EXPENSE_STATUS_MUTATION);

  const expenses = (data?.adminExpenses?.items || []) as Expense[];
  const totalCount = data?.adminExpenses?.totalCount || 0;
  const detailExpense = (detailData?.adminExpenseById || null) as Expense | null;

  const summary = useMemo(() => {
    const draftCount = expenses.filter((expense) => expense.status === 'draft').length;
    const pendingCount = expenses.filter((expense) => expense.status === 'pending').length;
    const approvedCount = expenses.filter((expense) => expense.status === 'approved').length;
    const totalAmount = expenses.reduce((acc, expense) => acc + expense.totalCents, 0);
    const pageCount = expenses.length;

    return { draftCount, pendingCount, approvedCount, totalAmount, pageCount };
  }, [expenses]);

  const buildFormFromExpense = (expense: Expense): ExpenseForm => {
    const localIncident = expense.incurredAt ? new Date(expense.incurredAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16);
    const lineItems: EditableLineItem[] = expense.lineItems.length
      ? expense.lineItems.map((line) => ({
          id: line.id,
          lineType: (line.lineType as LineType) || 'custom',
          label: line.label,
          quantity: String(line.quantity),
          unitPriceCents: dollarsFromCents(line.unitPriceCents),
          unit: line.unit || '',
          notes: line.notes || '',
          llmProvider: line.llmProvider || '',
          llmModel: line.llmModel || '',
          inputTokens: String(line.inputTokens ?? ''),
          outputTokens: String(line.outputTokens ?? ''),
        }))
      : [emptyLineItem()];

    return {
      id: expense.id,
      title: expense.title,
      description: expense.description || '',
      category: (expense.category as ExpenseCategory) || 'other',
      status: expense.status,
      vendor: expense.vendor || '',
      projectCode: expense.projectCode || '',
      serviceCode: expense.serviceCode || '',
      incurredAt: localIncident,
      dueAt: expense.dueAt ? new Date(expense.dueAt).toISOString().slice(0, 16) : '',
      invoiceNumber: expense.invoiceNumber || '',
      invoiceDate: expense.invoiceDate ? new Date(expense.invoiceDate).toISOString().slice(0, 16) : '',
      currency: expense.currency || 'USD',
      tags: (expense.tags || []).join(', '),
      referenceLink: expense.referenceLink || '',
      metadata: expense.metadata ? JSON.stringify(expense.metadata) : '',
      taxInput: (expense.taxCents / 100).toFixed(2),
      lineItems,
    };
  };

  const openCreateForm = () => {
    setEditing(emptyForm());
    setSelectedExpense(null);
    setFormErrors({});
    setShowOptionalDetails(false);
    setShowForm(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditing(buildFormFromExpense(expense));
    setSelectedExpense(null);
    setFormErrors({});
    setShowOptionalDetails(true);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(emptyForm());
    setSelectedExpense(null);
    setFormErrors({});
  };

  const setField = <K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) => {
    setEditing((prev) => ({ ...prev, [key]: value }));
  };

  const setLineItemField = (index: number, key: keyof EditableLineItem, value: string) => {
    setEditing((prev) => {
      const lineItems = [...prev.lineItems];
      lineItems[index] = { ...lineItems[index], [key]: value };
      return { ...prev, lineItems };
    });
  };

  const addLineItem = () => {
    setEditing((prev) => ({ ...prev, lineItems: [...prev.lineItems, emptyLineItem()] }));
  };

  const removeLineItem = (index: number) => {
    setEditing((prev) => {
      const lineItems = prev.lineItems.filter((_, i) => i !== index);
      return { ...prev, lineItems: lineItems.length ? lineItems : [emptyLineItem()] };
    });
  };

  const computedRows = useMemo(
    () =>
      editing.lineItems.map((line) => {
        const quantity = Number.parseFloat(line.quantity || '0');
        const unitPrice = Number.parseFloat(line.unitPriceCents || '0');
        const quantityValue = Number.isNaN(quantity) ? 0 : quantity;
        const priceValue = Number.isNaN(unitPrice) ? 0 : unitPrice;
        const cost = Math.max(0, Math.round(quantityValue * centsFromDollars(priceValue)));
        return cost;
      }),
    [editing.lineItems],
  );

  const subtotal = computedRows.reduce((acc, value) => acc + value, 0);
  const taxCents = Number.parseFloat(editing.taxInput || '0') * 100;
  const validTax = Number.isNaN(taxCents) ? 0 : Math.max(0, Math.round(taxCents));
  const total = Math.max(0, subtotal + validTax);
  const normalizeDuplicateKey = (value: string | null | undefined) => (value || '').trim().toLowerCase();
  const getExpenseDay = (value: string | null | undefined) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.slice(0, 10);
    return date.toISOString().slice(0, 10);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!editing.title.trim()) errors.title = 'Title is required';
    if (!editing.category) errors.category = 'Category is required';
    if (!editing.vendor.trim()) errors.vendor = 'Vendor is required';
    if (!editing.incurredAt) errors.incurredAt = 'Expense date is required';
    if (!editing.currency.trim()) errors.currency = 'Currency is required';
    const taxValue = Number.parseFloat(editing.taxInput || '0');
    if (!Number.isFinite(taxValue) || taxValue < 0) {
      errors.taxInput = 'Tax must be a non-negative number';
    }

    const currentFirstLineLabel = normalizeDuplicateKey(editing.lineItems[0]?.label);
    const duplicateExpense = expenses.find((expense) => {
      if (editing.id && expense.id === editing.id) return false;
      const sameTitle = (
        normalizeDuplicateKey(expense.title) === normalizeDuplicateKey(editing.title) &&
        normalizeDuplicateKey(expense.vendor) === normalizeDuplicateKey(editing.vendor) &&
        normalizeDuplicateKey(expense.category) === normalizeDuplicateKey(editing.category) &&
        getExpenseDay(expense.incurredAt) === getExpenseDay(editing.incurredAt)
      );
      const sameLineCost = (
        normalizeDuplicateKey(expense.vendor) === normalizeDuplicateKey(editing.vendor) &&
        normalizeDuplicateKey(expense.category) === normalizeDuplicateKey(editing.category) &&
        getExpenseDay(expense.incurredAt) === getExpenseDay(editing.incurredAt) &&
        expense.totalCents === total &&
        normalizeDuplicateKey(expense.lineItems?.[0]?.label) === currentFirstLineLabel
      );
      return sameTitle || sameLineCost;
    });

    if (duplicateExpense) {
      errors.duplicate = `Duplicate expense for ${duplicateExpense.vendor || 'this vendor'} on ${getExpenseDay(duplicateExpense.incurredAt)}. Use the existing record ${duplicateExpense.expenseRef || duplicateExpense.title}.`;
    }

    if (editing.lineItems.length === 0) {
      errors.lineItems = 'At least one line item is required';
    }

    editing.lineItems.forEach((line, index) => {
      const q = Number.parseFloat(line.quantity || '0');
      const p = Number.parseFloat(line.unitPriceCents || '0');
      if (!line.label.trim()) {
        errors[`line_${index}_label`] = 'Label is required';
      }
      if (!Number.isFinite(q) || q <= 0) {
        errors[`line_${index}_quantity`] = 'Quantity must be > 0';
      }
      if (!Number.isFinite(p) || p < 0) {
        errors[`line_${index}_price`] = 'Unit price must be non-negative';
      }
      if (line.lineType === 'llm') {
        if (!line.llmProvider.trim()) errors[`line_${index}_provider`] = 'LLM provider is required';
        if (!line.llmModel.trim()) errors[`line_${index}_model`] = 'LLM model is required';
        const inputTokens = Number.parseInt(line.inputTokens || '0', 10);
        const outputTokens = Number.parseInt(line.outputTokens || '0', 10);
        if (!Number.isFinite(inputTokens) || inputTokens < 0) errors[`line_${index}_inputTokens`] = 'Input tokens must be non-negative';
        if (!Number.isFinite(outputTokens) || outputTokens < 0) errors[`line_${index}_outputTokens`] = 'Output tokens must be non-negative';
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildLineItemPayload = (): ExpenseLineItemInput[] =>
    editing.lineItems
      .filter((line) => line.label.trim())
      .map((line) => {
        const quantity = Math.max(0, Number.parseFloat(line.quantity || '0'));
        const unitPriceCents = Math.max(0, centsFromDollars(Number.parseFloat(line.unitPriceCents || '0')));
        const payload: ExpenseLineItemInput = {
          lineType: line.lineType,
          label: line.label.trim(),
          quantity,
          unitPriceCents,
          unit: line.unit.trim() || undefined,
          notes: line.notes.trim() || undefined,
        };
        if (line.lineType === 'llm') {
          payload.llmProvider = line.llmProvider.trim();
          payload.llmModel = line.llmModel.trim();
          payload.inputTokens = Number.parseInt(line.inputTokens || '0', 10);
          payload.outputTokens = Number.parseInt(line.outputTokens || '0', 10);
        }
        return payload;
      });

  const buildCreateInput = (): ExpenseCreateInput => {
    const lineItems = buildLineItemPayload();
    const metadata = buildPayloadFromJson(editing.metadata);
    const parsedTax = Number.parseFloat(editing.taxInput || '0');
    return {
      title: editing.title.trim(),
      description: editing.description.trim() || undefined,
      category: editing.category,
      vendor: editing.vendor.trim(),
      projectCode: editing.projectCode.trim() || undefined,
      serviceCode: editing.serviceCode.trim() || undefined,
      incurredAt: new Date(editing.incurredAt).toISOString(),
      dueAt: editing.dueAt ? new Date(editing.dueAt).toISOString() : undefined,
      invoiceNumber: editing.invoiceNumber.trim() || undefined,
      invoiceDate: editing.invoiceDate ? new Date(editing.invoiceDate).toISOString() : undefined,
      currency: editing.currency.trim().toUpperCase(),
      status: editing.status,
      tags: editing.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      referenceLink: editing.referenceLink.trim() || undefined,
      metadata,
      lineItems,
      taxCents: Number.isFinite(parsedTax) ? Math.max(0, Math.round(parsedTax * 100)) : 0,
    };
  };

  const buildUpdateInput = (): ExpenseUpdateInput => {
    const base = buildCreateInput();
    const { status: _status, ...updateInput } = base;
    return {
      ...updateInput,
      id: editing.id || '',
    };
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      onToast('error', 'Please fix validation errors in the form');
      return;
    }

    setSaving(true);
    try {
      if (editing.id) {
        const originalExpense = expenses.find((expense) => expense.id === editing.id) || selectedExpense;
        await updateExpense({ variables: { input: buildUpdateInput() } });
        if (originalExpense && originalExpense.status !== editing.status) {
          await setExpenseStatus({
            variables: {
              input: {
                id: editing.id,
                status: editing.status,
                reason: '',
                actor: originalExpense.createdBy || 'admin',
              },
            },
          });
        }
        onToast('success', 'Expense updated');
      } else {
        await createExpense({ variables: { input: buildCreateInput() } });
        onToast('success', 'Expense created');
      }
      await refetch();
      closeForm();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!showForm) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.setTimeout(() => {
      formOverlayRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }, 0);
  }, [showForm, editing.id]);

  const handleStatusChange = async (expense: Expense, nextStatus: ExpenseStatus) => {
    if (expense.status === nextStatus) return;
    try {
      await setExpenseStatus({
        variables: {
          input: {
            id: expense.id,
            status: nextStatus,
            reason: '',
            actor: expense.createdBy || 'admin',
          },
        },
      });
      onToast('success', `Status updated to ${statusLabel(nextStatus)}`);
      await refetch();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to update status');
    }
  };

  const renderPager = () => {
    const pageCount = Math.max(1, Math.ceil(totalCount / limit));
    return (
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="text-sm text-slate-600">
          Showing {totalCount === 0 ? 0 : (page * limit) + 1} - {Math.min((page + 1) * limit, totalCount)} of {totalCount}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(0);
            }}
          >
            {PAGE_SIZES.map((value) => (
              <option key={value} value={value}>{value} / page</option>
            ))}
          </select>
          <button
            className="px-3 py-2 border border-slate-300 rounded-lg disabled:opacity-50"
            disabled={page === 0}
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          >
            Previous
          </button>
          <span className="text-sm text-slate-700">Page {Math.min(page + 1, pageCount)} / {pageCount}</span>
          <button
            className="px-3 py-2 border border-slate-300 rounded-lg disabled:opacity-50"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  if (loading && !data) return <div className="text-center py-12 text-slate-500">Loading expenses...</div>;
  if (error) return <div className="text-center py-12 text-red-600">Error: {error.message}</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Expenses</h2>
          <p className="text-slate-600">Track spending and allocate cost breakdown by line item</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-semibold"
            style={{ background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)' }}
          >
            <Plus className="w-4 h-4" />
            New Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Total Records</p>
          <p className="text-2xl font-black text-slate-800 mt-2">{totalCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Page Total</p>
          <p className="text-2xl font-black text-slate-800 mt-2">{summary.pageCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Total Amount</p>
          <p className="text-2xl font-black text-slate-800 mt-2">{toMoney(summary.totalAmount, editing.currency || 'USD')}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Draft / Pending</p>
          <p className="text-2xl font-black text-slate-800 mt-2">{summary.draftCount} / {summary.pendingCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Approved</p>
          <p className="text-2xl font-black text-emerald-700 mt-2">{summary.approvedCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-3">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              className="flex-1 border-0 p-2 outline-none"
              value={search}
              onChange={(event) => {
                setPage(0);
                setSearch(event.target.value);
              }}
              placeholder="Search"
            />
          </div>
          <select
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={categoryFilter}
            onChange={(event) => {
              setPage(0);
              setCategoryFilter(event.target.value as any);
            }}
          >
            <option value="all">All Categories</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={statusFilter}
            onChange={(event) => {
              setPage(0);
              setStatusFilter(event.target.value as any);
            }}
          >
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={vendorFilter}
            onChange={(event) => {
              setPage(0);
              setVendorFilter(event.target.value);
            }}
            placeholder="Vendor"
          />
              <input
                className="px-3 py-2 border border-slate-300 rounded-lg"
                value={projectFilter}
                onChange={(event) => {
                  setPage(0);
                  setProjectFilter(event.target.value);
                }}
                placeholder="Project code"
              />
              <input
                className="px-3 py-2 border border-slate-300 rounded-lg"
                value={currencyFilter}
                onChange={(event) => {
                  setPage(0);
                  setCurrencyFilter(event.target.value);
                }}
                placeholder="Currency (eg USD)"
              />
          <input
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={fromDate}
            onChange={(event) => {
              setPage(0);
              setFromDate(event.target.value);
            }}
            type="date"
          />
          <input
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={toDate}
            onChange={(event) => {
              setPage(0);
              setToDate(event.target.value);
            }}
            type="date"
          />
          <select
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value);
            }}
          >
            <option value="incurredAt">Sort: Date</option>
            <option value="totalCents">Sort: Total</option>
            <option value="status">Sort: Status</option>
          </select>
          <select
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={sortDir}
            onChange={(event) => {
              setSortDir(event.target.value as any);
            }}
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-700">Expense list</h3>
          <button
            className="text-sm px-3 py-2 border border-slate-200 rounded-lg"
            onClick={() => {
              setSearch('');
              setCategoryFilter('all');
              setStatusFilter('all');
              setVendorFilter('');
              setProjectFilter('');
              setCurrencyFilter('');
              setFromDate('');
              setToDate('');
              setSortBy('incurredAt');
              setSortDir('desc');
              setPage(0);
            }}
          >
            Clear filters
          </button>
        </div>
        {expenses.length === 0 ? (
          <div className="py-12 text-center text-slate-600">
            <p className="font-semibold text-slate-800">No expenses recorded yet</p>
            <p className="mt-1 text-sm">Create an expense here after the backend expense APIs are connected.</p>
            <button
              onClick={openCreateForm}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg font-semibold"
              style={{ background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)' }}
            >
              <Plus className="w-4 h-4" />
              New Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Ref</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Title</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Category</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Vendor</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Total</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{expense.expenseRef}</td>
                    <td className="px-4 py-3 text-slate-700">{expense.title}</td>
                    <td className="px-4 py-3 text-slate-700">{expense.category}</td>
                    <td className="px-4 py-3 text-slate-700">{expense.vendor || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatPrice(expense.totalCents, expense.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusClasses[expense.status]}`}>
                        {expense.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{expense.incurredAt?.slice(0, 10) || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200"
                          onClick={() => {
                            setSelectedExpense((current) => (current?.id === expense.id ? null : expense));
                          }}
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="px-2 py-1 rounded-lg bg-blue-100 text-blue-700 text-sm hover:bg-blue-200"
                          onClick={() => openEditForm(expense)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {renderPager()}

      {selectedExpense && detailExpense && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-bold text-slate-700">Snapshot: {detailExpense.expenseRef}</h3>
            <button
              className="text-sm px-3 py-1 border border-slate-200 rounded-lg"
              onClick={() => setSelectedExpense(null)}
            >
              Hide
            </button>
          </div>
          <div className="text-sm text-slate-600 mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            <div>Title: {detailExpense.title}</div>
            <div>Vendor: {detailExpense.vendor || '-'}</div>
            <div>Status: {detailExpense.status}</div>
            <div>Category: {detailExpense.category}</div>
            <div>Project: {detailExpense.projectCode || '-'}</div>
            <div>Total: {formatPrice(detailExpense.totalCents, detailExpense.currency)}</div>
            <div>Created: {detailExpense.createdAt?.slice(0, 16)}</div>
            <div>Updated: {detailExpense.updatedAt?.slice(0, 16)}</div>
          </div>
        </div>
      )}

      {showForm && (
        <div ref={formOverlayRef} className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 overflow-y-auto z-40">
          <div className="bg-white w-full max-w-5xl rounded-xl border border-slate-200 p-6 my-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">
                {editing.id ? 'Edit Expense' : 'Create Expense'}
              </h3>
              <button
                onClick={closeForm}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formErrors.duplicate && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {formErrors.duplicate}
              </div>
            )}

            <div className="space-y-4 mb-4">
              <div>
                <h4 className="font-semibold text-slate-800">Expense basics</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <FieldLabel label="Expense title">
                    <input
                      className={`px-3 py-2 border rounded-lg ${formErrors.title ? 'border-rose-300' : 'border-slate-300'}`}
                      value={editing.title}
                      onChange={(event) => setField('title', event.target.value)}
                      placeholder="AWS monthly hosting"
                    />
                  </FieldLabel>
                  <FieldLabel label="Vendor">
                    <input
                      className={`px-3 py-2 border rounded-lg ${formErrors.vendor ? 'border-rose-300' : 'border-slate-300'}`}
                      value={editing.vendor}
                      onChange={(event) => setField('vendor', event.target.value)}
                      placeholder="AWS, OpenAI, Stripe"
                    />
                  </FieldLabel>
                  <FieldLabel label="Category">
                    <select
                      className={`px-3 py-2 border rounded-lg ${formErrors.category ? 'border-rose-300' : 'border-slate-300'}`}
                      value={editing.category}
                      onChange={(event) => setField('category', event.target.value as ExpenseCategory)}
                    >
                      {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </FieldLabel>
                  <FieldLabel label="Status">
                    <select
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                      value={editing.status}
                      onChange={(event) => setField('status', event.target.value as ExpenseStatus)}
                    >
                      {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </FieldLabel>
                  <FieldLabel label="Expense date">
                    <input
                      className={`px-3 py-2 border rounded-lg ${formErrors.incurredAt ? 'border-rose-300' : 'border-slate-300'}`}
                      type="datetime-local"
                      value={editing.incurredAt}
                      onChange={(event) => setField('incurredAt', event.target.value)}
                    />
                  </FieldLabel>
                  <FieldLabel label="Currency">
                    <input
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                      value={editing.currency}
                      onChange={(event) => setField('currency', event.target.value)}
                      placeholder="USD"
                    />
                  </FieldLabel>
                  <FieldLabel label="Tax amount">
                    <input
                      className={`px-3 py-2 border rounded-lg ${formErrors.taxInput ? 'border-rose-300' : 'border-slate-300'}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={editing.taxInput}
                      onChange={(event) => setField('taxInput', event.target.value)}
                      placeholder="0.00"
                    />
                  </FieldLabel>
                </div>
              </div>

              <button
                className="w-full flex items-center justify-between px-4 py-3 border border-slate-200 rounded-lg text-left font-semibold text-slate-700 bg-slate-50"
                onClick={() => setShowOptionalDetails((value) => !value)}
                type="button"
              >
                Optional details
                {showOptionalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showOptionalDetails && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 border border-slate-200 rounded-lg p-4">
                  <FieldLabel label="Due date">
                    <input
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                      value={editing.dueAt}
                      type="datetime-local"
                      onChange={(event) => setField('dueAt', event.target.value)}
                    />
                  </FieldLabel>
                  <FieldLabel label="Invoice date">
                    <input
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                      type="datetime-local"
                      value={editing.invoiceDate}
                      onChange={(event) => setField('invoiceDate', event.target.value)}
                    />
                  </FieldLabel>
                  <FieldLabel label="Invoice number">
                    <input
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                      value={editing.invoiceNumber}
                      onChange={(event) => setField('invoiceNumber', event.target.value)}
                      placeholder="Optional"
                    />
                  </FieldLabel>
                  <FieldLabel label="Project code">
                    <input
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                      value={editing.projectCode}
                      onChange={(event) => setField('projectCode', event.target.value)}
                      placeholder="Optional"
                    />
                  </FieldLabel>
                  <FieldLabel label="Service code">
                    <input
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                      value={editing.serviceCode}
                      onChange={(event) => setField('serviceCode', event.target.value)}
                      placeholder="Optional"
                    />
                  </FieldLabel>
                  <FieldLabel label="Reference link">
                    <input
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                      value={editing.referenceLink}
                      onChange={(event) => setField('referenceLink', event.target.value)}
                      placeholder="Invoice or receipt URL"
                    />
                  </FieldLabel>
                  <FieldLabel label="Tags">
                    <input
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                      value={editing.tags}
                      onChange={(event) => setField('tags', event.target.value)}
                      placeholder="monthly, infra, ai"
                    />
                  </FieldLabel>
                  <FieldLabel label="Description">
                    <textarea
                      className="px-3 py-2 border border-slate-300 rounded-lg min-h-[80px]"
                      value={editing.description}
                      onChange={(event) => setField('description', event.target.value)}
                      placeholder="Optional note for finance/audit"
                    />
                  </FieldLabel>
                </div>
              )}
            </div>

            <div className="mb-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-700">Line Items</h4>
                <button
                  onClick={addLineItem}
                  className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm"
                  type="button"
                >
                  Add line item
                </button>
              </div>

              {formErrors.lineItems && <p className="text-xs text-rose-600 mb-2">{formErrors.lineItems}</p>}

              {editing.lineItems.map((line, index) => {
                const cost = computedRows[index] || 0;
                return (
                  <div key={line.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-3 pb-3 border-b border-slate-200">
                    <MiniLabel label="Cost type" className="md:col-span-2">
                      <select
                        className="px-3 py-2 border border-slate-300 rounded-lg"
                        value={line.lineType}
                        onChange={(event) => setLineItemField(index, 'lineType', event.target.value)}
                      >
                        {LINE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </MiniLabel>
                    <MiniLabel label="Item name" className="md:col-span-3">
                      <input
                        className={`px-3 py-2 border rounded-lg ${formErrors[`line_${index}_label`] ? 'border-rose-300' : 'border-slate-300'}`}
                        value={line.label}
                        onChange={(event) => setLineItemField(index, 'label', event.target.value)}
                        placeholder="e.g. EC2 compute, GPT tokens"
                      />
                    </MiniLabel>
                    <MiniLabel label="Quantity" className="md:col-span-2">
                      <input
                        className={`px-3 py-2 border rounded-lg ${formErrors[`line_${index}_quantity`] ? 'border-rose-300' : 'border-slate-300'}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(event) => setLineItemField(index, 'quantity', event.target.value)}
                        placeholder="1"
                      />
                    </MiniLabel>
                    <MiniLabel label={`Unit price (${editing.currency || 'USD'})`} className="md:col-span-2">
                      <input
                        className={`px-3 py-2 border rounded-lg ${formErrors[`line_${index}_price`] ? 'border-rose-300' : 'border-slate-300'}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPriceCents}
                        onChange={(event) => setLineItemField(index, 'unitPriceCents', event.target.value)}
                        placeholder="25.00"
                      />
                    </MiniLabel>
                    <MiniLabel label="Billing unit" className="md:col-span-2">
                      <input
                        className="px-3 py-2 border border-slate-300 rounded-lg"
                        value={line.unit}
                        onChange={(event) => setLineItemField(index, 'unit', event.target.value)}
                        placeholder="month, token, seat"
                      />
                    </MiniLabel>
                    <MiniLabel label="Calculated cost" className="md:col-span-2">
                      <input
                        className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        readOnly
                        value={formatPrice(cost, editing.currency || 'USD')}
                      />
                    </MiniLabel>

                    <MiniLabel label="Notes" className="md:col-span-4">
                      <textarea
                        className="px-3 py-2 border border-slate-300 rounded-lg"
                        value={line.notes}
                        onChange={(event) => setLineItemField(index, 'notes', event.target.value)}
                        placeholder="Optional"
                      />
                    </MiniLabel>

                    {line.lineType === 'llm' && (
                      <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-2 pt-2">
                        <MiniLabel label="LLM provider">
                          <input
                            className={`px-3 py-2 border rounded-lg ${formErrors[`line_${index}_provider`] ? 'border-rose-300' : 'border-slate-300'}`}
                            value={line.llmProvider}
                            onChange={(event) => setLineItemField(index, 'llmProvider', event.target.value)}
                            placeholder="OpenAI, Anthropic"
                          />
                        </MiniLabel>
                        <MiniLabel label="Model">
                          <input
                            className={`px-3 py-2 border rounded-lg ${formErrors[`line_${index}_model`] ? 'border-rose-300' : 'border-slate-300'}`}
                            value={line.llmModel}
                            onChange={(event) => setLineItemField(index, 'llmModel', event.target.value)}
                            placeholder="gpt-4.1, claude-sonnet"
                          />
                        </MiniLabel>
                        <MiniLabel label="Input tokens">
                          <input
                            className={`px-3 py-2 border rounded-lg ${formErrors[`line_${index}_inputTokens`] ? 'border-rose-300' : 'border-slate-300'}`}
                            type="number"
                            min="0"
                            value={line.inputTokens}
                            onChange={(event) => setLineItemField(index, 'inputTokens', event.target.value)}
                            placeholder="0"
                          />
                        </MiniLabel>
                        <MiniLabel label="Output tokens">
                          <input
                            className={`px-3 py-2 border rounded-lg ${formErrors[`line_${index}_outputTokens`] ? 'border-rose-300' : 'border-slate-300'}`}
                            type="number"
                            min="0"
                            value={line.outputTokens}
                            onChange={(event) => setLineItemField(index, 'outputTokens', event.target.value)}
                            placeholder="0"
                          />
                        </MiniLabel>
                      </div>
                    )}

                    <div className="md:col-span-12 flex justify-end">
                      <button
                        className="px-3 py-2 text-rose-700 bg-rose-50 rounded-lg text-sm"
                        onClick={() => removeLineItem(index)}
                        type="button"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="text-right text-sm text-slate-700 space-y-1">
                <p>Subtotal: <strong>{formatPrice(subtotal, editing.currency || 'USD')}</strong></p>
                <p>Tax: <strong>{formatPrice(validTax, editing.currency || 'USD')}</strong></p>
                <p>Total: <strong>{formatPrice(total, editing.currency || 'USD')}</strong></p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex gap-2 justify-end">
                <button
                  className="px-4 py-2 border border-slate-200 rounded-lg"
                  onClick={closeForm}
                  disabled={saving}
                  type="button"
                >
                  <RotateCcw className="w-4 h-4 inline mr-2" />
                  Cancel
                </button>
                <button
                  className={`px-4 py-2 text-white rounded-lg font-semibold ${saving ? 'opacity-70' : ''}`}
                  style={{ background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)' }}
                  onClick={handleSubmit}
                  disabled={saving}
                >
                  <Save className="w-4 h-4 inline mr-2" />
                  {saving ? 'Saving...' : editing.id ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
