import React, { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { ADMIN_NAV } from './AdminDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

export function AdminCmsPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('homepage');
  const [pageDraft, setPageDraft] = useState<any>(null);
  const [newAnn, setNewAnn] = useState({ title: '', category: 'Corporate Governance', summary: '', body: '' });
  const [newFaq, setNewFaq] = useState({ category: 'Onboarding & KYC', question: '', answer: '', sortOrder: 10 });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadCms = async () => {
    const [pRes, aRes, fRes, iRes] = await Promise.all([
      apiRequest<{ pages: any[] }>('/api/admin/cms/pages'),
      apiRequest<{ announcements: any[] }>('/api/admin/cms/announcements'),
      apiRequest<{ faqs: any[] }>('/api/admin/cms/faqs'),
      apiRequest<{ inquiries: any[] }>('/api/admin/cms/inquiries'),
    ]);
    setPages(pRes.pages || []);
    setAnnouncements(aRes.announcements || []);
    setFaqs(fRes.faqs || []);
    setInquiries(iRes.inquiries || []);
    const target = (pRes.pages || []).find((p) => p.slug === selectedSlug) || pRes.pages?.[0];
    if (target) {
      setPageDraft({
        title: target.title,
        subtitle: target.subtitle || '',
        heroKicker: target.hero_kicker || '',
        metaDescription: target.meta_description || '',
        contentJson: target.content_json,
        isPublished: Boolean(target.is_published),
      });
    }
  };

  useEffect(() => {
    loadCms();
  }, [selectedSlug]);

  const savePage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/api/admin/cms/pages/${selectedSlug}`, {
        method: 'PUT',
        body: JSON.stringify(pageDraft),
      });
      setFeedback(`Website page "${selectedSlug}" updated.`);
      await loadCms();
    } catch (err: any) {
      setError(err?.message || 'Unable to save page.');
    }
  };

  const addAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/admin/cms/announcements', { method: 'POST', body: JSON.stringify(newAnn) });
    setNewAnn({ title: '', category: 'Corporate Governance', summary: '', body: '' });
    setFeedback('Announcement published.');
    await loadCms();
  };

  const addFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/admin/cms/faqs', { method: 'POST', body: JSON.stringify(newFaq) });
    setNewFaq({ category: 'Onboarding & KYC', question: '', answer: '', sortOrder: 10 });
    setFeedback('FAQ entry added.');
    await loadCms();
  };

  return (
    <PortalShell portalTitle="Administrator Portal" breadcrumbLabel="Website CMS" navItems={ADMIN_NAV} variant="admin">
      <div className="space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">Corporate Content Management</h1>
          <p className="text-sm text-[#4A5260] mt-1">
            Edit public corporate pages, publish announcements, maintain FAQs, and review Investor Relations inquiries.
          </p>
        </div>

        {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
        {feedback && <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{feedback}</div>}

        {/* Page Editor */}
        <section className="bg-white border border-[#E5E8EE] p-6 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E8EE] pb-3">
            <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Corporate Page Editor</h2>
            <select
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
            >
              {pages.map((p) => (
                <option key={p.slug} value={p.slug}>
                  /{p.slug} — {p.title}
                </option>
              ))}
            </select>
          </div>
          {pageDraft && (
            <form onSubmit={savePage} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Page Title</label>
                  <input
                    type="text"
                    value={pageDraft.title}
                    onChange={(e) => setPageDraft({ ...pageDraft, title: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Hero Kicker</label>
                  <input
                    type="text"
                    value={pageDraft.heroKicker}
                    onChange={(e) => setPageDraft({ ...pageDraft, heroKicker: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Subtitle</label>
                <input
                  type="text"
                  value={pageDraft.subtitle}
                  onChange={(e) => setPageDraft({ ...pageDraft, subtitle: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Structured Content JSON</label>
                <textarea
                  rows={6}
                  value={pageDraft.contentJson}
                  onChange={(e) => setPageDraft({ ...pageDraft, contentJson: e.target.value })}
                  className="w-full px-3 py-2 font-mono border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
              <button type="submit" className="px-5 py-2.5 bg-[#0B172A] text-white font-semibold">
                Save Page Content
              </button>
            </form>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Announcements */}
          <section className="bg-white border border-[#E5E8EE] p-6 space-y-4 text-xs">
            <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Corporate Announcements</h2>
            <form onSubmit={addAnnouncement} className="space-y-3 border-b border-[#E5E8EE] pb-4">
              <input
                type="text"
                required
                placeholder="Announcement title"
                value={newAnn.title}
                onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
              />
              <input
                type="text"
                required
                placeholder="Category"
                value={newAnn.category}
                onChange={(e) => setNewAnn({ ...newAnn, category: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
              />
              <input
                type="text"
                required
                placeholder="Summary"
                value={newAnn.summary}
                onChange={(e) => setNewAnn({ ...newAnn, summary: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
              />
              <textarea
                rows={2}
                required
                placeholder="Full announcement body"
                value={newAnn.body}
                onChange={(e) => setNewAnn({ ...newAnn, body: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
              />
              <button type="submit" className="px-4 py-2 bg-[#0B172A] text-white font-semibold">
                Publish Announcement
              </button>
            </form>
            <div className="divide-y divide-[#E5E8EE]">
              {announcements.map((a) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[#0B172A]">{a.title}</div>
                    <div className="text-[#4A5260]">{a.category}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/admin/cms/announcements/${a.id}`, { method: 'DELETE' });
                      await loadCms();
                    }}
                    className="text-[#991B1B] underline"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* FAQs */}
          <section className="bg-white border border-[#E5E8EE] p-6 space-y-4 text-xs">
            <h2 className="font-serif text-xl font-semibold text-[#0B172A]">FAQ Register</h2>
            <form onSubmit={addFaq} className="space-y-3 border-b border-[#E5E8EE] pb-4">
              <input
                type="text"
                required
                placeholder="Category"
                value={newFaq.category}
                onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
              />
              <input
                type="text"
                required
                placeholder="Question"
                value={newFaq.question}
                onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
              />
              <textarea
                rows={2}
                required
                placeholder="Answer"
                value={newFaq.answer}
                onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
              />
              <button type="submit" className="px-4 py-2 bg-[#0B172A] text-white font-semibold">
                Add FAQ Entry
              </button>
            </form>
            <div className="divide-y divide-[#E5E8EE]">
              {faqs.map((f) => (
                <div key={f.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[#0B172A]">{f.question}</div>
                    <div className="text-[#4A5260]">{f.category}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/admin/cms/faqs/${f.id}`, { method: 'DELETE' });
                      await loadCms();
                    }}
                    className="text-[#991B1B] underline"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Contact Inquiries */}
        <section className="bg-white border border-[#E5E8EE] p-6 space-y-3 text-xs">
          <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Investor Relations Inquiries</h2>
          {inquiries.length === 0 ? (
            <p className="text-[#4A5260]">No public contact inquiries submitted.</p>
          ) : (
            <div className="divide-y divide-[#E5E8EE]">
              {inquiries.map((inq) => (
                <div key={inq.id} className="py-3 space-y-1">
                  <div className="font-semibold text-[#0B172A]">
                    <span className="font-mono text-[#997837]">{inq.reference_code}</span> · {inq.subject}
                  </div>
                  <div className="text-[#4A5260]">
                    {inq.full_name} ({inq.email}) · {formatDateTime(inq.created_at)}
                  </div>
                  <p>{inq.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PortalShell>
  );
}

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '', roleSlug: 'compliance_officer' });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadSettings = async () => {
    const res = await apiRequest<any>('/api/admin/settings');
    setSettings(res.settings || []);
    setAdminUsers(res.adminUsers || []);
    setRoles(res.roles || []);
    const map: Record<string, string> = {};
    for (const s of res.settings || []) map[s.setting_key] = s.setting_value;
    setValues(map);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    const updates = Object.entries(values).map(([settingKey, settingValue]) => ({ settingKey, settingValue }));
    await apiRequest('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ updates }) });
    setFeedback('System settings saved.');
    await loadSettings();
  };

  const createAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    try {
      await apiRequest('/api/admin/admin-users', { method: 'POST', body: JSON.stringify(newAdmin) });
      setFeedback('Administrator account created.');
      setNewAdmin({ email: '', password: '', roleSlug: 'compliance_officer' });
      await loadSettings();
    } catch (err: any) {
      setError(err?.message || 'Unable to create administrator.');
    }
  };

  return (
    <PortalShell portalTitle="Administrator Portal" breadcrumbLabel="System Settings" navItems={ADMIN_NAV} variant="admin">
      <div className="space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">System Settings & Permissions</h1>
          <p className="text-sm text-[#4A5260] mt-1">
            Configure corporate legal disclosures, currency, security thresholds, SMTP mail, and administrative roles.
          </p>
        </div>

        {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
        {feedback && <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{feedback}</div>}

        <form onSubmit={saveSettings} className="bg-white border border-[#E5E8EE] p-6 space-y-4 text-xs">
          <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Platform Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.map((s) => (
              <div key={s.setting_key}>
                <label className="block font-semibold text-[#0B172A] mb-1">
                  {s.setting_key} <span className="font-normal text-[#4A5260]">({s.group_name})</span>
                </label>
                <input
                  type="text"
                  value={values[s.setting_key] ?? ''}
                  onChange={(e) => setValues({ ...values, [s.setting_key]: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
                />
                {s.description && <div className="text-[11px] text-[#4A5260] mt-0.5">{s.description}</div>}
              </div>
            ))}
          </div>
          <button type="submit" className="px-5 py-2.5 bg-[#0B172A] text-white font-semibold">
            Save All Settings
          </button>
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white border border-[#E5E8EE] p-6 space-y-4 text-xs">
            <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Administrator Accounts</h2>
            <div className="divide-y divide-[#E5E8EE]">
              {adminUsers.map((u) => (
                <div key={u.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0B172A]">{u.email}</div>
                    <div className="text-[#4A5260]">{u.role_name}</div>
                  </div>
                  <span className="font-mono text-[#146348]">{u.account_status}</span>
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={createAdminUser} className="bg-white border border-[#E5E8EE] p-6 space-y-3 text-xs">
            <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Provision Staff Administrator</h2>
            <input
              type="email"
              required
              placeholder="Staff email address"
              value={newAdmin.email}
              onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
              className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
            />
            <input
              type="password"
              required
              minLength={10}
              placeholder="Initial password (min 10 chars)"
              value={newAdmin.password}
              onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
              className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
            />
            <select
              value={newAdmin.roleSlug}
              onChange={(e) => setNewAdmin({ ...newAdmin, roleSlug: e.target.value })}
              className="w-full px-3 py-2 border border-[#D6DAE2] bg-[#FCFBF8]"
            >
              {roles
                .filter((r) => r.slug !== 'investor')
                .map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.name}
                  </option>
                ))}
            </select>
            <button type="submit" className="px-5 py-2.5 bg-[#0B172A] text-white font-semibold">
              Create Administrator
            </button>
          </form>
        </div>
      </div>
    </PortalShell>
  );
}

const REPORT_TYPES = [
  { id: 'investors', label: 'Investor Directory' },
  { id: 'kyc', label: 'KYC Compliance' },
  { id: 'investments', label: 'Investment Requests' },
  { id: 'payments', label: 'Crypto Payments' },
  { id: 'allocations', label: 'Share Allocations' },
  { id: 'portfolios', label: 'Investor Portfolios' },
  { id: 'dividends', label: 'Dividend Ledger' },
  { id: 'audit', label: 'Administrative Audit Log' },
];

export function AdminReportsPage() {
  const [reportType, setReportType] = useState('investors');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest<{ rows: any[] }>(`/api/admin/reports/${reportType}`)
      .then((res) => setRows(res.rows || []))
      .finally(() => setLoading(false));
  }, [reportType]);

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <PortalShell portalTitle="Administrator Portal" breadcrumbLabel="Reports & Exports" navItems={ADMIN_NAV} variant="admin">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">Institutional Reports & CSV Exports</h1>
            <p className="text-sm text-[#4A5260] mt-1">
              Generate real-time database reports across all financial, compliance, and audit ledgers.
            </p>
          </div>
          <div className="flex items-center gap-3 no-print">
            <a
              href={`/api/admin/reports/${reportType}?format=csv`}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border border-[#D6DAE2] bg-white text-[#0B172A]"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#0B172A] text-white"
            >
              <Printer className="w-3.5 h-3.5" />
              Print PDF Report
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 no-print">
          {REPORT_TYPES.map((rt) => (
            <button
              key={rt.id}
              type="button"
              onClick={() => setReportType(rt.id)}
              className={`px-3.5 py-2 text-xs font-semibold border ${
                reportType === rt.id
                  ? 'bg-[#0B172A] text-white border-[#0B172A]'
                  : 'bg-white text-[#4A5260] border-[#D6DAE2]'
              }`}
            >
              {rt.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-[#E5E8EE] p-6 overflow-x-auto">
          {loading ? (
            <div className="h-36 bg-[#EFECE3]" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-[#4A5260]">No records found for this report.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E5E8EE] text-[#4A5260]">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="py-2 pr-4 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E8EE]">
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    {headers.map((h) => (
                      <td key={h} className="py-2.5 pr-4 font-mono tabular-nums whitespace-nowrap">
                        {row[h] === null || row[h] === undefined ? '—' : String(row[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
