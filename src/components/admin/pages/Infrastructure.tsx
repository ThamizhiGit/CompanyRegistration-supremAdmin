import React, { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { ADMIN_INFRASTRUCTURE_QUERY } from '../../../lib/graphql';
import { formatPrice } from '../../../lib/admin-utils';

interface InfrastructureEntry {
  income: number;
  expense: number;
  net: number;
  period: string;
  pendingBalance: number;
  failedRefunds: number;
  byDay: Array<{
    date: string;
    income: number;
    expense: number;
  }>;
}

export const Infrastructure: React.FC = () => {
  const [period, setPeriod] = useState('30d');

  const { data, loading, error, refetch } = useQuery<{adminInfrastructure: InfrastructureEntry}, {period: string}, any>(ADMIN_INFRASTRUCTURE_QUERY, {
    variables: { period },
  });

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading infrastructure...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-red-600">Error: {error.message}</div>;
  }

  const payload = data?.adminInfrastructure;

  if (!payload) {
    return <div className="text-center py-12 text-slate-500">No infrastructure data available</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Infrastructure</h2>
          <p className="text-slate-600">Income, expense, and operational platform metrics</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(event) => {
              const nextPeriod = event.target.value;
              setPeriod(nextPeriod);
              refetch({ period: nextPeriod });
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Income</p>
          <h3 className="text-3xl font-black text-emerald-700 mt-2">{formatPrice(payload.income)}</h3>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Expense</p>
          <h3 className="text-3xl font-black text-rose-700 mt-2">{formatPrice(payload.expense)}</h3>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Net</p>
          <h3 className={`text-3xl font-black mt-2 ${payload.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatPrice(payload.net)}
          </h3>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Pending balance</p>
          <h3 className="text-3xl font-black text-amber-700 mt-2">{formatPrice(payload.pendingBalance)}</h3>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-700">Daily trend ({payload.period})</h3>
        </div>
        {payload.byDay.length === 0 ? (
          <div className="py-10 text-center text-slate-500">No trend data available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Income</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Expense</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Net</th>
                </tr>
              </thead>
              <tbody>
                {payload.byDay.map((row) => (
                  <tr key={row.date} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">{row.date}</td>
                    <td className="px-4 py-3 text-slate-700">{formatPrice(row.income)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatPrice(row.expense)}</td>
                    <td className={`px-4 py-3 font-medium ${row.income - row.expense >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatPrice(row.income - row.expense)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <p className="text-sm text-slate-600">Failed refunds in selected period</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{payload.failedRefunds}</p>
      </div>
    </div>
  );
};
