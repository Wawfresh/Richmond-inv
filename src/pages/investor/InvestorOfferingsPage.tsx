import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PortalShell } from '../../components/PortalShell';
import { getPlanAmountBounds, RoiCalculator } from '../../components/RoiCalculator';
import { INVESTOR_NAV } from './InvestorDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatNumber, formatPlanDuration, formatRoi } from '../../lib/format';
import type { ShareOffering } from '../../types';

export function InvestorOfferingsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [offerings, setOfferings] = useState<ShareOffering[]>([]);
  const [selected, setSelected] = useState<ShareOffering | null>(null);
  const [amount, setAmount] = useState<number>(2500);
  const [eligibility, setEligibility] = useState<any>(null);
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [investorNotes, setInvestorNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    apiRequest<{ offerings: ShareOffering[] }>('/api/investor/offerings')
      .then((res) => {
        const list = res.offerings || [];
        setOfferings(list);
        const paramId = Number(searchParams.get('select'));
        const initial = list.find((o) => o.id === paramId) || list[0] || null;
        setSelected(initial);
        if (initial) setAmount(getPlanAmountBounds(initial).minAmount);
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const handleSelectOffering = (off: ShareOffering) => {
    setSelected(off);
    setAmount(getPlanAmountBounds(off).minAmount);
    setEligibility(null);
    setError('');
    setSuccessMsg('');
  };

  const handleCheckEligibility = async () => {
    if (!selected) return;
    setChecking(true);
    setError('');
    try {
      const res = await apiRequest(`/api/investor/offerings/${selected.id}/eligibility`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      setEligibility(res);
    } catch (err: any) {
      setError(err?.message || 'Eligibility check failed.');
    } finally {
      setChecking(false);
    }
  };

  const handleSubmitRequest = async (saveAsDraft: boolean) => {
    if (!selected) return;
    setError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const idempotencyKey = `req-${selected.id}-${amount}-${Date.now()}`;
      const res = await apiRequest<{ ok: boolean; request: { id: number; request_reference: string; status: string } }>(
        '/api/investor/investments',
        {
          method: 'POST',
          body: JSON.stringify({
            offeringId: selected.id,
            amount,
            saveAsDraft,
            termsConfirmed,
            investorNotes,
            idempotencyKey,
          }),
        }
      );
      if (saveAsDraft) {
        setSuccessMsg(`Draft ${res.request.request_reference} saved. Redirecting to Orders...`);
        navigate('/portal/orders');
      } else {
        navigate(`/portal/pay/${res.request.id}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to submit investment request.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBounds = selected ? getPlanAmountBounds(selected) : { minAmount: 0, maxAmount: 0 };

  return (
    <PortalShell
      portalTitle="Investor Portal"
      breadcrumbLabel="Investment Plans"
      navItems={INVESTOR_NAV}
      variant="investor"
    >
      {loading ? (
        <div className="h-48 bg-[#EFECE3]" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Plans List */}
          <div className="lg:col-span-5 space-y-4">
            <h1 className="font-serif text-2xl font-semibold text-[#0B172A]">Available Investment Plans</h1>
            {offerings.length === 0 ? (
              <div className="bg-white border border-[#E5E8EE] p-6 text-sm text-[#4A5260]">
                No investment plans are currently published.
              </div>
            ) : (
              offerings.map((off) => {
                const isSelected = selected?.id === off.id;
                const bounds = getPlanAmountBounds(off);
                return (
                  <button
                    key={off.id}
                    type="button"
                    onClick={() => handleSelectOffering(off)}
                    className={`w-full text-left p-5 border transition-colors ${
                      isSelected
                        ? 'bg-[#0B172A] text-[#FCFBF8] border-[#0B172A]'
                        : 'bg-white text-[#1C2026] border-[#E5E8EE] hover:border-[#B5924C]'
                    }`}
                  >
                    <div className={`text-xs font-mono ${isSelected ? 'text-[#C9A968]' : 'text-[#4A5260]'}`}>
                      {off.reference_code} · {off.sector}
                    </div>
                    <div className="font-serif text-xl font-semibold mt-1">{off.title}</div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                      <span className={isSelected ? 'text-[#6EE7B7]' : 'text-[#146348] font-semibold'}>
                        ROI: {formatRoi(off.roi_percent)}
                      </span>
                      <span>
                        {formatPlanDuration(
                          off.duration_months,
                          off.duration_days,
                          off.duration_hours,
                          off.duration_unit,
                          off.duration_value
                        )}
                      </span>
                    </div>
                    <div className={`mt-1.5 text-xs font-mono tabular-nums ${isSelected ? 'text-[#C8D0DC]' : 'text-[#4A5260]'}`}>
                      {formatCurrency(bounds.minAmount, off.currency)} – {formatCurrency(bounds.maxAmount, off.currency)}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Plan Detail & Order Builder */}
          <div className="lg:col-span-7">
            {!selected ? (
              <div className="bg-white border border-[#E5E8EE] p-8 text-sm text-[#4A5260]">
                Select an investment plan to review terms and submit an investment request.
              </div>
            ) : (
              <div className="bg-white border border-[#E5E8EE] p-7 space-y-6">
                <div className="space-y-2 border-b border-[#E5E8EE] pb-5">
                  <div className="text-xs font-mono text-[#997837]">
                    {selected.reference_code} · {selected.sector}
                  </div>
                  <h2 className="font-serif text-3xl font-semibold text-[#0B172A]">{selected.title}</h2>
                  <p className="text-sm text-[#4A5260] leading-relaxed">{selected.description}</p>
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-[#FCFBF8] border border-[#E5E8EE] p-4">
                  <div>
                    <dt className="text-[#4A5260]">Target ROI</dt>
                    <dd className="font-mono text-sm font-semibold text-[#146348] tabular-nums mt-0.5">
                      {formatRoi(selected.roi_percent)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#4A5260]">Duration</dt>
                    <dd className="font-mono text-sm font-semibold text-[#0B172A] tabular-nums mt-0.5">
                      {formatPlanDuration(
                        selected.duration_months,
                        selected.duration_days,
                        selected.duration_hours,
                        selected.duration_unit,
                        selected.duration_value
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#4A5260]">Eligibility</dt>
                    <dd className="text-sm font-semibold text-[#0B172A] mt-0.5">
                      {selected.requires_kyc ? 'KYC Required' : 'Open Access'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#4A5260]">Min Amount</dt>
                    <dd className="font-mono text-sm font-semibold text-[#0B172A] tabular-nums mt-0.5">
                      {formatCurrency(selectedBounds.minAmount, selected.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#4A5260]">Max Amount</dt>
                    <dd className="font-mono text-sm font-semibold text-[#0B172A] tabular-nums mt-0.5">
                      {formatCurrency(selectedBounds.maxAmount, selected.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#4A5260]">Remaining Pool</dt>
                    <dd className="font-mono text-sm font-semibold text-[#146348] tabular-nums mt-0.5">
                      {formatNumber(selected.available_quantity)}
                    </dd>
                  </div>
                </dl>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0B172A]">Risk Disclosures</h3>
                  <p className="text-xs text-[#4A5260] leading-relaxed">{selected.risk_disclosures}</p>
                </div>

                {(selected.documents || []).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0B172A]">
                      Plan Documentation
                    </h3>
                    <div className="divide-y divide-[#E5E8EE] border border-[#E5E8EE]">
                      {selected.documents!.map((d) => (
                        <div key={d.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                          <span>
                            <strong>{d.title}</strong> ({d.document_type})
                          </span>
                          {d.original_filename && (
                            <a
                              href={`/api/public/offerings/documents/${d.id}`}
                              className="text-[#0B172A] font-semibold underline"
                            >
                              Download
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Investment Amount Calculator & Submission */}
                <div className="border-t border-[#E5E8EE] pt-6 space-y-4">
                  <h3 className="font-serif text-xl font-semibold text-[#0B172A]">Configure Investment Request</h3>

                  {error && (
                    <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>
                  )}
                  {successMsg && (
                    <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">
                      {successMsg}
                    </div>
                  )}

                  <RoiCalculator
                    offering={selected}
                    amount={amount}
                    onAmountChange={(nextAmount) => {
                      setAmount(nextAmount);
                      setEligibility(null);
                    }}
                    variant="full"
                  />

                  <div>
                    <button
                      type="button"
                      onClick={handleCheckEligibility}
                      disabled={checking}
                      className="px-4 py-2 text-xs font-semibold border border-[#0B172A] text-[#0B172A] hover:bg-[#F9F7F2]"
                    >
                      {checking ? 'Evaluating Eligibility...' : 'Verify Investment Eligibility'}
                    </button>
                  </div>

                  {eligibility && (
                    <div
                      className={`p-4 border text-xs space-y-1 ${
                        eligibility.eligible
                          ? 'border-[#146348]/30 bg-[#146348]/5 text-[#146348]'
                          : 'border-[#991B1B]/30 bg-[#991B1B]/5 text-[#991B1B]'
                      }`}
                    >
                      <div className="font-semibold">
                        {eligibility.eligible ? 'Eligibility Verified' : 'Eligibility Requirement Not Met'}
                      </div>
                      <p>{eligibility.summary}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">
                      Investment Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={investorNotes}
                      onChange={(e) => setInvestorNotes(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8]"
                    />
                  </div>

                  <label className="flex items-start gap-2.5 text-xs text-[#4A5260]">
                    <input
                      type="checkbox"
                      checked={termsConfirmed}
                      onChange={(e) => setTermsConfirmed(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      I have reviewed the investment plan documentation, return schedule, and risk disclosures, and acknowledge that allocation occurs only upon administrative review and verified settlement.
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSubmitRequest(false)}
                      className="px-6 py-3 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] disabled:opacity-60"
                    >
                      {submitting ? 'Submitting...' : 'Submit Investment Request'}
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSubmitRequest(true)}
                      className="px-5 py-3 text-xs font-semibold border border-[#D6DAE2] text-[#0B172A] hover:bg-[#F9F7F2]"
                    >
                      Save as Draft
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PortalShell>
  );
}
