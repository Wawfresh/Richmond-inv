import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, LayoutGrid, Search, ShieldCheck, Table2 } from 'lucide-react';
import { CorporateLayout } from '../../components/Layout';
import { RoiCalculator } from '../../components/RoiCalculator';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatNumber, formatPlanDuration, formatRoi } from '../../lib/format';
import type { ShareOffering } from '../../types';
import marketsImg from '../../assets/images/strategy_global_markets_1794740249541.jpg';
import architectureImg from '../../assets/images/hero_institutional_architecture_1794740248296.jpg';
import boardroomImg from '../../assets/images/about_boardroom_heritage_1794740249488.jpg';
import reportImg from '../../assets/images/insights_annual_report_1794740249768.jpg';

const SECTOR_MEDIA = [architectureImg, marketsImg, boardroomImg, reportImg];

function getOfferingMedia(offering: ShareOffering, index: number): string {
  const s = offering.sector.toLowerCase();
  if (s.includes('infrastructure')) return architectureImg;
  if (s.includes('fixed') || s.includes('income') || s.includes('sovereign')) return reportImg;
  if (s.includes('industrial') || s.includes('growth')) return marketsImg;
  return SECTOR_MEDIA[index % SECTOR_MEDIA.length];
}

function getPlanAmounts(off: ShareOffering) {
  const unitPrice = Number(off.share_price || 0);
  const minAmount = Number(off.min_amount) > 0 ? Number(off.min_amount) : Number(off.min_quantity || 1) * unitPrice;
  const maxAmount = Number(off.max_amount) > 0 ? Number(off.max_amount) : Number(off.max_quantity || 100) * unitPrice;
  return { minAmount, maxAmount: Math.max(minAmount, maxAmount) };
}

function getSubscriptionStats(off: ShareOffering) {
  const authorized = Math.max(0, Number(off.total_authorized_quantity || 0));
  const available = Math.max(0, Number(off.available_quantity || 0));
  const allocated = Math.max(0, authorized - available);
  const pctSubscribed = authorized > 0 ? Math.min(100, Math.round((allocated / authorized) * 100)) : 0;
  const { minAmount, maxAmount } = getPlanAmounts(off);
  const authorizedCapital = authorized * Number(off.share_price || 0);
  return { authorized, available, allocated, pctSubscribed, minAmount, maxAmount, authorizedCapital };
}

type SortOption = 'default' | 'roi-desc' | 'roi-asc' | 'min-asc';
type ViewMode = 'grid' | 'table';

export function OfferingsPublicPage() {
  const { user } = useAuth();
  const [offerings, setOfferings] = useState<ShareOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    apiRequest<{ offerings: ShareOffering[] }>('/api/public/offerings')
      .then((res) => setOfferings(res.offerings || []))
      .catch((err: any) => setError(err?.message || 'Unable to load published share offerings.'))
      .finally(() => setLoading(false));
  }, []);

  const sectors = useMemo(
    () => ['All', ...Array.from(new Set(offerings.map((o) => o.sector)))],
    [offerings]
  );

  const aggregateStats = useMemo(() => {
    if (offerings.length === 0) {
      return { totalCapacityUsd: 0, lowestMinTicket: 0, primaryCurrency: 'USD' };
    }
    const totalCapacityUsd = offerings.reduce(
      (sum, off) => sum + Number(off.total_authorized_quantity || 0) * Number(off.share_price || 0),
      0
    );
    const lowestMinTicket = Math.min(...offerings.map((off) => getPlanAmounts(off).minAmount));
    return {
      totalCapacityUsd,
      lowestMinTicket,
      primaryCurrency: offerings[0]?.currency || 'USD',
    };
  }, [offerings]);

  const visibleOfferings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = offerings.filter((off) => {
      const matchesSector = sectorFilter === 'All' || off.sector === sectorFilter;
      const matchesQuery =
        !q ||
        off.title.toLowerCase().includes(q) ||
        off.reference_code.toLowerCase().includes(q) ||
        off.sector.toLowerCase().includes(q) ||
        off.summary.toLowerCase().includes(q);
      return matchesSector && matchesQuery;
    });

    const sorted = [...filtered];
    if (sortBy === 'roi-desc') {
      sorted.sort((a, b) => Number(b.roi_percent || 0) - Number(a.roi_percent || 0));
    } else if (sortBy === 'roi-asc') {
      sorted.sort((a, b) => Number(a.roi_percent || 0) - Number(b.roi_percent || 0));
    } else if (sortBy === 'min-asc') {
      sorted.sort((a, b) => getPlanAmounts(a).minAmount - getPlanAmounts(b).minAmount);
    }
    return sorted;
  }, [offerings, sectorFilter, searchQuery, sortBy]);

  return (
    <CorporateLayout>
      {/* Institutional Offerings Hero */}
      <section className="bg-[#0B172A] text-[#FCFBF8] border-b border-[#1E365C]">
        <div className="max-w-[1280px] mx-auto px-6 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[#C9A968] font-medium">
                Primary Market Issuance Desk
              </div>
              <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-[1.08] tracking-tight text-[#FCFBF8]">
                Institutional Investment Plans &amp; Private Placements
              </h1>
              <p className="text-base text-[#C8D0DC] leading-relaxed max-w-2xl">
                Evaluate active corporate equity and fixed-income investment plans structured for qualified investors. Inspect target ROI, plan duration, minimum and maximum investment thresholds, and official documentation prior to allocation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href="#issuance-catalog"
                className="inline-flex items-center gap-2 px-6 py-3 text-xs sm:text-sm font-semibold bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] transition-colors whitespace-nowrap"
              >
                Browse Open Tranches
                <ArrowRight className="w-4 h-4" />
              </a>
              {user?.accountType === 'investor' ? (
                <Link
                  to="/portal/offerings"
                  className="inline-flex items-center justify-center px-6 py-3 text-xs sm:text-sm font-medium border border-[#3B5278] text-[#FCFBF8] hover:border-[#C9A968] transition-colors whitespace-nowrap"
                >
                  Open Investor Subscription Desk
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center px-6 py-3 text-xs sm:text-sm font-medium border border-[#3B5278] text-[#FCFBF8] hover:border-[#C9A968] transition-colors whitespace-nowrap"
                >
                  Open Investor Account
                </Link>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative h-64 sm:h-80 lg:h-full min-h-[260px] bg-[#132542] border border-[#1E365C] overflow-hidden">
              <img
                src={marketsImg}
                alt="Global institutional capital markets showcase"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060E1C]/85 via-[#060E1C]/25 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between gap-2 text-xs text-[#E5E8EE]">
                <span>Verified Private Share Registry</span>
                <span className="font-mono text-[#C9A968] tabular-nums">KYC Governed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Quantitative Summary Bar */}
        <div className="border-t border-[#1E365C] bg-[#060E1C]">
          <div className="max-w-[1280px] mx-auto px-6 py-5 grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#8E99AA]">Published Tranches</div>
              <div className="font-mono text-xl font-semibold text-[#FCFBF8] mt-1 tabular-nums">
                {loading ? '—' : offerings.length}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#8E99AA]">Authorized Pool Value</div>
              <div className="font-mono text-xl font-semibold text-[#FCFBF8] mt-1 tabular-nums">
                {loading ? '—' : formatCurrency(aggregateStats.totalCapacityUsd, aggregateStats.primaryCurrency)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#8E99AA]">Entry Ticket From</div>
              <div className="font-mono text-xl font-semibold text-[#C9A968] mt-1 tabular-nums">
                {loading ? '—' : formatCurrency(aggregateStats.lowestMinTicket, aggregateStats.primaryCurrency)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#8E99AA]">Settlement Channels</div>
              <div className="font-mono text-base font-medium text-[#FCFBF8] mt-1.5">BTC · ETH · USDT</div>
            </div>
          </div>
        </div>
      </section>

      {/* Issuance Catalog Section */}
      <section id="issuance-catalog" className="max-w-[1280px] mx-auto px-6 py-14 space-y-8">
        {/* Sector Filters, Search, Sort & View Mode Controls */}
        <div className="bg-white border border-[#E5E8EE] p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {sectors.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSectorFilter(sec)}
                  className={`px-3.5 py-2 text-xs font-semibold border transition-colors whitespace-nowrap ${
                    sectorFilter === sec
                      ? 'bg-[#0B172A] text-[#FCFBF8] border-[#0B172A]'
                      : 'bg-[#FCFBF8] text-[#4A5260] border-[#D6DAE2] hover:text-[#0B172A] hover:border-[#0B172A]'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[210px]">
                <Search className="w-3.5 h-3.5 text-[#4A5260] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tranche or code..."
                  aria-label="Search share offerings"
                  className="w-full pl-8 pr-3 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8] text-[#1C2026] focus:outline-none focus:border-[#0B172A]"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort share offerings"
                className="px-3 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8] text-[#1C2026] focus:outline-none focus:border-[#0B172A]"
              >
                <option value="default">Sort: Featured Order</option>
                <option value="roi-desc">Target ROI: High to Low</option>
                <option value="roi-asc">Target ROI: Low to High</option>
                <option value="min-asc">Min Amount: Low to High</option>
              </select>

              <div className="inline-flex border border-[#D6DAE2] bg-[#FCFBF8]">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    viewMode === 'grid' ? 'bg-[#0B172A] text-[#FCFBF8]' : 'text-[#4A5260] hover:text-[#0B172A]'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    viewMode === 'table' ? 'bg-[#0B172A] text-[#FCFBF8]' : 'text-[#4A5260] hover:text-[#0B172A]'
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  Schedule
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[460px] bg-[#EFECE3] border border-[#E5E8EE]" />
            ))}
          </div>
        ) : visibleOfferings.length === 0 ? (
          <div className="bg-white border border-[#E5E8EE] p-12 text-center space-y-3">
            <p className="text-sm text-[#4A5260]">
              No published share offerings match your current sector or search filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSectorFilter('All');
                setSearchQuery('');
              }}
              className="px-4 py-2 text-xs font-semibold border border-[#D6DAE2] text-[#0B172A] hover:bg-[#F9F7F2]"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {visibleOfferings.map((off, idx) => {
              const stats = getSubscriptionStats(off);
              const mediaSrc = getOfferingMedia(off, idx);
              return (
                <article
                  key={off.id}
                  className="bg-white border border-[#E5E8EE] flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Visual Tranche Cover */}
                    <div className="relative h-44 bg-[#0B172A] overflow-hidden border-b border-[#E5E8EE]">
                      <img
                        src={mediaSrc}
                        alt={`${off.title} — ${off.sector}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#060E1C]/85 via-[#060E1C]/25 to-transparent" />
                      <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between gap-2 text-xs text-[#FCFBF8]">
                        <span className="font-mono tracking-wide text-[#C9A968]">{off.reference_code}</span>
                        <span className="font-mono tabular-nums text-[#E5E8EE]">
                          {formatPlanDuration(
                            off.duration_months,
                            off.duration_days,
                            off.duration_hours,
                            off.duration_unit,
                            off.duration_value
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-3">
                      <div className="text-xs text-[#4A5260] font-medium">
                        {off.sector}
                        <span className="mx-2" aria-hidden="true">
                          ·
                        </span>
                        <span>{off.requires_kyc ? 'KYC Verified Investors' : 'Open Subscription'}</span>
                      </div>
                      <h2 className="font-serif text-2xl font-semibold text-[#0B172A] leading-snug">
                        {off.title}
                      </h2>
                      <p className="text-sm text-[#4A5260] leading-relaxed">{off.summary}</p>
                    </div>
                  </div>

                  <div className="px-6 pb-6 space-y-5">
                    {/* Structured Investment Terms Grid */}
                    <dl className="grid grid-cols-2 gap-4 pt-4 border-t border-[#E5E8EE] text-xs">
                      <div>
                        <dt className="text-[#4A5260]">Target ROI</dt>
                        <dd className="font-mono text-lg font-semibold text-[#146348] tabular-nums mt-0.5">
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
                        <dd className="font-mono text-lg font-semibold text-[#0B172A] tabular-nums mt-0.5">
                          {formatCurrency(stats.minAmount, off.currency)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#4A5260]">Max Amount</dt>
                        <dd className="font-mono text-lg font-semibold text-[#0B172A] tabular-nums mt-0.5">
                          {formatCurrency(stats.maxAmount, off.currency)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#4A5260]">Authorized Pool</dt>
                        <dd className="font-mono text-[#1C2026] tabular-nums mt-0.5">
                          {formatNumber(stats.authorized)} shares
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#4A5260]">Eligibility Gate</dt>
                        <dd className="font-medium text-[#1C2026] mt-0.5">
                          {off.requires_kyc ? 'KYC Required' : 'Open Access'}
                        </dd>
                      </div>
                    </dl>

                    {/* Live Allocation Capacity Bar */}
                    <div className="space-y-1.5 pt-2 border-t border-[#E5E8EE]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#4A5260]">Pool Availability</span>
                        <span className="font-mono font-semibold text-[#146348] tabular-nums">
                          {formatNumber(stats.available)} remaining ({100 - stats.pctSubscribed}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#EFECE3] overflow-hidden">
                        <div
                          className="h-full bg-[#B5924C]"
                          style={{ width: `${Math.max(stats.pctSubscribed, 0)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                      <Link
                        to={`/offerings/${off.slug}`}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] transition-colors whitespace-nowrap"
                      >
                        Review Term Sheet
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      {user?.accountType === 'investor' && (
                        <Link
                          to={`/portal/offerings?select=${off.id}`}
                          className="inline-flex items-center justify-center px-4 py-3 text-xs font-semibold border border-[#0B172A] text-[#0B172A] hover:bg-[#F9F7F2] transition-colors whitespace-nowrap"
                        >
                          Subscribe
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Institutional Term-Sheet Schedule Table */
          <div className="bg-white border border-[#E5E8EE] overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-[#E5E8EE] bg-[#FCFBF8] text-xs uppercase tracking-wider text-[#4A5260]">
                  <th className="py-3.5 px-5 font-semibold">Plan &amp; Reference</th>
                  <th className="py-3.5 px-4 font-semibold">Sector</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Target ROI</th>
                  <th className="py-3.5 px-4 font-semibold">Duration</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Min Amount</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Max Amount</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Remaining Pool</th>
                  <th className="py-3.5 px-5 font-semibold text-right">Term Sheet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E8EE] text-sm">
                {visibleOfferings.map((off) => {
                  const stats = getSubscriptionStats(off);
                  return (
                    <tr key={off.id} className="hover:bg-[#FCFBF8] transition-colors">
                      <td className="py-4 px-5">
                        <div className="font-mono text-xs text-[#997837]">{off.reference_code}</div>
                        <div className="font-serif text-lg font-semibold text-[#0B172A]">{off.title}</div>
                      </td>
                      <td className="py-4 px-4 text-xs text-[#4A5260]">{off.sector}</td>
                      <td className="py-4 px-4 text-right font-mono font-semibold text-[#146348] tabular-nums">
                        {formatRoi(off.roi_percent)}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-[#0B172A] tabular-nums">
                        {formatPlanDuration(
                          off.duration_months,
                          off.duration_days,
                          off.duration_hours,
                          off.duration_unit,
                          off.duration_value
                        )}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-[#1C2026] tabular-nums">
                        {formatCurrency(stats.minAmount, off.currency)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-[#1C2026] tabular-nums">
                        {formatCurrency(stats.maxAmount, off.currency)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-semibold text-[#146348] tabular-nums">
                        {formatNumber(stats.available)} / {formatNumber(stats.authorized)}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <Link
                          to={`/offerings/${off.slug}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] whitespace-nowrap"
                        >
                          Inspect
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Institutional Subscription Framework Strip */}
        <div className="bg-[#FCFBF8] border border-[#E5E8EE] p-7 sm:p-9 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E5E8EE] pb-5">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
                Allocation Governance
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#0B172A] mt-1">
                From Prospectus Review to Verified Share Registry
              </h2>
            </div>
            <div className="flex flex-wrap gap-5 text-xs font-semibold">
              <Link to="/corporate-governance" className="text-[#0B172A] underline underline-offset-4 hover:text-[#997837]">
                Corporate Governance
              </Link>
              <Link to="/investment-risk-disclosures" className="text-[#0B172A] underline underline-offset-4 hover:text-[#997837]">
                Investment Risk Disclosures
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1.5">
              <div className="font-mono text-xs text-[#997837] font-semibold">01. Account & KYC</div>
              <h3 className="font-serif text-lg font-semibold text-[#0B172A]">Compliance Onboarding</h3>
              <p className="text-xs text-[#4A5260] leading-relaxed">
                Register an investor account and submit identity and residential verification documents for compliance review.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="font-mono text-xs text-[#997837] font-semibold">02. Eligibility Check</div>
              <h3 className="font-serif text-lg font-semibold text-[#0B172A]">Subscription Request</h3>
              <p className="text-xs text-[#4A5260] leading-relaxed">
                Enter your investment amount within plan thresholds, verify eligibility, and submit your binding request.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="font-mono text-xs text-[#997837] font-semibold">03. Treasury Review</div>
              <h3 className="font-serif text-lg font-semibold text-[#0B172A]">Manual Payment Audit</h3>
              <p className="text-xs text-[#4A5260] leading-relaxed">
                Remit approved settlement via BTC, ETH, or USDT and upload transaction hash proof for manual treasury sign-off.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="font-mono text-xs text-[#997837] font-semibold">04. Share Ledger</div>
              <h3 className="font-serif text-lg font-semibold text-[#0B172A]">Formal Share Issuance</h3>
              <p className="text-xs text-[#4A5260] leading-relaxed">
                Shares are atomically allocated to your portfolio ledger with traceable accounting references and CSV statements.
              </p>
            </div>
          </div>
        </div>
      </section>
    </CorporateLayout>
  );
}

export function OfferingDetailPublicPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [offering, setOffering] = useState<ShareOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [calcAmount, setCalcAmount] = useState<number>(1000);

  useEffect(() => {
    apiRequest<{ offering: ShareOffering }>(`/api/public/offerings/${slug}`)
      .then((res) => {
        setOffering(res.offering);
        if (res.offering) {
          setCalcAmount(getPlanAmounts(res.offering).minAmount);
        }
      })
      .catch(() => setOffering(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const stats = offering ? getSubscriptionStats(offering) : null;

  return (
    <CorporateLayout>
      {loading ? (
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="h-64 bg-[#EFECE3] border border-[#E5E8EE]" />
        </div>
      ) : !offering || !stats ? (
        <div className="max-w-[1200px] mx-auto px-6 py-16 space-y-6">
          <Link to="/offerings" className="inline-flex items-center gap-2 text-xs font-semibold text-[#0B172A]">
            <ArrowLeft className="w-4 h-4" />
            Back to Share Offerings
          </Link>
          <div className="bg-white border border-[#E5E8EE] p-10 text-sm text-[#4A5260]">
            Offering not found or no longer published.
          </div>
        </div>
      ) : (
        <>
          {/* Dark Institutional Offering Masthead */}
          <section className="bg-[#0B172A] text-[#FCFBF8] border-b border-[#1E365C]">
            <div className="max-w-[1200px] mx-auto px-6 py-12 space-y-6">
              <Link
                to="/offerings"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#C9A968] hover:text-[#FCFBF8]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Share Offerings Register
              </Link>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
                <div className="lg:col-span-8 space-y-3">
                  <div className="text-xs font-mono text-[#C9A968]">
                    {offering.reference_code}
                    <span className="mx-2 text-[#8E99AA]" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[#E5E8EE]">{offering.sector}</span>
                  </div>
                  <h1 className="font-serif text-3xl sm:text-5xl font-semibold text-[#FCFBF8] leading-tight">
                    {offering.title}
                  </h1>
                  <p className="text-base text-[#C8D0DC] leading-relaxed max-w-2xl">{offering.summary}</p>
                </div>

                <div className="lg:col-span-4 bg-[#060E1C] border border-[#1E365C] p-5 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[#8E99AA]">Target ROI</div>
                  <div className="font-mono text-3xl font-semibold text-[#FCFBF8] tabular-nums">
                    {formatRoi(offering.roi_percent)}
                  </div>
                  <div className="text-xs text-[#C9A968] font-mono tabular-nums">
                    Min: {formatCurrency(stats.minAmount, offering.currency)} · Max:{' '}
                    {formatCurrency(stats.maxAmount, offering.currency)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-[#1E365C] text-xs">
                <div>
                  <div className="text-[#8E99AA] uppercase tracking-wider">Authorized Pool Value</div>
                  <div className="font-mono text-base font-semibold text-[#FCFBF8] tabular-nums mt-1">
                    {formatCurrency(stats.authorizedCapital, offering.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-[#8E99AA] uppercase tracking-wider">Remaining Pool</div>
                  <div className="font-mono text-base font-semibold text-[#C9A968] tabular-nums mt-1">
                    {formatNumber(stats.available)} / {formatNumber(stats.authorized)}
                  </div>
                </div>
                <div>
                  <div className="text-[#8E99AA] uppercase tracking-wider">Plan Duration</div>
                  <div className="font-mono text-sm text-[#FCFBF8] tabular-nums mt-1.5">
                    {formatPlanDuration(
                      offering.duration_months,
                      offering.duration_days,
                      offering.duration_hours,
                      offering.duration_unit,
                      offering.duration_value
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[#8E99AA] uppercase tracking-wider">Investor Gate</div>
                  <div className="text-sm font-medium text-[#FCFBF8] mt-1.5">
                    {offering.requires_kyc ? 'Approved KYC Required' : 'Standard Eligibility'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Term Sheet + Calculator Workspace */}
          <div className="max-w-[1200px] mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-8">
              {/* Investment Memorandum */}
              <div className="bg-white border border-[#E5E8EE] p-8 space-y-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
                  Investment Memorandum
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#0B172A]">
                  Offering Mandate & Structure
                </h2>
                <div className="text-sm text-[#4A5260] leading-relaxed whitespace-pre-line max-w-prose">
                  {offering.description}
                </div>
              </div>

              {/* Structured Offering Term Sheet */}
              <div className="bg-white border border-[#E5E8EE] p-8 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E8EE] pb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
                      Formal Specifications
                    </div>
                    <h2 className="font-serif text-2xl font-semibold text-[#0B172A] mt-1">
                      Offering Term Sheet
                    </h2>
                  </div>
                  <span className="font-mono text-xs text-[#4A5260]">{offering.reference_code}</span>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 divide-y sm:divide-y-0 text-xs">
                  <div className="py-3 border-b border-[#E5E8EE] flex justify-between gap-4">
                    <dt className="text-[#4A5260]">Target ROI</dt>
                    <dd className="font-mono font-semibold text-[#146348] tabular-nums text-right">
                      {formatRoi(offering.roi_percent)}
                    </dd>
                  </div>
                  <div className="py-3 border-b border-[#E5E8EE] flex justify-between gap-4">
                    <dt className="text-[#4A5260]">Plan Duration</dt>
                    <dd className="font-mono font-semibold text-[#0B172A] tabular-nums text-right">
                      {formatPlanDuration(
                        offering.duration_months,
                        offering.duration_days,
                        offering.duration_hours,
                        offering.duration_unit,
                        offering.duration_value
                      )}
                    </dd>
                  </div>
                  <div className="py-3 border-b border-[#E5E8EE] flex justify-between gap-4">
                    <dt className="text-[#4A5260]">Asset Sector</dt>
                    <dd className="font-semibold text-[#0B172A] text-right">{offering.sector}</dd>
                  </div>
                  <div className="py-3 border-b border-[#E5E8EE] flex justify-between gap-4">
                    <dt className="text-[#4A5260]">Denomination Currency</dt>
                    <dd className="font-mono font-semibold text-[#0B172A]">{offering.currency}</dd>
                  </div>
                  <div className="py-3 border-b border-[#E5E8EE] flex justify-between gap-4">
                    <dt className="text-[#4A5260]">Min Amount</dt>
                    <dd className="font-mono font-semibold text-[#0B172A] tabular-nums">
                      {formatCurrency(stats.minAmount, offering.currency)}
                    </dd>
                  </div>
                  <div className="py-3 border-b border-[#E5E8EE] flex justify-between gap-4">
                    <dt className="text-[#4A5260]">Max Amount</dt>
                    <dd className="font-mono font-semibold text-[#0B172A] tabular-nums">
                      {formatCurrency(stats.maxAmount, offering.currency)}
                    </dd>
                  </div>
                  <div className="py-3 border-b border-[#E5E8EE] flex justify-between gap-4">
                    <dt className="text-[#4A5260]">Total Authorized Pool</dt>
                    <dd className="font-mono text-[#1C2026] tabular-nums">
                      {formatNumber(stats.authorized)} shares
                    </dd>
                  </div>
                  <div className="py-3 border-b border-[#E5E8EE] flex justify-between gap-4">
                    <dt className="text-[#4A5260]">Settlement Verification</dt>
                    <dd className="font-medium text-[#0B172A]">Treasury Audit (BTC · ETH · USDT)</dd>
                  </div>
                </dl>

                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#4A5260]">Tranche Allocation Progress</span>
                    <span className="font-mono font-semibold text-[#146348] tabular-nums">
                      {formatNumber(stats.allocated)} allocated · {formatNumber(stats.available)} remaining
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#EFECE3] overflow-hidden">
                    <div
                      className="h-full bg-[#B5924C]"
                      style={{ width: `${Math.max(stats.pctSubscribed, 0)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Documentation */}
              <div className="bg-white border border-[#E5E8EE] p-8 space-y-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
                  Prospectus & Filings
                </div>
                <h2 className="font-serif text-2xl font-semibold text-[#0B172A]">Published Documentation</h2>
                {(offering.documents || []).length === 0 ? (
                  <p className="text-sm text-[#4A5260]">
                    Standard offering terms are incorporated in the memorandum above. Supplemental filings will appear here when published.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E5E8EE] border-t border-[#E5E8EE]">
                    {(offering.documents || []).map((doc) => (
                      <div key={doc.id} className="py-3.5 flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <FileText className="w-4 h-4 text-[#997837] mt-1 shrink-0" />
                          <div>
                            <div className="text-sm font-semibold text-[#0B172A]">{doc.title}</div>
                            <div className="text-xs text-[#4A5260]">
                              {doc.document_type}
                              {doc.summary_notes ? ` · ${doc.summary_notes}` : ''}
                            </div>
                          </div>
                        </div>
                        {doc.original_filename && (
                          <a
                            href={`/api/public/offerings/documents/${doc.id}`}
                            className="px-3.5 py-2 text-xs font-semibold border border-[#D6DAE2] text-[#0B172A] hover:bg-[#F9F7F2] whitespace-nowrap"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Risk Disclosures */}
              <div className="bg-[#FCFBF8] border border-[#E5E8EE] p-8 space-y-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Regulatory & Capital Risk Notice</span>
                </div>
                <h2 className="font-serif text-2xl font-semibold text-[#0B172A]">Risk Disclosures</h2>
                <p className="text-sm text-[#4A5260] leading-relaxed">{offering.risk_disclosures}</p>
              </div>
            </div>

            {/* Interactive Subscription Estimator Sidebar */}
            <aside className="lg:col-span-4 bg-white border border-[#E5E8EE] p-7 space-y-6 lg:sticky lg:top-24">
              <div className="space-y-1 border-b border-[#E5E8EE] pb-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">
                  Allocation Desk
                </div>
                <h2 className="font-serif text-2xl font-semibold text-[#0B172A]">Investment Calculator</h2>
              </div>

              <RoiCalculator
                offering={offering}
                amount={calcAmount}
                onAmountChange={setCalcAmount}
                variant="compact"
                showPlanHeader={false}
              />

              <div className="space-y-2.5 text-xs text-[#4A5260]">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#146348] shrink-0 mt-0.5" />
                  <span>Direct registry allocation verified by Compliance & Treasury.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#146348] shrink-0 mt-0.5" />
                  <span>Settlement via BTC, ETH, or USDT with auditable ledger receipts.</span>
                </div>
              </div>

              {user?.accountType === 'investor' ? (
                <Link
                  to={`/portal/offerings?select=${offering.id}`}
                  className="block w-full text-center px-5 py-3.5 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] transition-colors"
                >
                  Subscribe in Investor Portal
                </Link>
              ) : user?.accountType === 'admin' ? (
                <Link
                  to="/admin/offerings"
                  className="block w-full text-center px-5 py-3.5 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] transition-colors"
                >
                  Manage Tranche in Admin Portal
                </Link>
              ) : (
                <div className="space-y-2.5">
                  <Link
                    to="/register"
                    className="block w-full text-center px-5 py-3.5 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] transition-colors"
                  >
                    Open Investor Account to Subscribe
                  </Link>
                  <Link
                    to="/login"
                    className="block w-full text-center px-5 py-3 text-xs font-semibold border border-[#D6DAE2] text-[#0B172A] hover:bg-[#F9F7F2] transition-colors"
                  >
                    Existing Investor Sign In
                  </Link>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </CorporateLayout>
  );
}
