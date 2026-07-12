import React, { useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { Dashboard } from './pages/Dashboard';
import { Plans } from './pages/Plans';
import { Companies } from './pages/Companies';
import { Subscriptions } from './pages/Subscriptions';
import { Users } from './pages/Users';
import { Accounts } from './pages/Accounts';
import { Toast } from './Toast';

interface AdminDashboardProps {
  username: string;
  onLogout: () => void;
}

type CurrentPage = 'dashboard' | 'packages' | 'companies' | 'subscriptions' | 'users' | 'accounts';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ username, onLogout }) => {
  const [currentPage, setCurrentPage] = useState<CurrentPage>('dashboard');
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
