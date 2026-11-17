import type { Knex } from 'knex';

export interface WithdrawableSummary {
  totalInvestedCapital: number;
  portfolioValuation: number | null;
  effectivePortfolioValue: number;
  totalDividendsDistributed: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
  availableBalance: number;
}

export async function computeInvestorWithdrawableSummary(
  db: Knex | Knex.Transaction,
  userId: number
): Promise<WithdrawableSummary> {
  const [portfolios, dividends, withdrawals] = await Promise.all([
    db('investor_portfolios').where({ user_id: userId }),
    db('dividend_records').where({ user_id: userId, status: 'distributed' }),
    db('withdrawal_requests').where({ user_id: userId }),
  ]);

  const totalInvestedCapital = portfolios.reduce(
    (sum: number, p: any) => sum + Number(p.total_invested_amount || 0),
    0
  );
  const hasExplicitValuations = portfolios.some((p: any) => p.current_unit_valuation !== null);
  const portfolioValuation = hasExplicitValuations
    ? portfolios.reduce(
        (sum: number, p: any) =>
          sum +
          Number(p.total_shares || 0) *
            Number(p.current_unit_valuation !== null ? p.current_unit_valuation : p.average_acquisition_price || 0),
        0
      )
    : null;

  const effectivePortfolioValue = portfolioValuation !== null ? portfolioValuation : totalInvestedCapital;
  const totalDividendsDistributed = dividends.reduce(
    (sum: number, d: any) => sum + Number(d.gross_amount || 0),
    0
  );

  const totalWithdrawn = withdrawals
    .filter((w: any) => ['approved', 'completed'].includes(w.status))
    .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);

  const pendingWithdrawals = withdrawals
    .filter((w: any) => w.status === 'pending')
    .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);

  const grossWithdrawablePool = effectivePortfolioValue + totalDividendsDistributed;
  const availableBalance = Math.max(
    0,
    Number((grossWithdrawablePool - totalWithdrawn - pendingWithdrawals).toFixed(2))
  );

  return {
    totalInvestedCapital: Number(totalInvestedCapital.toFixed(2)),
    portfolioValuation: portfolioValuation !== null ? Number(portfolioValuation.toFixed(2)) : null,
    effectivePortfolioValue: Number(effectivePortfolioValue.toFixed(2)),
    totalDividendsDistributed: Number(totalDividendsDistributed.toFixed(2)),
    totalWithdrawn: Number(totalWithdrawn.toFixed(2)),
    pendingWithdrawals: Number(pendingWithdrawals.toFixed(2)),
    availableBalance,
  };
}
