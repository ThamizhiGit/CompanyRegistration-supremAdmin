import React, { useMemo, useRef, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { ADMIN_USERS_FEED_QUERY, ADMIN_UPDATE_USER_MUTATION, ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY } from '../../../lib/graphql';
import { facetOptions, InlineSpinner, Pager, usePagedQuery } from '../../../lib/useAllPagesQuery';
import { Search, Eye, Edit2, Filter } from 'lucide-react';
import { ColumnFilter } from '../ColumnFilter';

interface UserType {
  /** An Int on the server (AdminUserType.id). */
  id: string | number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isCompanyAdmin: boolean;
  isActive: boolean;
  company?: { id: number; company: string };
  location?: { id: number; location: string };
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
  message?: unknown;
  createdAt?: string;
}

interface EditUserType {
  id: string | number;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  isCompanyAdmin: boolean;
  isActive: boolean;
}

export const Users: React.FC<{onToast: (type: 'success'|'error', msg: string) => void}> = ({ onToast }) => {
  const [companySelections, setCompanySelections] = useState<string[]>([]);
  const [locationSelections, setLocationSelections] = useState<string[]>([]);
  const [roleSelections, setRoleSelections] = useState<string[]>([]);
  const [statusSelections, setStatusSelections] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [editingUser, setEditingUser] = useState<EditUserType | null>(null);
  // The user whose activity is open (the row itself: it may not be on the current page later).
  const [activityUser, setActivityUser] = useState<UserType | null>(null);

  // One page of users at a time; the server searches, filters and counts.
  const singleBoolean = (selections: string[], whenTrue: string) =>
    selections.length === 1 ? selections[0] === whenTrue : null;
  const {
    rows: userRows,
    totalCount: usersTotal,
    facets: userFacets,
    page: usersPage,
    setPage: setUsersPage,
    pageSize: usersPageSize,
    loading: usersLoading,
    refreshing: usersRefreshing,
    error: usersError,
    refetch: refetchUsers,
  } = usePagedQuery<UserType>(ADMIN_USERS_FEED_QUERY, 'adminUsersFeed', {
    filter: {
      companyId: companySelections.map(Number).filter(Number.isFinite),
      locationId: locationSelections.map(Number).filter(Number.isFinite),
      isActive: singleBoolean(statusSelections, 'true'),
      isCompanyAdmin: singleBoolean(roleSelections, 'true'),
    },
    textFilters: { search },
  });
  // The selected user's activity, one page at a time (the server matches the
  // user as actor, or as the target of a user record).
  const {
    rows: activityRows,
    totalCount: activityTotal,
    page: activityPage,
    setPage: setActivityPage,
    pageSize: activityPageSize,
    loading: activityLoading,
    refreshing: activityRefreshing,
    error: activityError,
  } = usePagedQuery<UserActivityType>(ADMIN_USER_ACTIVITY_LOGS_FEED_QUERY, 'adminUserActivityLogsFeed', {
    filter: { userId: activityUser ? String(activityUser.id) : null },
    sortable: false,
    skip: activityUser === null,
    fetchPolicy: 'network-only',
  });

  const [updateUser] = useMutation<
    { adminUpdateUser: { success?: boolean | null; message?: string | null } | null },
    Record<string, unknown>,
    any,
    any
  >(
    ADMIN_UPDATE_USER_MUTATION,
  );
  // One save at a time: the ref blocks a second click before React re-renders.
  const savingRef = useRef(false);
  const [savingUser, setSavingUser] = useState(false);

  const users = userRows || [];
  const companyOptions = useMemo(() => facetOptions(userFacets, 'companyId'), [userFacets]);
  const locationOptions = useMemo(() => facetOptions(userFacets, 'locationId'), [userFacets]);
  const roleOptions = useMemo(
    () => facetOptions(userFacets, 'isCompanyAdmin', (facet) => (facet.value === 'True' ? 'Company Admin' : 'User'))
      .map((option) => ({ ...option, value: option.value === 'True' ? 'true' : 'false' })),
    [userFacets],
  );
  const statusOptions = useMemo(
    () => facetOptions(userFacets, 'isActive', (facet) => (facet.value === 'True' ? 'Active' : 'Inactive'))
      .map((option) => ({ ...option, value: option.value === 'True' ? 'true' : 'false' })),
    [userFacets],
  );
  const displayedUsers = users;
  const activityLogs = activityUser === null ? [] : activityRows || [];

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

  const toTitleCase = (value: string) =>
    value
      .toLowerCase()
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const formatAction = (action: unknown) => {
    if (typeof action !== 'string' || !action.trim()) return '-';
    const formatted = action.trim().toUpperCase();
    const map: Record<string, string> = {
      CREATE: 'Created',
      UPDATE: 'Updated',
      DELETE: 'Deleted',
      LOGIN: 'Logged in',
      LOGOUT: 'Logged out',
    };
    return map[formatted] || toTitleCase(formatted.toLowerCase());
  };

  const formatTargetType = (targetType: unknown) => {
    if (typeof targetType !== 'string' || !targetType.trim()) return '-';
    const formatted = targetType.trim().toLowerCase();
    const map: Record<string, string> = {
      customuser: 'User',
      custompermission: 'Permission',
      partialinvoicehistory: 'Invoice History',
      division: 'Division',
      company: 'Company',
      module: 'Package',
      subscription: 'Subscription',
      expense: 'Expense',
    };
    return map[formatted] || toTitleCase(formatted.replace(/[^a-z0-9]+/g, ' '));
  };

  const parseDetails = (details: unknown) => {
    if (details === null || details === undefined) return {};
    if (typeof details === 'string') {
      try {
        const parsed = JSON.parse(details);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }
    if (typeof details === 'object' && !Array.isArray(details)) return details as Record<string, unknown>;
    return {};
  };

  const formatActivitySummary = (activity: UserActivityType) => {
    if (typeof activity.message === 'string' && activity.message.trim()) {
      return activity.message.trim();
    }

    const action = formatAction(activity.action);
    const area = formatTargetType(activity.targetType);
    const details = parseDetails(activity.details);
    const rawAction = typeof activity.action === 'string' ? activity.action.trim().toUpperCase() : '';
    const rawTarget = typeof activity.targetType === 'string' ? activity.targetType.trim().toLowerCase() : '';

    let summary = `${action} ${area}`;

    if (rawAction === 'CREATE' && rawTarget === 'customuser') {
      summary = 'Created user account';
    } else if (rawAction === 'UPDATE' && rawTarget === 'customuser') {
      summary = 'Updated user account';
    } else if (rawAction === 'CREATE' && rawTarget === 'custompermission') {
      summary = 'Added permission';
    } else if (rawAction === 'UPDATE' && rawTarget === 'division') {
      summary = 'Updated division details';
    } else if (rawAction === 'CREATE' && rawTarget === 'partialinvoicehistory') {
      summary = 'Created invoice history record';
    }

    const extraParts: string[] = [];
    const email = typeof details.email === 'string' && details.email.trim() ? details.email.trim() : '';
    const name = typeof details.name === 'string' && details.name.trim() ? details.name.trim() : '';
    const status = typeof details.status === 'string' && details.status.trim() ? details.status.trim() : '';
    const expensePercentage = details.expense_percentage;
    const permissionName =
      typeof details.permission_name === 'string' && details.permission_name.trim()
        ? details.permission_name.trim()
        : typeof details.permission === 'string' && details.permission.trim()
          ? details.permission.trim()
          : '';

    if (permissionName && area === 'Permission') {
      extraParts.push(`permission: ${permissionName}`);
    }
    if (name && area !== 'Permission') {
      extraParts.push(`for ${name}`);
    }
    if (email) {
      extraParts.push(`for ${email}`);
    }
    if (status) {
      extraParts.push(`with status changed to ${status}`);
    }
    if (expensePercentage !== undefined) {
      extraParts.push('with expense percentage updated');
    }

    return extraParts.length ? `${summary} ${extraParts.join(' ')}` : summary;
  };

  const handleSave = async () => {
    if (!editingUser || savingRef.current) return;
    // The API takes the user id as an Int (sending the String id failed every edit).
    const userId = Number(editingUser.id);
    if (!Number.isInteger(userId)) {
      onToast('error', `This user has no numeric id (${editingUser.id}); it can't be edited here.`);
      return;
    }
    savingRef.current = true;
    setSavingUser(true);
    try {
      const result = await updateUser({
        variables: {
          userId,
          firstName: editingUser.firstName,
          lastName: editingUser.lastName,
          email: editingUser.email,
          username: editingUser.username,
          isCompanyAdmin: editingUser.isCompanyAdmin,
          isActive: editingUser.isActive,
        },
      });
      const payload = result.data?.adminUpdateUser;
      if (payload && payload.success === false) {
        onToast('error', payload.message || 'User could not be updated');
        return;
      }
      onToast('success', 'User updated');
      setEditingUser(null);
      refetchUsers();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to update user');
    } finally {
      savingRef.current = false;
      setSavingUser(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Users</h2>
        <p className="text-slate-600">Cross-tenant user management</p>
      </div>
      {usersError ? (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Error: {usersError.message}
          <button type="button" onClick={() => refetchUsers()} className="font-semibold underline">Try again</button>
        </p>
      ) : null}

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Search (name/email/username/company)</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search..."
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => {
                  if (open) {
                    setCompanySelections([]);
                    setLocationSelections([]);
                    setRoleSelections([]);
                    setStatusSelections([]);
                  }
                  return !open;
                })}
                aria-pressed={filtersOpen}
                title="Filters"
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${
                  filtersOpen
                    ? 'border-cyan-400 bg-cyan-50 text-cyan-600'
                    : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-cyan-300 hover:text-cyan-500'
                }`}
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {usersLoading ? (
          <InlineSpinner label="Loading users..." />
        ) : displayedUsers.length === 0 && !filtersOpen ? (
          <div className="text-center py-12 text-slate-500">
            {search || companySelections.length > 0 || locationSelections.length > 0 || roleSelections.length > 0 || statusSelections.length > 0
              ? 'No users match your filters'
              : 'No users found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Username</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Company</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Location</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                  <th className="sticky right-0 z-10 bg-slate-50 text-right py-3 px-4 font-semibold text-slate-700 w-24">Actions</th>
                </tr>
                {filtersOpen ? (
                <tr className="border-t border-slate-200 bg-white">
                  {/* Name, email and username: use the search above (the server searches them). */}
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2">
                    <ColumnFilter
                      label="Company"
                      options={companyOptions}
                      selectedValues={companySelections}
                      onChange={setCompanySelections}
                    />
                  </th>
                  <th className="px-4 py-2">
                    <ColumnFilter
                      label="Location"
                      options={locationOptions}
                      selectedValues={locationSelections}
                      onChange={setLocationSelections}
                    />
                  </th>
                  <th className="px-4 py-2">
                    <ColumnFilter
                      label="Role"
                      options={roleOptions}
                      selectedValues={roleSelections}
                      onChange={setRoleSelections}
                    />
                  </th>
                  <th className="px-4 py-2">
                    <ColumnFilter
                      label="Status"
                      options={statusOptions}
                      selectedValues={statusSelections}
                      onChange={setStatusSelections}
                    />
                  </th>
                  <th className="sticky right-0 z-10 bg-white px-4 py-2"></th>
                </tr>
                ) : null}
              </thead>
              <tbody>
                {displayedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      {search.trim() || companySelections.length || locationSelections.length || roleSelections.length || statusSelections.length
                        ? 'No users match your filters'
                        : 'No users found'}
                    </td>
                  </tr>
                ) : null}
                {displayedUsers.map((user) => (
                  <tr key={user.id} className="group border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-800 max-w-[150px] truncate" title={`${user.firstName} ${user.lastName}`}>{user.firstName} {user.lastName}</td>
                    <td className="py-3 px-4 text-slate-700 max-w-[220px] truncate" title={user.email}>{user.email}</td>
                    <td className="py-3 px-4 text-slate-700 font-mono text-sm max-w-[150px] truncate" title={user.username}>{user.username}</td>
                    <td className="py-3 px-4 text-slate-700 max-w-[170px] truncate" title={user.company?.company || '-'}>{user.company?.company || '-'}</td>
                    <td className="py-3 px-4 text-slate-700 max-w-[150px] truncate" title={user.location?.location || '-'}>{user.location?.location || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        user.isCompanyAdmin ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {user.isCompanyAdmin ? 'Company Admin' : 'User'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                      <td className="sticky right-0 bg-white py-3 px-4 group-hover:bg-slate-50">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <button
                        onClick={() => setActivityUser(user)}
                        title="View Activity"
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
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
                        })}
                        title="Edit User"
                        className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="sr-only">Edit User</span>
                      </button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          page={usersPage}
          pageSize={usersPageSize}
          totalCount={usersTotal}
          onPage={setUsersPage}
          refreshing={usersRefreshing}
          what="users"
        />
      </div>

      {activityUser !== null && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <h3 className="font-bold text-lg text-slate-800 truncate">
                User Activity - {`${activityUser.firstName || ''} ${activityUser.lastName || ''}`.trim() || activityUser.username}
              </h3>
              <button
                onClick={() => setActivityUser(null)}
                className="shrink-0 px-2 py-1 rounded border border-slate-200"
              >
                ×
              </button>
            </div>
            <div className="max-h-[calc(90vh-65px)] overflow-y-auto p-4">
              {activityLoading ? (
                <div className="text-center py-6 text-slate-500">Loading activity...</div>
              ) : activityError ? (
                <div className="text-center py-6 text-red-600">Failed to load activity logs: {activityError.message}</div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-6 text-slate-500">No activity found for this user.</div>
              ) : (
                <div className="space-y-2">
                  {activityLogs.map((activity) => {
                    const actionLabel = formatAction(activity.action);
                    const areaLabel = formatTargetType(activity.targetType);
                    return (
                      <details
                        key={activity.id}
                        className="group min-w-0 rounded-lg border border-slate-200 bg-white"
                      >
                        <summary className="list-none cursor-pointer">
                          <div className="grid grid-cols-1 gap-3 p-4 hover:bg-slate-50 md:grid-cols-[160px_1fr_auto] md:items-start">
                            <div className="text-sm font-semibold text-slate-800">
                              {displayDateTime(activity.createdAt)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900">{actionLabel} {areaLabel}</p>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{areaLabel}</span>
                              </div>
                              <p className="mt-1 text-sm text-slate-600">{formatActivitySummary(activity)}</p>
                              <p className="mt-2 text-xs text-slate-500">Done by {displayValue(activity.actor)}</p>
                            </div>
                            <div className="flex items-center justify-between gap-2 md:justify-end">
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{actionLabel}</span>
                              <span className="text-xs text-slate-400 group-open:hidden">Details</span>
                              <span className="hidden text-xs text-slate-400 group-open:inline">Hide details</span>
                            </div>
                          </div>
                        </summary>
                        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                          <div className="grid min-w-0 gap-2 md:grid-cols-3">
                            <p><strong>Target ID:</strong> {displayValue(activity.targetId)}</p>
                            <p><strong>Company ID:</strong> {activity.companyId || '-'}</p>
                            <div className="min-w-0 md:col-span-3">
                              <strong>Raw details:</strong>
                              <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded-md border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-600">
                                {displayValue(activity.details)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
              {activityLogs.length ? (
                <Pager
                  page={activityPage}
                  pageSize={activityPageSize}
                  totalCount={activityTotal}
                  onPage={setActivityPage}
                  refreshing={activityRefreshing}
                  what="activity entries"
                />
              ) : null}
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
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-white rounded-lg disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)' }}
                  onClick={handleSave}
                  disabled={savingUser}
                >
                  {savingUser ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
