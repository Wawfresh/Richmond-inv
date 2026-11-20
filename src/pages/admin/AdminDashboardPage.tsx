import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  Clock,
  FileCheck2,
  Layers,
  Mail,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime, formatNumber } from '../../lib/format';

export const ADMIN_NAV = [
  { to: '/admin', label: 'Metrics Overview', exact: true, badgeKey: undefined },
  { to: '/admin/investors', label: 'User Management', badgeKey: 'totalInvestors' },
  { to: '/admin/orders', label: 'Deposits & Crypto', badgeKey: 'pendingDepositsAndOrders' },
  { to: '/admin/withdrawals', label: 'Withdrawal Requests', badgeKey: 'pendingWithdrawalsCount' },
  { to: '/admin/offerings', label: 'Investment Plans', badgeKey: undefined },
  { to: '/admin/portfolios', label: 'Portfolios & Dividends', badgeKey: 'activePortfoliosCount' },
  { to: '/admin/kyc', label: 'KYC Verifications', badgeKey: 'pendingKycSubmissions' },
  { to: '/admin/newsletter', label: 'Newsletter & Emails', badgeKey: undefined },
  { to: '/admin/cms', label: 'Content & CMS Setup', badgeKey: undefined },
  { to: '/admin/settings', label: 'System Settings', badgeKey: undefined },
  { to: '/admin/reports', label: 'Reports & Exports', badgeKey: undefined },
];

function formatTransactionType(type: string) {
  return String(type || 'ledger_entry')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearReason, setClearReason] = useState('Administrative balance reset');
  const [clearingBalances, setClearingBalances] = useState(false);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const res = await apiRequest('/api/admin/dashboard');
      setData(res);
      setLastSyncedAt(new Date().toISOString());
    } catch (err: any) {
      setError(err?.message || 'Unable to load overview metrics.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(false);
    const onRefresh = () => loadDashboard(true);
    window.addEventListener('richmond:admin-refresh', onRefresh);
    return () => window.removeEventListener('richmond:admin-refresh', onRefresh);
  }, [loadDashboard]);

  const handleClearPlatformBalances = async (e: React.FormEvent) => {
    e.preventDefault();
    setClearingBalances(true);
    setError('');
    setFeedback('');
    try {
      await apiRequest('/api/admin/clear-balances', {
        method: 'POST',
        body: JSON.stringify({ reason: clearReason.trim() || 'Administrative balance reset' }),
      });
      setClearModalOpen(false);
      setFeedback('Platform investor balances have been cleared to $0.00 (user accounts preserved).');
      await loadDashboard(true);
      window.dispatchEvent(new CustomEvent('richmond:admin-refresh'));
    } catch (err: any) {
      setError(err?.message || 'Unable to clear balances.');
    } finally {
      setClearingBalances(false);
    }
  };

  const m = data?.metrics || {};
  const activePortfolios: any[] = data?.activePortfolios || [];
  const recentTransactions: any[] = data?.recentTransactions || [];
  const recentWithdrawals: any[] = data?.recentWithdrawals || [];

  const availablePlatformBalance = Number(m.availablePlatformBalance || 0);

  return (
    <PortalShell portalTitle="Administrator Portal" breadcrumbLabel="Overview" navItems={ADMIN_NAV} variant="admin">
      {loading ? (
        <div className="space-y-6">
          <div className="h-20 bg-[#EFECE3] border border-[#E5E8EE]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="h-28 bg-[#EFECE3] border border-[#E5E8EE]" />
            <div className="h-28 bg-[#EFECE3] border border-[#E5E8EE]" />
            <div className="h-28 bg-[#EFECE3] border border-[#E5E8EE]" />
            <div className="h-28 bg-[#EFECE3] border border-[#E5E8EE]" />
          </div>
          <div className="h-12 bg-[#EFECE3] border border-[#E5E8EE]" />
          <div className="h-48 bg-[#EFECE3] border border-[#E5E8EE]" />
        </div>
      ) : error ? (
        <div className="bg-white border border-[#991B1B]/30 p-6 text-sm text-[#991B1B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadDashboard(false)}
            className="px-4 py-2 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] self-start sm:self-auto"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Overview Bar: Sync Action + Available Capital */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E8EE] pb-5">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">Overview</div>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#0B172A] mt-1">
                Administration Dashboard Overview
              </h1>
              {lastSyncedAt && (
                <div className="text-xs text-[#4A5260] mt-1 font-mono tabular-nums">
                  Last synchronized: {formatDateTime(lastSyncedAt)}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => loadDashboard(true)}
                disabled={syncing}
                className="inline-flex items-center gap-2 border border-[#D6DAE2] bg-white px-3.5 py-2 text-xs font-semibold text-[#0B172A] hover:border-[#0B172A] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-[#997837]' : 'text-[#4A5260]'}`} />
                <span className="font-mono">{syncing ? 'Syncing...' : 'Sync Overview'}</span>
              </button>

              <button
                type="button"
                onClick={() => setClearModalOpen(true)}
                disabled={availablePlatformBalance === 0 && activePortfolios.length === 0}
                className="inline-flex items-center gap-1.5 border border-[#991B1B]/40 bg-white px-3.5 py-2 text-xs font-semibold text-[#991B1B] hover:bg-[#991B1B]/5 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Balance</span>
              </button>

              <div className="sm:border-l sm:border-[#E5E8EE] sm:pl-4 text-left sm:text-right">
                <div className="text-[11px] uppercase tracking-wider text-[#4A5260] font-mono">Available Balance</div>
                <div className="text-base font-bold font-mono text-[#146348] tabular-nums">
                  {formatCurrency(availablePlatformBalance)}
                </div>
              </div>
            </div>
          </div>

          {feedback && (
            <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{feedback}</div>
          )}

          {/* 4 KPI Summary Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E8EE] border-t-2 border-t-[#B5924C] p-5 space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#4A5260]">
                <span>Available Balance</span>
                <Wallet className="w-4 h-4 text-[#997837]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#0B172A] tabular-nums">
                {formatCurrency(availablePlatformBalance)}
              </div>
              <div className="text-xs text-[#4A5260] font-mono tabular-nums">
                Net Treasury Balance · Withdrawn: {formatCurrency(m.totalWithdrawn || 0)}
              </div>
            </div>

            <div className="bg-white border border-[#E5E8EE] p-5 space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#4A5260]">
                <span>Capital Invested</span>
                <Briefcase className="w-4 h-4 text-[#0B172A]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#0B172A] tabular-nums">
                {formatCurrency(m.totalAllocatedCapital || 0)}
              </div>
              <div className="text-xs text-[#4A5260] font-mono tabular-nums">
                {formatNumber(m.activePortfoliosCount || 0)} active fund portfolios · {formatNumber(m.totalAllocatedShares || 0)} shares
              </div>
            </div>

            <div className="bg-white border border-[#E5E8EE] p-5 space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#4A5260]">
                <span>Accrued Earnings</span>
                <TrendingUp className="w-4 h-4 text-[#146348]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#146348] tabular-nums">
                +{formatCurrency(m.totalDividendsDistributed || 0)}
              </div>
              <div className="text-xs text-[#4A5260] font-mono tabular-nums">
                Total dividend payouts credited ({formatCurrency(m.declaredDividendsPending || 0)} declared)
              </div>
            </div>

            <div className="bg-white border border-[#E5E8EE] p-5 space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#4A5260]">
                <span>Pending Requests</span>
                <Clock className="w-4 h-4 text-[#997837]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#0B172A] tabular-nums">
                {formatCurrency(m.pendingDepositsTotal || 0)}
              </div>
              <div className="text-xs text-[#4A5260] font-mono tabular-nums">
                {formatNumber(m.pendingCryptoPayments || 0)} deposits · {formatNumber(m.pendingInvestmentRequests || 0)} orders ·{' '}
                {formatNumber(m.pendingKycSubmissions || 0)} KYC awaiting review
              </div>
            </div>
          </section>

          {/* Actionable Governance Queue Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Link
              to="/admin/orders"
              className="bg-white border border-[#B5924C]/50 p-5 space-y-1.5 hover:border-[#0B172A] transition-colors block"
            >
              <div className="text-xs font-bold text-[#997837] uppercase tracking-wider font-mono">
                Pending Deposit Approvals
              </div>
              <div className="text-3xl font-bold font-mono text-[#0B172A] tabular-nums">
                {formatNumber(Number(m.pendingCryptoPayments || 0) + Number(m.pendingInvestmentRequests || 0))}
              </div>
              <div className="text-xs text-[#4A5260]">Review blockchain / order transaction references →</div>
            </Link>

            <Link
              to="/admin/withdrawals"
              className="bg-white border border-[#B5924C]/50 p-5 space-y-1.5 hover:border-[#0B172A] transition-colors block"
            >
              <div className="text-xs font-bold text-[#997837] uppercase tracking-wider font-mono">
                Pending Withdrawal Requests
              </div>
              <div className="text-3xl font-bold font-mono text-[#0B172A] tabular-nums">
                {formatNumber(m.pendingWithdrawalsCount || 0)}
              </div>
              <div className="text-xs text-[#4A5260] font-mono tabular-nums">
                {formatCurrency(m.pendingWithdrawalsTotal || 0)} awaiting review / settlement →
              </div>
            </Link>

            <Link
              to="/admin/investors"
              className="bg-white border border-[#E5E8EE] p-5 space-y-1.5 hover:border-[#0B172A] transition-colors block"
            >
              <div className="text-xs font-bold text-[#0B172A] uppercase tracking-wider font-mono">
                Registered Investors
              </div>
              <div className="text-3xl font-bold font-mono text-[#0B172A] tabular-nums">
                {formatNumber(m.totalInvestors || 0)}
              </div>
              <div className="text-xs text-[#4A5260]">
                Inspect client accounts &amp; shareholdings ({formatNumber(m.activeInvestors || 0)} active) →
              </div>
            </Link>

            <Link
              to="/admin/kyc"
              className="bg-white border border-[#E5E8EE] p-5 space-y-1.5 hover:border-[#0B172A] transition-colors block"
            >
              <div className="text-xs font-bold text-[#146348] uppercase tracking-wider font-mono">
                Pending KYC Verifications
              </div>
              <div className="text-3xl font-bold font-mono text-[#0B172A] tabular-nums">
                {formatNumber(m.pendingKycSubmissions || 0)}
              </div>
              <div className="text-xs text-[#4A5260]">Inspect client identity credentials →</div>
            </Link>
          </section>

          {/* Quick Actions Bar */}
          <section className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/offerings"
              className="inline-flex items-center gap-2 bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap"
            >
              <Layers className="w-4 h-4 text-[#C9A968]" />
              <span>Manage Investment Plans</span>
            </Link>

            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-2 border border-[#B5924C] bg-white text-[#0B172A] hover:bg-[#F9F7F2] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4 text-[#146348]" />
              <span>Verify Deposit Requests</span>
            </Link>

            <Link
              to="/admin/withdrawals"
              className="inline-flex items-center gap-2 border border-[#B5924C] bg-white text-[#0B172A] hover:bg-[#F9F7F2] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap"
            >
              <ArrowUpRight className="w-4 h-4 text-[#997837]" />
              <span>Review Withdrawals</span>
            </Link>

            <Link
              to="/admin/portfolios"
              className="inline-flex items-center gap-2 border border-[#D6DAE2] bg-white text-[#0B172A] hover:bg-[#F9F7F2] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap"
            >
              <TrendingUp className="w-4 h-4 text-[#997837]" />
              <span>Dividends &amp; Valuations</span>
            </Link>

            <Link
              to="/admin/kyc"
              className="inline-flex items-center gap-2 border border-[#D6DAE2] bg-white text-[#0B172A] hover:bg-[#F9F7F2] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap"
            >
              <FileCheck2 className="w-4 h-4 text-[#0B172A]" />
              <span>KYC Compliance</span>
            </Link>

            <Link
              to="/admin/newsletter"
              className="inline-flex items-center gap-2 border border-[#B5924C] bg-white text-[#0B172A] hover:bg-[#F9F7F2] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap"
            >
              <Mail className="w-4 h-4 text-[#997837]" />
              <span>Newsletter &amp; Emails</span>
            </Link>
          </section>

          {/* Current Active Portfolios */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xs font-bold text-[#0B172A] uppercase tracking-wider font-mono">
                Current Active Portfolios
              </h2>
              <Link to="/admin/portfolios" className="text-xs font-semibold text-[#997837] hover:underline whitespace-nowrap">
                View All Investments ({formatNumber(activePortfolios.length)})
              </Link>
            </div>

            {activePortfolios.length === 0 ? (
              <div className="bg-white border border-[#E5E8EE] p-8 text-center space-y-3">
                <Layers className="w-8 h-8 text-[#94A3B8] mx-auto" />
                <div className="text-sm font-semibold text-[#0B172A]">No Active Portfolios Yet</div>
                <p className="text-xs text-[#4A5260] max-w-md mx-auto leading-relaxed">
                  Investor share holdings and active institutional allocations will appear here once subscriptions are verified and settled.
                </p>
                <div className="pt-1">
                  <Link
                    to="/admin/offerings"
                    className="inline-flex items-center gap-1.5 bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] px-4 py-2 text-xs font-semibold transition-colors"
                  >
                    <span>Browse Offerings</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activePortfolios.slice(0, 6).map((portfolio) => (
                  <div key={portfolio.id} className="bg-white border border-[#E5E8EE] p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#0B172A] truncate">{portfolio.offering_title}</div>
                        <div className="text-xs text-[#4A5260] mt-0.5 truncate">
                          {portfolio.first_name} {portfolio.last_name} ·{' '}
                          <span className="font-mono">{portfolio.account_number}</span>
                        </div>
                        <div className="text-xs text-[#4A5260] font-mono mt-1 tabular-nums">
                          Principal: {formatCurrency(portfolio.total_invested_amount, portfolio.currency)}
                        </div>
                      </div>
                      <StatusBadge status="active" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-[#4A5260]">
                        <span>Allocated Share Holding</span>
                        <span className="font-mono text-[#0B172A] tabular-nums">
                          {formatNumber(portfolio.total_shares)} shares ({portfolio.share_pool_pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#EFECE3] overflow-hidden border border-[#E5E8EE]">
                        <div
                          className="h-full bg-[#B5924C]"
                          style={{ width: `${Math.min(100, Math.max(4, portfolio.share_pool_pct || 0))}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#E5E8EE] text-xs">
                      <div>
                        <div className="text-[11px] text-[#4A5260]">Dividends Distributed</div>
                        <div className="font-bold font-mono text-[#146348] tabular-nums mt-0.5">
                          +{formatCurrency(portfolio.dividends_earned || 0, portfolio.currency)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-[#4A5260]">Current Valuation</div>
                        <div className="font-bold font-mono text-[#0B172A] tabular-nums mt-0.5">
                          {formatCurrency(portfolio.current_value || 0, portfolio.currency)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Withdrawal Review Queue Summary */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xs font-bold text-[#0B172A] uppercase tracking-wider font-mono">
                Recent Withdrawal Requests
              </h2>
              <Link
                to="/admin/withdrawals"
                className="text-xs font-semibold text-[#997837] hover:underline whitespace-nowrap"
              >
                Open Withdrawal Review Queue ({formatNumber(m.pendingWithdrawalsCount || 0)} pending) →
              </Link>
            </div>

            {recentWithdrawals.length === 0 ? (
              <div className="bg-white border border-[#E5E8EE] p-6 text-center text-xs text-[#4A5260]">
                No investor withdrawal requests submitted yet.
              </div>
            ) : (
              <div className="bg-white border border-[#E5E8EE] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[680px]">
                    <thead className="bg-[#FCFBF8] text-[#4A5260] uppercase tracking-wider border-b border-[#E5E8EE]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Reference</th>
                        <th className="px-4 py-3 font-semibold">Investor</th>
                        <th className="px-4 py-3 font-semibold">Payout Channel</th>
                        <th className="px-4 py-3 font-semibold text-right">Amount</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E8EE]">
                      {recentWithdrawals.map((w) => (
                        <tr key={w.id} className="hover:bg-[#FCFBF8]">
                          <td className="px-4 py-3 font-mono text-[#0B172A] whitespace-nowrap">
                            {w.withdrawal_reference}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#0B172A]">
                              {w.first_name} {w.last_name}
                            </div>
                            <div className="text-[11px] font-mono text-[#4A5260]">{w.account_number}</div>
                          </td>
                          <td className="px-4 py-3 text-[#4A5260]">
                            <div>{w.payout_method}</div>
                            <div className="text-[11px] font-mono truncate max-w-[200px]" title={w.destination_address}>
                              {w.destination_address}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-[#0B172A] tabular-nums whitespace-nowrap">
                            {formatCurrency(w.amount, w.currency)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={w.status} />
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Link
                              to="/admin/withdrawals"
                              className="px-3 py-1.5 border border-[#B5924C] text-[#0B172A] font-semibold hover:bg-[#F9F7F2]"
                            >
                              Review
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Recent Ledger Activity */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xs font-bold text-[#0B172A] uppercase tracking-wider font-mono">
                Recent Ledger Activity
              </h2>
              <Link to="/admin/reports" className="text-xs font-semibold text-[#997837] hover:underline whitespace-nowrap">
                Complete Ledger
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="bg-white border border-[#E5E8EE] p-6 text-center text-xs text-[#4A5260]">
                No transactions recorded yet.
              </div>
            ) : (
              <div className="bg-white border border-[#E5E8EE] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[640px]">
                    <thead className="bg-[#FCFBF8] text-[#4A5260] uppercase tracking-wider border-b border-[#E5E8EE]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">Description</th>
                        <th className="px-4 py-3 font-semibold text-right">Amount</th>
                        <th className="px-4 py-3 font-semibold">Investor / Reference</th>
                        <th className="px-4 py-3 font-semibold text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E8EE]">
                      {recentTransactions.map((tx) => {
                        const amountNum = Number(tx.amount || 0);
                        const isCredit =
                          tx.transaction_type === 'dividend_credit' || tx.transaction_type === 'share_allocation';
                        return (
                          <tr key={tx.id} className="hover:bg-[#FCFBF8]">
                            <td className="px-4 py-3 font-semibold text-[#0B172A] whitespace-nowrap">
                              {formatTransactionType(tx.transaction_type)}
                            </td>
                            <td className="px-4 py-3 text-[#4A5260]">
                              <div className="text-[#1C2026]">{tx.description}</div>
                              {tx.offering_title && (
                                <div className="text-[11px] text-[#4A5260] mt-0.5">{tx.offering_title}</div>
                              )}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                                isCredit ? 'text-[#146348]' : 'text-[#0B172A]'
                              }`}
                            >
                              {isCredit ? '+' : ''}
                              {formatCurrency(amountNum, tx.currency)}
                            </td>
                            <td className="px-4 py-3 font-mono text-[#4A5260] whitespace-nowrap">
                              <div className="text-[#0B172A]">{tx.account_number}</div>
                              <div className="text-[11px]">{tx.transaction_reference}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-[#4A5260] tabular-nums whitespace-nowrap">
                              {formatDateTime(tx.occurred_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {clearModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#060E1C]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0B172A] text-[#FCFBF8] border border-[#1E365C] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E365C] pb-3">
              <h2 className="font-serif text-lg font-semibold text-[#FCFBF8]">Clear Platform Balances</h2>
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                className="text-[#A8B2C1] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#C8D0DC] leading-relaxed">
              This resets all investor share balances, accrued dividends, and pending withdrawals to $0.00 while preserving every registered user account and investment plan.
            </p>
            <form onSubmit={handleClearPlatformBalances} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1.5">Audit Reason *</label>
                <textarea
                  rows={2}
                  required
                  value={clearReason}
                  onChange={(e) => setClearReason(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setClearModalOpen(false)}
                  className="px-4 py-2 border border-[#1E365C] text-[#D6DAE2] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={clearingBalances}
                  className="px-5 py-2 bg-[#991B1B] text-white hover:bg-[#B91C1C] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
                >
                  {clearingBalances ? 'Clearing...' : 'Confirm Clear Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
