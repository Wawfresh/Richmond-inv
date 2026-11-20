import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { CorporateLayout } from '../../components/Layout';
import { PortalUtilityDock } from '../../components/PortalUtilityDock';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDate, formatPlanDuration, formatRoi } from '../../lib/format';
import type { Announcement, FaqEntry, ShareOffering } from '../../types';
import heroImg from '../../assets/images/hero_institutional_architecture_1794740248296.jpg';
import boardroomImg from '../../assets/images/about_boardroom_heritage_1794740249488.jpg';
import marketsImg from '../../assets/images/strategy_global_markets_1794740249541.jpg';
import reportImg from '../../assets/images/insights_annual_report_1794740249768.jpg';

interface HomePageContent {
  introHeading?: string;
  introBody?: string;
  pillars?: { index: string; title: string; body: string }[];
  processSteps?: { step: string; title: string; description: string }[];
  benefits?: { title: string; description: string }[];
}

export function HomePage() {
  const [pageTitle, setPageTitle] = useState('Disciplined Capital Stewardship for Global Share Offerings');
  const [pageSubtitle, setPageSubtitle] = useState(
    'RICHMOND-INV structures direct equity and fixed-income participation offerings for verified private and institutional investors under transparent governance.'
  );
  const [heroKicker, setHeroKicker] = useState('Institutional Share & Asset Stewardship');
  const [content, setContent] = useState<HomePageContent>({});
  const [offerings, setOfferings] = useState<ShareOffering[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [faqs, setFaqs] = useState<FaqEntry[]>([]);
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiRequest('/api/public/pages/homepage').catch(() => null),
      apiRequest('/api/public/bootstrap').catch(() => null),
    ]).then(([pageData, bootData]) => {
      if (!mounted) return;
      if (pageData) {
        if (pageData.title) setPageTitle(pageData.title);
        if (pageData.subtitle) setPageSubtitle(pageData.subtitle);
        if (pageData.heroKicker) setHeroKicker(pageData.heroKicker);
        if (pageData.content) setContent(pageData.content);
      }
      if (bootData) {
        setOfferings(bootData.offerings || []);
        setAnnouncements(bootData.announcements || []);
        setFaqs(bootData.faqs || []);
        if (bootData.faqs?.[0]?.id) setOpenFaqId(bootData.faqs[0].id);
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const pillars = content.pillars || [
    {
      index: '01',
      title: 'Direct Share Issuance',
      body: 'Structured participation across vetted corporate equity and preference share tranches with transparent pricing and allocation limits.',
    },
    {
      index: '02',
      title: 'Verified Compliance Workflow',
      body: 'Mandatory identity verification, documented suitability checks, and full administrative audit trails prior to capital settlement.',
    },
    {
      index: '03',
      title: 'Auditable Digital Settlement',
      body: 'Administrator-verified cryptocurrency settlement across Bitcoin, Ethereum, and Tether rails with manual treasury reconciliation.',
    },
    {
      index: '04',
      title: 'Transparent Portfolio Ledger',
      body: 'Real-time visibility into share allocations, acquisition cost basis, authorized valuation updates, and declared dividend records.',
    },
  ];

  const processSteps = content.processSteps || [
    {
      step: '01',
      title: 'Investor Registration & KYC',
      description:
        'Complete your investor profile and submit identity and address verification documents through our encrypted private portal.',
    },
    {
      step: '02',
      title: 'Offering Selection & Eligibility',
      description:
        'Review offering prospectuses, risk disclosures, and minimum/maximum share limits before submitting an investment request.',
    },
    {
      step: '03',
      title: 'Treasury Settlement Verification',
      description:
        'Upon request approval, remit settlement via configured cryptocurrency channels and submit the transaction hash for treasury review.',
    },
    {
      step: '04',
      title: 'Share Allocation & Reporting',
      description:
        'Once payment is verified by an authorized administrator, shares are formally allocated to your portfolio ledger with downloadable statements.',
    },
  ];

  const benefits = content.benefits || [
    {
      title: 'Segregated Investor Ledgers',
      description: 'Every shareholding, transaction, and dividend entry is tied to an explicit administrative accounting reference.',
    },
    {
      title: 'Institutional Governance',
      description: 'Multi-role compliance and operations controls prevent unauthorized allocations or unverified payment confirmations.',
    },
    {
      title: 'On-Demand Documentation',
      description: 'Access offering memoranda, risk disclosures, and printable portfolio statements directly from your investor dashboard.',
    },
  ];

  return (
    <CorporateLayout>
      {/* 1. Institutional Hero Section */}
      <section className="bg-[#0B172A] text-[#FCFBF8] border-b border-[#1E365C]">
        <div className="max-w-[1280px] mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
            <div className="space-y-6">
              <div className="text-xs uppercase tracking-[0.2em] text-[#C9A968] font-medium">
                {heroKicker}
              </div>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-[54px] font-semibold leading-[1.08] tracking-tight text-[#FCFBF8]">
                {pageTitle}
              </h1>
              <p className="text-base sm:text-lg text-[#C8D0DC] leading-relaxed max-w-xl">
                {pageSubtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/offerings"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] transition-colors whitespace-nowrap"
              >
                Explore Share Offerings
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center px-6 py-3.5 text-sm font-medium border border-[#3B5278] text-[#FCFBF8] hover:border-[#C9A968] transition-colors whitespace-nowrap"
              >
                Open Investor Account
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-72 sm:h-96 lg:h-full min-h-[340px] bg-[#132542] border border-[#1E365C] overflow-hidden">
              <img
                src={heroImg}
                alt="RICHMOND-INV institutional architectural headquarters"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060E1C]/80 via-[#060E1C]/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#E5E8EE]">
                <span>Auckland · Institutional Governance</span>
                <span className="font-mono tabular-nums text-[#C9A968]">Direct Share Registry</span>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Structural Summary Row */}
        <div className="border-t border-[#1E365C] bg-[#060E1C]">
          <div className="max-w-[1280px] mx-auto px-6 py-6 grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#8E99AA]">Active Offerings</div>
              <div className="font-mono text-xl font-semibold text-[#FCFBF8] mt-1 tabular-nums">
                {loading ? '—' : offerings.length}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#8E99AA]">Settlement Rails</div>
              <div className="font-mono text-xl font-semibold text-[#FCFBF8] mt-1">BTC · ETH · USDT</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#8E99AA]">Onboarding Standard</div>
              <div className="text-base font-medium text-[#FCFBF8] mt-1.5">Mandatory KYC Review</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#8E99AA]">Ledger Policy</div>
              <div className="text-base font-medium text-[#FCFBF8] mt-1.5">100% Audited Allocations</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Corporate Introduction & Philosophy */}
      <section className="max-w-[1280px] mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-5">
            <div className="h-full min-h-[300px] bg-[#EFECE3] border border-[#E5E8EE] overflow-hidden">
              <img
                src={boardroomImg}
                alt="RICHMOND-INV investment committee boardroom"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
              Company Introduction
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#0B172A] leading-tight">
              {content.introHeading || 'Institutional Rigor, Direct Shareholder Access'}
            </h2>
            <p className="text-[#4A5260] leading-relaxed text-base max-w-2xl">
              {content.introBody ||
                'RICHMOND-INV operates a unified investment and investor relations architecture designed to connect qualified capital with long-horizon real asset, infrastructure, and industrial equity tranches.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[#E5E8EE]">
              {pillars.map((pillar) => (
                <div key={pillar.index} className="space-y-1.5">
                  <div className="text-xs font-mono text-[#997837]">{pillar.index}.</div>
                  <h3 className="font-serif text-xl font-semibold text-[#0B172A]">{pillar.title}</h3>
                  <p className="text-sm text-[#4A5260] leading-relaxed">{pillar.body}</p>
                </div>
              ))}
            </div>
            <div className="pt-2 flex flex-wrap gap-6 text-sm font-medium">
              <Link to="/about" className="text-[#0B172A] underline underline-offset-4 hover:text-[#997837]">
                About RICHMOND-INV
              </Link>
              <Link to="/corporate-governance" className="text-[#0B172A] underline underline-offset-4 hover:text-[#997837]">
                Corporate Governance
              </Link>
              <Link to="/investment-philosophy" className="text-[#0B172A] underline underline-offset-4 hover:text-[#997837]">
                Investment Philosophy
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Available Share Offerings (Live Database Catalog) */}
      <section className="bg-[#FCFBF8] border-y border-[#E5E8EE] py-20">
        <div className="max-w-[1280px] mx-auto px-6 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E5E8EE] pb-6">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
                Capital Opportunities
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#0B172A] mt-2">
                Available Share Offerings
              </h2>
            </div>
            <Link
              to="/offerings"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B172A] hover:text-[#997837] whitespace-nowrap"
            >
              View All Offerings
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {offerings.length === 0 ? (
            <div className="bg-white border border-[#E5E8EE] p-10 text-center text-sm text-[#4A5260]">
              {loading ? 'Loading current share offerings...' : 'No share offerings are currently open for public subscription.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {offerings.map((off) => (
                <article
                  key={off.id}
                  className="bg-white border border-[#E5E8EE] p-7 flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-3">
                    <div className="text-xs text-[#4A5260] font-mono tabular-nums">
                      {off.reference_code} · {off.sector}
                    </div>
                    <h3 className="font-serif text-2xl font-semibold text-[#0B172A] leading-snug">
                      {off.title}
                    </h3>
                    <p className="text-sm text-[#4A5260] leading-relaxed">{off.summary}</p>
                  </div>

                  <div className="space-y-4">
                    <dl className="grid grid-cols-2 gap-y-3 gap-x-4 pt-4 border-t border-[#E5E8EE] text-xs">
                      <div>
                        <dt className="text-[#4A5260]">Target ROI</dt>
                        <dd className="font-mono text-base font-semibold text-[#146348] tabular-nums mt-0.5">
                          {formatRoi(off.roi_percent)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#4A5260]">Plan Duration</dt>
                        <dd className="font-mono text-sm font-semibold text-[#0B172A] tabular-nums mt-1">
                          {formatPlanDuration(
                            off.duration_months,
                            off.duration_days,
                            off.duration_hours,
                            off.duration_unit,
                            off.duration_value
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#4A5260]">Min Amount</dt>
                        <dd className="font-mono text-[#1C2026] tabular-nums mt-0.5">
                          {formatCurrency(
                            Number(off.min_amount) > 0 ? off.min_amount : Number(off.min_quantity || 1) * Number(off.share_price || 1),
                            off.currency
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#4A5260]">Max Amount</dt>
                        <dd className="font-mono text-[#1C2026] tabular-nums mt-0.5">
                          {formatCurrency(
                            Number(off.max_amount) > 0 ? off.max_amount : Number(off.max_quantity || 100) * Number(off.share_price || 1),
                            off.currency
                          )}
                        </dd>
                      </div>
                    </dl>

                    <Link
                      to={`/offerings/${off.slug}`}
                      className="block w-full text-center px-4 py-3 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] transition-colors"
                    >
                      Review Offering & Terms
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Investment Process & Strategic Context */}
      <section className="max-w-[1280px] mx-auto px-6 py-20 space-y-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-7 space-y-8">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
                Subscription Workflow
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#0B172A] mt-2">
                How Participation Works
              </h2>
            </div>

            <div className="divide-y divide-[#E5E8EE] border-y border-[#E5E8EE]">
              {processSteps.map((s) => (
                <div key={s.step} className="py-5 grid grid-cols-12 gap-4 items-start">
                  <div className="col-span-2 sm:col-span-1 font-mono text-sm font-semibold text-[#997837] tabular-nums">
                    {s.step}
                  </div>
                  <div className="col-span-10 sm:col-span-11 space-y-1">
                    <h3 className="font-serif text-xl font-semibold text-[#0B172A]">{s.title}</h3>
                    <p className="text-sm text-[#4A5260] leading-relaxed">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="h-full min-h-[320px] bg-[#EFECE3] border border-[#E5E8EE] overflow-hidden">
              <img
                src={marketsImg}
                alt="European institutional financial exchange atrium"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Investor Benefits */}
        <div className="bg-[#0B172A] text-[#FCFBF8] p-8 sm:p-12 border border-[#1E365C]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-4 space-y-3">
              <div className="text-xs uppercase tracking-[0.18em] text-[#C9A968]">Shareholder Standards</div>
              <h2 className="font-serif text-3xl font-semibold">Investor Protections & Clarity</h2>
              <p className="text-sm text-[#C8D0DC] leading-relaxed">
                Every stage of onboarding, payment verification, and share allocation is governed by explicit institutional controls.
              </p>
            </div>
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              {benefits.map((b, i) => (
                <div key={i} className="border border-[#1E365C] bg-[#132542]/60 p-6 space-y-2">
                  <h3 className="font-serif text-xl font-semibold text-[#FCFBF8]">{b.title}</h3>
                  <p className="text-xs sm:text-sm text-[#C8D0DC] leading-relaxed">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Corporate Announcements & Insights */}
      <section className="bg-[#FCFBF8] border-y border-[#E5E8EE] py-20">
        <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
              Investor Relations
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#0B172A]">
              Corporate Announcements
            </h2>
            <p className="text-sm text-[#4A5260] leading-relaxed">
              Official notices regarding share issuance schedules, treasury procedures, and governance disclosures.
            </p>
            <div className="border border-[#E5E8EE] bg-white overflow-hidden">
              <img
                src={reportImg}
                alt="Bound institutional annual investment reports"
                referrerPolicy="no-referrer"
                className="w-full h-56 object-cover"
              />
            </div>
            <Link
              to="/announcements"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B172A] underline underline-offset-4 hover:text-[#997837]"
            >
              Read All Announcements
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="lg:col-span-7 divide-y divide-[#E5E8EE] border-t border-[#E5E8EE]">
            {announcements.length === 0 ? (
              <p className="py-8 text-sm text-[#4A5260]">No corporate announcements published.</p>
            ) : (
              announcements.map((ann) => (
                <article key={ann.id} className="py-6 space-y-2">
                  <div className="text-xs text-[#4A5260]">
                    <span>{ann.category}</span>
                    <span className="mx-2">·</span>
                    <span className="font-mono tabular-nums">{formatDate(ann.published_at)}</span>
                  </div>
                  <h3 className="font-serif text-2xl font-semibold text-[#0B172A]">{ann.title}</h3>
                  <p className="text-sm text-[#4A5260] leading-relaxed">{ann.summary}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 6. Frequently Asked Questions */}
      <section className="max-w-[1280px] mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4 space-y-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
              Investor Guidance
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#0B172A]">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-[#4A5260] leading-relaxed">
              Clear answers covering verification requirements, share allocation timing, and settlement procedures.
            </p>
            <Link
              to="/faq"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B172A] underline underline-offset-4 hover:text-[#997837]"
            >
              View Full FAQ Register
            </Link>
          </div>

          <div className="lg:col-span-8 divide-y divide-[#E5E8EE] border-y border-[#E5E8EE]">
            {faqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id} className="py-5">
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full flex items-center justify-between gap-4 text-left"
                  >
                    <div>
                      <div className="text-xs text-[#997837] font-medium mb-1">{faq.category}</div>
                      <h3 className="font-serif text-xl font-semibold text-[#0B172A]">{faq.question}</h3>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-[#4A5260] shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#4A5260] shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm text-[#4A5260] leading-relaxed max-w-3xl">{faq.answer}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <PortalUtilityDock />
    </CorporateLayout>
  );
}
