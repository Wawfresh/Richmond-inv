import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, ShieldCheck, Wallet, Zap } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { INVESTOR_NAV } from './InvestorDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime, formatPlanDuration, formatRoi } from '../../lib/format';

interface SettlementResult {
  paymentReference: string;
  status: string;
  processingMode: 'automatic' | 'manual';
  autoProcessed: boolean;
  allocationSummary?: {
    allocationRef: string;
    txRef: string;
    quantity?: number;
  } | null;
  reviewReason?: string;
}

export function InvestorPaymentPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  const [requestRow, setRequestRow] = useState<any | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [globalProcessingMode, setGlobalProcessingMode] = useState<'automatic' | 'manual'>('manual');
  const [selectedMethodId, setSelectedMethodId] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null);

  const [submittedAmount, setSubmittedAmount] = useState('');
  const [txHash, setTxHash] = useState('');
  const [senderWallet, setSenderWallet] = useState('');
  const [investorNotes, setInvestorNotes] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submittingPay, setSubmittingPay] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);

  const loadPaymentData = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError('');
    try {
      const [reqRes, pmRes] = await Promise.all([
        apiRequest<{ request: any }>(`/api/investor/investments/${requestId}`),
        apiRequest<{ paymentMethods: any[]; globalProcessingMode?: 'automatic' | 'manual' }>(
          '/api/investor/payment-methods'
        ),
      ]);
      const reqData = reqRes.request;
      setRequestRow(reqData);
      if (reqData?.total_amount !== undefined && reqData?.total_amount !== null) {
        setSubmittedAmount(String(reqData.total_amount));
      }
      const methods = pmRes.paymentMethods || [];
      setPaymentMethods(methods);
      if (pmRes.globalProcessingMode) {
        setGlobalProcessingMode(pmRes.globalProcessingMode);
      }
      setSelectedMethodId((prev) => {
        if (prev && methods.some((m) => m.id === prev)) return prev;
        return methods[0]?.id || 0;
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to load payment instructions for this investment request.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadPaymentData();
  }, [loadPaymentData]);

  const selectedMethod = paymentMethods.find((m) => m.id === selectedMethodId) || paymentMethods[0] || null;
  const selectedEffectiveMode: 'automatic' | 'manual' =
    selectedMethod?.effectiveProcessingMode || globalProcessingMode;

  const handleCopyWallet = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    } catch {
      // Clipboard API fallback ignored
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestRow || !selectedMethod) return;
    setError('');
    setFeedback('');
    setSettlementResult(null);
    setSubmittingPay(true);

    try {
      const formData = new FormData();
      formData.append('investmentRequestId', String(requestRow.id));
      formData.append('paymentMethodId', String(selectedMethod.id));
      formData.append('submittedAmount', submittedAmount);
      formData.append('transactionHash', txHash);
      formData.append('senderWalletAddress', senderWallet);
      formData.append('investorNotes', investorNotes);
      if (evidenceFile) {
        formData.append('evidence', evidenceFile);
      }

      const res = await apiRequest<SettlementResult>('/api/investor/payments', {
        method: 'POST',
        body: formData,
      });

      setSettlementResult(res);
      if (res.autoProcessed) {
        setFeedback(
          res.allocationSummary
            ? `Payment ${res.paymentReference} was automatically verified and your investment holding has been allocated (${res.allocationSummary.allocationRef}).`
            : `Payment ${res.paymentReference} was automatically verified and confirmed.`
        );
      } else {
        setFeedback(
          `Payment verification ${res.paymentReference} has been submitted and queued for Treasury confirmation.`
        );
      }
      await loadPaymentData();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit cryptocurrency payment.');
    } finally {
      setSubmittingPay(false);
    }
  };

  const canSubmitPayment =
    requestRow &&
    ['submitted', 'under_review', 'awaiting_payment'].includes(requestRow.status) &&
    !(requestRow.payments || []).some((p: any) =>
      ['submitted', 'verification_pending', 'approved'].includes(p.status)
    );

  return (
    <PortalShell
      portalTitle="Investor Portal"
      breadcrumbLabel="Investment Payment & Settlement"
      navItems={INVESTOR_NAV}
      variant="investor"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/portal/orders"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B172A] hover:text-[#997837]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Orders &amp; Payments</span>
          </Link>
          <Link
            to="/portal/offerings"
            className="text-xs font-semibold text-[#4A5260] hover:text-[#0B172A]"
          >
            Browse Investment Plans
          </Link>
        </div>

        {error && <div className="p-3.5 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
        {feedback && (
          <div className="p-4 border border-[#146348]/40 bg-[#146348]/5 text-xs text-[#146348] space-y-2.5">
            <div className="font-semibold">{feedback}</div>
            {settlementResult?.reviewReason && !settlementResult.autoProcessed && (
              <div className="text-[#4A5260]">Review Note: {settlementResult.reviewReason}</div>
            )}
            <div className="flex flex-wrap gap-2">
              {settlementResult?.autoProcessed && (
                <button
                  type="button"
                  onClick={() => navigate('/portal/portfolio')}
                  className="px-4 py-2 bg-[#146348] text-white font-semibold hover:bg-[#104f3a] cursor-pointer"
                >
                  View Portfolio Holding
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/portal/orders')}
                className="px-4 py-2 bg-[#0B172A] text-[#FCFBF8] font-semibold hover:bg-[#132542] cursor-pointer"
              >
                View Order Status in Orders &amp; Payments
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="h-32 bg-[#EFECE3]" />
            <div className="h-64 bg-[#EFECE3]" />
          </div>
        ) : !requestRow ? (
          <div className="bg-white border border-[#E5E8EE] p-8 text-sm text-[#4A5260]">
            Investment request could not be found.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Payment Amount Instruction Header */}
            <section className="bg-[#0B172A] text-[#FCFBF8] border border-[#1E365C] p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-mono text-[#C9A968] uppercase tracking-wider">
                      {requestRow.request_reference}
                    </span>
                    <StatusBadge status={requestRow.status} />
                  </div>
                  <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#FCFBF8]">
                    Complete Payment for {requestRow.offering_title}
                  </h1>
                  <p className="text-xs sm:text-sm text-[#C8D0DC] max-w-2xl leading-relaxed">
                    Please send{' '}
                    <strong className="text-white font-mono">
                      {formatCurrency(requestRow.total_amount, requestRow.currency)}
                    </strong>{' '}
                    using one of the approved cryptocurrency payment methods configured by Administration below, then
                    submit your transaction hash (TXID) for settlement verification.
                  </p>
                </div>

                <div className="bg-[#060E1C] border border-[#B5924C]/50 p-5 shrink-0 min-w-[240px]">
                  <div className="text-[11px] uppercase tracking-widest text-[#C9A968]">Requested Amount Due</div>
                  <div className="font-mono text-3xl font-semibold text-white tabular-nums mt-1">
                    {formatCurrency(requestRow.total_amount, requestRow.currency)}
                  </div>
                  <div className="text-[11px] font-mono text-[#A8B2C1] mt-1.5 tabular-nums">
                    {requestRow.roi_percent !== undefined ? `ROI: ${formatRoi(requestRow.roi_percent)} · ` : ''}
                    {formatPlanDuration(
                      requestRow.duration_months,
                      requestRow.duration_days,
                      requestRow.duration_hours,
                      requestRow.duration_unit,
                      requestRow.duration_value
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Step-by-Step Settlement Instructions */}
            <section className="bg-white border border-[#E5E8EE] p-6 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
              <div className="bg-[#FCFBF8] border border-[#E5E8EE] p-4 space-y-1">
                <div className="font-mono text-[#997837] font-semibold">STEP 01 · CHOOSE CRYPTO METHOD</div>
                <div className="font-semibold text-[#0B172A]">Select an Admin-Approved Wallet</div>
                <p className="text-[#4A5260] leading-relaxed">
                  Pick any enabled cryptocurrency network below and verify the destination address and network match.
                </p>
              </div>
              <div className="bg-[#FCFBF8] border border-[#E5E8EE] p-4 space-y-1">
                <div className="font-mono text-[#997837] font-semibold">STEP 02 · TRANSFER REQUESTED AMOUNT</div>
                <div className="font-semibold text-[#0B172A]">
                  Send {formatCurrency(requestRow.total_amount, requestRow.currency)} Equivalent
                </div>
                <p className="text-[#4A5260] leading-relaxed">
                  Transfer the requested capital amount from your wallet and keep your blockchain transaction hash (TXID).
                </p>
              </div>
              <div className="bg-[#FCFBF8] border border-[#E5E8EE] p-4 space-y-1">
                <div className="font-mono text-[#997837] font-semibold">STEP 03 · SUBMIT PROOF</div>
                <div className="font-semibold text-[#0B172A]">Log TXID for Settlement Processing</div>
                <p className="text-[#4A5260] leading-relaxed">
                  Enter your TXID below for automatic settlement or manual Treasury confirmation depending on the channel.
                </p>
              </div>
            </section>

            {/* Existing Payment Records if already submitted */}
            {(requestRow.payments || []).length > 0 && (
              <section className="bg-white border border-[#E5E8EE] p-6 space-y-3">
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Logged Payment Submissions</h2>
                <div className="divide-y divide-[#E5E8EE] border border-[#E5E8EE]">
                  {requestRow.payments.map((p: any) => (
                    <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 font-mono font-semibold text-[#0B172A]">
                          <span>
                            {p.payment_reference} · {p.payment_method_name} ({p.payment_network})
                          </span>
                          <span className="px-2 py-0.5 text-[10px] border border-[#D6DAE2] bg-[#FCFBF8] text-[#4A5260] uppercase">
                            {p.processing_mode === 'automatic' ? 'Automatic' : 'Manual'}
                          </span>
                        </div>
                        <div className="text-[#4A5260] font-mono break-all">TXID: {p.transaction_hash}</div>
                        <div className="text-[#4A5260]">Submitted: {formatDateTime(p.created_at)}</div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="font-mono font-semibold text-[#0B172A] tabular-nums">
                          {formatCurrency(p.submitted_amount, p.currency)}
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Admin-Configured Crypto Payment Methods & Submission Form */}
            {canSubmitPayment && (
              <section className="bg-white border border-[#E5E8EE] p-6 sm:p-8 space-y-6">
                <div className="border-b border-[#E5E8EE] pb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[#997837] font-semibold">
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Treasury Cryptocurrency Channels</span>
                    </div>
                    <h2 className="font-serif text-2xl font-semibold text-[#0B172A] mt-0.5">
                      Select Payment Method &amp; Submit Settlement Proof
                    </h2>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs text-[#146348] font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Amount Due: {formatCurrency(requestRow.total_amount, requestRow.currency)}</span>
                  </div>
                </div>

                {paymentMethods.length === 0 ? (
                  <div className="p-4 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">
                    No cryptocurrency payment methods are currently enabled by Administration. Please contact Treasury Support.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left: Admin Crypto Methods + Selected Wallet Details */}
                    <div className="lg:col-span-5 space-y-4">
                      <label className="block text-xs font-semibold text-[#0B172A]">
                        Available Crypto Payment Methods ({paymentMethods.length})
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {paymentMethods.map((m) => {
                          const mode: 'automatic' | 'manual' =
                            m.effectiveProcessingMode || globalProcessingMode;
                          const isSelected = selectedMethod?.id === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setSelectedMethodId(m.id)}
                              className={`p-3.5 text-left border text-xs transition-colors cursor-pointer space-y-1 ${
                                isSelected
                                  ? 'bg-[#0B172A] text-white border-[#0B172A]'
                                  : 'bg-[#FCFBF8] text-[#1C2026] border-[#D6DAE2] hover:border-[#0B172A]'
                              }`}
                            >
                              <div className="font-semibold">
                                {m.name} {m.symbol ? `(${m.symbol})` : ''}
                              </div>
                              <div className={`text-[11px] ${isSelected ? 'text-[#C9A968]' : 'text-[#4A5260]'}`}>
                                {m.network}
                              </div>
                              <div
                                className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider pt-0.5 ${
                                  mode === 'automatic'
                                    ? isSelected
                                      ? 'text-[#7BE0B8]'
                                      : 'text-[#146348]'
                                    : isSelected
                                    ? 'text-[#C8D0DC]'
                                    : 'text-[#4A5260]'
                                }`}
                              >
                                {mode === 'automatic' ? (
                                  <Zap className="w-3 h-3" />
                                ) : (
                                  <ShieldCheck className="w-3 h-3" />
                                )}
                                <span>{mode === 'automatic' ? 'Auto Settlement' : 'Manual Review'}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedMethod?.wallet && (
                        <div className="border border-[#E5E8EE] bg-[#FCFBF8] p-5 space-y-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#0B172A]">{selectedMethod.wallet.label}</span>
                            <span className="font-mono text-[11px] text-[#997837]">{selectedMethod.wallet.network}</span>
                          </div>

                          <div
                            className={`p-2.5 border text-[11px] flex items-start gap-2 ${
                              selectedEffectiveMode === 'automatic'
                                ? 'bg-[#146348]/5 border-[#146348]/30 text-[#146348]'
                                : 'bg-white border-[#D6DAE2] text-[#4A5260]'
                            }`}
                          >
                            {selectedEffectiveMode === 'automatic' ? (
                              <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#0B172A]" />
                            )}
                            <span>
                              {selectedEffectiveMode === 'automatic'
                                ? 'Automatic Processing enabled: valid unique TXIDs covering the requested amount settle immediately.'
                                : 'Manual Treasury Processing: Treasury reviews your TXID and proof before allocating shares.'}
                            </span>
                          </div>

                          {selectedMethod.wallet.qrDataUrl && (
                            <div className="bg-white border border-[#E5E8EE] p-3 inline-block">
                              <img
                                src={selectedMethod.wallet.qrDataUrl}
                                alt={`${selectedMethod.name} deposit QR code`}
                                className="w-40 h-40"
                              />
                            </div>
                          )}

                          <div>
                            <div className="text-[11px] uppercase tracking-wider text-[#4A5260] mb-1">
                              Treasury Wallet Address ({selectedMethod.wallet.network})
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 p-2.5 bg-white border border-[#D6DAE2] font-mono text-xs break-all select-all">
                                {selectedMethod.wallet.wallet_address}
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopyWallet(selectedMethod.wallet.wallet_address)}
                                className="px-3 py-2.5 border border-[#D6DAE2] bg-white text-[#0B172A] hover:bg-[#F9F7F2] cursor-pointer shrink-0"
                                aria-label="Copy wallet address"
                              >
                                {copiedWallet ? <Check className="w-4 h-4 text-[#146348]" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          <div className="text-xs text-[#4A5260] space-y-1.5 border-t border-[#E5E8EE] pt-3">
                            <div>
                              Payment Amount Requested:{' '}
                              <strong className="font-mono text-[#0B172A]">
                                {formatCurrency(requestRow.total_amount, requestRow.currency)}
                              </strong>
                            </div>
                            <p className="leading-relaxed">{selectedMethod.wallet.payment_instructions}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Payment Verification Submission Form */}
                    <form onSubmit={handleSubmitPayment} className="lg:col-span-7 space-y-4">
                      <h3 className="font-serif text-xl font-semibold text-[#0B172A]">
                        Confirm &amp; Submit Cryptocurrency Payment
                      </h3>
                      <p className="text-xs text-[#4A5260]">
                        After transferring{' '}
                        <strong className="text-[#0B172A] font-mono">
                          {formatCurrency(requestRow.total_amount, requestRow.currency)}
                        </strong>{' '}
                        via <strong>{selectedMethod?.name}</strong> ({selectedMethod?.network}), provide your transaction
                        reference below.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">
                            Amount Paid ({requestRow.currency}) *
                          </label>
                          <input
                            type="number"
                            step="any"
                            required
                            value={submittedAmount}
                            onChange={(e) => setSubmittedAmount(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D6DAE2] bg-[#FCFBF8]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">
                            Sender Wallet Address (Optional)
                          </label>
                          <input
                            type="text"
                            value={senderWallet}
                            onChange={(e) => setSenderWallet(e.target.value)}
                            placeholder="Your sending address"
                            className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D6DAE2] bg-[#FCFBF8]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">
                          Blockchain Transaction Hash (TXID) *
                        </label>
                        <input
                          type="text"
                          required
                          minLength={12}
                          value={txHash}
                          onChange={(e) => setTxHash(e.target.value)}
                          placeholder="Enter full transaction hash"
                          className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D6DAE2] bg-[#FCFBF8]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">
                          Upload Payment Evidence (PDF / PNG / JPG, optional)
                        </label>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp"
                          onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                          className="w-full text-xs text-[#4A5260] file:mr-4 file:py-2 file:px-4 file:border file:border-[#D6DAE2] file:bg-[#FCFBF8] file:text-xs file:font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Notes (Optional)</label>
                        <textarea
                          rows={2}
                          value={investorNotes}
                          onChange={(e) => setInvestorNotes(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingPay}
                        className="px-6 py-3 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] disabled:opacity-60 cursor-pointer"
                      >
                        {submittingPay
                          ? 'Processing Payment...'
                          : selectedEffectiveMode === 'automatic'
                          ? 'Submit & Auto-Process Payment'
                          : 'Submit Payment for Treasury Verification'}
                      </button>
                    </form>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
