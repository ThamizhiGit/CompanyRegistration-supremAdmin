import React, { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { BarChart3, CalendarDays, Download, FileText, ReceiptText, WalletCards } from 'lucide-react';
import { ADMIN_ACCOUNTS_REPORT_QUERY } from '../../../lib/graphql';
import { formatPrice } from '../../../lib/admin-utils';
import { Infrastructure } from './Infrastructure';
import { Expenses } from './Expenses';

type AccountsTab = 'overview' | 'expenses' | 'monthly' | 'annual';
type ReportSortKey = 'label' | 'income' | 'expense' | 'net';
type SortDirection = 'asc' | 'desc' | null;

interface AccountsProps {
  onToast: (type: 'success' | 'error', msg: string) => void;
}

interface ReportRow {
  label: string;
  income: number;
  expense: number;
  net: number;
}

interface AccountsReport {
  period: string;
  year: number;
  month?: number | null;
  groupBy: string;
  income: number;
  expense: number;
  net: number;
  pendingBalance: number;
  failedRefunds: number;
  rows: ReportRow[];
}

const now = new Date();

const tabItems = [
  { id: 'overview', label: 'Overview', icon: WalletCards },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'monthly', label: 'Monthly Reports', icon: CalendarDays },
  { id: 'annual', label: 'Annual Reports', icon: BarChart3 },
] as const;

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

const AccountsReportTable: React.FC<{ period: 'monthly' | 'annual' }> = ({ period }) => {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groupBy, setGroupBy] = useState<'default' | 'week'>('default');
  const [sortKey, setSortKey] = useState<ReportSortKey>('label');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const variables = useMemo(() => ({
    period,
    year,
    month: period === 'monthly' ? month : null,
    groupBy: groupBy === 'week' ? 'week' : null,
  }), [period, year, month, groupBy]);

  const { data, loading, error, refetch } = useQuery<
    { adminAccountsReport: AccountsReport },
    { period: string; year: number; month: number | null; groupBy: string | null },
    any
  >(ADMIN_ACCOUNTS_REPORT_QUERY, { variables });

  const report = data?.adminAccountsReport;
  const title = `${period === 'monthly' ? 'Monthly' : 'Annual'} Accounts Report`;
  const subtitle = period === 'monthly' ? `${months[month - 1]} ${year}` : String(year);
  const sortedRows = useMemo(() => {
    const rows = report?.rows || [];
    if (!sortDirection) return rows;
    return [...rows].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const leftValue = typeof left === 'string' ? left.toLowerCase() : Number(left ?? 0);
      const rightValue = typeof right === 'string' ? right.toLowerCase() : Number(right ?? 0);
      if (leftValue < rightValue) return sortDirection === 'asc' ? -1 : 1;
      if (leftValue > rightValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [report?.rows, sortKey, sortDirection]);

  const cycleSort = (key: ReportSortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
      return;
    }
    setSortDirection((current) => current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc');
  };

  const SortHeader = ({ label, column, numeric = false }: { label: string; column: ReportSortKey; numeric?: boolean }) => (
    <button
      type="button"
      onClick={() => cycleSort(column)}
      className={`inline-flex w-full items-center gap-1 text-sm font-semibold ${
        numeric ? 'justify-end text-right' : 'justify-start text-left'
      } ${sortKey === column && sortDirection ? 'text-cyan-700' : 'text-slate-700'}`}
    >
      <span>{label}</span>
      <span className="text-[10px]">{sortKey === column && sortDirection ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
    </button>
  );

  const exportRows = () => {
    if (!report) return [];
    return [
      { Period: 'Total', Income: report.income / 100, Expense: report.expense / 100, Net: report.net / 100 },
      ...sortedRows.map((row) => ({
        Period: row.label,
        Income: row.income / 100,
        Expense: row.expense / 100,
        Net: row.net / 100,
      })),
    ];
  };

  const exportExcel = () => {
    const rows = exportRows();
    if (!rows.length) return;
    const tableRows = rows.map((row) => (
      `<tr><td>${escapeHtml(row.Period)}</td><td>${row.Income}</td><td>${row.Expense}</td><td>${row.Net}</td></tr>`
    )).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr><th colspan="4">${escapeHtml(title)} - ${escapeHtml(subtitle)}</th></tr><tr><th>Period</th><th>Income</th><th>Expense</th><th>Net</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
    downloadTextFile(
      `${period}-accounts-report-${year}${period === 'monthly' ? `-${String(month).padStart(2, '0')}` : ''}.xls`,
      html,
      'application/vnd.ms-excel;charset=utf-8',
    );
  };

  const exportPdf = () => {
    if (!report) return;
    const rows = exportRows();
    const tableRows = rows.map((row) => (
      `<tr><td>${escapeHtml(row.Period)}</td><td>${row.Income.toFixed(2)}</td><td>${row.Expense.toFixed(2)}</td><td>${row.Net.toFixed(2)}</td></tr>`
    )).join('');
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
    if (!printWindow) return;
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(title)} ${escapeHtml(subtitle)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 28px; }
            h1 { margin: 0; font-size: 22px; }
            p { margin: 6px 0 20px; color: #475569; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
            th { background: #f1f5f9; }
            td:nth-child(n+2), th:nth-child(n+2) { text-align: right; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)} · ${escapeHtml(report.groupBy)} wise</p>
          <table>
            <thead><tr><th>Period</th><th>Income</th><th>Expense</th><th>Net</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Year
            <input
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value) || now.getFullYear())}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          {period === 'monthly' && (
            <label className="text-sm font-semibold text-slate-700">
              Month
              <select
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {months.map((label, index) => (
                  <option key={label} value={index + 1}>{label}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm font-semibold text-slate-700">
            Group
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as 'default' | 'week')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="default">{period === 'monthly' ? 'Day wise' : 'Month wise'}</option>
              <option value="week">Week wise</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => refetch(variables)}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            onClick={exportExcel}
            disabled={!report}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
          <button
            onClick={exportPdf}
            disabled={!report}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {loading && !report ? (
        <div className="py-12 text-center text-slate-500">Loading report...</div>
      ) : error ? (
        <div className="py-12 text-center text-red-600">Error: {error.message}</div>
      ) : report ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-600">Income</p>
              <p className="mt-2 text-2xl font-black text-emerald-700">{formatPrice(report.income)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-600">Expense</p>
              <p className="mt-2 text-2xl font-black text-rose-700">{formatPrice(report.expense)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-600">Net</p>
              <p className={`mt-2 text-2xl font-black ${report.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatPrice(report.net)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-600">Pending balance</p>
              <p className="mt-2 text-2xl font-black text-amber-700">{formatPrice(report.pendingBalance)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3"><SortHeader label="Period" column="label" /></th>
                  <th className="px-4 py-3"><SortHeader label="Income" column="income" numeric /></th>
                  <th className="px-4 py-3"><SortHeader label="Expense" column="expense" numeric /></th>
                  <th className="px-4 py-3"><SortHeader label="Net" column="net" numeric /></th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">No report rows available</td>
                  </tr>
                ) : sortedRows.map((row) => (
                  <tr key={row.label} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">{row.label}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPrice(row.income)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPrice(row.expense)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${row.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatPrice(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export const Accounts: React.FC<AccountsProps> = ({ onToast }) => {
  const [activeTab, setActiveTab] = useState<AccountsTab>('overview');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Accounts</h2>
        <p className="text-slate-600">Infrastructure, expenses, and period reports in one place</p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2">
        {tabItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                isActive ? 'bg-cyan-500 text-white' : 'text-slate-600 hover:bg-cyan-50 hover:text-cyan-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && <Infrastructure />}
      {activeTab === 'expenses' && <Expenses onToast={onToast} />}
      {activeTab === 'monthly' && <AccountsReportTable period="monthly" />}
      {activeTab === 'annual' && <AccountsReportTable period="annual" />}
    </div>
  );
};
