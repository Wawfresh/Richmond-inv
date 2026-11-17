import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Settings2, ShieldCheck, Trash2, X, Zap } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { ADMIN_NAV } from './AdminDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime, formatNumber } from '../../lib/format';

type ProcessingMode = 'manual' | 'automatic';
type MethodProcessingMode = 'inherit' | 'manual' | 'automatic';

interface CryptoProcessingSettings {
  processingMode: ProcessingMode;
  autoAllocateShares: boolean;
  autoRequireFullAmount: boolean;
  autoMinTxidLength: number;
}

type DecisionModalState =
  | {
      kind: 'request';
      id: number;
      nextStatus: string;
      reference: string;
      label: string;
    }
  | {
      kind: 'payment';
      id: number;
      decision: 'approved' | 'rejected' | 'additional_evidence_required';
      reference: string;
      label: string;
    }
  | {
      kind: 'withdrawal';
      id: number;
      decision: 'approved' | 'completed' | 'rejected';
      reference: string;
      label: string;
    }
  | null;

interface EditMethodWalletDraft {
  methodId: number;
  walletId: number | null;
  name: string;
  symbol: string;
  network: string;
  processingMode: MethodProcessingMode;
  isEnabled: boolean;
  label: string;
  walletAddress: string;
  minPaymentAmount: string;
  paymentInstructions: string;
  isActive: boolean;
}

interface NewMethodDraft {
  code: string;
  name: string;
  symbol: string;
  network: string;
  processingMode: MethodProcessingMode;
  isEnabled: boolean;
  label: string;
  walletAddress: string;
  minPaymentAmount: string;
  paymentInstructions: string;
  isActive: boolean;
}

const DEFAULT_NEW_METHOD: NewMethodDraft = {
  code: '',
  name: '',
  symbol: '',
  network: '',
  processingMode: 'inherit',
  isEnabled: true,
  label: '',
  walletAddress: '',
  minPaymentAmount: '50',
  paymentInstructions:
    'Send the exact requested amount using the specified network. Submit your transaction hash (TXID) after broadcasting.',
  isActive: true,
};

export function AdminOrdersPaymentsPage() {
  const [tab, setTab] = useState<'requests' | 'payments' | 'withdrawals' | 'wallets'>('requests');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [requests, setRequests] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  // Global crypto payment processing engine settings
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('manual');
  const [autoAllocateShares, setAutoAllocateShares] = useState(true);
  const [autoRequireFullAmount, setAutoRequireFullAmount] = useState(true);
  const [autoMinTxidLengthText, setAutoMinTxidLengthText] = useState('16');
  const [savingSettings, setSavingSettings] = useState(false);

  // Clean decision modal state (replaces window.prompt)
  const [decisionModal, setDecisionModal] = useState<DecisionModalState>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionTxHash, setDecisionTxHash] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [autoProcessingId, setAutoProcessingId] = useState<number | null>(null);

  // Edit method & wallet modal state
  const [editDraft, setEditDraft] = useState<EditMethodWalletDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Add new crypto method modal state
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const [newMethodDraft, setNewMethodDraft] = useState<NewMethodDraft>(DEFAULT_NEW_METHOD);
  const [creatingMethod, setCreatingMethod] = useState(false);

  // Delete method confirmation modal state
  const [deletingMethod, setDeletingMethod] = useState<any | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, payRes, wdRes, pmRes] = await Promise.all([
        apiRequest<{ requests: any[] }>('/api/admin/investments'),
        apiRequest<{ submissions: any[] }>('/api/admin/payments/submissions'),
        apiRequest<{ withdrawals: any[] }>('/api/admin/withdrawals'),
        apiRequest<{ methods: any[]; wallets: any[]; settings?: CryptoProcessingSettings }>(
          '/api/admin/payments/methods'
        ),
      ]);
      setRequests(reqRes.requests || []);
      setPayments(payRes.submissions || []);
      setWithdrawals(wdRes.withdrawals || []);
      setMethods(pmRes.methods || []);
      setWallets(pmRes.wallets || []);
      if (pmRes.settings) {
        setProcessingMode(pmRes.settings.processingMode === 'automatic' ? 'automatic' : 'manual');
        setAutoAllocateShares(Boolean(pmRes.settings.autoAllocateShares));
        setAutoRequireFullAmount(Boolean(pmRes.settings.autoRequireFullAmount));
        setAutoMinTxidLengthText(String(pmRes.settings.autoMinTxidLength ?? 16));
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load deposit and order records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const onRefresh = () => loadAll();
    window.addEventListener('richmond:admin-refresh', onRefresh);
    return () => window.removeEventListener('richmond:admin-refresh', onRefresh);
  }, [loadAll]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    if (statusFilter === 'pending') {
      return requests.filter((r) =>
        ['submitted', 'under_review', 'awaiting_payment', 'payment_submitted', 'payment_verification_pending'].includes(
          r.status
        )
      );
    }
    if (statusFilter === 'approved') {
      return requests.filter((r) => ['approved', 'completed'].includes(r.status));
    }
    return requests.filter((r) => ['rejected', 'cancelled'].includes(r.status));
  }, [requests, statusFilter]);

  const filteredPayments = useMemo(() => {
    if (statusFilter === 'all') return payments;
    if (statusFilter === 'pending') {
      return payments.filter((p) =>
        ['submitted', 'verification_pending', 'additional_evidence_required'].includes(p.status)
      );
    }
    if (statusFilter === 'approved') {
      return payments.filter((p) => p.status === 'approved');
    }
    return payments.filter((p) => p.status === 'rejected');
  }, [payments, statusFilter]);

  const filteredWithdrawals = useMemo(() => {
    if (statusFilter === 'all') return withdrawals;
    if (statusFilter === 'pending') {
      return withdrawals.filter((w) => w.status === 'pending');
    }
    if (statusFilter === 'approved') {
      return withdrawals.filter((w) => ['approved', 'completed'].includes(w.status));
    }
    return withdrawals.filter((w) => ['rejected', 'cancelled'].includes(w.status));
  }, [withdrawals, statusFilter]);

  const openDecisionModal = (modal: DecisionModalState, defaultNotes = '') => {
    setDecisionModal(modal);
    setDecisionNotes(defaultNotes);
    setDecisionTxHash('');
  };

  const submitDecisionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionModal) return;
    setError('');
    setFeedback('');
    setSubmittingDecision(true);
    try {
      if (decisionModal.kind === 'request') {
        await apiRequest(`/api/admin/investments/${decisionModal.id}/decision`, {
          method: 'POST',
          body: JSON.stringify({
            nextStatus: decisionModal.nextStatus,
            adminNotes: decisionModal.nextStatus !== 'rejected' ? decisionNotes : undefined,
            rejectionReason: decisionModal.nextStatus === 'rejected' ? decisionNotes : undefined,
          }),
        });
        setFeedback(`Investment request ${decisionModal.reference} updated.`);
      } else if (decisionModal.kind === 'payment') {
        const res = await apiRequest<{ allocationSummary?: { allocationRef: string } }>(
          `/api/admin/payments/submissions/${decisionModal.id}/decision`,
          {
            method: 'POST',
            body: JSON.stringify({
              decision: decisionModal.decision,
              verificationNotes: decisionNotes || 'Verification update.',
              allocateSharesNow: decisionModal.decision === 'approved',
            }),
          }
        );
        setFeedback(
          res.allocationSummary
            ? `Payment approved and shares allocated (${res.allocationSummary.allocationRef}).`
            : `Payment ${decisionModal.reference} updated to ${decisionModal.decision.replace(/_/g, ' ')}.`
        );
      } else {
        await apiRequest(`/api/admin/withdrawals/${decisionModal.id}/decision`, {
          method: 'POST',
          body: JSON.stringify({
            decision: decisionModal.decision,
            adminNotes: decisionNotes || 'Treasury withdrawal review update.',
            transactionHash: decisionTxHash.trim(),
          }),
        });
        setFeedback(
          `Withdrawal ${decisionModal.reference} updated to ${decisionModal.decision.replace(/_/g, ' ')}.`
        );
      }
      setDecisionModal(null);
      setDecisionNotes('');
      setDecisionTxHash('');
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to process verification decision.');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleAutoProcessPayment = async (p: any) => {
    setError('');
    setFeedback('');
    setAutoProcessingId(p.id);
    try {
      const res = await apiRequest<{ ok: boolean; allocationSummary?: { allocationRef: string } }>(
        `/api/admin/payments/submissions/${p.id}/auto-process`,
        { method: 'POST' }
      );
      setFeedback(
        res.allocationSummary
          ? `Payment ${p.payment_reference} automatically verified and allocated (${res.allocationSummary.allocationRef}).`
          : `Payment ${p.payment_reference} automatically verified.`
      );
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Automatic verification check held this payment for manual review.');
      await loadAll();
    } finally {
      setAutoProcessingId(null);
    }
  };

  const quickDecideRequest = async (id: number, nextStatus: string, ref: string) => {
    if (nextStatus === 'rejected') {
      openDecisionModal({
        kind: 'request',
        id,
        nextStatus,
        reference: ref,
        label: 'Reject Investment Request',
      });
      return;
    }
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/api/admin/investments/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ nextStatus }),
      });
      setFeedback(`Investment request ${ref} updated to ${nextStatus.replace(/_/g, ' ')}.`);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to update investment request.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    const parsedLength = Number(autoMinTxidLengthText.trim());
    if (!autoMinTxidLengthText.trim() || !Number.isInteger(parsedLength) || parsedLength < 8 || parsedLength > 128) {
      setError('Minimum TXID character length must be a whole number between 8 and 128.');
      return;
    }

    setSavingSettings(true);
    try {
      await apiRequest('/api/admin/payments/settings', {
        method: 'PUT',
        body: JSON.stringify({
          processingMode,
          autoAllocateShares,
          autoRequireFullAmount,
          autoMinTxidLength: parsedLength,
        }),
      });
      setFeedback(
        `Crypto payment processing engine updated (${processingMode === 'automatic' ? 'Automatic Settlement' : 'Manual Treasury Review'} default).`
      );
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to save crypto payment processing settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleMethod = async (m: any) => {
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/api/admin/payments/methods/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: m.name,
          network: m.network,
          symbol: m.symbol,
          processingMode: m.processing_mode || 'inherit',
          isEnabled: !m.is_enabled,
        }),
      });
      setFeedback(`${m.name} (${m.code}) ${!m.is_enabled ? 'enabled' : 'disabled'}.`);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to update payment method.');
    }
  };

  const updateMethodProcessingMode = async (m: any, nextMode: MethodProcessingMode) => {
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/api/admin/payments/methods/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: m.name,
          network: m.network,
          symbol: m.symbol,
          processingMode: nextMode,
          isEnabled: Boolean(m.is_enabled),
        }),
      });
      setFeedback(`${m.name} processing mode updated to ${nextMode.toUpperCase()}.`);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to update method processing mode.');
    }
  };

  const openEditModal = (m: any, w: any | undefined) => {
    setEditDraft({
      methodId: m.id,
      walletId: w ? w.id : null,
      name: m.name || '',
      symbol: m.symbol || '',
      network: w?.network || m.network || '',
      processingMode: (m.processing_mode as MethodProcessingMode) || 'inherit',
      isEnabled: Boolean(m.is_enabled),
      label: w?.label || `${m.name} Treasury Wallet`,
      walletAddress: w?.wallet_address || '',
      minPaymentAmount: w ? String(w.min_payment_amount) : '50',
      paymentInstructions:
        w?.payment_instructions ||
        'Send the exact requested amount using the specified network and submit your transaction hash (TXID).',
      isActive: w ? Boolean(w.is_active) : true,
    });
  };

  const saveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDraft) return;
    setError('');
    setFeedback('');

    const parsedMinAmount = Number(editDraft.minPaymentAmount.trim());
    if (!editDraft.minPaymentAmount.trim() || Number.isNaN(parsedMinAmount) || parsedMinAmount <= 0) {
      setError('Minimum payment amount must be a valid number greater than 0.');
      return;
    }

    setSavingEdit(true);
    try {
      await apiRequest(`/api/admin/payments/methods/${editDraft.methodId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editDraft.name,
          symbol: editDraft.symbol,
          network: editDraft.network,
          processingMode: editDraft.processingMode,
          isEnabled: editDraft.isEnabled,
        }),
      });

      const walletPayload = {
        paymentMethodId: editDraft.methodId,
        label: editDraft.label,
        walletAddress: editDraft.walletAddress,
        network: editDraft.network,
        minPaymentAmount: parsedMinAmount,
        paymentInstructions: editDraft.paymentInstructions,
        isActive: editDraft.isActive,
      };

      if (editDraft.walletId) {
        await apiRequest(`/api/admin/payments/wallets/${editDraft.walletId}`, {
          method: 'PUT',
          body: JSON.stringify(walletPayload),
        });
      } else {
        await apiRequest('/api/admin/payments/wallets', {
          method: 'POST',
          body: JSON.stringify(walletPayload),
        });
      }

      setFeedback('Cryptocurrency payment method and treasury wallet updated.');
      setEditDraft(null);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to save cryptocurrency method and wallet settings.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');

    const parsedMinAmount = Number(newMethodDraft.minPaymentAmount.trim());
    if (!newMethodDraft.minPaymentAmount.trim() || Number.isNaN(parsedMinAmount) || parsedMinAmount <= 0) {
      setError('Minimum payment amount must be a valid number greater than 0.');
      return;
    }

    setCreatingMethod(true);
    try {
      await apiRequest('/api/admin/payments/methods', {
        method: 'POST',
        body: JSON.stringify({
          ...newMethodDraft,
          minPaymentAmount: parsedMinAmount,
        }),
      });
      setFeedback(`Added cryptocurrency method ${newMethodDraft.name} (${newMethodDraft.code.toUpperCase()}).`);
      setAddMethodOpen(false);
      setNewMethodDraft(DEFAULT_NEW_METHOD);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to create cryptocurrency payment method.');
    } finally {
      setCreatingMethod(false);
    }
  };

  const confirmDeleteMethod = async () => {
    if (!deletingMethod) return;
    setError('');
    setFeedback('');
    setDeletingInProgress(true);
    try {
      await apiRequest(`/api/admin/payments/methods/${deletingMethod.id}`, { method: 'DELETE' });
      setFeedback(`Removed cryptocurrency method ${deletingMethod.name} (${deletingMethod.code}).`);
      setDeletingMethod(null);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to delete payment method.');
      setDeletingMethod(null);
    } finally {
      setDeletingInProgress(false);
    }
  };

  const resolveDisplayMode = (methodMode: string | undefined): ProcessingMode => {
    if (methodMode === 'automatic' || methodMode === 'manual') return methodMode;
    return processingMode;
  };

  return (
    <PortalShell
      portalTitle="Administrator Portal"
      breadcrumbLabel="Deposits, Requests & Payment Methods"
      navItems={ADMIN_NAV}
      variant="admin"
    >
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E8EE] pb-5">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#0B172A]">
              Deposit Approvals &amp; Payment Methods
            </h1>
            <p className="text-sm text-[#4A5260] mt-1">
              Configure automatic and manual cryptocurrency settlement engines, authorize deposits, and manage treasury wallets.
            </p>
          </div>

          <div className="flex flex-wrap border border-[#D6DAE2] bg-white self-start">
            <button
              type="button"
              onClick={() => setTab('requests')}
              className={`px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                tab === 'requests' ? 'bg-[#0B172A] text-white' : 'text-[#4A5260] hover:text-[#0B172A]'
              }`}
            >
              Order Requests ({requests.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('payments')}
              className={`px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                tab === 'payments' ? 'bg-[#0B172A] text-white' : 'text-[#4A5260] hover:text-[#0B172A]'
              }`}
            >
              Deposit Approvals ({payments.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('withdrawals')}
              className={`px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                tab === 'withdrawals' ? 'bg-[#0B172A] text-white' : 'text-[#4A5260] hover:text-[#0B172A]'
              }`}
            >
              Withdrawals ({withdrawals.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('wallets')}
              className={`px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                tab === 'wallets' ? 'bg-[#0B172A] text-white' : 'text-[#4A5260] hover:text-[#0B172A]'
              }`}
            >
              Crypto Payment System
            </button>
          </div>
        </div>

        {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
        {feedback && <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{feedback}</div>}

        {(tab === 'requests' || tab === 'payments' || tab === 'withdrawals') && (
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`px-3.5 py-1.5 text-xs font-semibold capitalize border transition-colors cursor-pointer ${
                  statusFilter === f
                    ? 'bg-[#B5924C] text-[#060E1C] border-[#B5924C]'
                    : 'bg-white text-[#4A5260] border-[#D6DAE2] hover:border-[#0B172A]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="h-44 bg-[#EFECE3] border border-[#E5E8EE]" />
        ) : tab === 'requests' ? (
          <div className="bg-white border border-[#E5E8EE] p-6 overflow-x-auto">
            {filteredRequests.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#4A5260]">
                No investment requests match this status filter.
              </div>
            ) : (
              <table className="w-full text-left text-xs min-w-[680px]">
                <thead className="border-b border-[#E5E8EE] text-[#4A5260] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 pr-4">Reference</th>
                    <th className="py-2.5 pr-4">Investor</th>
                    <th className="py-2.5 pr-4">Offering</th>
                    <th className="py-2.5 pr-4 text-right">Shares</th>
                    <th className="py-2.5 pr-4 text-right">Amount</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E8EE]">
                  {filteredRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-[#FCFBF8]">
                      <td className="py-3 pr-4 font-mono">{r.request_reference}</td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-[#0B172A]">
                          {r.first_name} {r.last_name} ({r.account_number})
                        </div>
                        <div className="text-[#4A5260]">KYC: {r.kyc_status}</div>
                      </td>
                      <td className="py-3 pr-4">{r.offering_title}</td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatNumber(r.requested_quantity)}</td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold">
                        {formatCurrency(r.total_amount, r.currency)}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 flex flex-wrap gap-2">
                        {['submitted', 'under_review'].includes(r.status) && (
                          <>
                            {r.status === 'submitted' && (
                              <button
                                type="button"
                                onClick={() => quickDecideRequest(r.id, 'under_review', r.request_reference)}
                                className="px-2.5 py-1 border border-[#D6DAE2] cursor-pointer"
                              >
                                Mark Review
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => quickDecideRequest(r.id, 'awaiting_payment', r.request_reference)}
                              className="px-3 py-1 bg-[#0B172A] text-white font-semibold cursor-pointer"
                            >
                              Approve for Payment
                            </button>
                            <button
                              type="button"
                              onClick={() => quickDecideRequest(r.id, 'rejected', r.request_reference)}
                              className="px-2.5 py-1 border border-[#991B1B]/40 text-[#991B1B] cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => quickDecideRequest(r.id, 'completed', r.request_reference)}
                            className="px-3 py-1 bg-[#146348] text-white font-semibold cursor-pointer"
                          >
                            Allocate Shares
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : tab === 'payments' ? (
          <div className="space-y-4">
            {filteredPayments.length === 0 ? (
              <div className="bg-white border border-[#E5E8EE] p-8 text-center text-xs text-[#4A5260]">
                No cryptocurrency deposit submissions match this filter.
              </div>
            ) : (
              filteredPayments.map((p) => {
                const isAuto = p.processing_mode === 'automatic';
                return (
                  <div key={p.id} className="bg-white border border-[#E5E8EE] p-6 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E8EE] pb-3">
                      <div>
                        <span className="font-mono font-semibold text-[#997837]">{p.payment_reference}</span> · Request{' '}
                        <span className="font-mono">{p.request_reference}</span> · {p.first_name} {p.last_name} (
                        {p.account_number})
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 border font-mono text-[10px] uppercase tracking-wider font-semibold ${
                            isAuto
                              ? 'bg-[#146348]/10 text-[#146348] border-[#146348]/40'
                              : 'bg-[#0B172A]/5 text-[#0B172A] border-[#0B172A]/25'
                          }`}
                        >
                          {isAuto ? <Zap className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                          <span>{isAuto ? 'AUTOMATIC' : 'MANUAL'}</span>
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <strong>Network:</strong> {p.payment_method_name} ({p.payment_network})
                      </div>
                      <div>
                        <strong>Expected / Submitted:</strong>{' '}
                        <span className="font-mono tabular-nums">
                          {formatCurrency(p.expected_amount, p.currency)} / {formatCurrency(p.submitted_amount, p.currency)}
                        </span>
                      </div>
                      <div>
                        <strong>Submitted At:</strong> {formatDateTime(p.created_at)}
                      </div>
                      <div>
                        {p.evidence_filename && (
                          <a
                            href={`/api/admin/payments/submissions/${p.id}/evidence`}
                            className="underline font-semibold text-[#0B172A]"
                          >
                            Download Evidence ({p.evidence_filename})
                          </a>
                        )}
                      </div>
                    </div>
                    <div>
                      <strong>TX Hash:</strong>{' '}
                      <code className="font-mono bg-[#FCFBF8] border border-[#E5E8EE] px-2 py-0.5 break-all">
                        {p.transaction_hash}
                      </code>
                    </div>
                    {(p.verification_notes || p.auto_verified_at) && (
                      <div className="bg-[#FCFBF8] border border-[#E5E8EE] px-3 py-2 text-[11px] text-[#4A5260] flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <strong className="text-[#0B172A]">Settlement Note:</strong> {p.verification_notes || 'Processed'}
                        </span>
                        {p.auto_verified_at && (
                          <span className="font-mono">Auto-Verified: {formatDateTime(p.auto_verified_at)}</span>
                        )}
                      </div>
                    )}
                    {['submitted', 'verification_pending', 'additional_evidence_required'].includes(p.status) && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          type="button"
                          disabled={autoProcessingId === p.id}
                          onClick={() => handleAutoProcessPayment(p)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] font-bold cursor-pointer disabled:opacity-60"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{autoProcessingId === p.id ? 'Auto-Processing...' : 'Auto-Process Now'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openDecisionModal(
                              {
                                kind: 'payment',
                                id: p.id,
                                decision: 'approved',
                                reference: p.payment_reference,
                                label: 'Approve Deposit & Allocate Shares',
                              },
                              'Blockchain transfer verified manually by Treasury.'
                            )
                          }
                          className="px-4 py-2 bg-[#146348] text-white font-semibold cursor-pointer"
                        >
                          Approve Payment &amp; Allocate Shares
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openDecisionModal(
                              {
                                kind: 'payment',
                                id: p.id,
                                decision: 'additional_evidence_required',
                                reference: p.payment_reference,
                                label: 'Request Additional Settlement Evidence',
                              },
                              'Please upload a clearer confirmation hash receipt.'
                            )
                          }
                          className="px-3 py-2 border border-[#9A3412]/40 text-[#9A3412] font-semibold cursor-pointer"
                        >
                          Request Additional Evidence
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openDecisionModal(
                              {
                                kind: 'payment',
                                id: p.id,
                                decision: 'rejected',
                                reference: p.payment_reference,
                                label: 'Reject Deposit Submission',
                              },
                              ''
                            )
                          }
                          className="px-4 py-2 bg-[#991B1B] text-white font-semibold cursor-pointer"
                        >
                          Reject Payment
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : tab === 'withdrawals' ? (
          <div className="space-y-4">
            {filteredWithdrawals.length === 0 ? (
              <div className="bg-white border border-[#E5E8EE] p-8 text-center text-xs text-[#4A5260]">
                No investor withdrawal requests match this status filter.
              </div>
            ) : (
              filteredWithdrawals.map((w) => (
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
                        {w.payout_method} ({w.network})
                      </span>
                    </div>
                    <div>
                      <strong className="text-[#4A5260] block">Balance Source</strong>
                      <span className="capitalize">{String(w.source_type || 'available_balance').replace(/_/g, ' ')}</span>
                    </div>
                    <div>
                      <strong className="text-[#4A5260] block">Requested At</strong>
                      <span className="font-mono">{formatDateTime(w.created_at)}</span>
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
                            openDecisionModal(
                              {
                                kind: 'withdrawal',
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
                          openDecisionModal(
                            {
                              kind: 'withdrawal',
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
                          openDecisionModal(
                            {
                              kind: 'withdrawal',
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
              ))
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global Crypto Processing Engine Panel */}
            <section className="bg-[#0B172A] text-[#FCFBF8] border border-[#1E365C] p-6 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E365C] pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[#C9A968] font-semibold">
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>Settlement Engine Configuration</span>
                  </div>
                  <h2 className="font-serif text-xl sm:text-2xl font-semibold text-white mt-0.5">
                    Automatic &amp; Manual Crypto Processing Rules
                  </h2>
                </div>
                <div className="px-3 py-1.5 border border-[#C9A968]/40 bg-[#060E1C] font-mono text-xs text-[#C9A968] uppercase tracking-wider self-start">
                  Global Default: {processingMode === 'automatic' ? 'AUTOMATIC' : 'MANUAL'}
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setProcessingMode('manual')}
                    className={`p-4 text-left border transition-colors cursor-pointer space-y-1.5 ${
                      processingMode === 'manual'
                        ? 'bg-[#060E1C] border-[#C9A968] text-white'
                        : 'bg-[#0B172A] border-[#1E365C] text-[#A8B2C1] hover:border-[#C9A968]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 font-semibold text-sm text-white">
                        <ShieldCheck className="w-4 h-4 text-[#C9A968]" />
                        <span>Manual Treasury Processing</span>
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-[#1E365C] text-[#C9A968]">
                        {processingMode === 'manual' ? 'ACTIVE DEFAULT' : 'SELECT'}
                      </span>
                    </div>
                    <p className="text-xs text-[#C8D0DC] leading-relaxed">
                      Investor TXIDs enter Treasury Verification Pending until an administrator reviews proof and authorizes share allocation.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProcessingMode('automatic')}
                    className={`p-4 text-left border transition-colors cursor-pointer space-y-1.5 ${
                      processingMode === 'automatic'
                        ? 'bg-[#060E1C] border-[#C9A968] text-white'
                        : 'bg-[#0B172A] border-[#1E365C] text-[#A8B2C1] hover:border-[#C9A968]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 font-semibold text-sm text-white">
                        <Zap className="w-4 h-4 text-[#C9A968]" />
                        <span>Automatic Settlement Processing</span>
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-[#1E365C] text-[#C9A968]">
                        {processingMode === 'automatic' ? 'ACTIVE DEFAULT' : 'SELECT'}
                      </span>
                    </div>
                    <p className="text-xs text-[#C8D0DC] leading-relaxed">
                      Valid unique TXIDs matching settlement thresholds are verified instantly upon submission; irregular submissions fall back to manual review.
                    </p>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#060E1C] border border-[#1E365C] p-4 items-center">
                  <label className="flex items-start gap-2.5 text-[#D6DAE2] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoAllocateShares}
                      onChange={(e) => setAutoAllocateShares(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="block text-white">Auto-Allocate Shares on Settlement</strong>
                      <span className="text-[11px] text-[#A8B2C1]">
                        Credit investor portfolio immediately when automatic verification passes.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 text-[#D6DAE2] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRequireFullAmount}
                      onChange={(e) => setAutoRequireFullAmount(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="block text-white">Require Full Requested Amount</strong>
                      <span className="text-[11px] text-[#A8B2C1]">
                        Hold underpayments for manual treasury review instead of auto-approving.
                      </span>
                    </span>
                  </label>

                  <div>
                    <label className="block font-semibold text-white mb-1">Minimum TXID Length (8–128 chars)</label>
                    <input
                      type="number"
                      min={8}
                      max={128}
                      value={autoMinTxidLengthText}
                      onChange={(e) => setAutoMinTxidLengthText(e.target.value)}
                      className="w-full px-3 py-2 font-mono border border-[#1E365C] bg-[#0B172A] text-[#FCFBF8]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] text-[#A8B2C1]">
                    Individual cryptocurrencies below can inherit this global default or override to Automatic / Manual independently.
                  </p>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-5 py-2.5 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
                  >
                    {savingSettings ? 'Saving Engine Settings...' : 'Save Processing Settings'}
                  </button>
                </div>
              </form>
            </section>

            {/* Payment Methods Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-serif text-xl font-semibold text-[#0B172A]">
                  Configured Cryptocurrency Channels ({methods.length})
                </h3>
                <p className="text-xs text-[#4A5260]">
                  Add wallets, switch individual coins between Inherit / Automatic / Manual, or toggle investor visibility.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewMethodDraft(DEFAULT_NEW_METHOD);
                  setAddMethodOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#C9A968]" />
                <span>Add Crypto Method</span>
              </button>
            </div>

            {/* Payment Methods & Wallets Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {methods.map((m) => {
                const wallet = wallets.find((w) => w.payment_method_id === m.id);
                const configuredMode: MethodProcessingMode = m.processing_mode || 'inherit';
                const effectiveMode = resolveDisplayMode(configuredMode);
                return (
                  <div key={m.id} className="bg-white border border-[#E5E8EE] p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#0B172A]">
                            {m.name} <span className="font-mono text-xs text-[#997837]">({m.code})</span>
                          </div>
                          <div className="text-xs text-[#4A5260] font-mono mt-0.5">
                            {m.network} {m.symbol ? `· ${m.symbol}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider border ${
                              effectiveMode === 'automatic'
                                ? 'bg-[#146348]/10 text-[#146348] border-[#146348]/40'
                                : 'bg-[#0B172A]/5 text-[#0B172A] border-[#0B172A]/25'
                            }`}
                          >
                            {configuredMode === 'inherit'
                              ? `INHERIT (${effectiveMode.toUpperCase()})`
                              : effectiveMode.toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleMethod(m)}
                            className={`px-3 py-1 text-xs font-bold font-mono tracking-wider border cursor-pointer transition-colors ${
                              m.is_enabled
                                ? 'bg-[#146348]/10 text-[#146348] border-[#146348]/40 hover:bg-[#146348]/20'
                                : 'bg-[#991B1B]/10 text-[#991B1B] border-[#991B1B]/40 hover:bg-[#991B1B]/20'
                            }`}
                          >
                            {m.is_enabled ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      </div>

                      {wallet ? (
                        <>
                          <div className="bg-[#FCFBF8] p-3 border border-[#E5E8EE] font-mono text-xs text-[#0B172A] break-all select-all">
                            {wallet.wallet_address}
                          </div>
                          <p className="text-xs text-[#4A5260] leading-relaxed">{wallet.payment_instructions}</p>
                        </>
                      ) : (
                        <p className="text-xs text-[#991B1B]">
                          No treasury wallet linked to this method. Click Edit Details to attach a wallet address.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E8EE] text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-[11px] font-semibold text-[#4A5260]">Mode:</label>
                        <select
                          value={configuredMode}
                          onChange={(e) => updateMethodProcessingMode(m, e.target.value as MethodProcessingMode)}
                          className="px-2 py-1 border border-[#D6DAE2] bg-[#FCFBF8] text-xs font-mono text-[#0B172A]"
                        >
                          <option value="inherit">Inherit Global ({processingMode})</option>
                          <option value="automatic">Automatic Settlement</option>
                          <option value="manual">Manual Review</option>
                        </select>
                        {wallet && (
                          <span className="text-[#4A5260] font-mono tabular-nums">
                            · Min {formatCurrency(wallet.min_payment_amount, 'USD')} ·{' '}
                            {wallet.is_active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(m, wallet)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#B5924C] text-[#0B172A] font-semibold hover:bg-[#FCFBF8] cursor-pointer"
                        >
                          <Pencil className="w-3 h-3 text-[#997837]" />
                          <span>Edit Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingMethod(m)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#991B1B]/30 text-[#991B1B] hover:bg-[#991B1B]/5 cursor-pointer"
                          aria-label={`Delete ${m.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Decision Notes Modal (Replaces window.prompt cleanly on mobile & desktop) */}
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

            <form onSubmit={submitDecisionModal} className="space-y-4 text-xs">
              {decisionModal.kind === 'withdrawal' && decisionModal.decision === 'completed' && (
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
                  placeholder="Enter verification notes or reason..."
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
                  disabled={submittingDecision}
                  className="px-5 py-2 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
                >
                  {submittingDecision ? 'Processing...' : 'Confirm Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Crypto Method & Wallet Modal */}
      {addMethodOpen && (
        <div className="fixed inset-0 z-50 bg-[#060E1C]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#0B172A] text-[#FCFBF8] border border-[#1E365C] p-6 space-y-4 my-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E365C] pb-3">
              <h2 className="font-serif text-lg font-semibold text-[#FCFBF8]">Add Cryptocurrency Payment Method</h2>
              <button
                type="button"
                onClick={() => setAddMethodOpen(false)}
                className="text-[#A8B2C1] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMethod} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Coin / Method Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Solana"
                    value={newMethodDraft.name}
                    onChange={(e) => setNewMethodDraft({ ...newMethodDraft, name: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Symbol *</label>
                  <input
                    type="text"
                    required
                    placeholder="SOL"
                    value={newMethodDraft.symbol}
                    onChange={(e) => setNewMethodDraft({ ...newMethodDraft, symbol: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Method Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="SOL_MAINNET"
                    value={newMethodDraft.code}
                    onChange={(e) => setNewMethodDraft({ ...newMethodDraft, code: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Blockchain Network *</label>
                  <input
                    type="text"
                    required
                    placeholder="Solana Mainnet"
                    value={newMethodDraft.network}
                    onChange={(e) => setNewMethodDraft({ ...newMethodDraft, network: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Processing Mode *</label>
                  <select
                    value={newMethodDraft.processingMode}
                    onChange={(e) =>
                      setNewMethodDraft({
                        ...newMethodDraft,
                        processingMode: e.target.value as MethodProcessingMode,
                      })
                    }
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  >
                    <option value="inherit">Inherit Global ({processingMode})</option>
                    <option value="automatic">Automatic Settlement</option>
                    <option value="manual">Manual Treasury Review</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Treasury Wallet Label *</label>
                  <input
                    type="text"
                    required
                    placeholder="Richmond Primary SOL Treasury"
                    value={newMethodDraft.label}
                    onChange={(e) => setNewMethodDraft({ ...newMethodDraft, label: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Minimum Payment (USD) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={newMethodDraft.minPaymentAmount}
                    onChange={(e) => setNewMethodDraft({ ...newMethodDraft, minPaymentAmount: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">Public Deposit Wallet Address *</label>
                <input
                  type="text"
                  required
                  minLength={16}
                  value={newMethodDraft.walletAddress}
                  onChange={(e) => setNewMethodDraft({ ...newMethodDraft, walletAddress: e.target.value })}
                  placeholder="Enter full treasury wallet address"
                  className="w-full px-3 py-2 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">Investor Payment Instructions *</label>
                <textarea
                  rows={3}
                  required
                  value={newMethodDraft.paymentInstructions}
                  onChange={(e) => setNewMethodDraft({ ...newMethodDraft, paymentInstructions: e.target.value })}
                  className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                />
              </div>

              <div className="flex flex-wrap gap-6 pt-1">
                <label className="flex items-center gap-2 text-[#D6DAE2]">
                  <input
                    type="checkbox"
                    checked={newMethodDraft.isEnabled}
                    onChange={(e) => setNewMethodDraft({ ...newMethodDraft, isEnabled: e.target.checked })}
                  />
                  <span>Method Enabled for Investors</span>
                </label>
                <label className="flex items-center gap-2 text-[#D6DAE2]">
                  <input
                    type="checkbox"
                    checked={newMethodDraft.isActive}
                    onChange={(e) => setNewMethodDraft({ ...newMethodDraft, isActive: e.target.checked })}
                  />
                  <span>Wallet Active</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={creatingMethod}
                className="w-full py-3 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
              >
                {creatingMethod ? 'Creating Crypto Method...' : 'Create Cryptocurrency Payment Method'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Method & Wallet Modal */}
      {editDraft && (
        <div className="fixed inset-0 z-50 bg-[#060E1C]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#0B172A] text-[#FCFBF8] border border-[#1E365C] p-6 space-y-4 my-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E365C] pb-3">
              <h2 className="font-serif text-lg font-semibold text-[#FCFBF8]">
                Edit Crypto Method &amp; Treasury Wallet
              </h2>
              <button
                type="button"
                onClick={() => setEditDraft(null)}
                className="text-[#A8B2C1] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveEditModal} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Method Name *</label>
                  <input
                    type="text"
                    required
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Symbol *</label>
                  <input
                    type="text"
                    required
                    value={editDraft.symbol}
                    onChange={(e) => setEditDraft({ ...editDraft, symbol: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Processing Mode *</label>
                  <select
                    value={editDraft.processingMode}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, processingMode: e.target.value as MethodProcessingMode })
                    }
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  >
                    <option value="inherit">Inherit ({processingMode})</option>
                    <option value="automatic">Automatic</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Wallet Label *</label>
                  <input
                    type="text"
                    required
                    value={editDraft.label}
                    onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Network *</label>
                  <input
                    type="text"
                    required
                    value={editDraft.network}
                    onChange={(e) => setEditDraft({ ...editDraft, network: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">Public Deposit Wallet Address *</label>
                <input
                  type="text"
                  required
                  minLength={16}
                  value={editDraft.walletAddress}
                  onChange={(e) => setEditDraft({ ...editDraft, walletAddress: e.target.value })}
                  className="w-full px-3 py-2 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Minimum Payment (USD) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editDraft.minPaymentAmount}
                    onChange={(e) => setEditDraft({ ...editDraft, minPaymentAmount: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div className="space-y-2 pt-3">
                  <label className="flex items-center gap-2 text-[#D6DAE2]">
                    <input
                      type="checkbox"
                      checked={editDraft.isEnabled}
                      onChange={(e) => setEditDraft({ ...editDraft, isEnabled: e.target.checked })}
                    />
                    <span>Method Enabled</span>
                  </label>
                  <label className="flex items-center gap-2 text-[#D6DAE2]">
                    <input
                      type="checkbox"
                      checked={editDraft.isActive}
                      onChange={(e) => setEditDraft({ ...editDraft, isActive: e.target.checked })}
                    />
                    <span>Wallet Active for Investor Deposits</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">Investor Payment Instructions *</label>
                <textarea
                  rows={3}
                  required
                  value={editDraft.paymentInstructions}
                  onChange={(e) => setEditDraft({ ...editDraft, paymentInstructions: e.target.value })}
                  className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                />
              </div>

              <button
                type="submit"
                disabled={savingEdit}
                className="w-full py-3 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
              >
                {savingEdit ? 'Saving Configuration...' : 'Save Method & Wallet Configuration'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Unused Method Modal */}
      {deletingMethod && (
        <div className="fixed inset-0 z-50 bg-[#060E1C]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0B172A] text-[#FCFBF8] border border-[#1E365C] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E365C] pb-3">
              <h2 className="font-serif text-lg font-semibold text-[#FCFBF8]">Remove Payment Method</h2>
              <button
                type="button"
                onClick={() => setDeletingMethod(null)}
                className="text-[#A8B2C1] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#C8D0DC] leading-relaxed">
              Delete <strong className="text-white">{deletingMethod.name}</strong> ({deletingMethod.code}) and its linked treasury wallet? Methods with existing investor deposit records cannot be deleted and should be toggled OFF instead.
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeletingMethod(null)}
                className="px-4 py-2 border border-[#1E365C] text-[#D6DAE2] hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingInProgress}
                onClick={confirmDeleteMethod}
                className="px-5 py-2 bg-[#991B1B] text-white font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
              >
                {deletingInProgress ? 'Removing...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
