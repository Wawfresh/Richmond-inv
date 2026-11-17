import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  Download,
  FileCheck2,
  FileText,
  Layers,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

export interface NavItem {
  to: string;
  label: string;
  exact?: boolean;
  badgeKey?: string;
}

interface PortalShellProps {
  portalTitle: string;
  breadcrumbLabel: string;
  navItems: NavItem[];
  children: React.ReactNode;
  variant: 'investor' | 'admin';
}

function getAdminNavIcon(to: string) {
  switch (to) {
    case '/admin':
      return TrendingUp;
    case '/admin/investors':
      return Users;
    case '/admin/orders':
      return ArrowDownToLine;
    case '/admin/withdrawals':
      return ArrowUpRight;
    case '/admin/offerings':
      return Layers;
    case '/admin/portfolios':
      return Briefcase;
    case '/admin/kyc':
      return FileCheck2;
    case '/admin/cms':
      return FileText;
    case '/admin/settings':
      return Settings;
    case '/admin/reports':
      return Download;
    default:
      return Layers;
  }
}

export function PortalShell({ portalTitle, breadcrumbLabel, navItems, children, variant }: PortalShellProps) {
  const { user, adminReturnLabel, returnToAdminConsole, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminBadges, setAdminBadges] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [returningAdmin, setReturningAdmin] = useState(false);
  const [returnError, setReturnError] = useState('');

  const loadAdminCounts = useCallback(async () => {
    if (variant !== 'admin') return;
    try {
      const res = await apiRequest<{ metrics?: Record<string, any> }>('/api/admin/dashboard');
      const m = res?.metrics || {};
      setAdminBadges({
        totalInvestors: Number(m.totalInvestors || 0),
        pendingDepositsAndOrders: Number(m.pendingCryptoPayments || 0) + Number(m.pendingInvestmentRequests || 0),
        pendingWithdrawalsCount: Number(m.pendingWithdrawalsCount || 0),
        activePortfoliosCount: Number(m.activePortfoliosCount || 0),
        pendingKycSubmissions: Number(m.pendingKycSubmissions || 0),
      });
    } catch {
      // Keep shell resilient if count fetch fails transiently
    }
  }, [variant]);

  useEffect(() => {
    loadAdminCounts();
  }, [loadAdminCounts, location.pathname]);

  const handleAdminRefresh = async () => {
    setRefreshing(true);
    window.dispatchEvent(new CustomEvent('richmond:admin-refresh'));
    await loadAdminCounts();
    setTimeout(() => setRefreshing(false), 300);
  };

  const handleLogout = async () => {
    await logout();
    navigate(variant === 'admin' ? '/admin/login' : '/login');
  };

  const handleReturnToAdmin = async () => {
    setReturnError('');
    setReturningAdmin(true);
    try {
      await returnToAdminConsole(() => navigate('/admin/investors', { replace: true }));
    } catch (err: any) {
      setReturnError(err?.message || 'Unable to restore administrator session.');
      setReturningAdmin(false);
    }
  };

  const isNavActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.to;
    return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
  };

  return (
    <div className="min-h-screen flex bg-[#F9F7F2] text-[#1C2026]">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-[#060E1C]/60 lg:hidden no-print"
        />
      )}

      {/* Institutional Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0B172A] text-[#FCFBF8] flex flex-col border-r border-[#1E365C] transition-transform duration-200 lg:static lg:translate-x-0 no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-5 border-b border-[#1E365C] flex items-center justify-between">
          <div>
            <Link to="/" className="font-serif text-xl font-semibold tracking-tight text-[#FCFBF8] block">
              RICHMOND-INV
            </Link>
            <div className="text-[11px] uppercase tracking-widest text-[#C9A968] mt-1">{portalTitle}</div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
            className="lg:hidden p-1.5 text-[#D6DAE2] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const active = isNavActive(item);
            if (variant === 'admin') {
              const Icon = getAdminNavIcon(item.to);
              const badgeVal = item.badgeKey ? adminBadges[item.badgeKey] : undefined;
              const showBadge =
                typeof badgeVal === 'number' &&
                (item.badgeKey === 'totalInvestors' ? badgeVal >= 0 : badgeVal > 0);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#B5924C] text-[#060E1C] font-semibold'
                      : 'text-[#C8D0DC] hover:bg-[#132542]/70 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#060E1C]' : 'text-[#C9A968]'}`} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {showBadge && (
                    <span
                      className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 shrink-0 ${
                        active
                          ? 'bg-[#060E1C]/15 text-[#060E1C] font-bold'
                          : item.badgeKey === 'pendingDepositsAndOrders' ||
                            item.badgeKey === 'pendingWithdrawalsCount' ||
                            item.badgeKey === 'pendingKycSubmissions'
                          ? 'bg-[#B5924C]/20 text-[#C9A968] border border-[#B5924C]/40'
                          : 'bg-[#060E1C] text-[#C8D0DC]'
                      }`}
                    >
                      {badgeVal}
                    </span>
                  )}
                </Link>
              );
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`block px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap truncate ${
                  active
                    ? 'bg-[#132542] text-[#FCFBF8] border border-[#B5924C]/50'
                    : 'text-[#C8D0DC] hover:bg-[#132542]/60 hover:text-white border border-transparent'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#1E365C] bg-[#060E1C] space-y-2.5">
          <div>
            <div className="text-xs text-[#A8B2C1] truncate">{user?.email}</div>
            {user?.profile?.account_number && (
              <div className="font-mono text-xs text-[#C9A968] mt-0.5 tabular-nums">
                {user.profile.account_number}
              </div>
            )}
            {variant === 'admin' && <div className="text-xs text-[#C9A968] mt-0.5">{user?.roleName}</div>}
          </div>

          {variant === 'admin' ? (
            <div className="space-y-2 pt-1">
              <Link
                to="/"
                className="w-full flex items-center justify-center gap-2 border border-[#1E365C] bg-[#0B172A] hover:border-[#C9A968]/60 py-2 px-3 text-xs font-medium text-[#D6DAE2] hover:text-white transition-colors whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Corporate Site</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[#FCA5A5] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <Link to="/" className="text-xs text-[#A8B2C1] hover:text-white whitespace-nowrap">
                Corporate Site
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D6DAE2] hover:text-white whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-[#FCFBF8] border-b border-[#E5E8EE] px-4 sm:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open portal navigation"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 border border-[#D6DAE2] bg-white text-[#0B172A] shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs sm:text-sm font-medium text-[#4A5260] truncate">
              <span className="text-[#0B172A] font-semibold uppercase tracking-wider text-xs">{breadcrumbLabel}</span>
              {variant === 'admin' && (
                <>
                  <span className="mx-2 text-[#D6DAE2] hidden sm:inline">|</span>
                  <span className="hidden sm:inline font-mono text-xs text-[#997837]">
                    GOVERNANCE CONSOLE
                  </span>
                </>
              )}
              {variant === 'investor' && (
                <>
                  <span className="mx-2 text-[#D6DAE2]">/</span>
                  <span>{portalTitle}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {variant === 'investor' && (
              <Link
                to="/portal/offerings"
                className="px-4 py-2 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] transition-colors whitespace-nowrap"
              >
                Browse Offerings
              </Link>
            )}
            {variant === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={handleAdminRefresh}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-[#D6DAE2] bg-white text-[#0B172A] hover:border-[#0B172A] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#997837]' : 'text-[#4A5260]'}`} />
                  <span className="hidden sm:inline">Refresh Records</span>
                </button>
                <Link
                  to="/admin/reports"
                  className="px-3.5 py-2 text-xs font-semibold border border-[#D6DAE2] bg-white text-[#0B172A] hover:bg-[#F9F7F2] transition-colors whitespace-nowrap hidden md:inline-block"
                >
                  Export Reports
                </Link>
              </>
            )}
          </div>
        </header>

        {variant === 'investor' && adminReturnLabel && (
          <div className="bg-[#0B172A] text-[#FCFBF8] border-b border-[#B5924C]/50 px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2.5 text-xs min-w-0">
              <ShieldCheck className="w-4 h-4 text-[#C9A968] shrink-0" />
              <span className="truncate">
                <strong className="uppercase tracking-wider text-[#C9A968] mr-1.5">Administrator View</strong>
                Accessing investor dashboard for <span className="font-semibold text-white">{adminReturnLabel}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {returnError && <span className="text-[11px] text-[#FCA5A5]">{returnError}</span>}
              <button
                type="button"
                onClick={handleReturnToAdmin}
                disabled={returningAdmin}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{returningAdmin ? 'Returning...' : 'Return to Admin Console'}</span>
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 max-w-[1360px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
