import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { INVESTOR_NAV } from './InvestorDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime, formatNumber } from '../../lib/format';

export function InvestorOrdersPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePayReq, setActivePayReq] = useState<any | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<number>(0);
  const [txHash, setTxHash] = useState('');
  const [senderWallet, setSenderWallet] = useState('');
  const [submittedAmount, setSubmittedAmount] = useState('');
  const [investorNotes, setInvestorNotes] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submittingPay, setSubmittingPay] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqRes, pmRes] = await Promise.all([
        apiRequest<{ requests: any[] }>('/api/investor/investments'),
        apiRequest<{ paymentMethods: any[] }>('/api/investor/payment-methods'),
      ]);
      setRequests(reqRes.requests || []);
      const methods = pmRes.paymentMethods || [];
      setPaymentMethods(methods);
      if (methods[0]?.id && !selectedMethodId) setSelectedMethodId(methods[0].id);
    } catch (err: any) {
      setError(err?.message || 'Unable to load investment orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmitDraft = async (id: number) => {
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/api/investor/investments/${id}/submit`, { method: 'POST' });
      navigate(`/portal/pay/${id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit draft.');
    }
  };

  const handleCancelRequest = async (id: number) => {
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/api/investor/investments/${id}/cancel`, { method: 'POST' });
      setFeedback('Investment request cancelled.');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to cancel request.');
    }
  };

  const openPaymentPanel = (reqRow: any) => {
    setActivePayReq(reqRow);
    setSubmittedAmount(String(reqRow.total_amount));
    setTxHash('');
    setSenderWallet('');
    setInvestorNotes('');
    setEvidenceFile(null);
    setError('');
    setFeedback('');
  };

  const selectedMethod = paymentMethods.find((m) => m.id === selectedMethodId) || paymentMethods[0] || null;

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
    if (!activePayReq || !selectedMethod) return;
    setError('');
    setFeedback('');
    setSubmittingPay(true);

    try {
      const formData = new FormData();
      formData.append('investmentRequestId', String(activePayReq.id));
      formData.append('paymentMethodId', String(selectedMethod.id));
      formData.append('submittedAmount', submittedAmount);
      formData.append('transactionHash', txHash);
      formData.append('senderWalletAddress', senderWallet);
      formData.append('investorNotes', investorNotes);
      if (evidenceFile) {
        formData.append('evidence', evidenceFile);
      }

      const res = await apiRequest<{
        paymentReference: string;
        autoProcessed?: boolean;
        allocationSummary?: { allocationRef: string } | null;
      }>('/api/investor/payments', {
        method: 'POST',
        body: formData,
      });
      setFeedback(
        res.autoProcessed
          ? res.allocationSummary
            ? `Cryptocurrency payment ${res.paymentReference} was automatically verified and allocated (${res.allocationSummary.allocationRef}).`
            : `Cryptocurrency payment ${res.paymentReference} was automatically verified.`
          : `Cryptocurrency payment ${res.paymentReference} submitted and queued for manual treasury verification.`
      );
      setActivePayReq(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit cryptocurrency payment.');
    } finally {
      setSubmittingPay(false);
    }
  };

  return (
    <PortalShell
      portalTitle="Investor Portal"
      breadcrumbLabel="Investment Orders & Crypto Settlement"
      navItems={INVESTOR_NAV}
      variant="investor"
    >
      <div className="space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">Investment Requests & Settlement</h1>
          <p className="text-sm text-[#4A5260] mt-1">
            Track administrative approvals and submit cryptocurrency settlement proofs for approved orders.
          </p>
        </div>

        {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
        {feedback && <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{feedback}</div>}

        {/* Cryptocurrency Payment Submission Drawer/Panel */}
        {activePayReq && (
          <section className="bg-white border border-[#0B172A] p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E8EE] pb-4">
              <div>
                <div className="text-xs font-mono text-[#997837]">
                  SETTLEMENT FOR {activePayReq.request_reference}
                </div>
                <h2 className="font-serif text-2xl font-semibold text-[#0B172A]">
                  {activePayReq.offering_title} — {formatCurrency(activePayReq.total_amount, activePayReq.currency)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActivePayReq(null)}
                className="px-4 py-2 text-xs font-semibold border border-[#D6DAE2] text-[#4A5260]"
              >
                Close Settlement Panel
              </button>
            </div>

            {paymentMethods.length === 0 ? (
              <p className="text-sm text-[#991B1B]">
                No cryptocurrency payment wallets are currently enabled by Treasury Administration.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-5 space-y-4">
                  <label className="block text-xs font-semibold text-[#1C2026]">Select Cryptocurrency Network</label>
                  <div className="grid grid-cols-2 gap-2">
                    {paymentMethods.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMethodId(m.id)}
                        className={`p-3 text-left border text-xs ${
                          selectedMethod?.id === m.id
                            ? 'bg-[#0B172A] text-white border-[#0B172A]'
                            : 'bg-[#FCFBF8] text-[#1C2026] border-[#D6DAE2]'
                        }`}
                      >
                        <div className="font-semibold">{m.name}</div>
                        <div className="text-[11px] opacity-80">{m.network}</div>
                      </button>
                    ))}
                  </div>

                  {selectedMethod?.wallet && (
                    <div className="border border-[#E5E8EE] bg-[#FCFBF8] p-5 space-y-4">
                      <div className="text-xs font-semibold text-[#0B172A]">{selectedMethod.wallet.label}</div>
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
                          <code className="flex-1 p-2.5 bg-white border border-[#D6DAE2] font-mono text-xs break-all">
                            {selectedMethod.wallet.wallet_address}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopyWallet(selectedMethod.wallet.wallet_address)}
                            className="px-3 py-2.5 border border-[#D6DAE2] bg-white text-[#0B172A] hover:bg-[#F9F7F2]"
                            aria-label="Copy wallet address"
                          >
                            {copiedWallet ? <Check className="w-4 h-4 text-[#146348]" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-[#4A5260] space-y-1">
                        <div>
                          Minimum Settlement:{' '}
                          <strong className="font-mono text-[#0B172A]">
                            {formatCurrency(selectedMethod.wallet.min_payment_amount, activePayReq.currency)}
                          </strong>
                        </div>
                        <p className="leading-relaxed">{selectedMethod.wallet.payment_instructions}</p>
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmitPayment} className="lg:col-span-7 space-y-4">
                  <h3 className="font-serif text-xl font-semibold text-[#0B172A]">Submit Transaction Verification</h3>
                  <p className="text-xs text-[#4A5260]">
                    Settlement is processed automatically or verified manually by Treasury Administration depending on channel configuration.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">
                        Remitted Amount ({activePayReq.currency}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
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
                    <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Notes</label>
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
                    className="px-6 py-3 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] disabled:opacity-60"
                  >
                    {submittingPay ? 'Submitting Payment...' : 'Submit Payment for Settlement'}
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        {/* Orders Table */}
        <section className="bg-white border border-[#E5E8EE] p-6">
          {loading ? (
            <div className="h-36 bg-[#EFECE3]" />
          ) : requests.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#4A5260]">No investment requests recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E5E8EE] text-[#4A5260]">
                  <tr>
                    <th className="py-3 pr-4">Reference</th>
                    <th className="py-3 pr-4">Offering</th>
                    <th className="py-3 pr-4 text-right">Shares</th>
                    <th className="py-3 pr-4 text-right">Total</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Created</th>
                    <th className="py-3">Actions & Payments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E8EE]">
                  {requests.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="py-3.5 pr-4 font-mono tabular-nums font-medium text-[#0B172A]">
                        {r.request_reference}
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="font-medium text-[#0B172A]">{r.offering_title}</div>
                        {r.rejection_reason && (
                          <div className="text-[11px] text-[#991B1B] mt-1">Reason: {r.rejection_reason}</div>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono tabular-nums">
                        {formatNumber(r.requested_quantity)}
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono tabular-nums font-semibold">
                        {formatCurrency(r.total_amount, r.currency)}
                      </td>
                      <td className="py-3.5 pr-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3.5 pr-4 font-mono tabular-nums text-[#4A5260]">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="py-3.5 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {r.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => handleSubmitDraft(r.id)}
                              className="px-3 py-1.5 text-xs font-semibold bg-[#0B172A] text-white"
                            >
                              Submit Request
                            </button>
                          )}
                          {['awaiting_payment', 'submitted', 'under_review'].includes(r.status) &&
                            !(r.payments || []).some((p: any) =>
                              ['submitted', 'verification_pending', 'approved'].includes(p.status)
                            ) && (
                              <button
                                type="button"
                                onClick={() => navigate(`/portal/pay/${r.id}`)}
                                className="px-3 py-1.5 text-xs font-semibold bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] cursor-pointer"
                              >
                                Proceed to Payment
                              </button>
                            )}
                          {['draft', 'submitted', 'awaiting_payment'].includes(r.status) && (
                            <button
                              type="button"
                              onClick={() => handleCancelRequest(r.id)}
                              className="px-3 py-1.5 text-xs border border-[#D6DAE2] text-[#4A5260] hover:text-[#991B1B]"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                        {(r.payments || []).map((p: any) => (
                          <div key={p.id} className="text-[11px] text-[#4A5260] border-t border-[#E5E8EE] pt-1.5 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[#0B172A]">{p.payment_reference}</span> ·{' '}
                              <span>{p.payment_method_code}</span> ·{' '}
                              <span className="px-1.5 py-0.5 border border-[#D6DAE2] bg-[#FCFBF8] font-mono text-[10px] uppercase">
                                {p.processing_mode === 'automatic' ? 'Auto' : 'Manual'}
                              </span>{' '}
                              · <StatusBadge status={p.status} />
                            </div>
                            {p.verification_notes && <div>Note: {p.verification_notes}</div>}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PortalShell>
  );
}
