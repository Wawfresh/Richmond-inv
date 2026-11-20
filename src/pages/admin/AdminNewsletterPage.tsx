import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, Mail, Send, Server, Users } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { ADMIN_NAV } from './AdminDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

interface SmtpStatus {
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  hasPassword: boolean;
  source: 'database' | 'env' | 'mixed' | 'unconfigured';
}

interface InvestorRecipient {
  id: number;
  email: string;
  account_status: string;
  first_name?: string | null;
  last_name?: string | null;
  account_number?: string | null;
  kyc_status?: string | null;
}

interface NewsletterCampaign {
  id: number;
  campaign_reference: string;
  subject: string;
  headline?: string | null;
  body: string;
  audience_type: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  error_summary?: string | null;
  sent_by_email?: string | null;
  created_at: string;
}

function formatAudienceLabel(audienceType: string) {
  if (audienceType === 'all_active') return 'All Active Investors';
  if (audienceType === 'kyc_approved') return 'KYC-Approved Investors';
  if (audienceType === 'selected_investors') return 'Selected Investors';
  return audienceType;
}

export function AdminNewsletterPage() {
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(null);
  const [investors, setInvestors] = useState<InvestorRecipient[]>([]);
  const [campaigns, setCampaigns] = useState<NewsletterCampaign[]>([]);
  const [stats, setStats] = useState({
    totalActiveInvestors: 0,
    kycApprovedInvestors: 0,
    totalCampaignsSent: 0,
  });
  const [loading, setLoading] = useState(true);

  // Composer state
  const [audienceType, setAudienceType] = useState<'all_active' | 'kyc_approved' | 'selected_investors'>('all_active');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sendingNewsletter, setSendingNewsletter] = useState(false);
  const [newsletterError, setNewsletterError] = useState('');
  const [newsletterFeedback, setNewsletterFeedback] = useState('');

  // SMTP config state
  const [smtpForm, setSmtpForm] = useState({
    host: '',
    port: '465',
    secure: true,
    user: '',
    pass: '',
    from: 'RICHMOND-INV Investor Relations <noreply@richmond-inv.com>',
  });
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState('');
  const [smtpError, setSmtpError] = useState('');

  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState('');
  const [testError, setTestError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const res = await apiRequest<{
        smtpStatus: SmtpStatus;
        investors: InvestorRecipient[];
        campaigns: NewsletterCampaign[];
        stats: { totalActiveInvestors: number; kycApprovedInvestors: number; totalCampaignsSent: number };
      }>('/api/admin/newsletter');
      setSmtpStatus(res.smtpStatus);
      setInvestors(res.investors || []);
      setCampaigns(res.campaigns || []);
      setStats(res.stats || { totalActiveInvestors: 0, kycApprovedInvestors: 0, totalCampaignsSent: 0 });
      if (res.smtpStatus) {
        setSmtpForm((prev) => ({
          host: res.smtpStatus.host || prev.host,
          port: String(res.smtpStatus.port || 465),
          secure: res.smtpStatus.secure,
          user: res.smtpStatus.user || prev.user,
          pass: '',
          from: res.smtpStatus.from || prev.from,
        }));
      }
    } catch (err: any) {
      setNewsletterError(err?.message || 'Unable to load newsletter console.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredInvestors = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return investors;
    return investors.filter((inv) => {
      const fullName = `${inv.first_name || ''} ${inv.last_name || ''}`.toLowerCase();
      return (
        fullName.includes(q) ||
        inv.email.toLowerCase().includes(q) ||
        String(inv.account_number || '').toLowerCase().includes(q)
      );
    });
  }, [investors, recipientSearch]);

  const estimatedRecipientCount = useMemo(() => {
    if (audienceType === 'all_active') return stats.totalActiveInvestors;
    if (audienceType === 'kyc_approved') return stats.kycApprovedInvestors;
    return selectedIds.length;
  }, [audienceType, stats, selectedIds]);

  const toggleRecipient = (userId: number) => {
    setSelectedIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpError('');
    setSmtpFeedback('');
    setSavingSmtp(true);
    try {
      const res = await apiRequest<{ ok: boolean; smtpStatus: SmtpStatus }>('/api/admin/newsletter/smtp', {
        method: 'PUT',
        body: JSON.stringify({
          host: smtpForm.host,
          port: Number(smtpForm.port || 465),
          secure: smtpForm.secure,
          user: smtpForm.user,
          pass: smtpForm.pass,
          from: smtpForm.from,
        }),
      });
      setSmtpStatus(res.smtpStatus);
      setSmtpForm((prev) => ({ ...prev, pass: '' }));
      setSmtpFeedback('SMTP mail settings saved. Click "Send Test Email" below to verify live delivery.');
    } catch (err: any) {
      setSmtpError(err?.message || 'Unable to save SMTP settings.');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestError('');
    setTestFeedback('');
    setSendingTest(true);
    try {
      const res = await apiRequest<{ ok: boolean; recipientEmail: string }>('/api/admin/newsletter/test', {
        method: 'POST',
        body: JSON.stringify(testEmail.trim() ? { toEmail: testEmail.trim() } : {}),
      });
      setTestFeedback(`Test email successfully delivered to ${res.recipientEmail}. Check your inbox (and spam folder).`);
    } catch (err: any) {
      setTestError(err?.message || 'Test email delivery failed.');
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewsletterError('');
    setNewsletterFeedback('');
    setSendingNewsletter(true);
    try {
      const res = await apiRequest<{
        ok: boolean;
        campaignReference: string;
        recipientCount: number;
        sentCount: number;
        failedCount: number;
        status: string;
        errorSummary?: string | null;
      }>('/api/admin/newsletter/send', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          headline,
          body,
          audienceType,
          recipientUserIds: audienceType === 'selected_investors' ? selectedIds : [],
          ctaLabel,
          ctaUrl,
        }),
      });
      if (res.failedCount === 0) {
        setNewsletterFeedback(
          `Newsletter ${res.campaignReference} delivered to ${res.sentCount} of ${res.recipientCount} investor(s).`
        );
      } else {
        setNewsletterFeedback(
          `Newsletter ${res.campaignReference} completed with ${res.sentCount} sent and ${res.failedCount} failed.${res.errorSummary ? ` (${res.errorSummary})` : ''}`
        );
      }
      setSubject('');
      setHeadline('');
      setBody('');
      setCtaLabel('');
      setCtaUrl('');
      setSelectedIds([]);
      setShowPreview(false);
      await loadData();
    } catch (err: any) {
      setNewsletterError(err?.message || 'Unable to dispatch newsletter.');
    } finally {
      setSendingNewsletter(false);
    }
  };

  return (
    <PortalShell portalTitle="Administrator Portal" breadcrumbLabel="Newsletter & Emails" navItems={ADMIN_NAV} variant="admin">
      <div className="space-y-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
            Investor Communications & Automated Mail
          </div>
          <h1 className="font-serif text-3xl font-semibold text-[#0B172A] mt-1">
            Newsletter & Email Dispatch
          </h1>
          <p className="text-sm text-[#4A5260] mt-1">
            Send branded investor newsletters and manage the outbound SMTP connection powering registration, KYC, payment, dividend, and withdrawal confirmation emails.
          </p>
        </div>

        {/* Summary Figures */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E5E8EE] p-5">
            <div className="text-[11px] uppercase tracking-wider text-[#4A5260]">SMTP Mail Delivery</div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-block px-2 py-0.5 text-xs font-semibold border ${
                  smtpStatus?.configured
                    ? 'bg-[#146348]/10 text-[#146348] border-[#146348]/30'
                    : 'bg-[#997837]/10 text-[#997837] border-[#997837]/30'
                }`}
              >
                {loading ? 'Checking...' : smtpStatus?.configured ? 'Connected & Ready' : 'Configuration Required'}
              </span>
            </div>
            <div className="text-xs text-[#4A5260] font-mono mt-1.5 truncate">
              {smtpStatus?.host || 'No SMTP host configured'}
            </div>
          </div>

          <div className="bg-white border border-[#E5E8EE] p-5">
            <div className="text-[11px] uppercase tracking-wider text-[#4A5260]">Active Investors</div>
            <div className="font-mono text-2xl font-semibold text-[#0B172A] tabular-nums mt-1.5">
              {stats.totalActiveInvestors}
            </div>
            <div className="text-xs text-[#4A5260] mt-1">Eligible for broadcast newsletters</div>
          </div>

          <div className="bg-white border border-[#E5E8EE] p-5">
            <div className="text-[11px] uppercase tracking-wider text-[#4A5260]">KYC-Approved Investors</div>
            <div className="font-mono text-2xl font-semibold text-[#146348] tabular-nums mt-1.5">
              {stats.kycApprovedInvestors}
            </div>
            <div className="text-xs text-[#4A5260] mt-1">Verified investor accounts</div>
          </div>

          <div className="bg-white border border-[#E5E8EE] p-5">
            <div className="text-[11px] uppercase tracking-wider text-[#4A5260]">Campaigns Dispatched</div>
            <div className="font-mono text-2xl font-semibold text-[#0B172A] tabular-nums mt-1.5">
              {stats.totalCampaignsSent}
            </div>
            <div className="text-xs text-[#4A5260] mt-1">Recorded in dispatch ledger</div>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Left Column: Newsletter Composer */}
          <section className="xl:col-span-7 bg-white border border-[#E5E8EE] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E8EE] pb-3.5">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#997837]" />
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Compose Investor Newsletter</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview((p) => !p)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#D6DAE2] text-[#0B172A] hover:bg-[#FCFBF8] cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-[#997837]" />
                <span>{showPreview ? 'Hide Preview' : 'Preview Email'}</span>
              </button>
            </div>

            {newsletterError && (
              <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">
                {newsletterError}
              </div>
            )}
            {newsletterFeedback && (
              <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">
                {newsletterFeedback}
              </div>
            )}

            <form onSubmit={handleSendNewsletter} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1C2026] mb-1.5">Target Audience</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'all_active', label: `All Active (${stats.totalActiveInvestors})` },
                    { id: 'kyc_approved', label: `KYC Approved (${stats.kycApprovedInvestors})` },
                    { id: 'selected_investors', label: `Specific User(s) (${selectedIds.length})` },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAudienceType(opt.id as any)}
                      className={`px-3 py-2.5 text-left font-semibold border transition-colors cursor-pointer ${
                        audienceType === opt.id
                          ? 'bg-[#0B172A] text-[#FCFBF8] border-[#0B172A]'
                          : 'bg-[#FCFBF8] text-[#1C2026] border-[#D6DAE2] hover:border-[#0B172A]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {audienceType === 'selected_investors' && (
                <div className="border border-[#D6DAE2] bg-[#FCFBF8] p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-semibold text-[#0B172A]">
                      <Users className="w-3.5 h-3.5 text-[#997837]" />
                      <span>Select Investor Recipients</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedIds(filteredInvestors.map((i) => i.id))}
                        className="text-[11px] font-semibold text-[#0B172A] underline cursor-pointer"
                      >
                        Select All Shown
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="text-[11px] text-[#4A5260] underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder="Filter by name, email, or account number..."
                    className="w-full px-3 py-1.5 border border-[#D6DAE2] bg-white text-[#0B172A]"
                  />
                  <div className="max-h-44 overflow-y-auto divide-y divide-[#E5E8EE] border border-[#E5E8EE] bg-white">
                    {filteredInvestors.length === 0 ? (
                      <div className="p-3 text-[#4A5260]">No registered investors match your filter.</div>
                    ) : (
                      filteredInvestors.map((inv) => {
                        const checked = selectedIds.includes(inv.id);
                        const fullName = [inv.first_name, inv.last_name].filter(Boolean).join(' ') || 'Investor';
                        return (
                          <label
                            key={inv.id}
                            className="px-3 py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#F9F7F2]"
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleRecipient(inv.id)}
                                className="accent-[#0B172A]"
                              />
                              <span className="min-w-0">
                                <span className="block font-semibold text-[#0B172A] truncate">{fullName}</span>
                                <span className="block text-[11px] font-mono text-[#4A5260] truncate">
                                  {inv.email} {inv.account_number ? `· ${inv.account_number}` : ''}
                                </span>
                              </span>
                            </span>
                            <StatusBadge status={inv.kyc_status || 'not_submitted'} />
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#1C2026] mb-1">Email Subject Line *</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Q4 Shareholder Portfolio Update & New Share Tranche"
                  className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C2026] mb-1">Newsletter Headline (Optional)</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Displayed prominently inside the email header (defaults to subject)"
                  className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C2026] mb-1">Message Content *</label>
                <textarea
                  rows={8}
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your institutional investor update here. Separate paragraphs with a blank line. Each recipient is automatically greeted by their registered name."
                  className="w-full px-3 py-2.5 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A] leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-[#1C2026] mb-1">Button Label (Optional)</label>
                  <input
                    type="text"
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    placeholder="e.g. View Share Offerings"
                    className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1C2026] mb-1">Button Link URL (Optional)</label>
                  <input
                    type="url"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://richmond-inv.com/offerings"
                    className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                  />
                </div>
              </div>

              {showPreview && (
                <div className="border border-[#D6DAE2] bg-[#F4F2EC] p-4">
                  <div className="max-w-lg mx-auto bg-white border border-[#D6DAE2]">
                    <div className="bg-[#0B172A] px-5 py-4 border-b-2 border-[#B5924C]">
                      <div className="font-serif text-lg font-semibold text-[#FCFBF8]">RICHMOND-INV</div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#C9A968] mt-0.5">
                        INVESTOR NEWSLETTER
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      <p className="text-xs text-[#4A5260]">Dear [Investor Name],</p>
                      <h3 className="font-serif text-xl font-semibold text-[#0B172A]">
                        {headline || subject || 'Newsletter Headline Preview'}
                      </h3>
                      <div className="text-xs text-[#1C2026] leading-relaxed whitespace-pre-line">
                        {body || 'Your newsletter message paragraphs will appear here.'}
                      </div>
                      {ctaLabel && ctaUrl && (
                        <div className="pt-2">
                          <span className="inline-block px-4 py-2 bg-[#0B172A] text-[#FCFBF8] text-[11px] font-semibold uppercase tracking-wider">
                            {ctaLabel}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="bg-[#060E1C] px-5 py-3 text-[10px] text-[#A8B2C1]">
                      Richmond Investment Holdings Ltd. · Saint Johns, Auckland, 1072, New Zealand
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E8EE]">
                <div className="text-[#4A5260]">
                  Will send to{' '}
                  <strong className="font-mono text-[#0B172A]">{estimatedRecipientCount}</strong> investor recipient(s).
                </div>
                <button
                  type="submit"
                  disabled={sendingNewsletter || !smtpStatus?.configured || estimatedRecipientCount === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5 text-[#C9A968]" />
                  <span>{sendingNewsletter ? 'Dispatching Emails...' : 'Send Newsletter Now'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Right Column: SMTP Connection & Live Test */}
          <div className="xl:col-span-5 space-y-6">
            <section className="bg-white border border-[#E5E8EE] p-6 space-y-4 text-xs">
              <div className="flex items-center gap-2 border-b border-[#E5E8EE] pb-3">
                <Server className="w-4 h-4 text-[#997837]" />
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">SMTP Mail Server Connection</h2>
              </div>
              <p className="text-[#4A5260] leading-relaxed">
                Configure your domain SMTP mailbox once to activate both automatic user notification emails (registration, KYC, deposits, dividends, withdrawals) and Admin Newsletters.
              </p>

              {smtpError && (
                <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-[#991B1B]">{smtpError}</div>
              )}
              {smtpFeedback && (
                <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-[#146348]">{smtpFeedback}</div>
              )}

              <form onSubmit={handleSaveSmtp} className="space-y-3">
                <div>
                  <label className="block font-semibold text-[#1C2026] mb-1">SMTP Host *</label>
                  <input
                    type="text"
                    required
                    value={smtpForm.host}
                    onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                    placeholder="e.g. mail.richmond-inv.com"
                    className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#1C2026] mb-1">SMTP Port *</label>
                    <input
                      type="number"
                      required
                      value={smtpForm.port}
                      onChange={(e) => {
                        const portVal = e.target.value;
                        setSmtpForm({
                          ...smtpForm,
                          port: portVal,
                          secure: Number(portVal) === 465,
                        });
                      }}
                      placeholder="465"
                      className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#1C2026] mb-1">Encryption</label>
                    <select
                      value={smtpForm.secure ? 'ssl' : 'starttls'}
                      onChange={(e) => setSmtpForm({ ...smtpForm, secure: e.target.value === 'ssl' })}
                      className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                    >
                      <option value="ssl">SSL / TLS (Port 465)</option>
                      <option value="starttls">STARTTLS (Port 587)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#1C2026] mb-1">SMTP Username (Mailbox Email) *</label>
                  <input
                    type="text"
                    required
                    value={smtpForm.user}
                    onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                    placeholder="noreply@richmond-inv.com"
                    className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C2026] mb-1">
                    SMTP Password {smtpStatus?.hasPassword ? '(Saved — leave blank to keep)' : '*'}
                  </label>
                  <input
                    type="password"
                    required={!smtpStatus?.hasPassword}
                    value={smtpForm.pass}
                    onChange={(e) => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                    placeholder={smtpStatus?.hasPassword ? '••••••••••••' : 'Enter mailbox password'}
                    className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1C2026] mb-1">Sender "From" Header *</label>
                  <input
                    type="text"
                    required
                    value={smtpForm.from}
                    onChange={(e) => setSmtpForm({ ...smtpForm, from: e.target.value })}
                    placeholder="RICHMOND-INV <noreply@richmond-inv.com>"
                    className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingSmtp}
                  className="w-full py-2.5 bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] font-semibold cursor-pointer disabled:opacity-60"
                >
                  {savingSmtp ? 'Saving SMTP Configuration...' : 'Save SMTP Settings'}
                </button>
              </form>
            </section>

            {/* Test Delivery Box */}
            <section className="bg-white border border-[#E5E8EE] p-6 space-y-3 text-xs">
              <div className="flex items-center gap-2 border-b border-[#E5E8EE] pb-3">
                <CheckCircle2 className="w-4 h-4 text-[#146348]" />
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Test Live Email Delivery</h2>
              </div>
              <p className="text-[#4A5260]">
                Verify your SMTP credentials by sending a real branded test email to your inbox.
              </p>

              {testError && (
                <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-[#991B1B]">{testError}</div>
              )}
              {testFeedback && (
                <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-[#146348]">{testFeedback}</div>
              )}

              <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your-email@example.com (optional)"
                  className="flex-1 px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A]"
                />
                <button
                  type="submit"
                  disabled={sendingTest || !smtpStatus?.configured}
                  className="px-4 py-2 bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  {sendingTest ? 'Sending...' : 'Send Test Email'}
                </button>
              </form>
            </section>
          </div>
        </div>

        {/* Newsletter Dispatch History */}
        <section className="bg-white border border-[#E5E8EE] p-6 space-y-4 text-xs">
          <div className="border-b border-[#E5E8EE] pb-3">
            <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Newsletter Dispatch History</h2>
          </div>

          {campaigns.length === 0 ? (
            <p className="py-6 text-[#4A5260]">
              No investor newsletters have been dispatched yet. Composed campaigns and delivery counts will be logged here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-[#E5E8EE] text-[#4A5260]">
                  <tr>
                    <th className="py-2.5 pr-4">Reference</th>
                    <th className="py-2.5 pr-4">Subject</th>
                    <th className="py-2.5 pr-4">Audience</th>
                    <th className="py-2.5 pr-4 text-right">Delivered</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5">Dispatched</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E8EE]">
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 pr-4 font-mono text-[#0B172A] whitespace-nowrap">{c.campaign_reference}</td>
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-[#0B172A]">{c.subject}</div>
                        {c.error_summary && (
                          <div className="text-[11px] text-[#991B1B] mt-0.5">{c.error_summary}</div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-[#4A5260] whitespace-nowrap">
                        {formatAudienceLabel(c.audience_type)}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="text-[#146348] font-semibold">{c.sent_count}</span>
                        <span className="text-[#4A5260]"> / {c.recipient_count}</span>
                        {c.failed_count > 0 && (
                          <span className="text-[#991B1B] ml-1.5">({c.failed_count} failed)</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={c.status === 'sent' ? 'approved' : c.status === 'partial' ? 'pending' : 'rejected'} />
                      </td>
                      <td className="py-3 text-[#4A5260] font-mono tabular-nums whitespace-nowrap">
                        {formatDateTime(c.created_at)}
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
