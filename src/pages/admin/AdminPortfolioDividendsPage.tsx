import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { ADMIN_NAV } from './AdminDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime, formatNumber } from '../../lib/format';

export function AdminPortfolioDividendsPage() {
  const [holdings, setHoldings] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [dividends, setDividends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  // Clean valuation modal state
  const [valuationHolding, setValuationHolding] = useState<any>(null);
  const [valuationPrice, setValuationPrice] = useState('');
  const [valuationNotes, setValuationNotes] = useState('Authorized periodic valuation');
  const [savingValuation, setSavingValuation] = useState(false);

  const [divForm, setDivForm] = useState({
    holdingKey: '',
    periodLabel: 'FY 2026 Q4',
    ratePerShare: '2.50',
    accountingReference: '',
    paymentReference: '',
    notes: '',
    distributeImmediately: true,
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, dRes] = await Promise.all([
        apiRequest<{ holdings: any[]; allocations: any[] }>('/api/admin/portfolios'),
        apiRequest<{ dividends: any[] }>('/api/admin/dividends'),
      ]);
      setHoldings(pRes.holdings || []);
      setAllocations(pRes.allocations || []);
      setDividends(dRes.dividends || []);
      if (pRes.holdings?.[0]) {
        setDivForm((f) =>
          f.holdingKey ? f : { ...f, holdingKey: `${pRes.holdings[0].user_id}:${pRes.holdings[0].offering_id}` }
        );
      }
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

  const openValuationModal = (holding: any) => {
    setValuationHolding(holding);
    setValuationPrice(
      holding.current_unit_valuation !== null && holding.current_unit_valuation !== undefined
        ? String(holding.current_unit_valuation)
        : String(holding.average_acquisition_price || '')
    );
    setValuationNotes('Authorized periodic valuation');
  };

  const submitValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valuationHolding) return;
    const currentUnitValuation = Number(valuationPrice);
    if (Number.isNaN(currentUnitValuation) || currentUnitValuation <= 0) {
      setError('Enter a valid positive unit valuation.');
      return;
    }

    setError('');
    setFeedback('');
    setSavingValuation(true);
    try {
      await apiRequest(`/api/admin/portfolios/${valuationHolding.id}/valuation`, {
        method: 'POST',
        body: JSON.stringify({ currentUnitValuation, valuationNotes }),
      });
      setFeedback('Portfolio valuation updated.');
      setValuationHolding(null);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Unable to update valuation.');
    } finally {
      setSavingValuation(false);
    }
  };

  const handleRecordDividend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    const [userId, offeringId] = divForm.holdingKey.split(':').map(Number);
    if (!userId || !offeringId) {
      setError('Please select an investor shareholding.');
      return;
    }
    try {
      const res = await apiRequest<{ dividendRef: string }>('/api/admin/dividends', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          offeringId,
          periodLabel: divForm.periodLabel,
          ratePerShare: Number(divForm.ratePerShare),
          accountingReference: divForm.accountingReference,
          paymentReference: divForm.paymentReference,
          notes: divForm.notes,
          distributeImmediately: divForm.distributeImmediately,
        }),
      });
      setFeedback(`Dividend recorded under reference ${res.dividendRef}.`);
      setDivForm((f) => ({ ...f, accountingReference: '', paymentReference: '', notes: '' }));
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to record dividend.');
    }
  };

  const updateDividendStatus = async (id: number, status: 'distributed' | 'cancelled') => {
    await apiRequest(`/api/admin/dividends/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    await loadAll();
  };

  return (
    <PortalShell
      portalTitle="Administrator Portal"
      breadcrumbLabel="Portfolios & Dividends"
      navItems={ADMIN_NAV}
      variant="admin"
    >
      <div className="space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">
            Shareholder Portfolios, Allocations & Dividends
          </h1>
          <p className="text-sm text-[#4A5260] mt-1">
            Inspect verified shareholdings, post authorized unit valuations, and manage dividend distributions.
          </p>
        </div>

        {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
        {feedback && <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{feedback}</div>}

        {/* Holdings Table */}
        <section className="bg-white border border-[#E5E8EE] p-6 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Active Investor Holdings</h2>
          {loading ? (
            <div className="h-28 bg-[#EFECE3]" />
          ) : holdings.length === 0 ? (
            <p className="text-sm text-[#4A5260]">No share allocations exist yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E5E8EE] text-[#4A5260]">
                  <tr>
                    <th className="py-2 pr-4">Investor</th>
                    <th className="py-2 pr-4">Offering</th>
                    <th className="py-2 pr-4 text-right">Shares</th>
                    <th className="py-2 pr-4 text-right">Invested</th>
                    <th className="py-2 pr-4 text-right">Unit Valuation</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E8EE]">
                  {holdings.map((h) => (
                    <tr key={h.id}>
                      <td className="py-3 pr-4">
                        <span className="font-mono">{h.account_number}</span> · {h.first_name} {h.last_name}
                      </td>
                      <td className="py-3 pr-4">{h.offering_title}</td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatNumber(h.total_shares)}</td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums">
                        {formatCurrency(h.total_invested_amount, h.currency)}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums">
                        {h.current_unit_valuation !== null
                          ? formatCurrency(h.current_unit_valuation, h.currency)
                          : 'Cost basis'}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => openValuationModal(h)}
                          className="px-3 py-1 border border-[#D6DAE2] font-semibold cursor-pointer hover:border-[#0B172A]"
                        >
                          Set Valuation
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Dividend Entry Form */}
        <section className="bg-white border border-[#E5E8EE] p-6 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Declare Authorized Dividend</h2>
          {holdings.length === 0 ? (
            <p className="text-xs text-[#4A5260]">
              Dividends can be recorded once an investor holds allocated shares.
            </p>
          ) : (
            <form onSubmit={handleRecordDividend} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Eligible Holding *</label>
                  <select
                    value={divForm.holdingKey}
                    onChange={(e) => setDivForm({ ...divForm, holdingKey: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
                  >
                    {holdings.map((h) => (
                      <option key={h.id} value={`${h.user_id}:${h.offering_id}`}>
                        {h.account_number} — {h.offering_title} ({h.total_shares} shares)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Period Label *</label>
                  <input
                    type="text"
                    required
                    value={divForm.periodLabel}
                    onChange={(e) => setDivForm({ ...divForm, periodLabel: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Rate Per Share (USD) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={divForm.ratePerShare}
                    onChange={(e) => setDivForm({ ...divForm, ratePerShare: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div>
                  <label className="block font-semibold mb-1">Accounting Reference *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GL-DIV-2026-01"
                    value={divForm.accountingReference}
                    onChange={(e) => setDivForm({ ...divForm, accountingReference: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Payment Reference (Optional)</label>
                  <input
                    type="text"
                    value={divForm.paymentReference}
                    onChange={(e) => setDivForm({ ...divForm, paymentReference: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8]"
                  />
                </div>
                <label className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    checked={divForm.distributeImmediately}
                    onChange={(e) => setDivForm({ ...divForm, distributeImmediately: e.target.checked })}
                  />
                  Post as Distributed Immediately
                </label>
              </div>
              <button type="submit" className="px-5 py-2.5 bg-[#0B172A] text-white font-semibold">
                Record Dividend Entry
              </button>
            </form>
          )}
        </section>

        {/* Dividend & Allocation History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white border border-[#E5E8EE] p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Dividend Ledger</h2>
            {dividends.length === 0 ? (
              <p className="text-xs text-[#4A5260]">No dividend entries recorded.</p>
            ) : (
              <div className="divide-y divide-[#E5E8EE] text-xs">
                {dividends.map((d) => (
                  <div key={d.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-mono font-semibold text-[#0B172A]">
                        {d.dividend_reference} · {formatCurrency(d.gross_amount, d.currency)}
                      </div>
                      <div className="text-[#4A5260]">
                        {d.account_number} · {d.period_label} · {d.accounting_reference}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={d.status} />
                      {d.status === 'declared' && (
                        <button
                          type="button"
                          onClick={() => updateDividendStatus(d.id, 'distributed')}
                          className="px-2.5 py-1 bg-[#146348] text-white"
                        >
                          Distribute
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-[#E5E8EE] p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Share Allocation Register</h2>
            {allocations.length === 0 ? (
              <p className="text-xs text-[#4A5260]">No share allocations posted.</p>
            ) : (
              <div className="divide-y divide-[#E5E8EE] text-xs">
                {allocations.map((a) => (
                  <div key={a.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-mono font-semibold text-[#0B172A]">{a.allocation_reference}</div>
                      <div className="text-[#4A5260]">
                        {a.account_number} · {a.offering_title} · {formatDateTime(a.allocated_at)}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div>{formatNumber(a.allocated_quantity)} shares</div>
                      <div className="text-[#146348]">{formatCurrency(a.total_cost, a.currency)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Valuation Modal */}
      {valuationHolding && (
        <div className="fixed inset-0 z-50 bg-[#060E1C]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0B172A] text-[#FCFBF8] border border-[#1E365C] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E365C] pb-3">
              <div>
                <div className="text-[11px] font-mono text-[#C9A968]">{valuationHolding.account_number}</div>
                <h2 className="font-serif text-lg font-semibold text-[#FCFBF8]">Set Unit Valuation</h2>
              </div>
              <button
                type="button"
                onClick={() => setValuationHolding(null)}
                className="text-[#A8B2C1] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitValuation} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">
                  Authorized Unit Valuation ({valuationHolding.currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={valuationPrice}
                  onChange={(e) => setValuationPrice(e.target.value)}
                  className="w-full px-3 py-2 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">Accounting Basis / Notes *</label>
                <textarea
                  rows={2}
                  required
                  value={valuationNotes}
                  onChange={(e) => setValuationNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setValuationHolding(null)}
                  className="px-4 py-2 border border-[#1E365C] text-[#D6DAE2] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingValuation}
                  className="px-5 py-2 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
                >
                  {savingValuation ? 'Saving...' : 'Save Valuation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
