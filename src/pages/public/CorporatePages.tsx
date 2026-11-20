import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CorporateLayout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { Announcement, FaqEntry } from '../../types';

interface CmsSection {
  heading: string;
  body: string;
}

export function CmsCorporatePage({ slug, fallbackTitle }: { slug: string; fallbackTitle: string }) {
  const [data, setData] = useState<{
    title: string;
    subtitle: string;
    heroKicker: string;
    updatedAt?: string;
    content: { sections?: CmsSection[] };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiRequest(`/api/public/pages/${slug}`)
      .then((res) => {
        if (mounted) setData(res);
      })
      .catch(() => {
        if (mounted) setData(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [slug]);

  return (
    <CorporateLayout>
      <section className="bg-[#0B172A] text-[#FCFBF8] border-b border-[#1E365C] py-16">
        <div className="max-w-[1040px] mx-auto px-6 space-y-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[#C9A968]">
            {data?.heroKicker || 'RICHMOND-INV'}
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-tight">
            {data?.title || fallbackTitle}
          </h1>
          {data?.subtitle && (
            <p className="text-base sm:text-lg text-[#C8D0DC] max-w-2xl leading-relaxed">
              {data.subtitle}
            </p>
          )}
        </div>
      </section>

      <section className="max-w-[1040px] mx-auto px-6 py-16">
        {loading ? (
          <div className="space-y-4">
            <div className="h-6 w-64 bg-[#EFECE3]" />
            <div className="h-24 w-full bg-[#EFECE3]" />
          </div>
        ) : (
          <div className="space-y-10">
            {(data?.content?.sections || []).map((sec, idx) => (
              <article key={idx} className="bg-white border border-[#E5E8EE] p-8 space-y-3">
                <div className="text-xs font-mono text-[#997837]">0{idx + 1}.</div>
                <h2 className="font-serif text-2xl font-semibold text-[#0B172A]">{sec.heading}</h2>
                <p className="text-sm sm:text-base text-[#4A5260] leading-relaxed max-w-3xl">{sec.body}</p>
              </article>
            ))}

            <div className="pt-4 border-t border-[#E5E8EE] flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-[#4A5260]">
                Need assistance? Contact our Investor Relations desk or review open share offerings.
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/offerings"
                  className="px-5 py-2.5 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542]"
                >
                  View Share Offerings
                </Link>
                <Link
                  to="/contact"
                  className="px-5 py-2.5 text-xs font-semibold border border-[#D6DAE2] bg-white text-[#0B172A]"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>
    </CorporateLayout>
  );
}

export function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ announcements: Announcement[] }>('/api/public/announcements')
      .then((res) => setAnnouncements(res.announcements || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <CorporateLayout>
      <section className="bg-[#0B172A] text-[#FCFBF8] border-b border-[#1E365C] py-16">
        <div className="max-w-[1040px] mx-auto px-6 space-y-3">
          <div className="text-xs uppercase tracking-[0.2em] text-[#C9A968]">Investor Communications</div>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold">News & Announcements</h1>
          <p className="text-base text-[#C8D0DC] max-w-2xl">
            Official corporate releases, issuance schedules, and operational notices published by RICHMOND-INV.
          </p>
        </div>
      </section>

      <section className="max-w-[1040px] mx-auto px-6 py-16 space-y-6">
        {loading ? (
          <div className="h-32 bg-[#EFECE3]" />
        ) : announcements.length === 0 ? (
          <div className="bg-white border border-[#E5E8EE] p-8 text-sm text-[#4A5260]">
            No corporate announcements have been published yet.
          </div>
        ) : (
          announcements.map((a) => (
            <article key={a.id} className="bg-white border border-[#E5E8EE] p-8 space-y-3">
              <div className="text-xs text-[#4A5260]">
                <span className="font-medium text-[#997837]">{a.category}</span>
                <span className="mx-2">·</span>
                <span className="font-mono tabular-nums">{formatDate(a.published_at)}</span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#0B172A]">{a.title}</h2>
              <p className="text-sm font-medium text-[#1C2026]">{a.summary}</p>
              <p className="text-sm text-[#4A5260] leading-relaxed whitespace-pre-line">{a.body}</p>
            </article>
          ))
        )}
      </section>
    </CorporateLayout>
  );
}

export function FaqPage() {
  const [faqs, setFaqs] = useState<FaqEntry[]>([]);
  const [category, setCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ faqs: FaqEntry[] }>('/api/public/faqs')
      .then((res) => setFaqs(res.faqs || []))
      .finally(() => setLoading(false));
  }, []);

  const categories = ['All', ...Array.from(new Set(faqs.map((f) => f.category)))];
  const filtered = category === 'All' ? faqs : faqs.filter((f) => f.category === category);

  return (
    <CorporateLayout>
      <section className="bg-[#0B172A] text-[#FCFBF8] border-b border-[#1E365C] py-16">
        <div className="max-w-[1040px] mx-auto px-6 space-y-3">
          <div className="text-xs uppercase tracking-[0.2em] text-[#C9A968]">Shareholder Guidance</div>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold">Frequently Asked Questions</h1>
          <p className="text-base text-[#C8D0DC] max-w-2xl">
            Detailed guidance on investor registration, KYC compliance, share subscriptions, and digital settlement.
          </p>
        </div>
      </section>

      <section className="max-w-[1040px] mx-auto px-6 py-16 space-y-8">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 text-xs font-semibold border transition-colors ${
                category === cat
                  ? 'bg-[#0B172A] text-white border-[#0B172A]'
                  : 'bg-white text-[#4A5260] border-[#D6DAE2] hover:text-[#0B172A]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-32 bg-[#EFECE3]" />
        ) : (
          <div className="space-y-4">
            {filtered.map((faq) => (
              <div key={faq.id} className="bg-white border border-[#E5E8EE] p-7 space-y-2">
                <div className="text-xs font-medium text-[#997837]">{faq.category}</div>
                <h2 className="font-serif text-xl font-semibold text-[#0B172A]">{faq.question}</h2>
                <p className="text-sm text-[#4A5260] leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </CorporateLayout>
  );
}

export function ContactPage() {
  const { publicSettings } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', organization: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successRef, setSuccessRef] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessRef('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{ ok: boolean; referenceCode: string }>('/api/public/contact', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSuccessRef(res.referenceCode);
      setForm({ fullName: '', email: '', organization: '', subject: '', message: '' });
    } catch (err: any) {
      setError(err?.message || 'Unable to submit inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CorporateLayout>
      <section className="bg-[#0B172A] text-[#FCFBF8] border-b border-[#1E365C] py-16">
        <div className="max-w-[1040px] mx-auto px-6 space-y-3">
          <div className="text-xs uppercase tracking-[0.2em] text-[#C9A968]">Investor Relations Desk</div>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold">Contact RICHMOND-INV</h1>
          <p className="text-base text-[#C8D0DC] max-w-2xl">
            Direct institutional correspondence for prospective investors, existing shareholders, and compliance inquiries.
          </p>
        </div>
      </section>

      <section className="max-w-[1040px] mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#E5E8EE] p-7 space-y-4">
            <h2 className="font-serif text-2xl font-semibold text-[#0B172A]">Corporate Office</h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-[#4A5260]">Legal Entity</dt>
                <dd className="font-medium text-[#0B172A] mt-0.5">
                  {publicSettings.company_legal_name || 'Richmond Investment Holdings Ltd.'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-[#4A5260]">Headquarters</dt>
                <dd className="text-[#1C2026] mt-0.5">
                  {!publicSettings.headquarters_address ||
                  publicSettings.headquarters_address === '24 Bishopsgate, London EC2N 4BQ, United Kingdom'
                    ? 'Saint Johns, Auckland, 1072, New Zealand'
                    : publicSettings.headquarters_address}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-[#4A5260]">Investor Relations Email</dt>
                <dd className="font-mono text-[#0B172A] mt-0.5">
                  {publicSettings.contact_email || 'investor.relations@richmond-inv.com'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-[#4A5260]">Telephone</dt>
                <dd className="font-mono text-[#0B172A] mt-0.5">
                  {publicSettings.contact_phone || '+44 20 7946 0180'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#E5E8EE] p-8">
          <h2 className="font-serif text-2xl font-semibold text-[#0B172A] mb-6">Submit an Inquiry</h2>
          {error && <div className="mb-4 p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-sm text-[#991B1B]">{error}</div>}
          {successRef && (
            <div className="mb-4 p-4 border border-[#146348]/30 bg-[#146348]/5 text-sm text-[#146348]">
              Inquiry recorded under reference <span className="font-mono font-semibold">{successRef}</span>. Our Investor Relations team will review your correspondence.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8] focus:outline-none focus:border-[#0B172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8] focus:outline-none focus:border-[#0B172A]"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Organization (Optional)</label>
                <input
                  type="text"
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8] focus:outline-none focus:border-[#0B172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Subject *</label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8] focus:outline-none focus:border-[#0B172A]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Message *</label>
              <textarea
                rows={5}
                required
                minLength={10}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8] focus:outline-none focus:border-[#0B172A]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] disabled:opacity-60"
            >
              {submitting ? 'Submitting Inquiry...' : 'Submit Inquiry'}
            </button>
          </form>
        </div>
      </section>
    </CorporateLayout>
  );
}
