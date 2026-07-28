import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CreditCard,
  House,
  LogOut,
  Menu,
  Package,
  Settings,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileSectionOpen, setProfileSectionOpen] = useState(false);
  const [sessionRemaining, setSessionRemaining] = useState('00:00:00');
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const settingsRegionRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const profileRegionRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const settingsOpenRef = useRef(settingsOpen);
  settingsOpenRef.current = settingsOpen;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: House },
    { id: 'packages', label: 'Plans', icon: Package },
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
    { id: 'users', label: 'Users', icon: UsersRound },
    { id: 'accounts', label: 'Accounts', icon: WalletCards },
  ] as const;

  const sidebarInteractive = isDesktop || mobileSidebarOpen;

  const closeMobileSidebar = useCallback((restoreFocus = true) => {
    const shouldRestoreFocus = mobileSidebarOpen && restoreFocus;
    setMobileSidebarOpen(false);
    setSettingsOpen(false);
    setProfileMenuOpen(false);
    setProfileSectionOpen(false);

    if (shouldRestoreFocus) {
      window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
    }
  }, [mobileSidebarOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 768px)');
    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
      setMobileSidebarOpen(false);
      setSettingsOpen(false);
      setProfileMenuOpen(false);
      setProfileSectionOpen(false);
    };

    desktopQuery.addEventListener('change', handleBreakpointChange);
    return () => desktopQuery.removeEventListener('change', handleBreakpointChange);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      if (!settingsRegionRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [settingsOpen]);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      if (!profileRegionRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
        setProfileSectionOpen(false);
      }
    };

    const handleProfileKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setProfileMenuOpen(false);
      setProfileSectionOpen(false);
      window.requestAnimationFrame(() => profileButtonRef.current?.focus());
    };

    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleProfileKeyboard);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleProfileKeyboard);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    const updateSessionRemaining = () => {
      const expiresAt = window.sessionStorage.getItem('adminExpiresAt');
      if (!expiresAt) {
        setSessionRemaining('00:00:00');
        return;
      }

      const remainingSeconds = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;
      setSessionRemaining(
        [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
      );
    };

    updateSessionRemaining();
    const intervalId = window.setInterval(updateSessionRemaining, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    window.requestAnimationFrame(() => mobileCloseButtonRef.current?.focus());

    const handleMobileKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (settingsOpenRef.current) {
          setSettingsOpen(false);
          window.requestAnimationFrame(() => settingsButtonRef.current?.focus());
        } else {
          closeMobileSidebar();
        }
        return;
      }

      if (event.key !== 'Tab' || !sidebarRef.current) return;

      const focusableElements = Array.from(
        sidebarRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )
      ).filter((element) => element.getClientRects().length > 0);

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleMobileKeyboard);
    return () => document.removeEventListener('keydown', handleMobileKeyboard);
  }, [closeMobileSidebar, mobileSidebarOpen]);

  useEffect(() => {
    if (!settingsOpen || mobileSidebarOpen) return;

    const handleSettingsKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSettingsOpen(false);
      window.requestAnimationFrame(() => settingsButtonRef.current?.focus());
    };

    document.addEventListener('keydown', handleSettingsKeyboard);
    return () => document.removeEventListener('keydown', handleSettingsKeyboard);
  }, [mobileSidebarOpen, settingsOpen]);

  const handleMobileSidebarOpen = () => {
    setSidebarCollapsed(false);
    setSettingsOpen(false);
    setProfileMenuOpen(false);
    setProfileSectionOpen(false);
    setMobileSidebarOpen(true);
  };

  const handlePageChange = (page: typeof navItems[number]['id']) => {
    onPageChange(page);
    setSettingsOpen(false);
    setProfileMenuOpen(false);
    setProfileSectionOpen(false);

    if (mobileSidebarOpen) {
      closeMobileSidebar();
    }
  };

  const handleSettingsToggle = () => {
    setProfileMenuOpen(false);
    setProfileSectionOpen(false);

    if (isDesktop && sidebarCollapsed) {
      setSidebarCollapsed(false);
      setSettingsOpen(true);
      return;
    }

    setSettingsOpen((current) => !current);
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #e8fcf9 0%, #f8fafc 50%, #f3fefa 100%)' }}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close navigation overlay"
        aria-hidden={!mobileSidebarOpen}
        className={`fixed inset-0 z-30 bg-slate-900/20 transition-opacity duration-200 ease-out motion-reduce:transition-none md:hidden ${
          mobileSidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => closeMobileSidebar()}
      />

      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[292px] shrink-0 flex-col border-r border-[#dfe5ec] bg-white transition-[width,transform] duration-200 ease-out motion-reduce:transition-none md:relative md:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'md:w-[76px]' : 'md:w-[292px]'}`}
        aria-label="Admin navigation"
        aria-hidden={!sidebarInteractive}
      >
        <div
          className={`flex h-[76px] shrink-0 items-center ${
            sidebarCollapsed ? 'md:justify-center md:px-0' : ''
          } px-8`}
        >
          <UserRound
            className={`h-11 w-11 text-black transition-[width,height] duration-200 ease-out motion-reduce:transition-none ${
              sidebarCollapsed ? 'md:h-9 md:w-9' : ''
            }`}
            strokeWidth={2.2}
            aria-hidden="true"
          />
        </div>

        <button
          type="button"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => {
            setSidebarCollapsed((current) => !current);
            setSettingsOpen(false);
            setProfileMenuOpen(false);
            setProfileSectionOpen(false);
          }}
          className="absolute -right-3.5 top-5 z-10 hidden h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#11b9d4] text-white shadow-sm transition-[background-color,box-shadow,transform] duration-150 ease-out hover:scale-105 hover:bg-[#08a9c4] hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20b9e6] focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none md:flex"
        >
          <ChevronLeft
            className={`h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${
              sidebarCollapsed ? 'rotate-180' : ''
            }`}
            strokeWidth={3}
          />
        </button>

        <button
          ref={mobileCloseButtonRef}
          type="button"
          tabIndex={mobileSidebarOpen ? 0 : -1}
          aria-label="Close navigation"
          onClick={() => closeMobileSidebar()}
          className="absolute right-3 top-5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#11b9d4] text-white transition-[background-color,transform] duration-150 ease-out hover:scale-105 hover:bg-[#08a9c4] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20b9e6] focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none md:hidden"
        >
          <X className="h-4 w-4" />
        </button>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                tabIndex={sidebarInteractive ? 0 : -1}
                title={isDesktop && sidebarCollapsed ? item.label : undefined}
                aria-label={isDesktop && sidebarCollapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handlePageChange(item.id)}
                className={`group flex h-9 w-full cursor-pointer items-center gap-3 overflow-hidden px-3 text-left text-sm transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20b9e6] motion-reduce:transform-none motion-reduce:transition-none ${
                  isActive
                    ? 'bg-[#def5f8] font-semibold text-[#16afd5] hover:bg-[#d3f1f6]'
                    : 'font-medium text-[#43546e] hover:bg-[#eaf8fa] hover:text-[#16afd5]'
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${
                    sidebarCollapsed ? 'md:translate-x-[9px]' : 'group-hover:translate-x-0.5'
                  }`}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span
                  className={`max-w-[190px] overflow-hidden whitespace-nowrap opacity-100 transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none ${
                    sidebarCollapsed ? 'md:max-w-0 md:opacity-0' : ''
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div ref={settingsRegionRef} className="relative shrink-0 border-t border-[#dfe5ec] p-2">
          <div
            id="admin-settings-panel"
            role="dialog"
            aria-label="Admin settings"
            aria-hidden={!settingsOpen}
            className={`absolute bottom-[52px] left-2 right-2 origin-bottom rounded-xl border border-slate-200 bg-white p-2 shadow-lg transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
              settingsOpen
                ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
                : 'pointer-events-none translate-y-2 scale-95 opacity-0'
            }`}
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-xs font-semibold text-slate-700">{username}</p>
              <p className="text-[11px] text-slate-400">Super admin</p>
            </div>
            <button
              type="button"
              tabIndex={settingsOpen && sidebarInteractive ? 0 : -1}
              onClick={onLogout}
              className="mt-1 flex h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-red-500 transition-[background-color,transform] duration-150 ease-out hover:bg-red-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
              Sign out
            </button>
          </div>

          <button
            ref={settingsButtonRef}
            type="button"
            tabIndex={sidebarInteractive ? 0 : -1}
            title={isDesktop && sidebarCollapsed ? 'Settings' : undefined}
            aria-label={isDesktop && sidebarCollapsed ? 'Settings' : undefined}
            aria-expanded={settingsOpen}
            aria-controls="admin-settings-panel"
            onClick={handleSettingsToggle}
            className={`group relative flex h-9 w-full cursor-pointer items-center gap-3 overflow-hidden px-3 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20b9e6] motion-reduce:transform-none motion-reduce:transition-none ${
              settingsOpen
                ? 'bg-[#def5f8] font-semibold text-[#16afd5] hover:bg-[#d3f1f6]'
                : 'text-[#43546e] hover:bg-[#eaf8fa] hover:text-[#16afd5]'
            }`}
          >
            <Settings
              className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${
                sidebarCollapsed ? 'md:translate-x-[9px]' : 'group-hover:rotate-12'
              }`}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span
              className={`max-w-[190px] overflow-hidden whitespace-nowrap opacity-100 transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none ${
                sidebarCollapsed ? 'md:max-w-0 md:opacity-0' : ''
              }`}
            >
              Settings
            </span>
            <ChevronUp
              className={`absolute right-3 h-4 w-4 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
                settingsOpen ? 'rotate-180' : ''
              } ${sidebarCollapsed ? 'md:scale-0 md:opacity-0' : ''}`}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 backdrop-blur-md sm:px-6"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderBottom: '1px solid rgba(0, 203, 214, 0.1)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={mobileMenuButtonRef}
              type="button"
              aria-label="Open navigation"
              onClick={handleMobileSidebarOpen}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-cyan-50 text-[#00b8d4] transition-[background-color,transform] duration-150 ease-out hover:scale-105 hover:bg-cyan-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20b9e6] focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-3">

            <div className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden="true" />

            <div ref={profileRegionRef} className="relative">
              <button
                ref={profileButtonRef}
                type="button"
                aria-label={`Account menu for ${username}`}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-controls="admin-profile-menu"
                onClick={() => {
                  setProfileMenuOpen((current) => !current);
                  setProfileSectionOpen(false);
                  setSettingsOpen(false);
                }}
                className={`group flex min-w-0 cursor-pointer items-center gap-2 px-1 py-1 text-left transition-[background-color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20b9e6] focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none ${
                  profileMenuOpen ? 'bg-[#eaf8fa]' : 'hover:bg-slate-50'
                }`}
              >
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#245b69] text-white">
                  <UserRound className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400"
                    aria-hidden="true"
                  />
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block max-w-40 truncate text-sm font-semibold text-[#43546e]">
                    {username}
                  </span>
                  <span className="block text-[11px] text-slate-400">Super Admin</span>
                </span>
                <ChevronUp
                  className={`hidden h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none sm:block ${
                    profileMenuOpen ? 'rotate-180' : ''
                  }`}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>

              <div
                id="admin-profile-menu"
                role="menu"
                aria-label="Account options"
                aria-hidden={!profileMenuOpen}
                className={`absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[290px] origin-top-right overflow-hidden rounded-b-2xl border border-slate-200 bg-white transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
                  profileMenuOpen
                    ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
                    : 'pointer-events-none -translate-y-2 scale-95 opacity-0'
                }`}
              >
                <div className="flex flex-col items-center border-b border-slate-100 bg-[#f5fbfd] px-5 py-5 text-center">
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#245b69] text-white">
                    <UserRound className="h-10 w-10" strokeWidth={1.7} aria-hidden="true" />
                    <span
                      className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-emerald-400"
                      aria-hidden="true"
                    />
                  </span>
                  <p className="mt-3 max-w-full truncate text-lg font-bold text-slate-900">{username}</p>
                  <p className="text-xs text-slate-500">Super Admin</p>
                </div>

                <div className="p-2">
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={profileMenuOpen ? 0 : -1}
                    onClick={() => setProfileSectionOpen((current) => !current)}
                    className="flex h-11 w-full cursor-pointer items-center gap-3 px-3 text-left text-sm font-medium text-[#43546e] transition-[background-color,color,transform] duration-150 ease-out hover:bg-[#eaf8fa] hover:text-[#16afd5] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20b9e6] motion-reduce:transform-none motion-reduce:transition-none"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-500">
                      <UserRound className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    View Profile
                  </button>

                  {profileSectionOpen && (
                    <div className="mx-3 mb-2 border-l-2 border-sky-200 px-3 py-2 text-xs text-slate-500">
                      <p><span className="font-semibold text-slate-700">Username:</span> {username}</p>
                      <p className="mt-1"><span className="font-semibold text-slate-700">Access:</span> Super Admin</p>
                    </div>
                  )}

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={profileMenuOpen ? 0 : -1}
                    onClick={onLogout}
                    className="flex h-11 w-full cursor-pointer items-center gap-3 px-3 text-left text-sm font-medium text-[#43546e] transition-[background-color,color,transform] duration-150 ease-out hover:bg-red-50 hover:text-red-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400 motion-reduce:transform-none motion-reduce:transition-none"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-400">
                      <LogOut className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
