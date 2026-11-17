import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { INVESTOR_NAV } from './InvestorDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/format';

interface WithdrawalSummary {
  totalInvestedCapital: number;
  portfolioValuation: number | null;
  effectivePortfolioValue: number;
  totalDividendsDistributed: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
  availableBalance: number;
}

export function InvestorWithdrawPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<any[]>([]);
  const [summary, setSummary] = useState<WithdrawalSummary>({
    totalInvestedCapital: 0,
    portfolioValuation: null,
    effectivePortfolioValue: 0,
    totalDividendsDistributed: 0,
    totalWithdrawn: 0,
    pendingWithdrawals: 0,
    availableBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Form state (numeric amount stored as clearable string)
  const [withdrawAmountText, setWithdrawAmountText] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('');
  const [payoutNetwork, setPayoutNetwork] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [sourceType, setSourceType] = useState<'available_balance' | 'dividends' | 'portfolio_returns'>(
    'available_balance'
  );
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [formError, setFormError] = useState('');

  const loadWithdrawals = useCallback(async () => {
    try {
      const res = await apiRequest<{
        withdrawals: any[];
        summary: WithdrawalSummary;
        payoutMethods: any[];
      }>('/api/investor/withdrawals');

      setWithdrawals(res.withdrawals || []);
      if (res.summary) setSummary(res.summary);
      const methods = res.payoutMethods || [];
      setPayoutMethods(methods);

      setPayoutMethod((prev) => {
        if (prev) return prev;
        return methods[0] ? `${methods[0].name} (${methods[0].symbol})` : 'Bank Wire Settlement';
      });
      setPayoutNetwork((prev) => {
        if (prev) return prev;
        return methods[0]?.network || 'SWIFT / IBAN';
      });
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load withdrawal details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  const handlePayoutMethodChange = (value: string) => {
    setPayoutMethod(value);
    const matched = payoutMethods.find((m: any) => `${m.name} (${m.symbol})` === value || m.name === value);
    if (matched) {
      setPayoutNetwork(matched.network);
    } else if (value === 'Bank Wire Settlement') {
      setPayoutNetwork('SWIFT / IBAN');
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFeedback('');

    const parsedAmount = Number(withdrawAmountText.trim());
    if (!withdrawAmountText.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid withdrawal amount greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ withdrawal: { withdrawal_reference: string } }>('/api/investor/withdrawals', {
        method: 'POST',
        body: JSON.stringify({
          amount: parsedAmount,
          payoutMethod,
          network: payoutNetwork,
          destinationAddress,
          sourceType,
          investorNotes: withdrawNotes,
        }),
      });
      setFeedback(
        `Withdrawal request ${res.withdrawal.withdrawal_reference} for ${formatCurrency(parsedAmount)} submitted for Treasury processing.`
      );
      setWithdrawAmountText('');
      setDestinationAddress('');
      setWithdrawNotes('');
      await loadWithdrawals();
    } catch (err: any) {
      setFormError(err?.message || 'Unable to submit withdrawal request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelWithdrawal = async (id: number) => {
    setFormError('');
    setFeedback('');
    setCancellingId(id);
    try {
      await apiRequest(`/api/investor/withdrawals/${id}/cancel`, { method: 'POST' });
      setFeedback('Pending withdrawal request cancelled and balance restored.');
      await loadWithdrawals();
    } catch (err: any) {
      setFormError(err?.message || 'Unable to cancel withdrawal request.');
    } finally {
      setCancellingId(null);
    }
  };

  const availableBalance = Number(summary.availableBalance || 0);

  return (
    <PortalShell
      portalTitle="Investor Portal"
      breadcrumbLabel="Withdraw Funds"
      navItems={INVESTOR_NAV}
      variant="investor"
    >
      <div className="space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">Withdraw Funds</h1>
          <p className="text-sm text-[#4A5260] mt-1">
            Submit payout requests from your available balance or distributed dividends and track Treasury settlement status.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-28 bg-[#EFECE3]" />
              <div className="h-28 bg-[#EFECE3]" />
              <div className="h-28 bg-[#EFECE3]" />
            </div>
            <div className="h-64 bg-[#EFECE3]" />
          </div>
        ) : loadError ? (
          <div className="bg-white border border-[#991B1B]/30 p-6 text-sm text-[#991B1B]">{loadError}</div>
        ) : (
          <>
            {/* Balance Overview Strip */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-white border border-[#E5E8EE] p-6">
                <div className="text-xs uppercase tracking-wider text-[#4A5260]">Available Withdrawable Balance</div>
                <div className="font-mono text-2xl font-semibold text-[#146348] tabular-nums mt-2">
                  {formatCurrency(availableBalance)}
                </div>
                <div className="text-xs text-[#4A5260] mt-1">
                  Eligible portfolio value &amp; distributed dividends
                </div>
              </div>

              <div className="bg-white border border-[#E5E8EE] p-6">
                <div className="text-xs uppercase tracking-wider text-[#4A5260]">Pending Withdrawals</div>
                <div className="font-mono text-2xl font-semibold text-[#0B172A] tabular-nums mt-2">
                  {formatCurrency(summary.pendingWithdrawals || 0)}
                </div>
                <div className="text-xs text-[#4A5260] mt-1">Awaiting Treasury approval or dispatch</div>
              </div>

              <div className="bg-white border border-[#E5E8EE] p-6">
                <div className="text-xs uppercase tracking-wider text-[#4A5260]">Total Settled Withdrawals</div>
                <div className="font-mono text-2xl font-semibold text-[#0B172A] tabular-nums mt-2">
                  {formatCurrency(summary.totalWithdrawn || 0)}
                </div>
                <div className="text-xs text-[#4A5260] mt-1">Completed &amp; approved disbursements</div>
              </div>
            </section>

            {formError && (
              <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{formError}</div>
            )}
            {feedback && (
              <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{feedback}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left: Withdrawal Request Form */}
              <section className="lg:col-span-5 bg-white border border-[#E5E8EE] p-6 space-y-5">
                <div className="border-b border-[#E5E8EE] pb-3.5">
                  <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Request Withdrawal</h2>
                  <p className="text-xs text-[#4A5260] mt-0.5">
                    Select a payout channel and enter your receiving wallet or wire reference.
                  </p>
                </div>

                <form onSubmit={handleWithdrawSubmit} className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-[#1C2026]">Withdrawal Amount (USD) *</label>
                      {availableBalance > 0 && (
                        <button
                          type="button"
                          onClick={() => setWithdrawAmountText(String(availableBalance))}
                          className="font-mono text-[11px] text-[#997837] hover:underline cursor-pointer whitespace-nowrap"
                        >
                          Max: {formatCurrency(availableBalance)}
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={withdrawAmountText}
                      onChange={(e) => setWithdrawAmountText(e.target.value)}
                      className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C2026] mb-1">Withdrawal Source *</label>
                    <select
                      value={sourceType}
                      onChange={(e) =>
                        setSourceType(e.target.value as 'available_balance' | 'dividends' | 'portfolio_returns')
                      }
                      className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                    >
                      <option value="available_balance">Available Balance</option>
                      <option value="dividends">Distributed Dividends</option>
                      <option value="portfolio_returns">Portfolio Returns</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#1C2026] mb-1">Payout Method *</label>
                      <select
                        value={payoutMethod}
                        onChange={(e) => handlePayoutMethodChange(e.target.value)}
                        className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                      >
                        {payoutMethods.map((m: any) => (
                          <option key={m.id} value={`${m.name} (${m.symbol})`}>
                            {m.name} ({m.symbol})
                          </option>
                        ))}
                        <option value="Bank Wire Settlement">Bank Wire Settlement</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#1C2026] mb-1">Settlement Network</label>
                      <input
                        type="text"
                        value={payoutNetwork}
                        onChange={(e) => setPayoutNetwork(e.target.value)}
                        placeholder="e.g., Bitcoin Mainnet / TRC20"
                        className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C2026] mb-1">
                      Destination Wallet Address / Account Reference *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={8}
                      value={destinationAddress}
                      onChange={(e) => setDestinationAddress(e.target.value)}
                      placeholder="Enter receiving wallet address or IBAN"
                      className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C2026] mb-1">Settlement Notes (Optional)</label>
                    <textarea
                      rows={2}
                      value={withdrawNotes}
                      onChange={(e) => setWithdrawNotes(e.target.value)}
                      placeholder="Optional payout instructions"
                      className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                    />
                  </div>

                  <div className="pt-1 space-y-3">
                    {availableBalance <= 0 && (
                      <p className="text-[11px] text-[#4A5260]">
                        Active portfolio holdings or distributed dividends are required before submitting a withdrawal.
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#C9A968]" />
                      <span>{submitting ? 'Submitting...' : 'Submit Withdrawal Request'}</span>
                    </button>
                  </div>
                </form>
              </section>

              {/* Right: Withdrawal History */}
              <section className="lg:col-span-7 bg-white border border-[#E5E8EE] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E5E8EE] pb-3.5">
                  <div>
                    <h2 className="font-serif text-xl font-semibold text-[#0B172A]">
                      Withdrawal History ({withdrawals.length})
                    </h2>
                    <p className="text-xs text-[#4A5260] mt-0.5">
                      Track submitted requests, payout transaction hashes, and Treasury review notes.
                    </p>
                  </div>
                </div>

                {withdrawals.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[#4A5260]">
                    No withdrawal requests have been submitted yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5E8EE]">
                    {withdrawals.map((w: any) => (
                      <div key={w.id} className="py-4 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="font-mono font-semibold text-[#0B172A]">
                              {w.withdrawal_reference} · {w.payout_method}
                              {w.network ? ` (${w.network})` : ''}
                            </div>
                            <div className="text-[11px] text-[#4A5260]">
                              Source: <span className="capitalize">{String(w.source_type || 'available_balance').replace(/_/g, ' ')}</span> ·{' '}
                              {formatDateTime(w.created_at)}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono text-sm font-semibold text-[#0B172A] tabular-nums">
                              {formatCurrency(w.amount, w.currency)}
                            </span>
                            <StatusBadge status={w.status} />
                            {w.status === 'pending' && (
                              <button
                                type="button"
                                disabled={cancellingId === w.id}
                                onClick={() => handleCancelWithdrawal(w.id)}
                                className="px-2.5 py-1 border border-[#991B1B]/40 text-[#991B1B] font-semibold hover:bg-[#991B1B]/5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                              >
                                {cancellingId === w.id ? 'Cancelling...' : 'Cancel'}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="bg-[#FCFBF8] border border-[#E5E8EE] px-3 py-2 font-mono text-[11px] text-[#0B172A] break-all">
                          Destination: {w.destination_address}
                        </div>

                        {(w.investor_notes || w.admin_notes || w.transaction_hash) && (
                          <div className="space-y-1 text-[11px] text-[#4A5260]">
                            {w.investor_notes && (
                              <div>
                                <strong className="text-[#0B172A]">Your Note:</strong> {w.investor_notes}
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
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}
