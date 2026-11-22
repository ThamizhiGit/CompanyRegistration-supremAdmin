import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { Dashboard } from './pages/Dashboard';
import { Plans } from './pages/Plans';
import { Companies } from './pages/Companies';
import { Subscriptions } from './pages/Subscriptions';
import { Currencies } from './pages/Currencies';
import { Users } from './pages/Users';
import { Accounts } from './pages/Accounts';
import { Toast } from './Toast';

interface AdminDashboardProps {
  username: string;
  onLogout: () => void;
}

type CurrentPage = 'dashboard' | 'packages' | 'companies' | 'subscriptions' | 'currencies' | 'users' | 'accounts';

const PAGES: CurrentPage[] = ['dashboard', 'packages', 'companies', 'subscriptions', 'currencies', 'users', 'accounts'];

/*
 * The open page lives in the URL (#/companies), so a browser refresh, a
 * bookmark or a copied link opens the same page instead of the dashboard,
 * and Back/Forward move between pages. A hash needs no server rewrite rules.
 */
const pageFromHash = (): CurrentPage => {
  const name = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (PAGES as string[]).includes(name) ? (name as CurrentPage) : 'dashboard';
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ username, onLogout }) => {
  const [currentPage, setCurrentPageState] = useState<CurrentPage>(pageFromHash);

  useEffect(() => {
    const onHashChange = () => setCurrentPageState(pageFromHash());
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  const setCurrentPage = (page: CurrentPage) => {
    setCurrentPageState(page);
    const hash = `#/${page}`;
    if (window.location.hash !== hash) {
      // pushState: a Back press returns to the previous page (no hashchange fired for this push).
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    }
  };
  const [toast, setToast] = useState<{type: 'success'|'error'|'info', message: string} | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'packages':
        return <Plans onToast={showToast} />;
      case 'companies':
        return <Companies onToast={showToast} />;
      case 'subscriptions':
        return <Subscriptions onToast={showToast} />;
      case 'currencies':
        return <Currencies onToast={showToast} />;
      case 'users':
        return <Users onToast={showToast} />;
      case 'accounts':
        return <Accounts onToast={showToast} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div>
      <AdminLayout
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onLogout={onLogout}
        username={username}
      >
        {renderPage()}
      </AdminLayout>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
