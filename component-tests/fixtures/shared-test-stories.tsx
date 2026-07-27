import React, { useState } from 'react';
// Shared interactive stories mounted by the component suites.
import { ApolloClient, ApolloLink, InMemoryCache, Observable } from '@apollo/client';
import { ApolloProvider, useApolloClient } from '@apollo/client/react';
import { AdminDashboard } from '../../src/components/admin/AdminDashboard';
import { AdminLayout } from '../../src/components/admin/AdminLayout';
import {
  ColumnFilter,
  EMPTY_FILTER_VALUE,
} from '../../src/components/admin/ColumnFilter';
import { Toast } from '../../src/components/admin/Toast';
import { client } from '../../src/lib/apollo';

export const columnFilterOptions = [
  { value: 'Active', count: 3 },
  { value: 'Inactive', count: 2 },
  { value: EMPTY_FILTER_VALUE, count: 1 },
];

export function SharedFilterStory() {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div>
      <ColumnFilter
        label="Status"
        options={columnFilterOptions}
        selectedValues={selected}
        onChange={setSelected}
      />
      <output aria-label="selected values">{selected.join('|') || 'none'}</output>
      <button type="button">Outside target</button>
    </div>
  );
}

export function SharedToastStory({
  type,
  duration = 10_000,
}: {
  type: 'success' | 'error' | 'info';
  duration?: number;
}) {
  const [open, setOpen] = useState(true);

  return open ? (
    <Toast
      type={type}
      message={`${type} notification`}
      duration={duration}
      onClose={() => setOpen(false)}
    />
  ) : (
    <output>toast closed</output>
  );
}

type PageName = 'dashboard' | 'packages' | 'companies' | 'subscriptions' | 'users' | 'accounts';

export function SharedLayoutStory() {
  const [page, setPage] = useState<PageName>('dashboard');
  const [loggedOut, setLoggedOut] = useState(false);

  return (
    <AdminLayout
      currentPage={page}
      onPageChange={setPage}
      onLogout={() => setLoggedOut(true)}
      username="Ada Admin"
    >
      <h2>Content: {page}</h2>
      {loggedOut && <output>logout requested</output>}
    </AdminLayout>
  );
}

export function SharedProviderConsumerStory() {
  const contextClient = useApolloClient();
  return <output>{contextClient === client ? 'configured client available' : 'wrong client'}</output>;
}

const revenueSummary = {
  totalCompanies: 2,
  totalUsers: 7,
  totalPayments: 3,
  grossRevenue: 1200,
  totalExpenses: 200,
  netRevenue: 1000,
  byStatus: [],
  expenseByCategory: [],
  expenseByVendor: [],
};

export function SharedDashboardStory() {
  const testClient = new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { errorPolicy: 'all' },
      query: { errorPolicy: 'all' },
    },
    link: new ApolloLink(
      (operation) =>
        new Observable((observer) => {
          const resultByOperation: Record<string, object> = {
            AdminRevenueSummary: { adminRevenueSummary: revenueSummary },
            AdminPlans: { adminPlans: [] },
            AdminPromoCodes: { adminPromoCodes: [] },
          };
          observer.next({ data: resultByOperation[operation.operationName] ?? {} });
          observer.complete();
        }),
    ),
  });

  return (
    <ApolloProvider client={testClient}>
      <AdminDashboard username="Grace" onLogout={() => undefined} />
    </ApolloProvider>
  );
}
