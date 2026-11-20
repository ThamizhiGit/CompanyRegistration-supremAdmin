import React, { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { ADMIN_INFRASTRUCTURE_QUERY } from '../../../lib/graphql';
import { formatPrice } from '../../../lib/admin-utils';
import { DataTable } from '../ui/DataTable';

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

  const { data, loading, error } = useQuery<{adminInfrastructure: InfrastructureEntry}, {period: string}, any>(ADMIN_INFRASTRUCTURE_QUERY, {
    variables: { period },
  });

  if (loading && !data) {
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
          <h2 className="text-2xl font-semibold text-gray-700">Infrastructure</h2>
          <p className="text-slate-600">Income, expense, and operational platform metrics</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Infrastructure reporting period"
            value={period}
            onChange={(event) => {
              const nextPeriod = event.target.value;
              setPeriod(nextPeriod);
            }}
            className="min-h-9 rounded-lg border-[1.5px] border-slate-200 bg-white px-2.5 py-[7px] text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:shadow-[0_0_0_2.5px_rgba(14,165,233,0.08)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
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

      <DataTable<(typeof payload.byDay)[number]>
        testId="infrastructure-trend-table"
        title={`Daily trend (${payload.period})`}
        rows={payload.byDay}
        rowKey={(row) => row.date}
        searchPlaceholder="Search dates"
        exportName="Infrastructure daily trend"
        emptyMessage="No trend data available"
        pageSize={0}
        columns={[
          { key: 'date', header: 'Date', sortable: true, render: (row) => <span className="font-semibold">{row.date}</span> },
          { key: 'income', header: 'Income', sortable: true, value: (row) => row.income, exportValue: (row) => formatPrice(row.income), render: (row) => formatPrice(row.income) },
          { key: 'expense', header: 'Expense', sortable: true, value: (row) => row.expense, exportValue: (row) => formatPrice(row.expense), render: (row) => formatPrice(row.expense) },
          {
            key: 'net',
            header: 'Net',
            sortable: true,
            value: (row) => row.income - row.expense,
            exportValue: (row) => formatPrice(row.income - row.expense),
            render: (row) => (
              <span className={`font-semibold ${row.income - row.expense >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatPrice(row.income - row.expense)}
              </span>
            ),
          },
        ]}
      />

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <p className="text-sm text-slate-600">Failed refunds in selected period</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{payload.failedRefunds}</p>
      </div>
    </div>
  );
};
