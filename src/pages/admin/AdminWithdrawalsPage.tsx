import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { ADMIN_NAV } from './AdminDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime, formatNumber } from '../../lib/format';

type WithdrawalFilter = 'all' | 'pending' | 'approved' | 'completed' | 'rejected';

interface WithdrawalDecisionModal {
  id: number;
  decision: 'approved' | 'completed' | 'rejected';
  reference: string;
  label: string;
}

export function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<WithdrawalFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const [decisionModal, setDecisionModal] = useState<WithdrawalDecisionModal | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionTxHash, setDecisionTxHash] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ withdrawals: any[] }>('/api/admin/withdrawals');
      setWithdrawals(res.withdrawals || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load investor withdrawal requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWithdrawals();
    const onRefresh = () => loadWithdrawals();
    window.addEventListener('richmond:admin-refresh', onRefresh);
    return () => window.removeEventListener('richmond:admin-refresh', onRefresh);
  }, [loadWithdrawals]);

  const metrics = useMemo(() => {
    const pendingList = withdrawals.filter((w) => w.status === 'pending');
    const approvedList = withdrawals.filter((w) => w.status === 'approved');
    const completedList = withdrawals.filter((w) => w.status === 'completed');
    const pendingVolume = [...pendingList, ...approvedList].reduce((sum, w) => sum + Number(w.amount || 0), 0);
    const settledVolume = completedList.reduce((sum, w) => sum + Number(w.amount || 0), 0);
    return {
      pendingCount: pendingList.length,
      approvedCount: approvedList.length,
      pendingVolume,
      settledVolume,
    };
  }, [withdrawals]);

  const filteredWithdrawals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return withdrawals.filter((w) => {
      if (statusFilter === 'pending' && w.status !== 'pending') return false;
      if (statusFilter === 'approved' && w.status !== 'approved') return false;
      if (statusFilter === 'completed' && w.status !== 'completed') return false;
      if (statusFilter === 'rejected' && !['rejected', 'cancelled'].includes(w.status)) return false;

      if (!q) return true;
      const searchable = [
        w.withdrawal_reference,
        w.first_name,
        w.last_name,
        w.account_number,
        w.investor_email,
        w.payout_method,
        w.destination_address,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(q);
    });
  }, [withdrawals, statusFilter, searchQuery]);

  const openModal = (modal: WithdrawalDecisionModal, defaultNotes = '') => {
    setDecisionModal(modal);
    setDecisionNotes(defaultNotes);
    setDecisionTxHash('');
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionModal) return;
    setError('');
    setFeedback('');
    setSubmitting(true);
    try {
      await apiRequest(`/api/admin/withdrawals/${decisionModal.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: decisionModal.decision,
          adminNotes: decisionNotes || 'Treasury withdrawal review update.',
          transactionHash: decisionTxHash.trim(),
        }),
      });
      setFeedback(`Withdrawal ${decisionModal.reference} updated to ${decisionModal.decision.replace(/_/g, ' ')}.`);
      setDecisionModal(null);
      setDecisionNotes('');
      setDecisionTxHash('');
      window.dispatchEvent(new CustomEvent('richmond:admin-refresh'));
      await loadWithdrawals();
    } catch (err: any) {
      setError(err?.message || 'Unable to process withdrawal decision.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalShell
      portalTitle="Administrator Portal"
      breadcrumbLabel="Withdrawal Requests"
      navItems={ADMIN_NAV}
      variant="admin"
    >
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E8EE] pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Treasury Disbursements</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#0B172A] mt-0.5">
              Investor Withdrawal Review Queue
            </h1>
            <p className="text-sm text-[#4A5260] mt-1">
              Review investor withdrawal requests, authorize disbursements, record payout TXIDs, or reject ineligible claims.
            </p>
          </div>
        </div>

        {/* Summary Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E5E8EE] p-5">
            <div className="text-xs uppercase tracking-wider text-[#4A5260]">Pending Review</div>
            <div className="font-mono text-2xl font-bold text-[#0B172A] tabular-nums mt-1.5">
              {formatNumber(metrics.pendingCount)}
            </div>
            <div className="text-xs text-[#4A5260] mt-1">Awaiting initial authorization</div>
          </div>
          <div className="bg-white border border-[#E5E8EE] p-5">
            <div className="text-xs uppercase tracking-wider text-[#4A5260]">Approved Queue</div>
            <div className="font-mono text-2xl font-bold text-[#0B172A] tabular-nums mt-1.5">
              {formatNumber(metrics.approvedCount)}
            </div>
            <div className="text-xs text-[#4A5260] mt-1">Ready for payout dispatch</div>
          </div>
          <div className="bg-white border border-[#E5E8EE] p-5">
            <div className="text-xs uppercase tracking-wider text-[#4A5260]">Active Queue Volume</div>
            <div className="font-mono text-2xl font-bold text-[#997837] tabular-nums mt-1.5">
              {formatCurrency(metrics.pendingVolume)}
            </div>
            <div className="text-xs text-[#4A5260] mt-1">Pending + approved disbursements</div>
          </div>
          <div className="bg-white border border-[#E5E8EE] p-5">
            <div className="text-xs uppercase tracking-wider text-[#4A5260]">Settled Disbursements</div>
            <div className="font-mono text-2xl font-bold text-[#146348] tabular-nums mt-1.5">
              {formatCurrency(metrics.settledVolume)}
            </div>
            <div className="text-xs text-[#4A5260] mt-1">Completed &amp; posted to ledger</div>
          </div>
        </section>

        {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
        {feedback && <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{feedback}</div>}

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Pending' },
                { id: 'approved', label: 'Approved' },
                { id: 'completed', label: 'Completed' },
                { id: 'rejected', label: 'Rejected / Cancelled' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-[#B5924C] text-[#060E1C] border-[#B5924C]'
                    : 'bg-white text-[#4A5260] border-[#D6DAE2] hover:border-[#0B172A]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-[#4A5260] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference, investor, address..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-[#D6DAE2] bg-white text-[#0B172A]"
            />
          </div>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="h-48 bg-[#EFECE3] border border-[#E5E8EE]" />
        ) : filteredWithdrawals.length === 0 ? (
          <div className="bg-white border border-[#E5E8EE] p-8 text-center text-xs text-[#4A5260]">
            No investor withdrawal requests match your active filter.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredWithdrawals.map((w) => (
              <div key={w.id} className="bg-white border border-[#E5E8EE] p-6 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E8EE] pb-3">
                  <div>
                    <span className="font-mono font-semibold text-[#997837]">{w.withdrawal_reference}</span> ·{' '}
                    <span className="font-semibold text-[#0B172A]">
                      {w.first_name} {w.last_name}
                    </span>{' '}
                    ({w.account_number}) · <span className="text-[#4A5260]">{w.investor_email}</span>
                  </div>
                  <StatusBadge status={w.status} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <strong className="text-[#4A5260] block">Withdrawal Amount</strong>
                    <span className="font-mono tabular-nums font-bold text-sm text-[#0B172A]">
                      {formatCurrency(w.amount, w.currency)}
                    </span>
                  </div>
                  <div>
                    <strong className="text-[#4A5260] block">Payout Channel</strong>
                    <span>
                      {w.payout_method} {w.network ? `(${w.network})` : ''}
                    </span>
                  </div>
                  <div>
                    <strong className="text-[#4A5260] block">Balance Source</strong>
                    <span className="capitalize">
                      {String(w.source_type || 'available_balance').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <strong className="text-[#4A5260] block">Requested At</strong>
                    <span className="font-mono tabular-nums">{formatDateTime(w.created_at)}</span>
                  </div>
                </div>

                <div>
                  <strong className="text-[#4A5260] block mb-1">Destination Wallet / Settlement Account</strong>
                  <code className="block font-mono bg-[#FCFBF8] border border-[#E5E8EE] px-3 py-2 break-all text-[#0B172A]">
                    {w.destination_address}
                  </code>
                </div>

                {(w.investor_notes || w.admin_notes || w.transaction_hash) && (
                  <div className="bg-[#FCFBF8] border border-[#E5E8EE] p-3 space-y-1 text-[11px] text-[#4A5260]">
                    {w.investor_notes && (
                      <div>
                        <strong className="text-[#0B172A]">Investor Note:</strong> {w.investor_notes}
                      </div>
                    )}
                    {w.admin_notes && (
                      <div>
                        <strong className="text-[#0B172A]">Treasury Note:</strong> {w.admin_notes}
                      </div>
                    )}
                    {w.transaction_hash && (
                      <div>
                        <strong className="text-[#0B172A]">Payout TXID:</strong>{' '}
                        <span className="font-mono text-[#146348] break-all">{w.transaction_hash}</span>
                      </div>
                    )}
                  </div>
                )}

                {['pending', 'approved'].includes(w.status) && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {w.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() =>
                          openModal(
                            {
                              id: w.id,
                              decision: 'approved',
                              reference: w.withdrawal_reference,
                              label: 'Approve Withdrawal Request',
                            },
                            'Withdrawal authorized for treasury payout dispatch.'
                          )
                        }
                        className="px-4 py-2 bg-[#0B172A] text-white font-semibold whitespace-nowrap cursor-pointer"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        openModal(
                          {
                            id: w.id,
                            decision: 'completed',
                            reference: w.withdrawal_reference,
                            label: 'Complete Withdrawal Settlement',
                          },
                          'Withdrawal funds dispatched and settled to destination account.'
                        )
                      }
                      className="px-4 py-2 bg-[#146348] text-white font-semibold whitespace-nowrap cursor-pointer"
                    >
                      Complete Settlement
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openModal(
                          {
                            id: w.id,
                            decision: 'rejected',
                            reference: w.withdrawal_reference,
                            label: 'Reject Withdrawal Request',
                          },
                          ''
                        )
                      }
                      className="px-4 py-2 bg-[#991B1B] text-white font-semibold whitespace-nowrap cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {decisionModal && (
        <div className="fixed inset-0 z-50 bg-[#060E1C]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0B172A] text-[#FCFBF8] border border-[#1E365C] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E365C] pb-3">
              <div>
                <div className="text-[11px] font-mono text-[#C9A968]">{decisionModal.reference}</div>
                <h2 className="font-serif text-lg font-semibold text-[#FCFBF8]">{decisionModal.label}</h2>
              </div>
              <button
                type="button"
                onClick={() => setDecisionModal(null)}
                className="text-[#A8B2C1] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDecision} className="space-y-4 text-xs">
              {decisionModal.decision === 'completed' && (
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1.5">
                    Payout Transaction Hash / Wire Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={decisionTxHash}
                    onChange={(e) => setDecisionTxHash(e.target.value)}
                    placeholder="Enter blockchain TXID or wire settlement ref..."
                    className="w-full px-3 py-2 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1.5">
                  Treasury / Compliance Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="Enter verification notes or rejection reason..."
                  className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDecisionModal(null)}
                  className="px-4 py-2 border border-[#1E365C] text-[#D6DAE2] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Processing...' : 'Confirm Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
