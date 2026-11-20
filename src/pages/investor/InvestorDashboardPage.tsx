import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Lock, Pencil, X } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { PortalUtilityDock } from '../../components/PortalUtilityDock';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { apiDownload, apiRequest } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPlanDuration, formatRoi } from '../../lib/format';

export const INVESTOR_NAV = [
  { to: '/portal', label: 'Dashboard', exact: true },
  { to: '/portal/offerings', label: 'Investment Plans' },
  { to: '/portal/orders', label: 'Orders & Payments' },
  { to: '/portal/portfolio', label: 'Portfolio & Dividends' },
  { to: '/portal/withdraw', label: 'Withdraw Funds' },
  { to: '/portal/kyc', label: 'KYC Verification' },
  { to: '/portal/account', label: 'Account & Profile' },
];

interface ProfileDraft {
  firstName: string;
  middleName: string;
  lastName: string;
  telephone: string;
  dateOfBirth: string;
  countryOfResidence: string;
  residentialAddress: string;
  city: string;
  stateRegion: string;
  postalCode: string;
}

export function InvestorDashboardPage() {
  const { refreshSession } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editable Profile state (Email stays strictly locked)
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState('');
  const [profileError, setProfileError] = useState('');
  const [downloadingStatement, setDownloadingStatement] = useState(false);
  const [statementError, setStatementError] = useState('');

  const syncProfileDraft = (p: any) => {
    if (!p) return;
    setProfileDraft({
      firstName: p.first_name || '',
      middleName: p.middle_name || '',
      lastName: p.last_name || '',
      telephone: p.telephone || '',
      dateOfBirth: p.date_of_birth ? String(p.date_of_birth).slice(0, 10) : '',
      countryOfResidence: p.country_of_residence || '',
      residentialAddress: p.residential_address || '',
      city: p.city || '',
      stateRegion: p.state_region || '',
      postalCode: p.postal_code || '',
    });
  };

  const loadDashboard = useCallback(async () => {
    try {
      const res = await apiRequest<any>('/api/investor/dashboard');
      setData(res);
      syncProfileDraft(res.profile);
    } catch (err: any) {
      setError(err?.message || 'Unable to load investor dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileDraft) return;
    setProfileError('');
    setProfileFeedback('');
    setSavingProfile(true);
    try {
      await apiRequest('/api/investor/profile', {
        method: 'PUT',
        body: JSON.stringify(profileDraft),
      });
      setProfileFeedback('Investor profile updated successfully.');
      setEditingProfile(false);
      await Promise.all([loadDashboard(), refreshSession()]);
    } catch (err: any) {
      setProfileError(err?.message || 'Unable to update profile details.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDownloadStatement = async () => {
    setStatementError('');
    setDownloadingStatement(true);
    try {
      await apiDownload('/api/investor/portfolio/statement-pdf', 'RICHMOND-INV-Portfolio-Statement.pdf');
    } catch (err: any) {
      setStatementError(err?.message || 'Unable to generate PDF statement.');
    } finally {
      setDownloadingStatement(false);
    }
  };

  const availableBalance = Number(data?.metrics?.availableBalance || 0);

  return (
    <PortalShell portalTitle="Investor Portal" breadcrumbLabel="Dashboard" navItems={INVESTOR_NAV} variant="investor">
      {loading ? (
        <div className="space-y-4">
          <div className="h-24 bg-[#EFECE3]" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-28 bg-[#EFECE3]" />
            <div className="h-28 bg-[#EFECE3]" />
            <div className="h-28 bg-[#EFECE3]" />
            <div className="h-28 bg-[#EFECE3]" />
          </div>
        </div>
      ) : error ? (
        <div className="bg-white border border-[#991B1B]/30 p-6 text-sm text-[#991B1B]">{error}</div>
      ) : (
        <div className="space-y-8 pb-14">
          {/* Welcome & Account Overview */}
          <section className="bg-white border border-[#E5E8EE] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="text-xs uppercase tracking-widest text-[#997837] font-semibold">
                Shareholder Account Overview
              </div>
              <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">
                Welcome, {data.profile?.first_name} {data.profile?.last_name}
              </h1>
              <div className="text-xs text-[#4A5260] flex flex-wrap items-center gap-2">
                <span>
                  Account Number:{' '}
                  <strong className="font-mono text-[#0B172A] tabular-nums">{data.profile?.account_number}</strong>
                </span>
                <span>·</span>
                <span>Residence: {data.profile?.country_of_residence}</span>
                <span>·</span>
                <span>Unread Notifications: {data.metrics?.unreadNotificationsCount ?? 0}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-[#4A5260]">KYC Verification</div>
                <StatusBadge status={data.profile?.kyc_status} />
              </div>
              {data.profile?.kyc_status !== 'approved' && (
                <Link
                  to="/portal/kyc"
                  className="px-4 py-2.5 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] whitespace-nowrap"
                >
                  Complete KYC Verification
                </Link>
              )}
            </div>
          </section>

          {/* Key Financial & Operational Figures (100% DB-derived) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <div className="bg-white border border-[#E5E8EE] p-6">
              <div className="text-xs uppercase tracking-wider text-[#4A5260]">Total Invested Capital</div>
              <div className="font-mono text-2xl font-semibold text-[#0B172A] tabular-nums mt-2">
                {formatCurrency(data.metrics?.totalInvestedCapital || 0)}
              </div>
              <div className="text-xs text-[#4A5260] mt-1">Verified allocated principal</div>
            </div>

            <div className="bg-white border border-[#E5E8EE] p-6">
              <div className="text-xs uppercase tracking-wider text-[#4A5260]">Total Shareholdings</div>
              <div className="font-mono text-2xl font-semibold text-[#0B172A] tabular-nums mt-2">
                {formatNumber(data.metrics?.totalShareholdings || 0)}
              </div>
              <div className="text-xs text-[#4A5260] mt-1">Allocated shares across offerings</div>
            </div>

            <div className="bg-white border border-[#E5E8EE] p-6">
              <div className="text-xs uppercase tracking-wider text-[#4A5260]">Portfolio Valuation</div>
              <div className="font-mono text-2xl font-semibold text-[#146348] tabular-nums mt-2">
                {data.metrics?.portfolioValuation !== null
                  ? formatCurrency(data.metrics.portfolioValuation)
                  : formatCurrency(data.metrics?.totalInvestedCapital || 0)}
              </div>
              <div className="text-xs text-[#4A5260] mt-1">
                {data.metrics?.portfolioValuation !== null
                  ? 'Based on authorized unit valuations'
                  : 'At acquisition cost basis'}
              </div>
            </div>

            <div className="bg-white border border-[#E5E8EE] p-6">
              <div className="text-xs uppercase tracking-wider text-[#4A5260]">Withdrawable Balance</div>
              <div className="font-mono text-2xl font-semibold text-[#0B172A] tabular-nums mt-2">
                {formatCurrency(availableBalance)}
              </div>
              <div className="text-xs text-[#146348] font-mono tabular-nums mt-1">
                Dividends: {formatCurrency(data.metrics?.totalDividendsDistributed || 0)}
              </div>
            </div>
          </section>

          {/* Investor Profile (Editable except Email) */}
          <section className="bg-white border border-[#E5E8EE] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E8EE] pb-3.5">
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Investor Profile</h2>
                <p className="text-xs text-[#4A5260] mt-0.5">
                  Personal and residential details. Registered email is permanently locked.
                </p>
              </div>
              {!editingProfile ? (
                <button
                  type="button"
                  onClick={() => {
                    syncProfileDraft(data.profile);
                    setProfileError('');
                    setProfileFeedback('');
                    setEditingProfile(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-[#B5924C] text-[#0B172A] hover:bg-[#FCFBF8] cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#997837]" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    syncProfileDraft(data.profile);
                    setProfileError('');
                    setEditingProfile(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-[#D6DAE2] text-[#4A5260] hover:text-[#0B172A] cursor-pointer whitespace-nowrap shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              )}
            </div>

            {profileError && (
              <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">
                {profileError}
              </div>
            )}
            {profileFeedback && (
              <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">
                {profileFeedback}
              </div>
            )}

            {!editingProfile ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 text-xs">
                <div>
                  <dt className="text-[#4A5260]">Full Legal Name</dt>
                  <dd className="font-semibold text-[#0B172A] mt-0.5">
                    {data.profile?.first_name} {data.profile?.middle_name ? `${data.profile.middle_name} ` : ''}
                    {data.profile?.last_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#4A5260] flex items-center gap-1.5">
                    <span>Registered Email</span>
                    <Lock className="w-3 h-3 text-[#997837]" />
                    <span className="text-[11px] text-[#997837]">Locked</span>
                  </dt>
                  <dd className="font-mono text-[#0B172A] mt-0.5 break-all">{data.email}</dd>
                </div>
                <div>
                  <dt className="text-[#4A5260]">Account Number</dt>
                  <dd className="font-mono font-semibold text-[#0B172A] tabular-nums mt-0.5">
                    {data.profile?.account_number}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#4A5260]">Telephone</dt>
                  <dd className="font-mono text-[#0B172A] tabular-nums mt-0.5">{data.profile?.telephone}</dd>
                </div>
                <div>
                  <dt className="text-[#4A5260]">Date of Birth</dt>
                  <dd className="font-mono text-[#0B172A] tabular-nums mt-0.5">
                    {data.profile?.date_of_birth ? String(data.profile.date_of_birth).slice(0, 10) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#4A5260]">Country of Residence</dt>
                  <dd className="text-[#0B172A] mt-0.5">{data.profile?.country_of_residence}</dd>
                </div>
                <div className="sm:col-span-2 lg:col-span-3 pt-3 border-t border-[#E5E8EE]">
                  <dt className="text-[#4A5260]">Residential Address</dt>
                  <dd className="text-[#0B172A] mt-0.5">
                    {data.profile?.residential_address}, {data.profile?.city}, {data.profile?.state_region}{' '}
                    {data.profile?.postal_code}
                  </dd>
                </div>
              </dl>
            ) : (
              profileDraft && (
                <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                  <div>
                    <label className="flex items-center gap-1.5 font-semibold text-[#4A5260] mb-1">
                      <Lock className="w-3.5 h-3.5 text-[#997837]" />
                      <span>Registered Email (Locked — Cannot Be Edited)</span>
                    </label>
                    <input
                      type="email"
                      value={data.email || ''}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 font-mono border border-[#E5E8EE] bg-[#F3F4F6] text-[#4A5260] cursor-not-allowed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-[#1C2026] mb-1">First Name *</label>
                      <input
                        type="text"
                        required
                        value={profileDraft.firstName}
                        onChange={(e) => setProfileDraft({ ...profileDraft, firstName: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1C2026] mb-1">Middle Name</label>
                      <input
                        type="text"
                        value={profileDraft.middleName}
                        onChange={(e) => setProfileDraft({ ...profileDraft, middleName: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1C2026] mb-1">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={profileDraft.lastName}
                        onChange={(e) => setProfileDraft({ ...profileDraft, lastName: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-[#1C2026] mb-1">Telephone *</label>
                      <input
                        type="text"
                        required
                        value={profileDraft.telephone}
                        onChange={(e) => setProfileDraft({ ...profileDraft, telephone: e.target.value })}
                        className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1C2026] mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        required
                        value={profileDraft.dateOfBirth}
                        onChange={(e) => setProfileDraft({ ...profileDraft, dateOfBirth: e.target.value })}
                        className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1C2026] mb-1">Country of Residence *</label>
                      <input
                        type="text"
                        required
                        value={profileDraft.countryOfResidence}
                        onChange={(e) => setProfileDraft({ ...profileDraft, countryOfResidence: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C2026] mb-1">Residential Address *</label>
                    <input
                      type="text"
                      required
                      value={profileDraft.residentialAddress}
                      onChange={(e) => setProfileDraft({ ...profileDraft, residentialAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-[#1C2026] mb-1">City *</label>
                      <input
                        type="text"
                        required
                        value={profileDraft.city}
                        onChange={(e) => setProfileDraft({ ...profileDraft, city: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1C2026] mb-1">State / Region *</label>
                      <input
                        type="text"
                        required
                        value={profileDraft.stateRegion}
                        onChange={(e) => setProfileDraft({ ...profileDraft, stateRegion: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1C2026] mb-1">Postal Code *</label>
                      <input
                        type="text"
                        required
                        value={profileDraft.postalCode}
                        onChange={(e) => setProfileDraft({ ...profileDraft, postalCode: e.target.value })}
                        className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        syncProfileDraft(data.profile);
                        setProfileError('');
                        setEditingProfile(false);
                      }}
                      className="px-4 py-2 border border-[#D6DAE2] text-[#4A5260] hover:text-[#0B172A] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2 bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] font-semibold cursor-pointer disabled:opacity-60"
                    >
                      {savingProfile ? 'Saving Profile...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </form>
              )
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Recent Investment Requests */}
            <section className="lg:col-span-7 bg-white border border-[#E5E8EE] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E8EE] pb-3">
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Recent Investment Requests</h2>
                <Link to="/portal/orders" className="text-xs font-semibold text-[#0B172A] hover:underline">
                  Manage Orders
                </Link>
              </div>
              {(data.recentRequests || []).length === 0 ? (
                <div className="py-8 text-sm text-[#4A5260] space-y-3">
                  <p>You have not submitted any share subscription requests yet.</p>
                  <Link
                    to="/portal/offerings"
                    className="inline-block px-4 py-2 text-xs font-semibold bg-[#0B172A] text-white"
                  >
                    Explore Available Offerings
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E5E8EE] text-[#4A5260]">
                      <tr>
                        <th className="py-2.5 pr-4">Reference</th>
                        <th className="py-2.5 pr-4">Offering</th>
                        <th className="py-2.5 pr-4 text-right">Shares</th>
                        <th className="py-2.5 pr-4 text-right">Amount</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E8EE]">
                      {data.recentRequests.map((r: any) => (
                        <tr key={r.id}>
                          <td className="py-3 pr-4 font-mono tabular-nums text-[#0B172A]">{r.request_reference}</td>
                          <td className="py-3 pr-4">{r.offering_title}</td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatNumber(r.requested_quantity)}</td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums">
                            {formatCurrency(r.total_amount, r.currency)}
                          </td>
                          <td className="py-3">
                            <StatusBadge status={r.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Notifications & Recent Activity */}
            <section className="lg:col-span-5 bg-white border border-[#E5E8EE] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E8EE] pb-3">
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Account Notifications</h2>
                <Link to="/portal/account" className="text-xs font-semibold text-[#0B172A] hover:underline">
                  View All
                </Link>
              </div>
              {(data.notifications || []).length === 0 ? (
                <p className="py-6 text-sm text-[#4A5260]">No notifications recorded.</p>
              ) : (
                <div className="divide-y divide-[#E5E8EE]">
                  {data.notifications.slice(0, 5).map((n: any) => (
                    <div key={n.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-semibold ${n.is_read ? 'text-[#4A5260]' : 'text-[#0B172A]'}`}>
                          {n.title}
                        </span>
                        <span className="text-[11px] font-mono text-[#4A5260] tabular-nums whitespace-nowrap">
                          {formatDate(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-[#4A5260] leading-relaxed">{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Recent Portfolio Transactions & Available Offerings */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <section className="lg:col-span-6 bg-white border border-[#E5E8EE] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E8EE] pb-3">
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Recent Ledger Transactions</h2>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadStatement}
                    disabled={downloadingStatement}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#C9A968]" />
                    <span>{downloadingStatement ? 'Generating...' : 'Download PDF'}</span>
                  </button>
                  <Link
                    to="/portal/portfolio"
                    className="text-xs font-semibold text-[#0B172A] hover:underline whitespace-nowrap shrink-0"
                  >
                    Portfolio Statements
                  </Link>
                </div>
              </div>
              {statementError && (
                <div className="p-2.5 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">
                  {statementError}
                </div>
              )}
              {(data.recentTransactions || []).length === 0 ? (
                <p className="py-6 text-sm text-[#4A5260]">
                  No settled ledger transactions exist yet. Share allocations appear here once payment verification is approved.
                </p>
              ) : (
                <div className="divide-y divide-[#E5E8EE]">
                  {data.recentTransactions.map((tx: any) => (
                    <div key={tx.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="font-medium text-[#0B172A]">{tx.description}</div>
                        <div className="text-[#4A5260] font-mono mt-0.5">
                          {tx.transaction_reference} · {formatDateTime(tx.occurred_at)}
                        </div>
                      </div>
                      <div
                        className={`font-mono font-semibold tabular-nums whitespace-nowrap ${
                          Number(tx.amount) < 0 ? 'text-[#991B1B]' : 'text-[#146348]'
                        }`}
                      >
                        {formatCurrency(tx.amount, tx.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="lg:col-span-6 bg-white border border-[#E5E8EE] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E8EE] pb-3">
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Open Share Offerings</h2>
                <Link to="/portal/offerings" className="text-xs font-semibold text-[#0B172A] hover:underline">
                  Subscribe
                </Link>
              </div>
              <div className="divide-y divide-[#E5E8EE]">
                {(data.availableOfferings || []).slice(0, 4).map((off: any) => (
                  <div key={off.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-[#0B172A]">{off.title}</div>
                      <div className="text-xs text-[#4A5260] font-mono tabular-nums">
                        {off.reference_code} · ROI: {formatRoi(off.roi_percent)} ·{' '}
                        {formatPlanDuration(
                          off.duration_months,
                          off.duration_days,
                          off.duration_hours,
                          off.duration_unit,
                          off.duration_value
                        )}
                      </div>
                    </div>
                    <Link
                      to={`/portal/offerings?select=${off.id}`}
                      className="px-3 py-1.5 text-xs font-semibold border border-[#D6DAE2] text-[#0B172A] hover:bg-[#F9F7F2] whitespace-nowrap"
                    >
                      Select
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
      <PortalUtilityDock />
    </PortalShell>
  );
}
