import React from 'react';
import { useQuery } from '@apollo/client/react';
import { ADMIN_REVENUE_SUMMARY_QUERY } from '../../../lib/graphql';
import { formatPrice } from '../../../lib/admin-utils';
import { Building2, CreditCard, ReceiptText, TrendingUp, Users, WalletCards, type LucideIcon } from 'lucide-react';

interface RevenueStatusSummary {
  status: string;
  count: number;
  amount: number;
}

interface RevenueSummary {
  totalCompanies: number;
  totalUsers: number;
  totalPayments: number;
  grossRevenue: number;
  totalExpenses?: number | null;
  netRevenue?: number | null;
  byStatus: RevenueStatusSummary[];
}

interface DashboardCard {
  label: string;
  eyebrow: string;
  value: string | number;
  icon: LucideIcon;
  panel: string;
  textColor: string;
  iconColor: string;
  shadowColor: string;
}

export const Dashboard: React.FC = () => {
  const { data, loading, error } = useQuery<{
    adminRevenueSummary: RevenueSummary;
  }, Record<string, never>, any>(ADMIN_REVENUE_SUMMARY_QUERY);

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading dashboard...</div>;
  }

  if (error) {
    const errorMsg = (error as any).graphQLErrors?.[0]?.message || error.message;
    if (import.meta.env.DEV) {
      console.error('Dashboard Error:', error);
    }

    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="text-red-600 text-5xl mb-4">!</div>
          <h3 className="text-xl font-bold text-red-600 mb-2">Error Loading Dashboard</h3>
          <p className="text-red-600 text-sm mb-4">{errorMsg}</p>
        </div>
      </div>
    );
  }

  const summary = data?.adminRevenueSummary;

  if (!summary) {
    return <div className="text-center py-12 text-slate-500">No data available</div>;
  }

  const totalExpenses = summary.totalExpenses ?? 0;
  const netRevenue = summary.netRevenue ?? (summary.grossRevenue - totalExpenses);

  const cards: DashboardCard[] = [
    {
      label: 'Companies',
      eyebrow: 'Total Count',
      value: summary.totalCompanies || 0,
      icon: Building2,
      panel: 'linear-gradient(135deg, #eef3ff 0%, #f6f4ff 100%)',
      textColor: '#2452d6',
      iconColor: '#4f6df5',
      shadowColor: 'rgba(79, 109, 245, 0.24)'
    },
    {
      label: 'Users',
      eyebrow: 'Total Count',
      value: summary.totalUsers || 0,
      icon: Users,
      panel: 'linear-gradient(135deg, #effcf8 0%, #e3fbfb 100%)',
      textColor: '#04745f',
      iconColor: '#10b99c',
      shadowColor: 'rgba(16, 185, 156, 0.22)'
    },
    {
      label: 'Payments',
      eyebrow: 'Total Count',
      value: summary.totalPayments || 0,
      icon: CreditCard,
      panel: 'linear-gradient(135deg, #fff7e8 0%, #fff8cf 100%)',
      textColor: '#b65608',
      iconColor: '#f57c00',
      shadowColor: 'rgba(245, 124, 0, 0.24)'
    },
    {
      label: 'Gross Revenue',
      eyebrow: 'Total Amount',
      value: formatPrice(summary.grossRevenue),
      icon: TrendingUp,
      panel: 'linear-gradient(135deg, #fff0f6 0%, #f8efff 100%)',
      textColor: '#c41463',
      iconColor: '#ec3a78',
      shadowColor: 'rgba(236, 58, 120, 0.22)'
    },
    {
      label: 'Total Expenses',
      eyebrow: 'Total Amount',
      value: formatPrice(totalExpenses),
      icon: ReceiptText,
      panel: 'linear-gradient(135deg, #f7f0ff 0%, #eef2ff 100%)',
      textColor: '#6b2de6',
      iconColor: '#8b4cf0',
      shadowColor: 'rgba(139, 76, 240, 0.22)'
    },
    {
      label: 'Net Revenue',
      eyebrow: 'Net Amount',
      value: formatPrice(netRevenue),
      icon: WalletCards,
      panel: netRevenue >= 0
        ? 'linear-gradient(135deg, #eefdf3 0%, #e7fbec 100%)'
        : 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
      textColor: netRevenue >= 0 ? '#087c4d' : '#be123c',
      iconColor: netRevenue >= 0 ? '#15b66c' : '#e83c64',
      shadowColor: netRevenue >= 0 ? 'rgba(21, 182, 108, 0.22)' : 'rgba(232, 60, 100, 0.22)'
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Dashboard</h2>
        <p className="text-slate-600">Platform overview and key metrics</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="group flex min-h-[104px] items-center gap-4 rounded-2xl border border-white/70 p-4 transition-transform hover:-translate-y-0.5"
              style={{
                background: card.panel,
                boxShadow: `0 10px 22px ${card.shadowColor}, 0 2px 8px rgba(15, 23, 42, 0.08)`
              }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white transition-transform group-hover:-translate-y-0.5"
                style={{
                  backgroundColor: card.iconColor,
                  boxShadow: `0 12px 18px ${card.shadowColor}`
                }}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold leading-5" style={{ color: card.textColor }}>
                  {card.label}
                </p>
                <p className="mt-0.5 text-xs font-semibold leading-4" style={{ color: card.textColor }}>
                  {card.eyebrow}
                </p>
                <p className="mt-1 truncate text-2xl font-black leading-7" style={{ color: card.textColor }} title={String(card.value)}>
                  {card.value}
                </p>
              </div>
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
