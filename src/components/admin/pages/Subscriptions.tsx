import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { ADMIN_PAYMENTS_QUERY, ADMIN_UPDATE_PAYMENT_STATUS_MUTATION, ADMIN_PAYMENTS_QUERY as REFETCH_QUERY } from '../../../lib/graphql';
import { formatPrice, formatDate, parseModules } from '../../../lib/admin-utils';
import { RefreshCw } from 'lucide-react';

type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded' | null;

interface PaymentType {
  paymentIntentId: string;
  email: string;
  modules: string;
  amount: number;
  currency: string;
  status: string;
  companyId?: number;
  companyName?: string;
  createdAt: string;
  updatedAt: string;
}

export const Subscriptions: React.FC<{onToast: (type: 'success'|'error', msg: string) => void}> = ({onToast}) => {
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>(null);
  const [companySearch, setCompanySearch] = useState('');

  const { data, loading, error, refetch } = useQuery<{adminPayments: PaymentType[]}, {status: PaymentStatus; companyId: number | null}, any>(ADMIN_PAYMENTS_QUERY, {
    variables: {
      status: statusFilter,
      companyId: null
    }
  });

  const [updatePaymentStatus] = useMutation(ADMIN_UPDATE_PAYMENT_STATUS_MUTATION);

  const handleStatusChange = async (paymentIntentId: string, newStatus: string) => {
    try {
      await updatePaymentStatus({
        variables: {
          paymentIntentId,
          status: newStatus
        }
      });
      onToast('success', 'Payment status updated');
      refetch();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to update payment status');
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500">Loading subscriptions...</div>;
  if (error) return <div className="text-center py-12 text-red-600">Error: {error.message}</div>;

  const payments = data?.adminPayments || [];
  const statuses = ['pending', 'succeeded', 'failed', 'refunded'] as const;

  const filteredPayments = companySearch
    ? payments.filter((p: any) => p.companyName?.toLowerCase().includes(companySearch.toLowerCase()))
    : payments;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Subscriptions & Payments</h2>
          <p className="text-slate-600">Monitor and manage payment transactions</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 rounded-lg font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Status</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter(null)}
                className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Search by Company</label>
            <input
              type="text"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Company name..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {payments.length === 0 ? 'No payments found' : 'No payments match your filters'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Company</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Email</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Modules</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Amount</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Created</th>
                  <th className="text-right py-4 px-6 font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment: any) => {
                  const modules = parseModules(payment.modules);
                  return (
                    <tr key={payment.paymentIntentId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-4 px-6 font-medium text-slate-800">{payment.companyName || '-'}</td>
                      <td className="py-4 px-6 text-slate-700">{payment.email}</td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1">
                          {modules.map((mod) => (
                            <span
                              key={mod}
                              className="inline-block px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded"
                            >
                              {mod}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-800">
                        {formatPrice(payment.amount, payment.currency)}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          payment.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' :
                          payment.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                          payment.status === 'failed' ? 'bg-red-50 text-red-700' :
                          'bg-slate-50 text-slate-700'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-600 text-sm">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <select
                          value={payment.status}
                          onChange={(e) => handleStatusChange(payment.paymentIntentId, e.target.value)}
                          className="px-3 py-1 border border-slate-300 rounded text-sm bg-white cursor-pointer hover:border-slate-400"
                        >
                          <option value="pending">pending</option>
                          <option value="succeeded">succeeded</option>
                          <option value="failed">failed</option>
                          <option value="refunded">refunded</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
