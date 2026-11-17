import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Pencil, Search, X } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { ADMIN_NAV } from './AdminDashboardPage';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime, formatNumber } from '../../lib/format';

type ActionModalState =
  | {
      kind: 'status';
      id: number;
      nextStatus: 'active' | 'suspended';
      label: string;
    }
  | {
      kind: 'changeRequest';
      id: number;
      decision: 'approved' | 'rejected';
      label: string;
    }
  | {
      kind: 'clearBalance';
      id: number;
      label: string;
    }
  | null;

interface EditInvestorForm {
  id: number;
  accountNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  telephone: string;
  dateOfBirth: string;
  countryOfResidence: string;
  residentialAddress: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  kycStatus: 'not_submitted' | 'submitted' | 'under_review' | 'additional_info_required' | 'approved' | 'rejected';
  accountStatus: 'active' | 'suspended';
}

export function AdminInvestorsPage() {
  const navigate = useNavigate();
  const { accessInvestorDashboard } = useAuth();
  const [investors, setInvestors] = useState<any[]>([]);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  // Clean confirmation modal state
  const [actionModal, setActionModal] = useState<ActionModalState>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Edit investor modal state
  const [editForm, setEditForm] = useState<EditInvestorForm | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Access investor dashboard state
  const [accessingId, setAccessingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set('status', statusFilter);
      const [invRes, crRes] = await Promise.all([
        apiRequest<{ investors: any[] }>(`/api/admin/investors?${qs.toString()}`),
        apiRequest<{ requests: any[] }>('/api/admin/profile-change-requests'),
      ]);
      setInvestors(invRes.investors || []);
      setChangeRequests(crRes.requests || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load investors.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
    const onRefresh = () => loadData();
    window.addEventListener('richmond:admin-refresh', onRefresh);
    return () => window.removeEventListener('richmond:admin-refresh', onRefresh);
  }, [loadData]);

  const filteredInvestors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return investors;
    return investors.filter((inv) =>
      `${inv.first_name} ${inv.last_name} ${inv.email} ${inv.account_number} ${inv.country_of_residence}`
        .toLowerCase()
        .includes(q)
    );
  }, [investors, search]);

  const inspectInvestor = async (id: number) => {
    setError('');
    try {
      const detail = await apiRequest(`/api/admin/investors/${id}`);
      setSelectedDetail(detail);
    } catch (err: any) {
      setError(err?.message || 'Unable to load investor record.');
    }
  };

  const openEditModal = async (id: number) => {
    setError('');
    setEditError('');
    setLoadingEditId(id);
    try {
      const detail =
        selectedDetail?.user?.id === id
          ? selectedDetail
          : await apiRequest(`/api/admin/investors/${id}`);
      const u = detail.user;
      const p = detail.profile;
      setEditForm({
        id: u.id,
        accountNumber: p?.account_number || '',
        firstName: p?.first_name || '',
        middleName: p?.middle_name || '',
        lastName: p?.last_name || '',
        email: u.email || '',
        telephone: p?.telephone || '',
        dateOfBirth: p?.date_of_birth ? String(p.date_of_birth).slice(0, 10) : '',
        countryOfResidence: p?.country_of_residence || '',
        residentialAddress: p?.residential_address || '',
        city: p?.city || '',
        stateRegion: p?.state_region || '',
        postalCode: p?.postal_code || '',
        kycStatus: p?.kyc_status || 'not_submitted',
        accountStatus: u.account_status === 'suspended' ? 'suspended' : 'active',
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to load investor details for editing.');
    } finally {
      setLoadingEditId(null);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    setEditError('');
    setError('');
    setFeedback('');
    setSavingEdit(true);
    try {
      await apiRequest(`/api/admin/investors/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          firstName: editForm.firstName,
          middleName: editForm.middleName,
          lastName: editForm.lastName,
          email: editForm.email,
          telephone: editForm.telephone,
          dateOfBirth: editForm.dateOfBirth,
          countryOfResidence: editForm.countryOfResidence,
          residentialAddress: editForm.residentialAddress,
          city: editForm.city,
          stateRegion: editForm.stateRegion,
          postalCode: editForm.postalCode,
          kycStatus: editForm.kycStatus,
          accountStatus: editForm.accountStatus,
        }),
      });
      setFeedback(`Updated investor details for ${editForm.firstName} ${editForm.lastName} (${editForm.accountNumber}).`);
      const editedId = editForm.id;
      setEditForm(null);
      await loadData();
      if (selectedDetail?.user?.id === editedId) {
        await inspectInvestor(editedId);
      }
    } catch (err: any) {
      setEditError(err?.message || 'Unable to save investor details.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAccessDashboard = async (investorId: number) => {
    setError('');
    setFeedback('');
    setAccessingId(investorId);
    try {
      await accessInvestorDashboard(investorId, () => navigate('/portal', { replace: true }));
    } catch (err: any) {
      setError(err?.message || 'Unable to access investor dashboard.');
      setAccessingId(null);
    }
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;
    setError('');
    setFeedback('');
    setSubmittingAction(true);
    try {
      if (actionModal.kind === 'status') {
        await apiRequest(`/api/admin/investors/${actionModal.id}/status`, {
          method: 'POST',
          body: JSON.stringify({
            status: actionModal.nextStatus,
            reason: actionNotes.trim() || 'Administrative review',
          }),
        });
        setFeedback(`Investor account status updated to ${actionModal.nextStatus}.`);
        await loadData();
        if (selectedDetail?.user?.id === actionModal.id) {
          await inspectInvestor(actionModal.id);
        }
      } else if (actionModal.kind === 'clearBalance') {
        await apiRequest(`/api/admin/investors/${actionModal.id}/clear-balance`, {
          method: 'POST',
          body: JSON.stringify({
            reason: actionNotes.trim() || 'Administrative balance clearance',
          }),
        });
        setFeedback('Investor balance cleared to $0.00 (user account preserved).');
        await loadData();
        if (selectedDetail?.user?.id === actionModal.id) {
          await inspectInvestor(actionModal.id);
        }
        window.dispatchEvent(new CustomEvent('richmond:admin-refresh'));
      } else {
        await apiRequest(`/api/admin/profile-change-requests/${actionModal.id}/decision`, {
          method: 'POST',
          body: JSON.stringify({
            decision: actionModal.decision,
            reviewNotes: actionNotes.trim(),
          }),
        });
        setFeedback(`Profile change request ${actionModal.decision}.`);
        await loadData();
      }
      setActionModal(null);
      setActionNotes('');
    } catch (err: any) {
      setError(err?.message || 'Unable to complete action.');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <PortalShell portalTitle="Administrator Portal" breadcrumbLabel="User Management" navItems={ADMIN_NAV} variant="admin">
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5E8EE] pb-5">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#0B172A]">
              Investor Directory &amp; User Management
            </h1>
            <p className="text-sm text-[#4A5260] mt-1">
              Search registered investors, edit account details, inspect holdings, manage status, or access an investor dashboard.
            </p>
          </div>
          <div className="text-xs font-mono text-[#4A5260] tabular-nums shrink-0">
            Total Registered: <strong className="text-[#0B172A]">{formatNumber(investors.length)}</strong>
          </div>
        </div>

        {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
        {feedback && <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{feedback}</div>}

        <div className="bg-white border border-[#E5E8EE] p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-[#4A5260] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by client name, email, account #, or country..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8] focus:outline-none focus:border-[#0B172A]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8]"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {loading ? (
            <div className="h-32 bg-[#EFECE3]" />
          ) : filteredInvestors.length === 0 ? (
            <p className="py-6 text-sm text-[#4A5260]">No registered investors match the filter criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[820px]">
                <thead className="border-b border-[#E5E8EE] text-[#4A5260] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 pr-4">Account #</th>
                    <th className="py-2.5 pr-4">Investor</th>
                    <th className="py-2.5 pr-4">Country</th>
                    <th className="py-2.5 pr-4">KYC</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E8EE]">
                  {filteredInvestors.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#FCFBF8]">
                      <td className="py-3 pr-4 font-mono font-semibold text-[#0B172A] whitespace-nowrap">
                        {inv.account_number}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-[#0B172A]">
                          {inv.first_name} {inv.last_name}
                        </div>
                        <div className="text-[#4A5260] font-mono">{inv.email}</div>
                      </td>
                      <td className="py-3 pr-4">{inv.country_of_residence}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={inv.kyc_status} />
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={inv.account_status} />
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => inspectInvestor(inv.id)}
                            className="px-3 py-1.5 border border-[#D6DAE2] text-[#0B172A] font-semibold hover:border-[#0B172A] cursor-pointer whitespace-nowrap"
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(inv.id)}
                            disabled={loadingEditId === inv.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#B5924C]/60 bg-[#FCFBF8] text-[#0B172A] font-semibold hover:border-[#0B172A] cursor-pointer disabled:opacity-60 whitespace-nowrap"
                          >
                            <Pencil className="w-3 h-3 text-[#997837]" />
                            <span>{loadingEditId === inv.id ? 'Loading...' : 'Edit'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAccessDashboard(inv.id)}
                            disabled={accessingId === inv.id || inv.account_status !== 'active'}
                            title={
                              inv.account_status !== 'active'
                                ? 'Reactivate this investor account before accessing their dashboard.'
                                : 'Open investor dashboard'
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0B172A] text-[#FCFBF8] font-semibold hover:bg-[#132542] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            <ExternalLink className="w-3 h-3 text-[#C9A968]" />
                            <span>{accessingId === inv.id ? 'Opening...' : 'Access Dashboard'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActionModal({
                                kind: 'clearBalance',
                                id: inv.id,
                                label: `Clear Balance (${inv.account_number})`,
                              });
                              setActionNotes('Administrative balance clearance');
                            }}
                            className="px-3 py-1.5 border border-[#991B1B]/40 text-[#991B1B] hover:bg-[#991B1B]/5 font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Clear Balance
                          </button>
                          {inv.account_status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActionModal({
                                  kind: 'status',
                                  id: inv.id,
                                  nextStatus: 'suspended',
                                  label: `Suspend Account (${inv.account_number})`,
                                });
                                setActionNotes('Administrative compliance review');
                              }}
                              className="px-3 py-1.5 border border-[#991B1B]/40 text-[#991B1B] cursor-pointer whitespace-nowrap"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setActionModal({
                                  kind: 'status',
                                  id: inv.id,
                                  nextStatus: 'active',
                                  label: `Reactivate Account (${inv.account_number})`,
                                });
                                setActionNotes('Compliance clearance verified');
                              }}
                              className="px-3 py-1.5 border border-[#146348]/40 text-[#146348] cursor-pointer whitespace-nowrap"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Profile Change Requests */}
        <div className="bg-white border border-[#E5E8EE] p-6 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Profile Change Requests</h2>
          {changeRequests.length === 0 ? (
            <p className="text-xs text-[#4A5260]">No profile change requests pending or recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead className="border-b border-[#E5E8EE] text-[#4A5260]">
                  <tr>
                    <th className="py-2 pr-4">Investor</th>
                    <th className="py-2 pr-4">Field</th>
                    <th className="py-2 pr-4">Previous → Requested</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E8EE]">
                  {changeRequests.map((cr) => (
                    <tr key={cr.id}>
                      <td className="py-3 pr-4">
                        <span className="font-mono">{cr.account_number}</span> · {cr.first_name} {cr.last_name}
                      </td>
                      <td className="py-3 pr-4 font-mono">{cr.field_name}</td>
                      <td className="py-3 pr-4">
                        {cr.previous_value || '—'} → <strong>{cr.requested_value}</strong>
                        <div className="text-[#4A5260]">Reason: {cr.reason}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={cr.status} />
                      </td>
                      <td className="py-3">
                        {cr.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActionModal({
                                  kind: 'changeRequest',
                                  id: cr.id,
                                  decision: 'approved',
                                  label: `Approve Profile Update (${cr.account_number})`,
                                });
                                setActionNotes('Verified against investor file');
                              }}
                              className="px-3 py-1 bg-[#146348] text-white font-semibold cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActionModal({
                                  kind: 'changeRequest',
                                  id: cr.id,
                                  decision: 'rejected',
                                  label: `Reject Profile Update (${cr.account_number})`,
                                });
                                setActionNotes('');
                              }}
                              className="px-3 py-1 border border-[#991B1B]/40 text-[#991B1B] cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Inspect Investor File Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-[#060E1C]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white border border-[#0B172A] p-6 space-y-5 my-auto max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E8EE] pb-3">
              <div>
                <div className="text-xs font-mono text-[#997837]">{selectedDetail.profile?.account_number}</div>
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">
                  {selectedDetail.profile?.first_name} {selectedDetail.profile?.last_name}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedDetail.user.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#B5924C]/60 bg-[#FCFBF8] text-xs font-semibold text-[#0B172A] hover:border-[#0B172A] cursor-pointer"
                >
                  <Pencil className="w-3 h-3 text-[#997837]" />
                  <span>Edit Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAccessDashboard(selectedDetail.user.id)}
                  disabled={accessingId === selectedDetail.user.id || selectedDetail.user?.account_status !== 'active'}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0B172A] text-xs font-semibold text-[#FCFBF8] hover:bg-[#132542] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <ExternalLink className="w-3 h-3 text-[#C9A968]" />
                  <span>{accessingId === selectedDetail.user.id ? 'Opening...' : 'Access Dashboard'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionModal({
                      kind: 'clearBalance',
                      id: selectedDetail.user.id,
                      label: `Clear Balance (${selectedDetail.profile?.account_number})`,
                    });
                    setActionNotes('Administrative balance clearance');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#991B1B]/40 text-xs font-semibold text-[#991B1B] hover:bg-[#991B1B]/5 cursor-pointer"
                >
                  <span>Clear Balance</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                  className="text-[#4A5260] hover:text-[#0B172A] cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-[#FCFBF8] border border-[#E5E8EE] p-4">
              <div>
                <strong>Email:</strong> {selectedDetail.user?.email}
              </div>
              <div>
                <strong>Telephone:</strong> {selectedDetail.profile?.telephone}
              </div>
              <div>
                <strong>Registered:</strong> {formatDateTime(selectedDetail.user?.created_at)}
              </div>
              <div>
                <strong>Date of Birth:</strong> <span className="font-mono">{selectedDetail.profile?.date_of_birth}</span>
              </div>
              <div>
                <strong>KYC Status:</strong> <StatusBadge status={selectedDetail.profile?.kyc_status} />
              </div>
              <div>
                <strong>Account Status:</strong> <StatusBadge status={selectedDetail.user?.account_status} />
              </div>
              <div className="sm:col-span-3">
                <strong>Address:</strong> {selectedDetail.profile?.residential_address}, {selectedDetail.profile?.city},{' '}
                {selectedDetail.profile?.state_region} {selectedDetail.profile?.postal_code},{' '}
                {selectedDetail.profile?.country_of_residence}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B172A]">Active Share Holdings</h3>
              {(selectedDetail.holdings || []).length === 0 ? (
                <p className="text-xs text-[#4A5260]">No allocated shareholdings yet.</p>
              ) : (
                <div className="divide-y divide-[#E5E8EE] border border-[#E5E8EE] text-xs">
                  {selectedDetail.holdings.map((h: any) => (
                    <div key={h.id} className="p-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-[#0B172A]">{h.offering_title}</div>
                        <div className="text-[#4A5260] font-mono">{formatNumber(h.total_shares)} shares</div>
                      </div>
                      <div className="text-right font-mono font-semibold text-[#146348] tabular-nums">
                        {formatCurrency(h.total_invested_amount, h.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B172A]">Subscription Requests</h3>
              {(selectedDetail.investmentRequests || []).length === 0 ? (
                <p className="text-xs text-[#4A5260]">No subscription orders submitted yet.</p>
              ) : (
                <div className="divide-y divide-[#E5E8EE] border border-[#E5E8EE] text-xs">
                  {selectedDetail.investmentRequests.slice(0, 5).map((r: any) => (
                    <div key={r.id} className="p-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-mono font-semibold text-[#0B172A]">{r.request_reference}</div>
                        <div className="text-[#4A5260]">{r.offering_title}</div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="font-mono font-semibold tabular-nums">
                          {formatCurrency(r.total_amount, r.currency)}
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Investor Details Modal */}
      {editForm && (
        <div className="fixed inset-0 z-50 bg-[#060E1C]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#0B172A] text-[#FCFBF8] border border-[#1E365C] p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E365C] pb-3">
              <div>
                <div className="text-xs font-mono text-[#C9A968]">{editForm.accountNumber}</div>
                <h2 className="font-serif text-xl font-semibold text-[#FCFBF8]">Edit Investor Details</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditForm(null)}
                className="text-[#A8B2C1] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 border border-[#991B1B]/60 bg-[#991B1B]/20 text-xs text-[#FCA5A5]">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">First Name *</label>
                  <input
                    required
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Middle Name</label>
                  <input
                    value={editForm.middleName}
                    onChange={(e) => setEditForm({ ...editForm, middleName: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Last Name *</label>
                  <input
                    required
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Telephone *</label>
                  <input
                    required
                    value={editForm.telephone}
                    onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={editForm.dateOfBirth}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Country of Residence *</label>
                  <input
                    required
                    value={editForm.countryOfResidence}
                    onChange={(e) => setEditForm({ ...editForm, countryOfResidence: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1">Residential Address *</label>
                <input
                  required
                  value={editForm.residentialAddress}
                  onChange={(e) => setEditForm({ ...editForm, residentialAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">City *</label>
                  <input
                    required
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">State / Region *</label>
                  <input
                    required
                    value={editForm.stateRegion}
                    onChange={(e) => setEditForm({ ...editForm, stateRegion: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Postal Code *</label>
                  <input
                    required
                    value={editForm.postalCode}
                    onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })}
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-[#1E365C]">
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">KYC Verification Status *</label>
                  <select
                    value={editForm.kycStatus}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        kycStatus: e.target.value as EditInvestorForm['kycStatus'],
                      })
                    }
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  >
                    <option value="not_submitted">Not Submitted</option>
                    <option value="submitted">Submitted</option>
                    <option value="under_review">Under Review</option>
                    <option value="additional_info_required">Additional Info Required</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#D6DAE2] mb-1">Account Status *</label>
                  <select
                    value={editForm.accountStatus}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        accountStatus: e.target.value as EditInvestorForm['accountStatus'],
                      })
                    }
                    className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E365C]">
                <button
                  type="button"
                  onClick={() => setEditForm(null)}
                  className="px-4 py-2 border border-[#1E365C] text-[#D6DAE2] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
                >
                  {savingEdit ? 'Saving Changes...' : 'Save Investor Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Notes Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-[#060E1C]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0B172A] text-[#FCFBF8] border border-[#1E365C] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E365C] pb-3">
              <h2 className="font-serif text-lg font-semibold text-[#FCFBF8]">{actionModal.label}</h2>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="text-[#A8B2C1] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmAction} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#D6DAE2] mb-1.5">Administrative Notes / Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-4 py-2 border border-[#1E365C] text-[#D6DAE2] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
                >
                  {submittingAction ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
