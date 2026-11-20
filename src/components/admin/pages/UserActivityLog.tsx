import React, { useState } from 'react';
import { ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY } from '../../../lib/graphql';
import { InlineSpinner, Pager, usePagedQuery } from '../../../lib/useAllPagesQuery';
import { toDateTimeLocalValue, formatDateTime } from '../../../lib/admin-utils';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { Eye } from 'lucide-react';
import { DataTable, RowActionButton } from '../ui/DataTable';

const filterInputClass =
  'h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100';

interface ActivityType {
  id: string;
  actor?: unknown;
  action?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  companyId?: number;
  userId?: string | number;
  details?: unknown;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export const UserActivityLog: React.FC = () => {
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [userId, setUserId] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<ActivityType | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const debouncedCompanyId = useDebouncedValue(companyId);
  // Keyset paging: cursors[n] reads page n (page 0 has none). New rows written
  // while paging never shift the next page.
  const [cursors, setCursors] = useState<string[]>([]);
  const displayValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const filtersKey = JSON.stringify([actor, action, debouncedCompanyId, userId, fromDate, toDate]);
  const [cursorKey, setCursorKey] = useState(filtersKey);
  const cursorPages = cursorKey === filtersKey ? cursors : [];
  const cursor = cursorPages.length ? cursorPages[cursorPages.length - 1] : null;

  // One page at a time, newest first; the server filters.
  const { rows, totalCount, pageSize, loading, refreshing, error, refetch, nextCursor } = usePagedQuery<ActivityType>(
    ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY,
    'adminUserActivityLogsFeed',
    {
      sortable: false,
      filter: {
        companyId: debouncedCompanyId || null,
        from: fromDate || null,
        to: toDate || null,
        cursor,
      },
      textFilters: { actor, action, userId },
    },
  );
  const page = cursorPages.length;
  const goToPage = (target: number) => {
    if (target > page && nextCursor) {
      setCursorKey(filtersKey);
      setCursors([...cursorPages, nextCursor]);
    } else if (target < page) {
      setCursorKey(filtersKey);
      setCursors(cursorPages.slice(0, Math.max(0, target)));
    }
  };

  const logs = rows || [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-700">User Activity Log</h2>
        <p className="text-slate-600">Audit logs across user and company activity</p>
      </div>
      {error ? (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Error: {error.message}
          <button type="button" onClick={() => refetch()} className="font-semibold underline">Try again</button>
        </p>
      ) : null}

      <DataTable<ActivityType>
        testId="activity-table"
        rows={logs}
        rowKey={(log) => String(log.id)}
        searchPlaceholder="Search actor"
        searchValue={actor}
        onSearchChange={setActor}
        filtersOpen={filtersOpen}
        onFiltersToggle={(open) => {
          if (!open) {
            setAction('');
            setCompanyId('');
            setUserId('');
            setFromDate('');
            setToDate('');
          }
          setFiltersOpen(open);
        }}
        onRefresh={() => refetch()}
        loading={loading}
        loadingText={<InlineSpinner label="Loading activity logs..." />}
        emptyMessage="No activity in selected filters"
        footer={(
          <Pager
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPage={goToPage}
            refreshing={refreshing}
            what="entries"
          />
        )}
        columns={[
          {
            key: 'time',
            header: 'Time',
            className: 'whitespace-nowrap',
            filterCell: (
              <div className="flex flex-col gap-1">
                {/* The state holds ISO strings; the input needs local "YYYY-MM-DDTHH:mm". */}
                <input
                  type="datetime-local"
                  aria-label="From"
                  value={toDateTimeLocalValue(fromDate || null)}
                  onChange={(event) => setFromDate(event.target.value ? new Date(event.target.value).toISOString() : '')}
                  className={filterInputClass}
                />
                <input
                  type="datetime-local"
                  aria-label="To"
                  value={toDateTimeLocalValue(toDate || null)}
                  onChange={(event) => setToDate(event.target.value ? new Date(event.target.value).toISOString() : '')}
                  className={filterInputClass}
                />
              </div>
            ),
            render: (log) => formatDateTime(log.createdAt),
          },
          { key: 'actor', header: 'Actor', render: (log) => <span className="font-semibold">{displayValue(log.actor)}</span> },
          {
            key: 'action',
            header: 'Action',
            filterCell: <input className={filterInputClass} value={action} onChange={(event) => setAction(event.target.value)} placeholder="Action" aria-label="Action" />,
            render: (log) => displayValue(log.action),
          },
          {
            key: 'target',
            header: 'Target',
            filterCell: (
              <div className="grid grid-cols-2 gap-1">
                <input
                  className={filterInputClass}
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value ? parseInt(event.target.value, 10) : '')}
                  placeholder="Company Id"
                  aria-label="Company Id"
                  type="number"
                  min={1}
                />
                <input className={filterInputClass} value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="User Id" aria-label="User Id" />
              </div>
            ),
            render: (log) => `${displayValue(log.targetType)} / ${displayValue(log.targetId)}`,
          },
        ]}
        rowActions={(log) => <RowActionButton title="View" icon={<Eye />} onClick={() => setSelected(log)} />}
      />

      {selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white max-w-2xl w-full rounded-xl border border-slate-200 shadow-xl">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">Activity Detail</h3>
              <button onClick={() => setSelected(null)} className="px-3 py-1 border border-slate-200 rounded-lg text-sm">Close</button>
            </div>
            <div className="p-4 space-y-3 text-sm text-slate-700">
              <p><strong>Actor:</strong> {displayValue(selected.actor)}</p>
              <p><strong>Action:</strong> {displayValue(selected.action)}</p>
              <p><strong>Target:</strong> {displayValue(selected.targetType)} ({displayValue(selected.targetId)})</p>
              <p><strong>Company:</strong> {selected.companyId || '-'}</p>
              <p><strong>User:</strong> {selected.userId || '-'}</p>
              <p><strong>Created:</strong> {formatDateTime(selected.createdAt)} ({toDateTimeLocalValue(selected.createdAt)})</p>
              <p><strong>IP:</strong> {selected.ipAddress || '-'}</p>
              <p><strong>User agent:</strong> {selected.userAgent || '-'}</p>
              <div>
                <p className="font-semibold mb-1">Details</p>
                <pre className="bg-slate-50 p-3 rounded border border-slate-200 text-xs overflow-auto">{displayValue(selected.details)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
