import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Pencil, Plus, Table as TableIcon, X } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { ADMIN_NAV } from './AdminDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatNumber, formatPlanDuration, formatRoi } from '../../lib/format';
import type { PlanDurationUnit } from '../../types';

interface PlanFormState {
  title: string;
  sector: string;
  summary: string;
  description: string;
  currency: string;
  roiPercent: string;
  durationUnit: PlanDurationUnit;
  durationValue: string;
  minAmount: string;
  maxAmount: string;
  totalAuthorizedQuantity: string;
  status: 'draft' | 'published' | 'suspended' | 'closed';
  riskDisclosures: string;
  requiresKyc: boolean;
}

function getDefaultForm(): PlanFormState {
  return {
    title: '',
    sector: 'Core Infrastructure',
    summary: '',
    description: '',
    currency: 'USD',
    roiPercent: '10',
    durationUnit: 'month',
    durationValue: '6',
    minAmount: '500',
    maxAmount: '50000',
    totalAuthorizedQuantity: '50000',
    status: 'published',
    riskDisclosures: '',
    requiresKyc: true,
  };
}

function resolveInitialDuration(o: any): { unit: PlanDurationUnit; value: string } {
  const unit = o.duration_unit as PlanDurationUnit | undefined;
  const val = Number(o.duration_value || 0);
  if (unit && ['month', 'days', 'hours', 'daily'].includes(unit) && val > 0) {
    return { unit, value: String(val) };
  }
  if (Number(o.duration_months || 0) > 0) return { unit: 'month', value: String(o.duration_months) };
  if (Number(o.duration_days || 0) > 0) return { unit: unit === 'daily' ? 'daily' : 'days', value: String(o.duration_days) };
  if (Number(o.duration_hours || 0) > 0) return { unit: 'hours', value: String(o.duration_hours) };
  return { unit: unit || 'month', value: val > 0 ? String(val) : '1' };
}

function getDurationUnitSuffix(unit: PlanDurationUnit): string {
  if (unit === 'month') return 'Months';
  if (unit === 'days') return 'Days';
  if (unit === 'hours') return 'Hours';
  return 'Days (Daily)';
}

function getPlanAmountBounds(o: any) {
  const price = Math.max(0.01, Number(o.share_price || 1));
  const minAmount = Number(o.min_amount) > 0 ? Number(o.min_amount) : Number(o.min_quantity || 1) * price;
  const maxAmount = Number(o.max_amount) > 0 ? Number(o.max_amount) : Number(o.max_quantity || 100) * price;
  return { minAmount, maxAmount };
}

export function AdminOfferingsPage() {
  const [offerings, setOfferings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PlanFormState>(getDefaultForm);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadOfferings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ offerings: any[] }>('/api/admin/offerings');
      setOfferings(res.offerings || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load investment plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
    const onRefresh = () => loadOfferings();
    window.addEventListener('richmond:admin-refresh', onRefresh);
    return () => window.removeEventListener('richmond:admin-refresh', onRefresh);
  }, [loadOfferings]);

  const filteredOfferings = useMemo(() => {
    if (statusFilter === 'all') return offerings;
    return offerings.filter((o) => o.status === statusFilter);
  }, [offerings, statusFilter]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(getDefaultForm());
    setModalError('');
    setModalOpen(true);
  };

  const openEditModal = (off: any) => {
    const bounds = getPlanAmountBounds(off);
    const dur = resolveInitialDuration(off);
    setEditingId(off.id);
    setForm({
      title: off.title,
      sector: off.sector,
      summary: off.summary,
      description: off.description,
      currency: off.currency,
      roiPercent: String(off.roi_percent ?? ''),
      durationUnit: dur.unit,
      durationValue: dur.value,
      minAmount: String(bounds.minAmount),
      maxAmount: String(bounds.maxAmount),
      totalAuthorizedQuantity: String(off.total_authorized_quantity ?? ''),
      status: off.status,
      riskDisclosures: off.risk_disclosures,
      requiresKyc: Boolean(off.requires_kyc),
    });
    setModalError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setError('');
    setFeedback('');

    const roiPercent = Number(form.roiPercent);
    const durationValue = Math.floor(Number(form.durationValue));
    const minAmount = Number(form.minAmount);
    const maxAmount = Number(form.maxAmount);
    const totalAuthorizedQuantity = Math.floor(Number(form.totalAuthorizedQuantity));

    if (form.roiPercent.trim() === '' || Number.isNaN(roiPercent) || roiPercent < 0) {
      setModalError('Enter a valid Target ROI percentage.');
      return;
    }
    if (form.durationValue.trim() === '' || Number.isNaN(durationValue) || durationValue < 1) {
      setModalError('Enter how long the selected plan duration will run (at least 1).');
      return;
    }
    if (form.minAmount.trim() === '' || Number.isNaN(minAmount) || minAmount <= 0) {
      setModalError('Enter a valid minimum investment amount.');
      return;
    }
    if (form.maxAmount.trim() === '' || Number.isNaN(maxAmount) || maxAmount <= 0) {
      setModalError('Enter a valid maximum investment amount.');
      return;
    }
    if (minAmount > maxAmount) {
      setModalError('Minimum investment amount cannot exceed maximum investment amount.');
      return;
    }
    if (form.totalAuthorizedQuantity.trim() === '' || Number.isNaN(totalAuthorizedQuantity) || totalAuthorizedQuantity < 1) {
      setModalError('Enter a valid authorized pool capacity.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        sector: form.sector,
        summary: form.summary,
        description: form.description,
        currency: form.currency,
        roiPercent,
        durationUnit: form.durationUnit,
        durationValue,
        minAmount,
        maxAmount,
        totalAuthorizedQuantity,
        status: form.status,
        riskDisclosures: form.riskDisclosures,
        requiresKyc: form.requiresKyc,
      };
      if (editingId) {
        await apiRequest(`/api/admin/offerings/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback(`Updated investment plan "${form.title}".`);
      } else {
        await apiRequest('/api/admin/offerings', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback(`Created investment plan "${form.title}".`);
      }
      setModalOpen(false);
      setEditingId(null);
      await loadOfferings();
    } catch (err: any) {
      setModalError(err?.message || 'Unable to save investment plan.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: number, status: 'draft' | 'published' | 'suspended' | 'closed') => {
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/api/admin/offerings/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      setFeedback(`Investment plan status updated to ${status}.`);
      await loadOfferings();
    } catch (err: any) {
      setError(err?.message || 'Unable to update investment plan status.');
    }
  };

  return (
    <PortalShell
      portalTitle="Administrator Portal"
      breadcrumbLabel="Investment Plans"
      navItems={ADMIN_NAV}
      variant="admin"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E8EE] pb-5">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#0B172A]">
              Investment Plans
            </h1>
            <p className="text-sm text-[#4A5260] mt-1">
              Configure investment plans, target ROI percentages, plan duration cycles (month, days, hours, daily), and min/max capital amounts.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Investment Plan</span>
          </button>
        </div>

        {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
        {feedback && <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{feedback}</div>}

        {/* Status Filter & Cards/Table Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {['all', 'published', 'draft', 'suspended', 'closed'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 text-xs font-semibold capitalize border transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#0B172A] text-[#FCFBF8] border-[#0B172A]'
                    : 'bg-white text-[#4A5260] border-[#D6DAE2] hover:border-[#0B172A]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="inline-flex border border-[#D6DAE2] bg-white">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                viewMode === 'cards' ? 'bg-[#0B172A] text-white' : 'text-[#4A5260] hover:text-[#0B172A]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                viewMode === 'table' ? 'bg-[#0B172A] text-white' : 'text-[#4A5260] hover:text-[#0B172A]'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Schedule</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="h-56 bg-[#EFECE3] border border-[#E5E8EE]" />
            <div className="h-56 bg-[#EFECE3] border border-[#E5E8EE]" />
            <div className="h-56 bg-[#EFECE3] border border-[#E5E8EE]" />
          </div>
        ) : filteredOfferings.length === 0 ? (
          <div className="bg-white border border-[#E5E8EE] p-8 text-center space-y-3">
            <div className="text-sm font-semibold text-[#0B172A]">No Investment Plans Found</div>
            <p className="text-xs text-[#4A5260]">
              No investment plans match the selected filter. Create a new investment plan to publish it for investors.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 bg-[#0B172A] text-white px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Investment Plan</span>
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOfferings.map((o) => {
              const authQty = Number(o.total_authorized_quantity || 0);
              const availQty = Number(o.available_quantity || 0);
              const subscribedPct = authQty > 0 ? Math.round(((authQty - availQty) / authQty) * 100) : 0;
              const bounds = getPlanAmountBounds(o);
              return (
                <div key={o.id} className="bg-white border border-[#E5E8EE] p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-[#997837]">{o.reference_code}</div>
                        <h2 className="font-serif text-lg font-semibold text-[#0B172A] mt-0.5 leading-snug">
                          {o.title}
                        </h2>
                        <div className="text-xs text-[#997837] font-medium mt-0.5">{o.sector}</div>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs border-y border-[#E5E8EE] py-3">
                      <div>
                        <div className="text-[#4A5260]">Target ROI</div>
                        <div className="font-bold font-mono text-[#146348] tabular-nums mt-0.5">
                          {formatRoi(o.roi_percent)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#4A5260]">Duration</div>
                        <div className="font-bold font-mono text-[#0B172A] tabular-nums mt-0.5">
                          {formatPlanDuration(
                            o.duration_months,
                            o.duration_days,
                            o.duration_hours,
                            o.duration_unit,
                            o.duration_value
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#4A5260]">Min Amount</div>
                        <div className="font-bold font-mono text-[#0B172A] tabular-nums mt-0.5">
                          {formatCurrency(bounds.minAmount, o.currency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#4A5260]">Max Amount</div>
                        <div className="font-bold font-mono text-[#0B172A] tabular-nums mt-0.5">
                          {formatCurrency(bounds.maxAmount, o.currency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#4A5260]">Available / Pool</div>
                        <div className="font-bold font-mono text-[#0B172A] tabular-nums mt-0.5">
                          {formatNumber(availQty)} / {formatNumber(authQty)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#4A5260]">Eligibility Gate</div>
                        <div className="font-bold text-[#0B172A] mt-0.5">
                          {o.requires_kyc ? 'KYC Required' : 'Open Access'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-mono text-[#4A5260] tabular-nums">
                        <span>Pool Subscribed</span>
                        <span>{subscribedPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#EFECE3] overflow-hidden">
                        <div className="h-full bg-[#B5924C]" style={{ width: `${Math.min(100, subscribedPct)}%` }} />
                      </div>
                    </div>

                    <p className="text-xs text-[#4A5260] line-clamp-2 leading-relaxed">{o.summary}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E5E8EE]">
                    <div className="flex flex-wrap gap-1.5">
                      {o.status !== 'published' && (
                        <button
                          type="button"
                          onClick={() => setStatus(o.id, 'published')}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-[#146348] text-white cursor-pointer"
                        >
                          Publish
                        </button>
                      )}
                      {o.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => setStatus(o.id, 'suspended')}
                          className="px-2.5 py-1.5 text-xs font-semibold border border-[#991B1B]/40 text-[#991B1B] cursor-pointer"
                        >
                          Suspend
                        </button>
                      )}
                      {o.status !== 'closed' && (
                        <button
                          type="button"
                          onClick={() => setStatus(o.id, 'closed')}
                          className="px-2.5 py-1.5 text-xs font-semibold border border-[#D6DAE2] text-[#4A5260] cursor-pointer"
                        >
                          Close
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditModal(o)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#B5924C] text-[#0B172A] hover:bg-[#FCFBF8] cursor-pointer"
                    >
                      <Pencil className="w-3 h-3 text-[#997837]" />
                      <span>Edit Plan</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-[#E5E8EE] p-6 overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[780px]">
              <thead className="border-b border-[#E5E8EE] text-[#4A5260] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 pr-4">Ref</th>
                  <th className="py-2.5 pr-4">Plan Title</th>
                  <th className="py-2.5 pr-4 text-right">ROI (%)</th>
                  <th className="py-2.5 pr-4">Duration</th>
                  <th className="py-2.5 pr-4 text-right">Min / Max Amount</th>
                  <th className="py-2.5 pr-4 text-right">Avail / Auth</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E8EE]">
                {filteredOfferings.map((o) => {
                  const bounds = getPlanAmountBounds(o);
                  return (
                    <tr key={o.id} className="hover:bg-[#FCFBF8]">
                      <td className="py-3 pr-4 font-mono">{o.reference_code}</td>
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-[#0B172A]">{o.title}</div>
                        <div className="text-[#4A5260]">{o.sector}</div>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono font-semibold text-[#146348] tabular-nums">
                        {formatRoi(o.roi_percent)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[#0B172A] tabular-nums">
                        {formatPlanDuration(
                          o.duration_months,
                          o.duration_days,
                          o.duration_hours,
                          o.duration_unit,
                          o.duration_value
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums">
                        {formatCurrency(bounds.minAmount, o.currency)} – {formatCurrency(bounds.maxAmount, o.currency)}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums">
                        {formatNumber(o.available_quantity)} / {formatNumber(o.total_authorized_quantity)}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="py-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(o)}
                          className="px-2.5 py-1 border border-[#D6DAE2] font-semibold cursor-pointer"
                        >
                          Edit Plan
                        </button>
                        {o.status !== 'published' && (
                          <button
                            type="button"
                            onClick={() => setStatus(o.id, 'published')}
                            className="px-2.5 py-1 bg-[#146348] text-white cursor-pointer"
                          >
                            Publish
                          </button>
                        )}
                        {o.status === 'published' && (
                          <button
                            type="button"
                            onClick={() => setStatus(o.id, 'suspended')}
                            className="px-2.5 py-1 border border-[#991B1B]/40 text-[#991B1B] cursor-pointer"
                          >
                            Suspend
                          </button>
                        )}
                        {o.status !== 'closed' && (
                          <button
                            type="button"
                            onClick={() => setStatus(o.id, 'closed')}
                            className="px-2.5 py-1 border border-[#D6DAE2] cursor-pointer"
                          >
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Investment Plan Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-[#060E1C]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[#0B172A] text-[#FCFBF8] border border-[#1E365C] p-5 sm:p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E365C] pb-3">
              <h2 className="font-serif text-lg font-semibold text-[#FCFBF8]">
                {editingId ? 'Edit Investment Plan' : 'Create New Investment Plan'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="p-1 text-[#A8B2C1] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 border border-[#DC2626]/40 bg-[#DC2626]/10 text-xs text-[#FCA5A5]">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">Investment Plan Name *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Global Infrastructure Equity Plan"
                  className="w-full min-w-0 px-3 py-2.5 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">Sector / Focus *</label>
                <input
                  type="text"
                  required
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                  placeholder="e.g. Core Infrastructure & Utilities"
                  className="w-full min-w-0 px-3 py-2.5 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="min-w-0">
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Currency</label>
                  <input
                    type="text"
                    required
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full min-w-0 px-3 py-2.5 font-mono uppercase border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block font-semibold text-[#D6DAE2] mb-1">ROI (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 12.5"
                    value={form.roiPercent}
                    onChange={(e) => setForm({ ...form, roiPercent: e.target.value })}
                    className="w-full min-w-0 px-3 py-2.5 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as PlanFormState['status'] })}
                    className="w-full min-w-0 px-3 py-2.5 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="suspended">Suspended</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Plan Duration Unit + How Long It Runs */}
              <div className="border border-[#1E365C] bg-[#060E1C]/60 p-3 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#C9A968]">
                  Plan Duration &amp; Cycle
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label htmlFor="plan-duration-unit" className="block font-semibold text-[#D6DAE2] mb-1">
                      Period Type *
                    </label>
                    <select
                      id="plan-duration-unit"
                      value={form.durationUnit}
                      onChange={(e) =>
                        setForm({ ...form, durationUnit: e.target.value as PlanDurationUnit })
                      }
                      className="w-full min-w-0 px-3 py-2.5 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                    >
                      <option value="month">Month</option>
                      <option value="days">Days</option>
                      <option value="hours">Hours</option>
                      <option value="daily">Daily</option>
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="plan-duration-value" className="block font-semibold text-[#D6DAE2] mb-1">
                      Duration ({getDurationUnitSuffix(form.durationUnit)}) *
                    </label>
                    <input
                      id="plan-duration-value"
                      type="number"
                      min="1"
                      step="1"
                      required
                      placeholder="e.g. 6"
                      value={form.durationValue}
                      onChange={(e) => setForm({ ...form, durationValue: e.target.value })}
                      className="w-full min-w-0 px-3 py-2.5 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block font-semibold text-[#D6DAE2] mb-1">
                    Min Amount ({form.currency || 'USD'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 500"
                    value={form.minAmount}
                    onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                    className="w-full min-w-0 px-3 py-2.5 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block font-semibold text-[#D6DAE2] mb-1">
                    Max Amount ({form.currency || 'USD'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 50000"
                    value={form.maxAmount}
                    onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
                    className="w-full min-w-0 px-3 py-2.5 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">Authorized Pool (Total Shares)</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 50000"
                  value={form.totalAuthorizedQuantity}
                  onChange={(e) => setForm({ ...form, totalAuthorizedQuantity: e.target.value })}
                  className="w-full min-w-0 px-3 py-2.5 font-mono border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[#D6DAE2] pt-1">
                <input
                  type="checkbox"
                  checked={form.requiresKyc}
                  onChange={(e) => setForm({ ...form, requiresKyc: e.target.checked })}
                />
                <span>Require Approved KYC for Subscription</span>
              </label>

              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">Executive Summary *</label>
                <textarea
                  rows={2}
                  required
                  minLength={10}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="Concise investment plan mandate summary..."
                  className="w-full min-w-0 px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">Full Plan Description *</label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detailed allocation structure, return schedule, and custody details..."
                  className="w-full min-w-0 px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">Risk Disclosures *</label>
                <textarea
                  rows={2}
                  required
                  minLength={10}
                  value={form.riskDisclosures}
                  onChange={(e) => setForm({ ...form, riskDisclosures: e.target.value })}
                  placeholder="Capital risk and liquidity horizon disclosures..."
                  className="w-full min-w-0 px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] font-bold uppercase tracking-wider transition-colors disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'Saving Investment Plan...' : editingId ? 'Save Investment Plan' : 'Create Investment Plan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
