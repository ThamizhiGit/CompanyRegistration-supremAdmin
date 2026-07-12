import React, { useState } from 'react';
import { LogOut, Menu, X, LayoutDashboard, Package, Building2, Users, WalletCards, CreditCard } from 'lucide-react';

interface AdminLayoutProps {
  currentPage: 'dashboard' | 'packages' | 'companies' | 'subscriptions' | 'users' | 'accounts';
  onPageChange: (page: 'dashboard' | 'packages' | 'companies' | 'subscriptions' | 'users' | 'accounts') => void;
  onLogout: () => void;
  username: string;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentPage,
  onPageChange,
  onLogout,
  username,
  children
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'packages', label: 'Plans', icon: Package },
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'accounts', label: 'Accounts', icon: WalletCards },
  ] as const;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{
      background: 'linear-gradient(135deg, #e8fcf9 0%, #f8fafc 50%, #f3fefa 100%)'
    }}>
      {/* Top Bar - Glassmorphic */}
      <div className="h-16 flex items-center justify-between gap-3 px-4 backdrop-blur-md sm:px-6" style={{
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderBottom: '1px solid rgba(0, 203, 214, 0.1)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
      }}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg transition-all hover:scale-110"
            style={{color: '#00cbd6', backgroundColor: 'rgba(0, 203, 214, 0.1)'}}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="text-xl font-black sm:text-2xl" style={{
            color: '#00cbd6',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
          }}>Supreme Admin</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <span className="hidden text-sm font-medium sm:inline" style={{color: '#10b981'}}>Welcome, <span className="font-bold" style={{color: '#00cbd6'}}>{username}</span></span>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all hover:scale-105 backdrop-blur-sm sm:px-4"
            style={{color: 'white', backgroundColor: 'rgba(239, 68, 68, 0.8)', border: '1px solid rgba(239, 68, 68, 0.3)'}}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 min-h-0">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="fixed inset-x-0 bottom-0 top-16 z-20 bg-slate-900/20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Sidebar - Glassmorphic */}
        {sidebarOpen && (
          <div className="fixed bottom-0 left-0 top-16 z-30 w-64 overflow-y-auto backdrop-blur-md md:relative md:inset-auto md:z-auto" style={{
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            borderRight: '1px solid rgba(0, 203, 214, 0.1)',
            boxShadow: '4px 0 6px rgba(0, 0, 0, 0.05)'
          }}>
            <nav className="p-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onPageChange(item.id);
                      if (window.innerWidth < 768) setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all text-left ${
                      isActive ? 'scale-105 shadow-lg' : 'hover:scale-102'
                    }`}
                    style={isActive ? {
                      background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 8px 16px rgba(0, 203, 214, 0.2)'
                    } : {
                      color: '#1f2937',
                      backgroundColor: 'rgba(255, 255, 255, 0.4)'
                    }}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Main Content */}
        <div className="min-w-0 flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
