import React from 'react';
import { useQuery } from '@apollo/client/react';
import { ADMIN_REVENUE_SUMMARY_QUERY } from '../../../lib/graphql';
import { formatPrice } from '../../../lib/admin-utils';
import { BarChart3, Building2, Users, CreditCard, TrendingUp } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { data, loading, error } = useQuery<{
    adminRevenueSummary: {
      totalCompanies: number;
      totalUsers: number;
      totalPayments: number;
      grossRevenue: number;
      byStatus: Array<{ status: string; count: number; amount: number }>;
    };
  }, Record<string, never>, any>(ADMIN_REVENUE_SUMMARY_QUERY);

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading dashboard...</div>;
  }

  if (error) {
    const token = localStorage.getItem('token');
    const errorMsg = (error as any).graphQLErrors?.[0]?.message || error.message;
    console.error('Dashboard Error:', { error, token: token ? 'Present' : 'Missing' });

    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-red-600 mb-2">Error Loading Dashboard</h3>
          <p className="text-red-600 text-sm mb-4">{errorMsg}</p>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-left text-xs text-slate-600 space-y-1">
            <p><strong>Debug Info:</strong></p>
            <p>Token: {token ? '✅ Present' : '❌ Missing'}</p>
            <p>User: {localStorage.getItem('adminUsername')}</p>
            <p>Error: {errorMsg}</p>
          </div>
        </div>
      </div>
    );
  }

  const summary = data?.adminRevenueSummary;

  if (!summary) {
    return <div className="text-center py-12 text-slate-500">No data available</div>;
  }

  const cards = [
    {
      label: 'Total Companies',
      value: summary.totalCompanies || 0,
      icon: Building2,
      gradient: 'linear-gradient(135deg, #e8fcf9 0%, #b3e5fc 100%)',
      textColor: '#0288d1',
      accentColor: '#00cbd6'
    },
    {
      label: 'Total Users',
      value: summary.totalUsers || 0,
      icon: Users,
      gradient: 'linear-gradient(135deg, #e0f2f1 0%, #c8e6c9 100%)',
      textColor: '#00695c',
      accentColor: '#10b981'
    },
    {
      label: 'Total Payments',
      value: summary.totalPayments || 0,
      icon: CreditCard,
      gradient: 'linear-gradient(135deg, #f3e5f5 0%, #ede7f6 100%)',
      textColor: '#6a1b9a',
      accentColor: '#7c4dff'
    },
    {
      label: 'Gross Revenue',
      value: formatPrice(summary.grossRevenue),
      icon: TrendingUp,
      gradient: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
      textColor: '#e65100',
      accentColor: '#ff6f00'
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Dashboard</h2>
        <p className="text-slate-600">Platform overview and key metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card: any) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl p-6 backdrop-blur-md transition-all hover:scale-105 hover:shadow-lg group"
              style={{
                background: card.gradient,
                border: `2px solid rgba(255, 255, 255, 0.4)`,
                boxShadow: '0 8px 16px rgba(0, 203, 214, 0.1)'
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-sm font-bold" style={{color: card.textColor}}>{card.label}</span>
                <div className="p-2 rounded-lg transition-transform group-hover:scale-110" style={{
                  backgroundColor: `rgba(${card.accentColor === '#00cbd6' ? '0, 203, 214' : card.accentColor === '#10b981' ? '16, 185, 129' : card.accentColor === '#7c4dff' ? '124, 77, 255' : '255, 111, 0'}, 0.15)`
                }}>
                  <Icon className="w-5 h-5" style={{color: card.accentColor}} />
                </div>
              </div>
              <div className="text-4xl font-black" style={{color: card.textColor}}>{card.value}</div>
            </div>
          );
        })}
      </div>

      {/* Payment Status Breakdown */}
      {summary.byStatus && summary.byStatus.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Payment Status Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Count</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {summary.byStatus.map((row: any) => (
                  <tr key={row.status} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        row.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' :
                        row.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                        row.status === 'failed' ? 'bg-red-50 text-red-700' :
                        'bg-slate-50 text-slate-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{row.count}</td>
                    <td className="py-3 px-4 text-slate-700">{formatPrice(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
