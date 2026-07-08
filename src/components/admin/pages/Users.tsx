import React, { useState } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import { ADMIN_USERS_QUERY, ADMIN_COMPANIES_QUERY, ADMIN_UPDATE_USER_MUTATION, ADMIN_ACTIVITY_LOG_QUERY } from '../../../lib/graphql';
import { Search, Eye, Edit2 } from 'lucide-react';

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

interface UserActivityType {
  id: string;
  actor?: unknown;
  action?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  companyId: number | null;
  userId: string | number;
  details?: unknown;
  createdAt?: string;
}

interface EditUserType {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  isCompanyAdmin: boolean;
  isActive: boolean;
  locationId: number | '';
}

export const Users: React.FC<{onToast: (type: 'success'|'error', msg: string) => void}> = ({ onToast }) => {
  const [companyFilter, setCompanyFilter] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<EditUserType | null>(null);
  const [activityUserId, setActivityUserId] = useState<string | number | null>(null);

  const { data: usersData, loading: usersLoading, error: usersError, refetch: refetchUsers } = useQuery<{adminUsers: UserType[]}, {
    companyId: number | null;
    search: string | null;
  }, any>(ADMIN_USERS_QUERY, {
    variables: {
      companyId: companyFilter,
      search: search || null,
    }
  });

  const { data: companiesData } = useQuery<{adminCompanies: CompanyType[]}, {search: string | null}, any>(ADMIN_COMPANIES_QUERY, {
    variables: { search: null },
  });
  const [getUserActivities, { data: activityData, loading: activityLoading, error: activityError }] = useLazyQuery<{
    adminUserActivityLogs: UserActivityType[];
  }, {
    userId: string | number;
  }, any>(ADMIN_ACTIVITY_LOG_QUERY, {
    fetchPolicy: 'network-only',
  });

  const [updateUser] = useMutation(ADMIN_UPDATE_USER_MUTATION);

  if (usersLoading) return <div className="text-center py-12 text-slate-500">Loading users...</div>;
  if (usersError) return <div className="text-center py-12 text-red-600">Error: {usersError.message}</div>;

  const users = usersData?.adminUsers || [];
  const companies = companiesData?.adminCompanies || [];
  const activityUser = users.find((user) => String(user.id) === String(activityUserId));
  const activityLogs = activityData?.adminUserActivityLogs || [];

  const toActivityUserId = (value: string | number) => {
    if (typeof value === 'number') return value;
    const asNumber = parseInt(value, 10);
    return Number.isNaN(asNumber) ? value : asNumber;
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

  const displayDateTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };

  const resolvedLocationId =
    editingUser?.locationId ? String(editingUser.locationId) : '';

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      await updateUser({
        variables: {
          userId: editingUser.id,
          firstName: editingUser.firstName,
          lastName: editingUser.lastName,
          email: editingUser.email,
          username: editingUser.username,
          isCompanyAdmin: editingUser.isCompanyAdmin,
          isActive: editingUser.isActive,
          locationId: editingUser.locationId || null,
        },
      });
      onToast('success', 'User updated');
      setEditingUser(null);
      refetchUsers();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to update user');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Users</h2>
        <p className="text-slate-600">Cross-tenant user management</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Company</label>
            <select
              value={companyFilter || ''}
              onChange={(event) => setCompanyFilter(event.target.value ? parseInt(event.target.value) : null)}
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
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {users.length === 0 ? (
          <div className="text-center py-12 text-slate-500">{search || companyFilter ? 'No users match your filters' : 'No users found'}</div>
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
                  <th className="text-right py-4 px-6 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-4 px-6 font-medium text-slate-800">{user.firstName} {user.lastName}</td>
                    <td className="py-4 px-6 text-slate-700">{user.email}</td>
                    <td className="py-4 px-6 text-slate-700 font-mono text-sm">{user.username}</td>
                    <td className="py-4 px-6 text-slate-700">{user.company?.company || '-'}</td>
                    <td className="py-4 px-6 text-slate-700">{user.location?.location || '-'}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        user.isCompanyAdmin ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {user.isCompanyAdmin ? 'Company Admin' : 'User'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                      <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => {
                          const normalizedId = toActivityUserId(user.id);
                          setActivityUserId(normalizedId);
                          getUserActivities({
                            variables: { userId: normalizedId },
                          });
                        }}
                        title="View Activity"
                        className="p-2 mr-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="sr-only">View Activity</span>
                      </button>
                      <button
                        onClick={() => setEditingUser({
                          id: user.id,
                          firstName: user.firstName,
                          lastName: user.lastName,
                          email: user.email,
                          username: user.username,
                          isCompanyAdmin: user.isCompanyAdmin,
                          isActive: user.isActive,
                          locationId: user.location?.id || '',
                        })}
                        title="Edit User"
                        className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="sr-only">Edit User</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activityUserId !== null && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">
                User Activity - {activityUser ? `${activityUser.firstName} ${activityUser.lastName}` : activityUserId}
              </h3>
              <button
                onClick={() => setActivityUserId(null)}
                className="px-2 py-1 rounded border border-slate-200"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              {activityLoading ? (
                <div className="text-center py-6 text-slate-500">Loading activity...</div>
              ) : activityError ? (
                <div className="text-center py-6 text-red-600">Failed to load activity logs: {activityError.message}</div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-6 text-slate-500">No activity logs found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Created</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Actor</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Action</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Target Type</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Target ID</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Company ID</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityLogs.map((activity) => (
                        <tr key={activity.id} className="border-b border-slate-100">
                          <td className="py-3 px-4 text-sm text-slate-700">{displayDateTime(activity.createdAt)}</td>
                          <td className="py-3 px-4 text-sm text-slate-700">{displayValue(activity.actor)}</td>
                          <td className="py-3 px-4 text-sm text-slate-700">{displayValue(activity.action)}</td>
                          <td className="py-3 px-4 text-sm text-slate-700">{displayValue(activity.targetType)}</td>
                          <td className="py-3 px-4 text-sm text-slate-700">{displayValue(activity.targetId)}</td>
                          <td className="py-3 px-4 text-sm text-slate-700">{activity.companyId || '-'}</td>
                          <td className="py-3 px-4 text-sm text-slate-700">{displayValue(activity.details)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Edit User</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label>
                  <span className="text-sm text-slate-700">First name</span>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-1"
                    value={editingUser.firstName}
                    onChange={(event) => setEditingUser({ ...editingUser, firstName: event.target.value })}
                  />
                </label>
                <label>
                  <span className="text-sm text-slate-700">Last name</span>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-1"
                    value={editingUser.lastName}
                    onChange={(event) => setEditingUser({ ...editingUser, lastName: event.target.value })}
                  />
                </label>
                <label>
                  <span className="text-sm text-slate-700">Email</span>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-1"
                    value={editingUser.email}
                    onChange={(event) => setEditingUser({ ...editingUser, email: event.target.value })}
                  />
                </label>
                <label>
                  <span className="text-sm text-slate-700">Username</span>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-1"
                    value={editingUser.username}
                    onChange={(event) => setEditingUser({ ...editingUser, username: event.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingUser.isCompanyAdmin}
                    onChange={(event) => setEditingUser({ ...editingUser, isCompanyAdmin: event.target.checked })}
                  />
                  <span>Company admin</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingUser.isActive}
                    onChange={(event) => setEditingUser({ ...editingUser, isActive: event.target.checked })}
                  />
                  <span>Active</span>
                </label>
              </div>
              <label>
                <span className="text-sm text-slate-700">Location Id</span>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-1"
                  value={resolvedLocationId}
                  onChange={(event) =>
                    setEditingUser({
                      ...editingUser,
                      locationId: event.target.value ? parseInt(event.target.value, 10) : '',
                    })
                  }
                  placeholder="Optional"
                  type="number"
                  min={1}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-white rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)' }}
                  onClick={handleSave}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
