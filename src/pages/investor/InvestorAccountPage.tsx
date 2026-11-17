import React, { useEffect, useState } from 'react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { INVESTOR_NAV } from './InvestorDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

export function InvestorAccountPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fieldName, setFieldName] = useState('residential_address');
  const [requestedValue, setRequestedValue] = useState('');
  const [reason, setReason] = useState('');
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadAccount = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/investor/account');
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccount();
  }, []);

  const handleRequestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    try {
      await apiRequest('/api/investor/account/change-request', {
        method: 'POST',
        body: JSON.stringify({ fieldName, requestedValue, reason }),
      });
      setFeedback('Profile change request submitted for administrative approval.');
      setRequestedValue('');
      setReason('');
      await loadAccount();
    } catch (err: any) {
      setError(err?.message || 'Unable to submit change request.');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    try {
      await apiRequest('/api/investor/account/change-password', {
        method: 'POST',
        body: JSON.stringify(passForm),
      });
      setFeedback('Account password updated successfully.');
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setError(err?.message || 'Unable to update password.');
    }
  };

  const handleMarkAllRead = async () => {
    await apiRequest('/api/investor/notifications/read-all', { method: 'POST' });
    await loadAccount();
  };

  return (
    <PortalShell
      portalTitle="Investor Portal"
      breadcrumbLabel="Account & Notifications"
      navItems={INVESTOR_NAV}
      variant="investor"
    >
      <div className="space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">Account & Profile Governance</h1>
          <p className="text-sm text-[#4A5260] mt-1">
            Review registered details, request controlled profile updates, manage security, and inspect notifications.
          </p>
        </div>

        {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
        {feedback && <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{feedback}</div>}

        {loading ? (
          <div className="h-48 bg-[#EFECE3]" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Profile Details & Controlled Change Request */}
            <div className="lg:col-span-7 space-y-6">
              <section className="bg-white border border-[#E5E8EE] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E5E8EE] pb-3">
                  <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Registered Investor Profile</h2>
                  <StatusBadge status={data?.user?.account_status} />
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <dt className="text-[#4A5260]">Account Number</dt>
                    <dd className="font-mono font-semibold text-[#0B172A] mt-0.5">{data?.profile?.account_number}</dd>
                  </div>
                  <div>
                    <dt className="text-[#4A5260]">Email Address</dt>
                    <dd className="font-mono mt-0.5">{data?.user?.email}</dd>
                  </div>
                  <div>
                    <dt className="text-[#4A5260]">Legal Name</dt>
                    <dd className="mt-0.5">
                      {data?.profile?.first_name} {data?.profile?.middle_name || ''} {data?.profile?.last_name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#4A5260]">Telephone</dt>
                    <dd className="font-mono mt-0.5">{data?.profile?.telephone}</dd>
                  </div>
                  <div>
                    <dt className="text-[#4A5260]">Date of Birth</dt>
                    <dd className="font-mono mt-0.5">{data?.profile?.date_of_birth}</dd>
                  </div>
                  <div>
                    <dt className="text-[#4A5260]">Country of Residence</dt>
                    <dd className="mt-0.5">{data?.profile?.country_of_residence}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[#4A5260]">Residential Address</dt>
                    <dd className="mt-0.5">
                      {data?.profile?.residential_address}, {data?.profile?.city}, {data?.profile?.state_region}{' '}
                      {data?.profile?.postal_code}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="bg-white border border-[#E5E8EE] p-6 space-y-4">
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Submit Profile Change Request</h2>
                <form onSubmit={handleRequestChange} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Field to Amend</label>
                      <select
                        value={fieldName}
                        onChange={(e) => setFieldName(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8]"
                      >
                        <option value="telephone">Telephone</option>
                        <option value="residential_address">Residential Address</option>
                        <option value="city">City</option>
                        <option value="state_region">State / Region</option>
                        <option value="postal_code">Postal Code</option>
                        <option value="country_of_residence">Country of Residence</option>
                        <option value="first_name">First Name</option>
                        <option value="last_name">Last Name</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Updated Value *</label>
                      <input
                        type="text"
                        required
                        value={requestedValue}
                        onChange={(e) => setRequestedValue(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Reason for Amendment *</label>
                    <input
                      type="text"
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8]"
                  >
                    Submit Change Request
                  </button>
                </form>

                {(data?.changeRequests || []).length > 0 && (
                  <div className="pt-4 border-t border-[#E5E8EE] divide-y divide-[#E5E8EE] text-xs">
                    {data.changeRequests.map((cr: any) => (
                      <div key={cr.id} className="py-2.5 flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold text-[#0B172A]">{cr.field_name}</div>
                          <div className="text-[#4A5260]">
                            {cr.previous_value || '—'} → <strong>{cr.requested_value}</strong>
                          </div>
                        </div>
                        <StatusBadge status={cr.status} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Password & Notifications */}
            <div className="lg:col-span-5 space-y-6">
              <section className="bg-white border border-[#E5E8EE] p-6 space-y-4">
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Account Security</h2>
                <form onSubmit={handlePasswordChange} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Current Password</label>
                    <input
                      type="password"
                      required
                      value={passForm.currentPassword}
                      onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">New Password (min 10 chars)</label>
                    <input
                      type="password"
                      required
                      minLength={10}
                      value={passForm.newPassword}
                      onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      minLength={10}
                      value={passForm.confirmPassword}
                      onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8]"
                  >
                    Update Password
                  </button>
                </form>
              </section>

              <section className="bg-white border border-[#E5E8EE] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E5E8EE] pb-3">
                  <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Notification History</h2>
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-xs font-semibold text-[#0B172A] hover:underline"
                  >
                    Mark All Read
                  </button>
                </div>
                <div className="divide-y divide-[#E5E8EE] max-h-96 overflow-y-auto">
                  {(data?.notifications || []).map((n: any) => (
                    <div key={n.id} className="py-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className={n.is_read ? 'text-[#4A5260] font-medium' : 'text-[#0B172A] font-semibold'}>
                          {n.title}
                        </span>
                        <span className="font-mono text-[11px] text-[#4A5260]">{formatDateTime(n.created_at)}</span>
                      </div>
                      <p className="text-[#4A5260]">{n.message}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
