import React, { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { ADMIN_USERS_QUERY, ADMIN_COMPANIES_QUERY } from '../../../lib/graphql';
import { formatDate } from '../../../lib/admin-utils';
import { Search } from 'lucide-react';

interface UserType {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isCompanyAdmin: boolean;
  isActive: boolean;
  company?: { id: number; company: string };
  location?: { id: number; location: string };
}

interface CompanyType {
  id: number;
  company: string;
}

export const Users: React.FC<{onToast: (type: 'success'|'error', msg: string) => void}> = ({onToast}) => {
  const [companyFilter, setCompanyFilter] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const { data: usersData, loading: usersLoading, error: usersError } = useQuery<{adminUsers: UserType[]}, {companyId: number | null; search: string | null}, any>(ADMIN_USERS_QUERY, {
    variables: {
      companyId: companyFilter,
      search: search || null
    }
  });

  const { data: companiesData } = useQuery<{adminCompanies: CompanyType[]}, {search: string | null}, any>(ADMIN_COMPANIES_QUERY, {
    variables: { search: null }
  });

  if (usersLoading) return <div className="text-center py-12 text-slate-500">Loading users...</div>;
  if (usersError) return <div className="text-center py-12 text-red-600">Error: {usersError.message}</div>;

  const users = usersData?.adminUsers || [];
  const companies = companiesData?.adminCompanies || [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Users</h2>
        <p className="text-slate-600">Cross-tenant user management</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Company</label>
            <select
              value={companyFilter || ''}
              onChange={(e) => setCompanyFilter(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">All Companies</option>
              {companies.map((company: any) => (
                <option key={company.id} value={company.id}>
                  {company.company}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Search (name/email/username)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {users.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {search || companyFilter ? 'No users match your filters' : 'No users found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Name</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Email</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Username</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Company</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Location</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Role</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: any) => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-4 px-6 font-medium text-slate-800">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="py-4 px-6 text-slate-700">{user.email}</td>
                    <td className="py-4 px-6 text-slate-700 font-mono text-sm">{user.username}</td>
                    <td className="py-4 px-6 text-slate-700">
                      {user.company?.company || '-'}
                    </td>
                    <td className="py-4 px-6 text-slate-700">
                      {user.location?.location || '-'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        user.isCompanyAdmin
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {user.isCompanyAdmin ? 'Company Admin' : 'User'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        user.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
