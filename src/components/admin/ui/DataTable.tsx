import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Filter,
  Plus,
  Printer,
  RotateCcw,
  Search,
} from 'lucide-react';
import { buildColumnFilterOptions, ColumnFilter, matchesColumnFilter } from '../ColumnFilter';

/*
 * The super-admin twin of the Penquee portal's app-table
 * (con-frontend components/table). A page passes rows + column config; the
 * table draws everything else the same way on every page:
 *   - toolbar inside the box: search, column-filter toggle, extra controls,
 *     Refresh, Excel, Print, the create button
 *   - sky uppercase headers with click-to-sort (asc -> desc -> off)
 *   - a filter row under the headers (ColumnFilter per filterable column)
 *   - 52px rows, sky hover, status badges, an empty state
 *   - "Rows per page | Showing x - y of z" pagination with first/prev/next/last
 * Search, sort, filter and paging run in the browser unless the page takes
 * them over (searchValue/onSearchChange for server search, `pagination` for
 * server pages).
 */

type CellValue = string | number | boolean | null | undefined;

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Plain value: used for sorting, searching, filtering, Excel and Print. */
  value?: (row: T) => CellValue;
  /** What the cell shows; defaults to value(row). */
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  /** Adds a ColumnFilter (built from value()) to the filter row. */
  filterable?: boolean;
  /** Custom control for the filter row (server filters, ranges, dates...). */
  filterCell?: React.ReactNode;
  /** Shows value() as a coloured status badge, like the portal's statusColumns. */
  status?: boolean;
  align?: 'left' | 'right';
  /** What Excel and Print show; defaults to value(row). */
  exportValue?: (row: T) => CellValue;
  /** Left out of Excel and Print. */
  noExport?: boolean;
  className?: string;
}

export interface DataTableSort {
  key: string;
  dir: 'asc' | 'desc';
}

export interface DataTablePagination {
  page: number; // 0-based
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

interface DataTableProps<T> {
  title?: string;
  rows: T[];
  rowKey: (row: T) => string;
  columns: DataTableColumn<T>[];
  /** Buttons for the Actions column (kept as titled icon buttons). */
  rowActions?: (row: T) => React.ReactNode;
  rowClassName?: (row: T) => string;
  rowTestId?: (row: T) => string;

  searchPlaceholder?: string;
  /** Controlled search (e.g. server-side). Without it the table searches its own rows. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Hide the column-filter toggle (no filterable columns, or the page filters elsewhere). */
  showFilterToggle?: boolean;
  /** Controlled filter row (open/closed); default closed and table-owned. */
  filtersOpen?: boolean;
  onFiltersToggle?: (open: boolean) => void;
  /** Controlled sort (server-side); without it the table sorts its own rows. */
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;

  onRefresh?: () => void;
  /** Turns on the Excel and Print buttons (built from the columns). */
  exportName?: string;
  onExport?: () => void;
  onPrint?: () => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;

  createLabel?: string;
  onCreate?: () => void;
  createTestId?: string;
  /** Extra controls next to the search box (date pickers, selects...). */
  headerExtra?: React.ReactNode;
  /** Extra buttons before the create button. */
  headerActions?: React.ReactNode;
  /** Notices drawn inside the box, above the table. */
  notice?: React.ReactNode;

  loading?: boolean;
  loadingText?: React.ReactNode;
  error?: React.ReactNode;
  emptyMessage?: React.ReactNode;

  /** Client paging page size; 0 shows every row. */
  pageSize?: number;
  pageSizeOptions?: number[];
  /** Server paging; when set the rows are one page already. */
  pagination?: DataTablePagination;
  hidePagination?: boolean;
  /** Replaces the built-in pagination (e.g. the server Pager). */
  footer?: React.ReactNode;

  minWidth?: string;
  testId?: string;
}

const statusTone = (value: CellValue) => {
  const v = String(value ?? '').trim().toUpperCase();
  if (['ACTIVE', 'SUCCEEDED', 'PAID', 'COMPLETED', 'APPROVED', 'YES', 'TRIALING', 'RUNNING', 'SUCCESS', 'ENABLED'].includes(v)) {
    return 'border-emerald-300/60 bg-emerald-400/5 text-emerald-500';
  }
  if (['PENDING', 'PROCESSING', 'OPEN', 'SUBMITTED', 'IN PROGRESS', 'MONTHLY', 'YEARLY'].includes(v)) {
    return 'border-blue-300/60 bg-blue-400/5 text-blue-500';
  }
  if (['PAST_DUE', 'PAST DUE', 'DRAFT', 'ON HOLD', 'WAITING', 'REVIEW', 'INCOMPLETE', 'PARTIALLY PAID', 'REFUNDED'].includes(v)) {
    return 'border-amber-300/60 bg-amber-400/5 text-amber-500';
  }
  if (['INACTIVE', 'FAILED', 'CANCELLED', 'CANCELED', 'REJECTED', 'CLOSED', 'NO', 'EXPIRED', 'SUSPENDED', 'DISABLED', 'UNPAID'].includes(v)) {
    return 'border-rose-300/60 bg-rose-400/[0.08] text-rose-500';
  }
  return 'border-violet-300/60 bg-violet-400/[0.08] text-violet-500';
};

export const StatusBadge: React.FC<{ value: CellValue; label?: React.ReactNode }> = ({ value, label }) => (
  <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[13px] font-semibold tracking-[0.03em] ${statusTone(value)}`}>
    {label ?? String(value ?? '')}
  </span>
);

/** An icon button for the Actions column, in the portal's row-action style. */
export const RowActionButton: React.FC<{
  title: string;
  label?: string;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  testId?: string;
}> = ({ title, label, onClick, icon, danger, disabled, testId }) => (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    disabled={disabled}
    title={title}
    data-testid={testId}
    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40 [&>svg]:h-4 [&>svg]:w-4 ${
      danger
        ? 'border-rose-100 bg-white text-rose-400 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600'
        : 'border-sky-200 bg-sky-50 text-sky-600 hover:border-sky-400 hover:bg-sky-100 hover:text-sky-700'
    }`}
  >
    {icon}
    <span className="sr-only">{label ?? title}</span>
  </button>
);

const toolbarButtonClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200/60 bg-slate-50 px-3 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 [&>svg]:h-[15px] [&>svg]:w-[15px]';

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const cellText = (value: CellValue) => (value === null || value === undefined ? '' : String(value));

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    title,
    rows,
    rowKey,
    columns,
    rowActions,
    rowClassName,
    rowTestId,
    searchPlaceholder = 'Search...',
    searchValue,
    onSearchChange,
    showFilterToggle,
    filtersOpen: controlledFiltersOpen,
    onFiltersToggle,
    sort: controlledSort,
    onSortChange,
    onRefresh,
    exportName,
    onExport,
    onPrint,
    onNotify,
    createLabel,
    onCreate,
    createTestId,
    headerExtra,
    headerActions,
    notice,
    loading,
    loadingText = 'Loading...',
    error,
    emptyMessage = 'No data available',
    pageSize: initialPageSize = 10,
    pageSizeOptions = [10, 25, 50, 100],
    pagination,
    hidePagination,
    footer,
    minWidth = '700px',
    testId,
  } = props;

  const [internalSearch, setInternalSearch] = useState('');
  const search = searchValue ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;
  const [ownFiltersOpen, setOwnFiltersOpen] = useState(false);
  const filtersOpen = controlledFiltersOpen ?? ownFiltersOpen;
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [ownSort, setOwnSort] = useState<DataTableSort | null>(null);
  const sort = controlledSort !== undefined ? controlledSort : ownSort;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const valueOf = (column: DataTableColumn<T>, row: T): CellValue =>
    column.value ? column.value(row) : (row as Record<string, CellValue>)[column.key];

  const filterable = columns.filter((column) => column.filterable && !column.filterCell);
  const filterOptions = useMemo(() => {
    const options: Record<string, ReturnType<typeof buildColumnFilterOptions>> = {};
    filterable.forEach((column) => {
      options[column.key] = buildColumnFilterOptions(rows, (row) => valueOf(column, row));
    });
    return options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns]);

  const processed = useMemo(() => {
    const needle = onSearchChange ? '' : search.trim().toLowerCase();
    let out = rows.filter((row) => {
      if (needle && !columns.some((column) => cellText(valueOf(column, row)).toLowerCase().includes(needle))) return false;
      return filterable.every((column) => matchesColumnFilter(filters[column.key] || [], valueOf(column, row)));
    });
    if (sort && !onSortChange) {
      const column = columns.find((c) => c.key === sort.key);
      if (column) {
        const factor = sort.dir === 'asc' ? 1 : -1;
        out = [...out].sort((a, b) => {
          const av = valueOf(column, a);
          const bv = valueOf(column, b);
          if (av === bv) return 0;
          if (av === null || av === undefined || av === '') return 1;
          if (bv === null || bv === undefined || bv === '') return -1;
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
          return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * factor;
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, search, filters, sort, onSearchChange, onSortChange]);

  // Back to the first page whenever the visible set changes shape.
  useEffect(() => {
    setPage(0);
  }, [search, filters, sort, pageSize]);

  const total = pagination ? pagination.total : processed.length;
  const currentPage = pagination ? pagination.page : page;
  const size = pagination ? pagination.pageSize : pageSize;
  const pageCount = size > 0 ? Math.max(1, Math.ceil(total / size)) : 1;
  const safePage = Math.min(currentPage, pageCount - 1);
  const visible = pagination || size === 0 ? processed : processed.slice(safePage * size, safePage * size + size);
  const start = total === 0 ? 0 : size === 0 ? 1 : safePage * size + 1;
  const end = size === 0 ? total : Math.min(total, safePage * size + (pagination ? rows.length || size : size));

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(next, pageCount - 1));
    if (pagination) pagination.onPageChange(clamped);
    else setPage(clamped);
  };
  const changeSize = (next: number) => {
    if (pagination) pagination.onPageSizeChange?.(next);
    else setPageSize(next);
  };

  const cycleSort = (key: string) => {
    const next: DataTableSort | null =
      !sort || sort.key !== key ? { key, dir: 'asc' } : sort.dir === 'asc' ? { key, dir: 'desc' } : null;
    if (onSortChange) onSortChange(next);
    else setOwnSort(next);
  };

  const toggleFilters = () => {
    const next = !filtersOpen;
    if (!next) setFilters({});
    if (controlledFiltersOpen === undefined) setOwnFiltersOpen(next);
    onFiltersToggle?.(next);
  };

  const exportColumns = columns.filter((column) => !column.noExport);
  const htmlTable = () => {
    const head = exportColumns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join('');
    const body = processed
      .map((row) => `<tr>${exportColumns.map((column) => `<td>${escapeHtml(column.exportValue ? column.exportValue(row) : valueOf(column, row))}</td>`).join('')}</tr>`)
      .join('');
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  };
  const exportExcel = () => {
    if (onExport) return onExport();
    if (!processed.length) {
      onNotify?.('error', 'No data available to download');
      return;
    }
    const blob = new Blob(
      [`<!doctype html><html><head><meta charset="utf-8" /></head><body>${htmlTable()}</body></html>`],
      { type: 'application/vnd.ms-excel;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(exportName || title || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    onNotify?.('success', 'Excel file downloaded successfully!');
  };
  const printTable = () => {
    if (onPrint) return onPrint();
    if (!processed.length) {
      onNotify?.('error', 'No data available to print');
      return;
    }
    const win = window.open('', '_blank', 'width=1024,height=768');
    if (!win) return;
    const heading = escapeHtml(exportName || title || '');
    win.document.write(
      `<!doctype html><html><head><title>${heading}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#0f172a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left}th{background:#f1f5f9}</style></head><body><h1>${heading}</h1>${htmlTable()}</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  };

  const showToggle = showFilterToggle ?? columns.some((column) => column.filterable || column.filterCell);
  const showExport = Boolean(exportName || onExport);
  const showPrint = Boolean(exportName || onPrint);
  const colSpan = columns.length + (rowActions ? 1 : 0);

  return (
    <div className="relative overflow-x-clip overflow-y-visible rounded-lg border border-gray-200 bg-white p-2" data-testid={testId}>
      {/* ─── header bar (portal app-table) ─── */}
      <div className="flex flex-wrap items-center gap-2.5 px-3 py-3 sm:px-5">
        {title ? <h3 className="m-0 mr-2 text-base font-bold text-slate-800">{title}</h3> : null}
        <div className="relative min-w-[180px] max-w-[280px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {showToggle ? (
          <button
            type="button"
            onClick={toggleFilters}
            aria-pressed={filtersOpen}
            title="Column filters"
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border transition-all ${
              filtersOpen
                ? 'border-sky-400 bg-sky-50 text-sky-500'
                : 'border-slate-200 bg-white text-slate-400 hover:border-sky-300 hover:bg-slate-50 hover:text-sky-400'
            }`}
          >
            <Filter className="h-[15px] w-[15px]" />
          </button>
        ) : null}
        {headerExtra}
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-1.5">
          {onRefresh ? (
            <button type="button" className={toolbarButtonClass} onClick={onRefresh} title="Refresh">
              <RotateCcw />
              <span className="text-[13px] font-medium">Refresh</span>
            </button>
          ) : null}
          {showExport ? (
            <button type="button" className={toolbarButtonClass} onClick={exportExcel} title="Excel">
              <Download />
              <span className="text-[13px] font-medium">Excel</span>
            </button>
          ) : null}
          {showPrint ? (
            <button type="button" className={toolbarButtonClass} onClick={printTable} title="Print">
              <Printer />
              <span className="text-[13px] font-medium">Print</span>
            </button>
          ) : null}
          {headerActions}
          {onCreate && createLabel ? (
            <button
              type="button"
              onClick={onCreate}
              data-testid={createTestId}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:from-sky-600 hover:to-cyan-500"
            >
              <Plus className="h-4 w-4" />
              {createLabel}
            </button>
          ) : null}
        </div>
      </div>

      {notice ? <div className="space-y-2 px-3 pb-2 sm:px-5">{notice}</div> : null}

      {/* ─── table ─── */}
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full border-separate border-spacing-0 text-left" style={{ minWidth }}>
          <thead>
            <tr className="sticky top-0 z-10 bg-white">
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const align = column.align === 'right' ? 'text-right' : 'text-left';
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={`select-none whitespace-nowrap border-b border-slate-200 px-3 py-3.5 align-top text-[14px] font-extrabold uppercase tracking-wider text-sky-600 ${align}`}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => cycleSort(column.key)}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider ${column.align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-sky-700' : 'hover:text-sky-700'}`}
                      >
                        <span>{column.header}</span>
                        <span className="text-[10px]">{active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {rowActions ? (
                <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-3 py-3.5 text-right align-top text-[14px] font-extrabold uppercase tracking-wider text-sky-600">
                  Actions
                </th>
              ) : null}
            </tr>
            {filtersOpen ? (
              <tr className="bg-white">
                {columns.map((column) => (
                  <th key={column.key} className="border-b border-slate-200 px-2 py-1.5">
                    {column.filterCell ? column.filterCell : column.filterable ? (
                      <ColumnFilter
                        label={column.header}
                        options={filterOptions[column.key] || []}
                        selectedValues={filters[column.key] || []}
                        onChange={(values) => setFilters((current) => ({ ...current, [column.key]: values }))}
                      />
                    ) : null}
                  </th>
                ))}
                {rowActions ? <th className="border-b border-slate-200 px-1 py-1.5" /> : null}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-5 py-[60px] text-center text-sm font-semibold text-slate-400">
                  {loadingText}
                </td>
              </tr>
            ) : error && rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-5 py-[60px] text-center text-sm font-semibold text-rose-600">
                  {error}
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-5 py-[60px] text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="h-14 w-14 text-slate-200" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                      <rect x="8" y="8" width="48" height="48" rx="8" stroke="currentColor" strokeWidth="2" />
                      <line x1="8" y1="24" x2="56" y2="24" stroke="currentColor" strokeWidth="2" />
                      <line x1="24" y1="24" x2="24" y2="56" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <p className="m-0 text-sm font-semibold text-slate-400">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={rowKey(row)} data-testid={rowTestId?.(row)} className={`h-[52px] transition-colors hover:bg-sky-50 ${rowClassName?.(row) || ''}`}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`whitespace-normal break-words border-t border-slate-100 px-3 py-3 align-top text-[14px] text-slate-950 ${
                        column.align === 'right' ? 'text-right' : ''
                      } ${column.className || ''}`}
                    >
                      {column.render
                        ? column.render(row)
                        : column.status
                          ? <StatusBadge value={valueOf(column, row)} />
                          : cellText(valueOf(column, row))}
                    </td>
                  ))}
                  {rowActions ? (
                    <td className="whitespace-nowrap border-t border-slate-100 px-3 py-3 text-right align-top">
                      <div className="flex items-center justify-end gap-1">{rowActions(row)}</div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─── pagination (portal footer) ─── */}
      {footer ? <div className="border-t border-slate-900/[0.06] bg-[#f8fbfe] px-3 sm:px-5">{footer}</div> : hidePagination ? null : (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-900/[0.06] bg-[#f8fbfe] px-3 py-3 sm:px-5">
          <div className="flex items-center gap-2.5 text-[14px] text-slate-400">
            <span className="font-medium">Rows per page:</span>
            <select
              aria-label="Rows per page"
              className="min-w-[60px] rounded-md border border-slate-900/10 bg-white px-2 py-1 text-[14px] text-slate-600 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/10"
              value={size}
              onChange={(event) => changeSize(Number(event.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
              {pagination ? null : <option value={0}>All</option>}
            </select>
            <span className="text-slate-900/[0.12]">|</span>
            <span className="font-medium">Showing {start} - {end} of {total}</span>
          </div>
          <div className="flex items-center gap-1">
            {[
              { label: 'First page', icon: <ChevronsLeft className="h-4 w-4" />, to: 0, disabled: safePage === 0 },
              { label: 'Previous page', icon: <ChevronLeft className="h-4 w-4" />, to: safePage - 1, disabled: safePage === 0 },
              { label: 'Next page', icon: <ChevronRight className="h-4 w-4" />, to: safePage + 1, disabled: safePage >= pageCount - 1 },
              { label: 'Last page', icon: <ChevronsRight className="h-4 w-4" />, to: pageCount - 1, disabled: safePage >= pageCount - 1 },
            ].map((button) => (
              <button
                key={button.label}
                type="button"
                title={button.label}
                aria-label={button.label}
                disabled={button.disabled}
                onClick={() => goTo(button.to)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-25"
              >
                {button.icon}
              </button>
            ))}
            <span className="ml-1 text-[13px] font-medium text-slate-500">
              Page {safePage + 1} / {pageCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
