import React, { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { ADMIN_ACTIVITY_LOG_QUERY } from '../../../lib/graphql';
import { toDateTimeLocalValue, formatDateTime } from '../../../lib/admin-utils';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';

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
  const debouncedActor = useDebouncedValue(actor);
  const debouncedAction = useDebouncedValue(action);
  const debouncedCompanyId = useDebouncedValue(companyId);
  const debouncedUserId = useDebouncedValue(userId);
  const debouncedFromDate = useDebouncedValue(fromDate);
  const debouncedToDate = useDebouncedValue(toDate);
  const toActivityUserId = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? trimmed : parsed;
  };
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

  const { data, loading, error } = useQuery<{adminUserActivityLogs: ActivityType[]}, {
    actor: string;
    action: string;
    companyId: number | null;
    userId: string | number | null;
    from: string | null;
    to: string | null;
  }, any>(ADMIN_ACTIVITY_LOG_QUERY, {
    variables: {
      actor: debouncedActor || '',
      action: debouncedAction || '',
      companyId: debouncedCompanyId || null,
      userId: toActivityUserId(debouncedUserId),
      from: debouncedFromDate || null,
      to: debouncedToDate || null,
    }
  });

  if (loading && !data) {
    return <div className="text-center py-12 text-slate-500">Loading activity logs...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-red-600">Error: {error.message}</div>;
  }

  const logs = data?.adminUserActivityLogs || [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">User Activity Log</h2>
        <p className="text-slate-600">Audit logs across user and company activity</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={actor}
            onChange={(event) => setActor(event.target.value)}
            placeholder="Actor"
          />
          <input
            className="px-3 py-2 border border-slate-300 rounded-lg"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="Action"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="px-3 py-2 border border-slate-300 rounded-lg"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value ? parseInt(event.target.value, 10) : '')}
              placeholder="Company Id"
              type="number"
              min={1}
            />
            <input
              className="px-3 py-2 border border-slate-300 rounded-lg"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="User Id"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:col-span-2">
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value ? new Date(event.target.value).toISOString() : '')}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="datetime-local"
              value={toDate}
              onChange={(event) => setToDate(event.target.value ? new Date(event.target.value).toISOString() : '')}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No activity in selected filters</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Actor</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Action</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Target</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm text-slate-700">{formatDateTime(log.createdAt)}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{displayValue(log.actor)}</td>
                    <td className="py-3 px-4 text-slate-700">{displayValue(log.action)}</td>
                    <td className="py-3 px-4 text-slate-700">{displayValue(log.targetType)} / {displayValue(log.targetId)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm hover:bg-slate-100"
                        onClick={() => setSelected(log)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
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
