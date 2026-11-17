import { useEffect, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { INVESTOR_NAV } from './InvestorDashboardPage';
import { apiDownload, apiRequest } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../lib/format';

export function InvestorPortfolioPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    apiRequest('/api/investor/portfolio')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const handleDownloadPdf = async () => {
    setDownloadError('');
    setDownloadingPdf(true);
    try {
      await apiDownload('/api/investor/portfolio/statement-pdf', 'RICHMOND-INV-Portfolio-Statement.pdf');
    } catch (err: any) {
      setDownloadError(err?.message || 'Unable to generate PDF statement.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadCsv = async () => {
    setDownloadError('');
    setDownloadingCsv(true);
    try {
      await apiDownload('/api/investor/portfolio/export-csv', 'richmond-inv-portfolio-ledger.csv');
    } catch (err: any) {
      setDownloadError(err?.message || 'Unable to export CSV ledger.');
    } finally {
      setDownloadingCsv(false);
    }
  };

  const holdings = data?.holdings || [];
  const dividends = data?.dividends || [];
  const totalInvested = holdings.reduce((sum: number, h: any) => sum + Number(h.total_invested_amount || 0), 0);
  const portfolioValuation = holdings.reduce((sum: number, h: any) => {
    if (h.current_unit_valuation !== null && h.current_unit_valuation !== undefined) {
      return sum + Number(h.total_shares || 0) * Number(h.current_unit_valuation);
    }
    return sum + Number(h.total_invested_amount || 0);
  }, 0);
  const netReturn = portfolioValuation - totalInvested;
  const netReturnPct = totalInvested > 0 ? (netReturn / totalInvested) * 100 : 0;
  const dividendsEarned = dividends
    .filter((d: any) => d.status === 'distributed')
    .reduce((sum: number, d: any) => sum + Number(d.gross_amount || 0), 0);

  return (
    <PortalShell
      portalTitle="Investor Portal"
      breadcrumbLabel="Portfolio & Statements"
      navItems={INVESTOR_NAV}
      variant="investor"
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">Shareholder Portfolio & Statements</h1>
            <p className="text-sm text-[#4A5260] mt-1">
              Audited shareholding ledger, acquisition cost basis, and authorized dividend records.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 no-print">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={loading || downloadingPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5 text-[#C9A968]" />
              <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF Statement'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={loading || downloadingCsv}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border border-[#D6DAE2] bg-white text-[#0B172A] hover:bg-[#F9F7F2] cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadingCsv ? 'Exporting CSV...' : 'Export CSV Ledger'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border border-[#D6DAE2] bg-white text-[#0B172A] hover:bg-[#F9F7F2] cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Statement</span>
            </button>
          </div>
        </div>

        {downloadError && (
          <div className="p-3.5 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B] no-print">
            {downloadError}
          </div>
        )}

        {loading ? (
          <div className="h-48 bg-[#EFECE3]" />
        ) : (
          <>
            {/* Statement Header for Print */}
            <div className="bg-white border border-[#E5E8EE] p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-[#4A5260]">Shareholder</div>
                <div className="font-semibold text-[#0B172A] mt-0.5">
                  {data?.profile?.first_name} {data?.profile?.last_name}
                </div>
              </div>
              <div>
                <div className="text-[#4A5260]">Investor Account Number</div>
                <div className="font-mono font-semibold text-[#0B172A] mt-0.5">{data?.profile?.account_number}</div>
              </div>
              <div>
                <div className="text-[#4A5260]">Statement Generated</div>
                <div className="font-mono mt-0.5">{formatDateTime(new Date())}</div>
              </div>
            </div>

            {/* Portfolio Performance Summary Strip */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              <div className="bg-white border border-[#E5E8EE] p-6">
                <div className="text-xs uppercase tracking-wider text-[#4A5260]">Total Invested</div>
                <div className="font-mono text-2xl font-semibold text-[#0B172A] tabular-nums mt-2">
                  {formatCurrency(totalInvested)}
                </div>
                <div className="text-xs text-[#4A5260] mt-1">Verified acquisition cost basis</div>
              </div>

              <div className="bg-white border border-[#E5E8EE] p-6">
                <div className="text-xs uppercase tracking-wider text-[#4A5260]">Portfolio Valuation</div>
                <div className="font-mono text-2xl font-semibold text-[#0B172A] tabular-nums mt-2">
                  {formatCurrency(portfolioValuation)}
                </div>
                <div className="text-xs text-[#4A5260] mt-1">Current authorized carrying value</div>
              </div>

              <div className="bg-white border border-[#E5E8EE] p-6">
                <div className="text-xs uppercase tracking-wider text-[#4A5260]">Net Return</div>
                <div
                  className={`font-mono text-2xl font-semibold tabular-nums mt-2 ${
                    netReturn < 0 ? 'text-[#991B1B]' : 'text-[#146348]'
                  }`}
                >
                  {netReturn >= 0 ? '+' : ''}
                  {formatCurrency(netReturn)}
                </div>
                <div className="text-xs font-mono tabular-nums text-[#4A5260] mt-1">
                  {netReturn >= 0 ? '+' : ''}
                  {netReturnPct.toFixed(2)}% unrealized variance
                </div>
              </div>

              <div className="bg-white border border-[#E5E8EE] p-6">
                <div className="text-xs uppercase tracking-wider text-[#4A5260]">Dividends Earned</div>
                <div className="font-mono text-2xl font-semibold text-[#146348] tabular-nums mt-2">
                  {formatCurrency(dividendsEarned)}
                </div>
                <div className="text-xs text-[#4A5260] mt-1">Distributed shareholder payouts</div>
              </div>
            </section>

            {/* Holdings */}
            <section className="bg-white border border-[#E5E8EE] p-6 space-y-4">
              <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Verified Shareholdings</h2>
              {(data?.holdings || []).length === 0 ? (
                <p className="text-sm text-[#4A5260]">
                  No shares allocated yet. Completed investments appear here after treasury verification.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E5E8EE] text-[#4A5260]">
                      <tr>
                        <th className="py-2.5 pr-4">Offering</th>
                        <th className="py-2.5 pr-4 text-right">Shares Held</th>
                        <th className="py-2.5 pr-4 text-right">Avg Acquisition Price</th>
                        <th className="py-2.5 pr-4 text-right">Total Invested</th>
                        <th className="py-2.5 text-right">Authorized Valuation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E8EE]">
                      {data.holdings.map((h: any) => {
                        const valuation =
                          h.current_unit_valuation !== null
                            ? Number(h.total_shares) * Number(h.current_unit_valuation)
                            : null;
                        return (
                          <tr key={h.id}>
                            <td className="py-3 pr-4">
                              <div className="font-semibold text-[#0B172A]">{h.offering_title}</div>
                              <div className="font-mono text-[11px] text-[#4A5260]">{h.offering_reference}</div>
                            </td>
                            <td className="py-3 pr-4 text-right font-mono tabular-nums">
                              {formatNumber(h.total_shares)}
                            </td>
                            <td className="py-3 pr-4 text-right font-mono tabular-nums">
                              {formatCurrency(h.average_acquisition_price, h.currency)}
                            </td>
                            <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold">
                              {formatCurrency(h.total_invested_amount, h.currency)}
                            </td>
                            <td className="py-3 text-right font-mono tabular-nums text-[#146348]">
                              {valuation !== null ? formatCurrency(valuation, h.currency) : 'Cost basis only'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Dividends */}
            <section className="bg-white border border-[#E5E8EE] p-6 space-y-4">
              <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Dividend Records</h2>
              {(data?.dividends || []).length === 0 ? (
                <p className="text-sm text-[#4A5260]">No dividend distributions recorded for this account.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E5E8EE] text-[#4A5260]">
                      <tr>
                        <th className="py-2.5 pr-4">Reference</th>
                        <th className="py-2.5 pr-4">Offering & Period</th>
                        <th className="py-2.5 pr-4 text-right">Eligible Shares</th>
                        <th className="py-2.5 pr-4 text-right">Rate/Share</th>
                        <th className="py-2.5 pr-4 text-right">Gross Amount</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E8EE]">
                      {data.dividends.map((d: any) => (
                        <tr key={d.id}>
                          <td className="py-3 pr-4 font-mono">{d.dividend_reference}</td>
                          <td className="py-3 pr-4">
                            {d.offering_title} · {d.period_label}
                          </td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums">
                            {formatNumber(d.shares_eligible)}
                          </td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums">
                            {formatCurrency(d.rate_per_share, d.currency)}
                          </td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-[#146348]">
                            {formatCurrency(d.gross_amount, d.currency)}
                          </td>
                          <td className="py-3">
                            <StatusBadge status={d.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Transaction Ledger */}
            <section className="bg-white border border-[#E5E8EE] p-6 space-y-4">
              <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Portfolio Transaction Ledger</h2>
              {(data?.transactions || []).length === 0 ? (
                <p className="text-sm text-[#4A5260]">No portfolio transactions recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E5E8EE] text-[#4A5260]">
                      <tr>
                        <th className="py-2.5 pr-4">Date</th>
                        <th className="py-2.5 pr-4">Reference</th>
                        <th className="py-2.5 pr-4">Description</th>
                        <th className="py-2.5 pr-4 text-right">Quantity</th>
                        <th className="py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E8EE]">
                      {data.transactions.map((tx: any) => (
                        <tr key={tx.id}>
                          <td className="py-3 pr-4 font-mono tabular-nums">{formatDate(tx.occurred_at)}</td>
                          <td className="py-3 pr-4 font-mono">{tx.transaction_reference}</td>
                          <td className="py-3 pr-4">{tx.description}</td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatNumber(tx.quantity)}</td>
                          <td className="py-3 text-right font-mono tabular-nums font-semibold">
                            {formatCurrency(tx.amount, tx.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PortalShell>
  );
}
