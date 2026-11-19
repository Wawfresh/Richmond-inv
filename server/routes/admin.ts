import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/connection.ts';
import { generateOpaqueToken, generateReference, hashPassword, sha256 } from '../lib/crypto.ts';
import {
  evaluateAutomaticCryptoVerification,
  executeShareAllocationTx,
  getCryptoProcessingSettings,
} from '../lib/cryptoPayments.ts';
import { writeAuditLog } from '../lib/audit.ts';
import { createNotification } from '../lib/notifications.ts';
import { computeInvestorWithdrawableSummary } from '../lib/withdrawals.ts';
import { createPrivateUploader, resolveSafeStoragePath } from '../lib/uploads.ts';
import { requireAdmin, SESSION_COOKIE_NAME } from '../middleware/auth.ts';
import { setSessionCookie } from './auth.ts';

export const adminRouter = Router();
adminRouter.use(requireAdmin());

const offeringDocUploader = createPrivateUploader('offerings');

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    );
  }
  return lines.join('\n');
}

adminRouter.get('/dashboard', async (_req, res, next) => {
  try {
    const db = getDb();

    const [
      totalInvestors,
      activeInvestors,
      suspendedAccounts,
      pendingKyc,
      approvedKyc,
      activeOfferings,
      pendingRequests,
      pendingPayments,
      pendingDepositsSum,
      approvedOrCompletedInvestments,
      rejectedInvestments,
      allocatedCapital,
      dividendsTotal,
      declaredDividends,
      offeringsRows,
      portfolioRows,
      distributedDividendsByHolding,
      recentTransactions,
      recentPayments,
      recentKyc,
      recentDividends,
      recentAuditLogs,
      pendingWithdrawalsCount,
      pendingWithdrawalsTotal,
      completedWithdrawalsSum,
      recentWithdrawals,
    ] = await Promise.all([
      db('users').where({ account_type: 'investor' }).count('id as count').first(),
      db('users').where({ account_type: 'investor', account_status: 'active' }).count('id as count').first(),
      db('users').where({ account_type: 'investor', account_status: 'suspended' }).count('id as count').first(),
      db('kyc_submissions').whereIn('status', ['submitted', 'under_review', 'additional_info_required']).count('id as count').first(),
      db('investor_profiles').where({ kyc_status: 'approved' }).count('id as count').first(),
      db('share_offerings').where({ status: 'published' }).count('id as count').first(),
      db('investment_requests').whereIn('status', ['submitted', 'under_review', 'awaiting_payment', 'payment_submitted', 'payment_verification_pending']).count('id as count').first(),
      db('payment_submissions').whereIn('status', ['submitted', 'verification_pending', 'additional_evidence_required']).count('id as count').first(),
      db('payment_submissions').whereIn('status', ['submitted', 'verification_pending', 'additional_evidence_required']).sum('submitted_amount as total').first(),
      db('investment_requests').whereIn('status', ['approved', 'completed']).count('id as count').first(),
      db('investment_requests').where({ status: 'rejected' }).count('id as count').first(),
      db('share_allocations').sum('total_cost as total').first(),
      db('dividend_records').where({ status: 'distributed' }).sum('gross_amount as total').first(),
      db('dividend_records').where({ status: 'declared' }).sum('gross_amount as total').first(),
      db('share_offerings')
        .orderBy('created_at', 'desc')
        .select(
          'id',
          'reference_code',
          'title',
          'sector',
          'currency',
          'share_price',
          'roi_percent',
          'duration_unit',
          'duration_value',
          'duration_months',
          'duration_days',
          'duration_hours',
          'min_amount',
          'max_amount',
          'min_quantity',
          'max_quantity',
          'total_authorized_quantity',
          'available_quantity',
          'status'
        ),
      db('investor_portfolios')
        .join('share_offerings', 'investor_portfolios.offering_id', 'share_offerings.id')
        .join('investor_profiles', 'investor_portfolios.user_id', 'investor_profiles.user_id')
        .orderBy('investor_portfolios.updated_at', 'desc')
        .select(
          'investor_portfolios.id',
          'investor_portfolios.user_id',
          'investor_portfolios.offering_id',
          'investor_portfolios.total_shares',
          'investor_portfolios.average_acquisition_price',
          'investor_portfolios.current_unit_valuation',
          'investor_portfolios.total_invested_amount',
          'investor_portfolios.currency',
          'investor_portfolios.updated_at',
          'share_offerings.reference_code as offering_reference',
          'share_offerings.title as offering_title',
          'share_offerings.sector as offering_sector',
          'share_offerings.total_authorized_quantity',
          'investor_profiles.account_number',
          'investor_profiles.first_name',
          'investor_profiles.last_name'
        ),
      db('dividend_records')
        .where({ status: 'distributed' })
        .groupBy('user_id', 'offering_id')
        .select('user_id', 'offering_id')
        .sum('gross_amount as total'),
      db('portfolio_transactions')
        .join('investor_profiles', 'portfolio_transactions.user_id', 'investor_profiles.user_id')
        .leftJoin('share_offerings', 'portfolio_transactions.offering_id', 'share_offerings.id')
        .orderBy('portfolio_transactions.occurred_at', 'desc')
        .limit(10)
        .select(
          'portfolio_transactions.id',
          'portfolio_transactions.transaction_reference',
          'portfolio_transactions.transaction_type',
          'portfolio_transactions.quantity',
          'portfolio_transactions.unit_price',
          'portfolio_transactions.amount',
          'portfolio_transactions.currency',
          'portfolio_transactions.accounting_reference',
          'portfolio_transactions.description',
          'portfolio_transactions.occurred_at',
          'investor_profiles.account_number',
          'investor_profiles.first_name',
          'investor_profiles.last_name',
          'share_offerings.title as offering_title'
        ),
      db('payment_submissions')
        .join('investment_requests', 'payment_submissions.investment_request_id', 'investment_requests.id')
        .join('payment_methods', 'payment_submissions.payment_method_id', 'payment_methods.id')
        .join('investor_profiles', 'payment_submissions.user_id', 'investor_profiles.user_id')
        .orderBy('payment_submissions.created_at', 'desc')
        .limit(6)
        .select(
          'payment_submissions.id',
          'payment_submissions.payment_reference',
          'payment_submissions.submitted_amount',
          'payment_submissions.expected_amount',
          'payment_submissions.currency',
          'payment_submissions.status',
          'payment_submissions.created_at',
          'investment_requests.request_reference',
          'payment_methods.code as payment_method_code',
          'investor_profiles.account_number',
          'investor_profiles.first_name',
          'investor_profiles.last_name'
        ),
      db('kyc_submissions')
        .join('investor_profiles', 'kyc_submissions.user_id', 'investor_profiles.user_id')
        .orderBy('kyc_submissions.created_at', 'desc')
        .limit(5)
        .select(
          'kyc_submissions.id',
          'kyc_submissions.submission_reference',
          'kyc_submissions.document_type',
          'kyc_submissions.issuing_country',
          'kyc_submissions.status',
          'kyc_submissions.created_at',
          'investor_profiles.account_number',
          'investor_profiles.first_name',
          'investor_profiles.last_name'
        ),
      db('dividend_records')
        .join('investor_profiles', 'dividend_records.user_id', 'investor_profiles.user_id')
        .join('share_offerings', 'dividend_records.offering_id', 'share_offerings.id')
        .orderBy('dividend_records.declared_at', 'desc')
        .limit(5)
        .select(
          'dividend_records.id',
          'dividend_records.dividend_reference',
          'dividend_records.period_label',
          'dividend_records.gross_amount',
          'dividend_records.currency',
          'dividend_records.status',
          'dividend_records.declared_at',
          'investor_profiles.account_number',
          'share_offerings.title as offering_title'
        ),
      db('admin_audit_logs')
        .leftJoin('users', 'admin_audit_logs.actor_user_id', 'users.id')
        .orderBy('admin_audit_logs.created_at', 'desc')
        .limit(12)
        .select('admin_audit_logs.*', 'users.email as actor_email'),
      db('withdrawal_requests').whereIn('status', ['pending', 'approved']).count('id as count').first(),
      db('withdrawal_requests').whereIn('status', ['pending', 'approved']).sum('amount as total').first(),
      db('withdrawal_requests').whereIn('status', ['approved', 'completed']).sum('amount as total').first(),
      db('withdrawal_requests')
        .join('investor_profiles', 'withdrawal_requests.user_id', 'investor_profiles.user_id')
        .join('users', 'withdrawal_requests.user_id', 'users.id')
        .orderBy('withdrawal_requests.created_at', 'desc')
        .limit(6)
        .select(
          'withdrawal_requests.*',
          'users.email as investor_email',
          'investor_profiles.account_number',
          'investor_profiles.first_name',
          'investor_profiles.last_name'
        ),
    ]);

    const dividendsMap = new Map<string, number>();
    for (const row of distributedDividendsByHolding as any[]) {
      dividendsMap.set(`${row.user_id}:${row.offering_id}`, Number(row.total || 0));
    }

    const publishedOfferings = offeringsRows.filter((o: any) => o.status === 'published');
    const totalAuthorizedReserveCapital = publishedOfferings.reduce(
      (sum: number, o: any) => sum + Number(o.total_authorized_quantity || 0) * Number(o.share_price || 0),
      0
    );
    const totalPortfolioCapital = portfolioRows.reduce(
      (sum: number, p: any) => sum + Number(p.total_invested_amount || 0),
      0
    );
    const totalAllocatedCapital = totalPortfolioCapital > 0 ? totalPortfolioCapital : 0;
    const availableReserveCapital = Math.max(0, totalAuthorizedReserveCapital - totalAllocatedCapital);
    const totalAllocatedShares = portfolioRows.reduce((sum: number, p: any) => sum + Number(p.total_shares || 0), 0);
    const totalPortfolioValuation = portfolioRows.reduce(
      (sum: number, p: any) =>
        sum +
        Number(p.total_shares || 0) *
          Number(p.current_unit_valuation !== null ? p.current_unit_valuation : p.average_acquisition_price || 0),
      0
    );
    const totalDividendsDistributed = Number(dividendsTotal?.total || 0);
    const totalWithdrawn = Number(completedWithdrawalsSum?.total || 0);
    const availablePlatformBalance = Math.max(
      0,
      Number((totalAllocatedCapital + totalDividendsDistributed - totalWithdrawn).toFixed(2))
    );

    const activePortfolios = (portfolioRows as any[])
      .filter((p) => Number(p.total_shares || 0) > 0)
      .map((p) => {
        const unitValuation = Number(
          p.current_unit_valuation !== null && p.current_unit_valuation !== undefined
            ? p.current_unit_valuation
            : p.average_acquisition_price || 0
        );
        const totalShares = Number(p.total_shares || 0);
        const currentValue = totalShares * unitValuation;
        const dividendsEarned = dividendsMap.get(`${p.user_id}:${p.offering_id}`) || 0;
        const authorizedShares = Number(p.total_authorized_quantity || 0);
        const sharePoolPct = authorizedShares > 0 ? Math.min(100, (totalShares / authorizedShares) * 100) : 0;
        return {
          ...p,
          total_shares: totalShares,
          total_invested_amount: Number(p.total_invested_amount || 0),
          unit_valuation: unitValuation,
          current_value: currentValue,
          dividends_earned: dividendsEarned,
          share_pool_pct: Number(sharePoolPct.toFixed(2)),
        };
      });

    res.json({
      metrics: {
        totalInvestors: Number(totalInvestors?.count || 0),
        activeInvestors: Number(activeInvestors?.count || 0),
        suspendedAccounts: Number(suspendedAccounts?.count || 0),
        pendingKycSubmissions: Number(pendingKyc?.count || 0),
        approvedKycAccounts: Number(approvedKyc?.count || 0),
        activeShareOfferings: Number(activeOfferings?.count || 0),
        pendingInvestmentRequests: Number(pendingRequests?.count || 0),
        pendingCryptoPayments: Number(pendingPayments?.count || 0),
        pendingDepositsTotal: Number(pendingDepositsSum?.total || 0),
        approvedInvestments: Number(approvedOrCompletedInvestments?.count || 0),
        rejectedInvestments: Number(rejectedInvestments?.count || 0),
        totalAllocatedCapital,
        availableReserveCapital,
        availablePlatformBalance,
        totalWithdrawn,
        totalDividendsDistributed,
        declaredDividendsPending: Number(declaredDividends?.total || 0),
        totalAuthorizedReserveCapital,
        totalAllocatedShares,
        totalPortfolioValuation,
        activePortfoliosCount: activePortfolios.length,
        pendingWithdrawalsCount: Number(pendingWithdrawalsCount?.count || 0),
        pendingWithdrawalsTotal: Number(pendingWithdrawalsTotal?.total || 0),
      },
      activePortfolios,
      recentTransactions,
      offeringsSummary: offeringsRows,
      recentPayments,
      recentKyc,
      recentDividends,
      recentWithdrawals,
      recentAuditLogs,
    });
  } catch (err) {
    next(err);
  }
});

// A. INVESTOR MANAGEMENT
adminRouter.get('/investors', requireAdmin('investors.view'), async (req, res, next) => {
  try {
    const db = getDb();
    const search = String(req.query.search || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim();
    const kyc = String(req.query.kyc || '').trim();

    let query = db('users')
      .join('investor_profiles', 'users.id', 'investor_profiles.user_id')
      .where('users.account_type', 'investor')
      .orderBy('users.created_at', 'desc')
      .select(
        'users.id',
        'users.email',
        'users.account_status',
        'users.last_login_at',
        'users.created_at',
        'investor_profiles.account_number',
        'investor_profiles.first_name',
        'investor_profiles.middle_name',
        'investor_profiles.last_name',
        'investor_profiles.telephone',
        'investor_profiles.country_of_residence',
        'investor_profiles.kyc_status'
      );

    if (status) query = query.where('users.account_status', status);
    if (kyc) query = query.where('investor_profiles.kyc_status', kyc);

    const rows = await query;
    const filtered = search
      ? rows.filter((r: any) =>
          `${r.email} ${r.account_number} ${r.first_name} ${r.last_name} ${r.country_of_residence}`
            .toLowerCase()
            .includes(search)
        )
      : rows;

    res.json({ investors: filtered });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/investors/:id', requireAdmin('investors.view'), async (req, res, next) => {
  try {
    const db = getDb();
    const userId = Number(req.params.id);
    const user = await db('users').where({ id: userId, account_type: 'investor' }).select('id', 'email', 'account_status', 'last_login_at', 'created_at').first();
    if (!user) {
      res.status(404).json({ error: 'Investor not found.' });
      return;
    }
    const profile = await db('investor_profiles').where({ user_id: userId }).first();
    const kycSubmissions = await db('kyc_submissions').where({ user_id: userId }).orderBy('created_at', 'desc');
    const investmentRequests = await db('investment_requests')
      .join('share_offerings', 'investment_requests.offering_id', 'share_offerings.id')
      .where('investment_requests.user_id', userId)
      .orderBy('investment_requests.created_at', 'desc')
      .select('investment_requests.*', 'share_offerings.title as offering_title');
    const holdings = await db('investor_portfolios')
      .join('share_offerings', 'investor_portfolios.offering_id', 'share_offerings.id')
      .where('investor_portfolios.user_id', userId)
      .select('investor_portfolios.*', 'share_offerings.title as offering_title');
    const changeRequests = await db('profile_change_requests').where({ user_id: userId }).orderBy('created_at', 'desc');

    res.json({ user, profile, kycSubmissions, investmentRequests, holdings, changeRequests });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/investors/:id/status', requireAdmin('investors.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(['active', 'suspended']),
      reason: z.string().trim().min(3).max(500),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid status update.' });
      return;
    }

    const db = getDb();
    const userId = Number(req.params.id);
    const user = await db('users').where({ id: userId, account_type: 'investor' }).first();
    if (!user) {
      res.status(404).json({ error: 'Investor not found.' });
      return;
    }

    await db.transaction(async (trx) => {
      await trx('users').where({ id: userId }).update({
        account_status: parsed.data.status,
        updated_at: new Date(),
      });
      if (parsed.data.status === 'suspended') {
        await trx('user_sessions').where({ user_id: userId }).whereNull('revoked_at').update({ revoked_at: new Date() });
      }
    });

    await createNotification({
      userId,
      category: 'account_status',
      title: parsed.data.status === 'suspended' ? 'Account Suspended' : 'Account Reactivated',
      message: `Your account status was updated to ${parsed.data.status}. Note: ${parsed.data.reason}`,
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: `investor.status_${parsed.data.status}`,
      entityType: 'user',
      entityId: userId,
      previousData: { account_status: user.account_status },
      newData: { account_status: parsed.data.status, reason: parsed.data.reason },
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/investors/:id', requireAdmin('investors.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      firstName: z.string().trim().min(1, 'First name is required.').max(100),
      middleName: z.string().trim().max(100).optional().default(''),
      lastName: z.string().trim().min(1, 'Last name is required.').max(100),
      email: z.string().trim().email('Valid email address is required.').max(191),
      telephone: z.string().trim().min(4, 'Telephone number is required.').max(40),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD.'),
      countryOfResidence: z.string().trim().min(2, 'Country of residence is required.').max(100),
      residentialAddress: z.string().trim().min(2, 'Residential address is required.').max(255),
      city: z.string().trim().min(1, 'City is required.').max(100),
      stateRegion: z.string().trim().min(1, 'State or region is required.').max(100),
      postalCode: z.string().trim().min(1, 'Postal code is required.').max(40),
      kycStatus: z.enum([
        'not_submitted',
        'submitted',
        'under_review',
        'additional_info_required',
        'approved',
        'rejected',
      ]),
      accountStatus: z.enum(['active', 'suspended']),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid investor details.' });
      return;
    }

    const dob = new Date(parsed.data.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      res.status(400).json({ error: 'Invalid date of birth.' });
      return;
    }

    const db = getDb();
    const userId = Number(req.params.id);
    const existingUser = await db('users').where({ id: userId, account_type: 'investor' }).first();
    const existingProfile = await db('investor_profiles').where({ user_id: userId }).first();
    if (!existingUser || !existingProfile) {
      res.status(404).json({ error: 'Investor not found.' });
      return;
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const emailConflict = await db('users')
      .where('email', normalizedEmail)
      .whereNot('id', userId)
      .first();
    if (emailConflict) {
      res.status(409).json({ error: 'Another account is already registered with this email address.' });
      return;
    }

    const nextKycStatus = existingProfile.kyc_status === 'approved' ? 'approved' : parsed.data.kycStatus;
    const now = new Date();
    await db.transaction(async (trx) => {
      await trx('users').where({ id: userId }).update({
        email: normalizedEmail,
        account_status: parsed.data.accountStatus,
        updated_at: now,
      });

      if (parsed.data.accountStatus === 'suspended') {
        await trx('user_sessions')
          .where({ user_id: userId })
          .whereNull('revoked_at')
          .update({ revoked_at: now });
      }

      await trx('investor_profiles').where({ user_id: userId }).update({
        first_name: parsed.data.firstName,
        middle_name: parsed.data.middleName || null,
        last_name: parsed.data.lastName,
        telephone: parsed.data.telephone,
        date_of_birth: parsed.data.dateOfBirth,
        country_of_residence: parsed.data.countryOfResidence,
        residential_address: parsed.data.residentialAddress,
        city: parsed.data.city,
        state_region: parsed.data.stateRegion,
        postal_code: parsed.data.postalCode,
        kyc_status: nextKycStatus,
        updated_at: now,
      });
    });

    await createNotification({
      userId,
      category: 'account_changes',
      title: 'Investor Profile Updated by Administration',
      message: 'Your investor profile or account status was updated by Compliance Administration.',
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'investor.admin_updated',
      entityType: 'user',
      entityId: userId,
      previousData: {
        email: existingUser.email,
        account_status: existingUser.account_status,
        first_name: existingProfile.first_name,
        last_name: existingProfile.last_name,
        kyc_status: existingProfile.kyc_status,
      },
      newData: {
        email: normalizedEmail,
        account_status: parsed.data.accountStatus,
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        kyc_status: nextKycStatus,
      },
      req,
    });

    const updatedUser = await db('users')
      .where({ id: userId })
      .select('id', 'email', 'account_status', 'last_login_at', 'created_at')
      .first();
    const updatedProfile = await db('investor_profiles').where({ user_id: userId }).first();

    res.json({ ok: true, user: updatedUser, profile: updatedProfile });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/investors/:id/access-dashboard', requireAdmin('investors.manage'), async (req, res, next) => {
  try {
    const db = getDb();
    const userId = Number(req.params.id);

    const investor = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where({ 'users.id': userId, 'users.account_type': 'investor' })
      .select('users.*', 'roles.slug as role_slug', 'roles.name as role_name')
      .first();

    if (!investor) {
      res.status(404).json({ error: 'Investor not found.' });
      return;
    }

    if (investor.account_status !== 'active') {
      res.status(400).json({ error: 'Suspended investor accounts cannot be accessed. Reactivate the account first.' });
      return;
    }

    const profile = await db('investor_profiles').where({ user_id: userId }).first();
    if (!profile) {
      res.status(404).json({ error: 'Investor profile record not found.' });
      return;
    }

    const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;
    const currentAdminRawToken =
      typeof cookieToken === 'string' && cookieToken.length > 0 ? cookieToken : bearerToken;

    if (!currentAdminRawToken) {
      res.status(400).json({ error: 'Unable to capture active administrator session token for return navigation.' });
      return;
    }

    const rawToken = generateOpaqueToken(32);
    const csrfToken = generateOpaqueToken(24);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 2); // 2-hour delegated access session

    await db('user_sessions').insert({
      user_id: investor.id,
      token_hash: sha256(rawToken),
      csrf_token: csrfToken,
      ip_address: req.ip || null,
      user_agent: `admin-delegated:${req.authUser!.id}`,
      expires_at: expiresAt,
    });

    const permRows = await db('role_permissions')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .where('role_permissions.role_id', investor.role_id)
      .select('permissions.key');

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'admin.investor_dashboard_accessed',
      entityType: 'user',
      entityId: investor.id,
      newData: {
        account_number: profile.account_number,
        email: investor.email,
      },
      req,
    });

    setSessionCookie(req, res, rawToken, expiresAt);
    res.json({
      ok: true,
      sessionToken: rawToken,
      csrfToken,
      returnAdminSessionToken: currentAdminRawToken,
      user: {
        id: investor.id,
        email: investor.email,
        accountType: investor.account_type,
        accountStatus: investor.account_status,
        roleSlug: investor.role_slug,
        roleName: investor.role_name,
        permissions: permRows.map((p: any) => p.key),
        profile,
      },
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/clear-balances', requireAdmin('portfolio.manage'), async (req, res, next) => {
  try {
    const db = getDb();
    const reason = String(req.body?.reason || 'Administrative balance reset').trim().slice(0, 500);
    const now = new Date();

    await db.transaction(async (trx) => {
      const portfolios = await trx('investor_portfolios').where('total_shares', '>', 0);
      for (const p of portfolios) {
        await trx('portfolio_transactions').insert({
          transaction_reference: generateReference('RINV-CLR'),
          user_id: p.user_id,
          offering_id: p.offering_id,
          transaction_type: 'balance_adjustment',
          quantity: -Number(p.total_shares || 0),
          unit_price: Number(p.average_acquisition_price || 0),
          amount: -Number(p.total_invested_amount || 0),
          currency: p.currency || 'USD',
          accounting_reference: `ADMIN-CLEAR-${Date.now()}`,
          description: `Balance cleared by administration: ${reason}`,
          occurred_at: now,
        });
      }

      await trx('investor_portfolios').update({
        total_shares: 0,
        total_invested_amount: 0,
        current_unit_valuation: null,
        updated_at: now,
      });

      await trx('dividend_records')
        .whereIn('status', ['declared', 'distributed'])
        .update({ status: 'cancelled' });

      await trx('withdrawal_requests')
        .where({ status: 'pending' })
        .update({
          status: 'cancelled',
          admin_notes: `Cancelled during administrative balance reset: ${reason}`,
          reviewed_by: req.authUser!.id,
          reviewed_at: now,
          updated_at: now,
        });

      const offerings = await trx('share_offerings').select('id', 'total_authorized_quantity');
      for (const off of offerings) {
        await trx('share_offerings')
          .where({ id: off.id })
          .update({ available_quantity: off.total_authorized_quantity, updated_at: now });
      }
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'admin.balances_cleared',
      entityType: 'system',
      entityId: 0,
      newData: { reason },
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/investors/:id/clear-balance', requireAdmin('portfolio.manage'), async (req, res, next) => {
  try {
    const db = getDb();
    const userId = Number(req.params.id);
    const reason = String(req.body?.reason || 'Administrative balance clearance').trim().slice(0, 500);
    const investor = await db('users').where({ id: userId, account_type: 'investor' }).first();
    const profile = await db('investor_profiles').where({ user_id: userId }).first();
    if (!investor || !profile) {
      res.status(404).json({ error: 'Investor not found.' });
      return;
    }

    const previousSummary = await computeInvestorWithdrawableSummary(db, userId);
    const now = new Date();

    await db.transaction(async (trx) => {
      const holdings = await trx('investor_portfolios').where({ user_id: userId });
      for (const h of holdings) {
        if (Number(h.total_shares || 0) > 0 || Number(h.total_invested_amount || 0) > 0) {
          await trx('share_offerings')
            .where({ id: h.offering_id })
            .increment('available_quantity', Number(h.total_shares || 0));

          await trx('portfolio_transactions').insert({
            transaction_reference: generateReference('RINV-CLR'),
            user_id: userId,
            offering_id: h.offering_id,
            transaction_type: 'balance_adjustment',
            quantity: -Number(h.total_shares || 0),
            unit_price: Number(h.average_acquisition_price || 0),
            amount: -Number(h.total_invested_amount || 0),
            currency: h.currency || 'USD',
            accounting_reference: `ADMIN-CLEAR-${userId}`,
            description: `Investor balance cleared by administration: ${reason}`,
            occurred_at: now,
          });
        }
      }

      await trx('investor_portfolios').where({ user_id: userId }).update({
        total_shares: 0,
        total_invested_amount: 0,
        current_unit_valuation: null,
        updated_at: now,
      });

      await trx('dividend_records')
        .where({ user_id: userId })
        .whereIn('status', ['declared', 'distributed'])
        .update({ status: 'cancelled' });

      await trx('withdrawal_requests')
        .where({ user_id: userId, status: 'pending' })
        .update({
          status: 'cancelled',
          admin_notes: `Cancelled during investor balance clearance: ${reason}`,
          reviewed_by: req.authUser!.id,
          reviewed_at: now,
          updated_at: now,
        });
    });

    await createNotification({
      userId,
      category: 'account_changes',
      title: 'Account Balance Cleared by Administration',
      message: `Your portfolio and withdrawable balance has been cleared to USD 0.00 by administration. Reason: ${reason}`,
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'investor.balance_cleared',
      entityType: 'user',
      entityId: userId,
      previousData: previousSummary,
      newData: { availableBalance: 0, totalInvestedCapital: 0, reason },
      req,
    });

    const summary = await computeInvestorWithdrawableSummary(db, userId);
    res.json({ ok: true, summary });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/profile-change-requests', requireAdmin('investors.view'), async (_req, res, next) => {
  try {
    const db = getDb();
    const requests = await db('profile_change_requests')
      .join('investor_profiles', 'profile_change_requests.user_id', 'investor_profiles.user_id')
      .orderBy('profile_change_requests.created_at', 'desc')
      .select(
        'profile_change_requests.*',
        'investor_profiles.account_number',
        'investor_profiles.first_name',
        'investor_profiles.last_name'
      );
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/profile-change-requests/:id/decision', requireAdmin('investors.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      decision: z.enum(['approved', 'rejected']),
      reviewNotes: z.string().trim().max(500).optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid decision is required.' });
      return;
    }

    const db = getDb();
    const row = await db('profile_change_requests').where({ id: Number(req.params.id) }).first();
    if (!row || row.status !== 'pending') {
      res.status(404).json({ error: 'Pending profile change request not found.' });
      return;
    }

    const allowedFields = new Set([
      'first_name',
      'middle_name',
      'last_name',
      'telephone',
      'country_of_residence',
      'residential_address',
      'city',
      'state_region',
      'postal_code',
    ]);
    if (!allowedFields.has(row.field_name)) {
      res.status(400).json({ error: 'Unsupported profile field.' });
      return;
    }

    await db.transaction(async (trx) => {
      await trx('profile_change_requests').where({ id: row.id }).update({
        status: parsed.data.decision,
        reviewed_by: req.authUser!.id,
        review_notes: parsed.data.reviewNotes || null,
        reviewed_at: new Date(),
      });

      if (parsed.data.decision === 'approved') {
        await trx('investor_profiles')
          .where({ user_id: row.user_id })
          .update({
            [row.field_name]: row.requested_value,
            updated_at: new Date(),
          });
      }
    });

    await createNotification({
      userId: row.user_id,
      category: 'account_changes',
      title: `Profile Change Request ${parsed.data.decision === 'approved' ? 'Approved' : 'Rejected'}`,
      message: `Your request to update ${row.field_name} has been ${parsed.data.decision}. ${parsed.data.reviewNotes || ''}`.trim(),
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: `profile_change.${parsed.data.decision}`,
      entityType: 'profile_change_request',
      entityId: row.id,
      previousData: { field: row.field_name, value: row.previous_value },
      newData: { field: row.field_name, value: row.requested_value, notes: parsed.data.reviewNotes },
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// B. KYC MANAGEMENT
adminRouter.get('/kyc', requireAdmin('kyc.review'), async (_req, res, next) => {
  try {
    const db = getDb();
    const submissions = await db('kyc_submissions')
      .join('investor_profiles', 'kyc_submissions.user_id', 'investor_profiles.user_id')
      .join('users', 'kyc_submissions.user_id', 'users.id')
      .orderBy('kyc_submissions.created_at', 'desc')
      .select(
        'kyc_submissions.*',
        'users.email',
        'investor_profiles.account_number',
        'investor_profiles.first_name',
        'investor_profiles.last_name',
        'investor_profiles.country_of_residence',
        'investor_profiles.kyc_status as profile_kyc_status'
      );

    const docs = await db('kyc_documents').select(
      'id',
      'kyc_submission_id',
      'category',
      'original_filename',
      'mime_type',
      'file_size',
      'created_at'
    );

    const docsBySub = new Map<number, any[]>();
    for (const d of docs) {
      const list = docsBySub.get(d.kyc_submission_id) || [];
      list.push(d);
      docsBySub.set(d.kyc_submission_id, list);
    }

    res.json({
      submissions: submissions.map((s: any) => ({
        ...s,
        documents: docsBySub.get(s.id) || [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/kyc/documents/:docId', requireAdmin('kyc.review'), async (req, res, next) => {
  try {
    const db = getDb();
    const doc = await db('kyc_documents').where({ id: Number(req.params.docId) }).first();
    if (!doc) {
      res.status(404).json({ error: 'KYC document not found.' });
      return;
    }
    const safePath = resolveSafeStoragePath(doc.storage_path);
    if (!safePath) {
      res.status(404).json({ error: 'File missing in storage.' });
      return;
    }
    if (String(req.query.inline || '') === '1') {
      const safeName = String(doc.original_filename || 'document').replace(/["\r\n]/g, '');
      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
      res.sendFile(safePath);
      return;
    }
    res.download(safePath, doc.original_filename);
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/kyc/:id/decision', requireAdmin('kyc.review'), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(['under_review', 'additional_info_required', 'approved', 'rejected']),
      comments: z.string().trim().min(2, 'Administrative comments are required.').max(1500),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid KYC decision.' });
      return;
    }

    const db = getDb();
    const sub = await db('kyc_submissions').where({ id: Number(req.params.id) }).first();
    if (!sub) {
      res.status(404).json({ error: 'KYC submission not found.' });
      return;
    }

    const profile = await db('investor_profiles').where({ user_id: sub.user_id }).first();
    if (sub.status === 'approved' || profile?.kyc_status === 'approved') {
      res.status(409).json({
        error: 'This investor account is permanently KYC approved and cannot be altered.',
      });
      return;
    }

    await db.transaction(async (trx) => {
      await trx('kyc_submissions').where({ id: sub.id }).update({
        status: parsed.data.status,
        admin_comments: parsed.data.comments,
        reviewed_by: req.authUser!.id,
        reviewed_at: new Date(),
        updated_at: new Date(),
      });

      await trx('kyc_status_history').insert({
        kyc_submission_id: sub.id,
        from_status: sub.status,
        to_status: parsed.data.status,
        changed_by: req.authUser!.id,
        notes: parsed.data.comments,
      });

      await trx('investor_profiles').where({ user_id: sub.user_id }).update({
        kyc_status: parsed.data.status,
        updated_at: new Date(),
      });
    });

    await createNotification({
      userId: sub.user_id,
      category: 'kyc_decision',
      title: `KYC Verification Status: ${parsed.data.status.replace(/_/g, ' ').toUpperCase()}`,
      message: `Compliance decision for ${sub.submission_reference}: ${parsed.data.comments}`,
      relatedEntityType: 'kyc_submission',
      relatedEntityId: sub.id,
      sendEmail: true,
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: `kyc.${parsed.data.status}`,
      entityType: 'kyc_submission',
      entityId: sub.id,
      previousData: { status: sub.status },
      newData: { status: parsed.data.status, comments: parsed.data.comments },
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// C. SHARE OFFERING MANAGEMENT
adminRouter.get('/offerings', requireAdmin('offerings.manage'), async (_req, res, next) => {
  try {
    const db = getDb();
    const offerings = await db('share_offerings').orderBy('created_at', 'desc');
    const docs = await db('offering_documents').select('*');
    const docsByOff = new Map<number, any[]>();
    for (const d of docs) {
      const list = docsByOff.get(d.offering_id) || [];
      list.push(d);
      docsByOff.set(d.offering_id, list);
    }
    res.json({
      offerings: offerings.map((o: any) => ({ ...o, documents: docsByOff.get(o.id) || [] })),
    });
  } catch (err) {
    next(err);
  }
});

const offeringSchema = z.object({
  title: z.string().trim().min(3).max(191),
  sector: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(10).max(1000),
  description: z.string().trim().min(10).max(10000),
  currency: z.string().trim().min(3).max(12).default('USD'),
  sharePrice: z.number().positive().optional(),
  roiPercent: z.number().min(0).max(10000).default(0),
  durationUnit: z.enum(['month', 'days', 'hours', 'daily']).optional(),
  durationValue: z.number().int().min(0).max(87600).optional(),
  durationMonths: z.number().int().min(0).max(1200).default(0),
  durationDays: z.number().int().min(0).max(36500).default(0),
  durationHours: z.number().int().min(0).max(87600).default(0),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  minQuantity: z.number().int().positive().optional(),
  maxQuantity: z.number().int().positive().optional(),
  totalAuthorizedQuantity: z.number().int().positive(),
  openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['draft', 'published', 'suspended', 'closed']).default('draft'),
  riskDisclosures: z.string().trim().min(10).max(5000),
  requiresKyc: z.boolean().default(true),
});

function resolvePlanBounds(data: z.infer<typeof offeringSchema>, existing?: any) {
  const sharePrice = data.sharePrice ?? (Number(existing?.share_price) > 0 ? Number(existing.share_price) : 1);
  const minAmount =
    data.minAmount ??
    (data.minQuantity ? Number((data.minQuantity * sharePrice).toFixed(2)) : Number(existing?.min_amount || sharePrice));
  const maxAmount =
    data.maxAmount ??
    (data.maxQuantity ? Number((data.maxQuantity * sharePrice).toFixed(2)) : Number(existing?.max_amount || minAmount * 100));
  const minQuantity = data.minQuantity ?? Math.max(1, Math.floor(minAmount / sharePrice));
  const maxQuantity = data.maxQuantity ?? Math.max(minQuantity, Math.floor(maxAmount / sharePrice));
  const openingDate = data.openingDate || existing?.opening_date || new Date().toISOString().slice(0, 10);
  const closingDate = data.closingDate || existing?.closing_date || '2099-12-31';

  let durationUnit = data.durationUnit;
  let durationValue = data.durationValue;
  let durationMonths = data.durationMonths ?? 0;
  let durationDays = data.durationDays ?? 0;
  let durationHours = data.durationHours ?? 0;

  if (durationUnit !== undefined) {
    const val = Math.max(0, Math.floor(Number(durationValue ?? 0)));
    durationValue = val;
    if (durationUnit === 'month') {
      durationMonths = val;
      durationDays = 0;
      durationHours = 0;
    } else if (durationUnit === 'days' || durationUnit === 'daily') {
      durationMonths = 0;
      durationDays = val;
      durationHours = 0;
    } else {
      durationMonths = 0;
      durationDays = 0;
      durationHours = val;
    }
  } else {
    if (durationMonths > 0) {
      durationUnit = 'month';
      durationValue = durationMonths;
    } else if (durationDays > 0) {
      durationUnit = 'days';
      durationValue = durationDays;
    } else if (durationHours > 0) {
      durationUnit = 'hours';
      durationValue = durationHours;
    } else {
      durationUnit = (existing?.duration_unit as any) || 'month';
      durationValue = Number(existing?.duration_value ?? 0);
    }
  }

  return {
    sharePrice,
    minAmount,
    maxAmount,
    minQuantity,
    maxQuantity,
    openingDate,
    closingDate,
    durationUnit,
    durationValue,
    durationMonths,
    durationDays,
    durationHours,
  };
}

adminRouter.post('/offerings', requireAdmin('offerings.manage'), async (req, res, next) => {
  try {
    const parsed = offeringSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid investment plan specification.' });
      return;
    }

    const bounds = resolvePlanBounds(parsed.data);
    if (bounds.minAmount > bounds.maxAmount) {
      res.status(400).json({ error: 'Minimum investment amount cannot exceed maximum investment amount.' });
      return;
    }

    const db = getDb();
    const referenceCode = generateReference('RINV-OFF');
    const slugBase = parsed.data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120);
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    const [id] = await db('share_offerings').insert({
      reference_code: referenceCode,
      title: parsed.data.title,
      slug,
      sector: parsed.data.sector,
      summary: parsed.data.summary,
      description: parsed.data.description,
      currency: parsed.data.currency.toUpperCase(),
      share_price: bounds.sharePrice,
      roi_percent: parsed.data.roiPercent,
      duration_unit: bounds.durationUnit,
      duration_value: bounds.durationValue,
      duration_months: bounds.durationMonths,
      duration_days: bounds.durationDays,
      duration_hours: bounds.durationHours,
      min_amount: bounds.minAmount,
      max_amount: bounds.maxAmount,
      min_quantity: bounds.minQuantity,
      max_quantity: bounds.maxQuantity,
      total_authorized_quantity: parsed.data.totalAuthorizedQuantity,
      available_quantity: parsed.data.totalAuthorizedQuantity,
      opening_date: bounds.openingDate,
      closing_date: bounds.closingDate,
      status: parsed.data.status,
      risk_disclosures: parsed.data.riskDisclosures,
      requires_kyc: parsed.data.requiresKyc,
      created_by: req.authUser!.id,
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'offering.created',
      entityType: 'share_offering',
      entityId: id,
      newData: { referenceCode, title: parsed.data.title },
      req,
    });

    res.status(201).json({ ok: true, id, referenceCode });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/offerings/:id', requireAdmin('offerings.manage'), async (req, res, next) => {
  try {
    const parsed = offeringSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid investment plan specification.' });
      return;
    }

    const db = getDb();
    const id = Number(req.params.id);
    const existing = await db('share_offerings').where({ id }).first();
    if (!existing) {
      res.status(404).json({ error: 'Investment plan not found.' });
      return;
    }

    const bounds = resolvePlanBounds(parsed.data, existing);
    if (bounds.minAmount > bounds.maxAmount) {
      res.status(400).json({ error: 'Minimum investment amount cannot exceed maximum investment amount.' });
      return;
    }

    const allocatedSoFar = Number(existing.total_authorized_quantity) - Number(existing.available_quantity);
    if (parsed.data.totalAuthorizedQuantity < allocatedSoFar) {
      res.status(400).json({
        error: `Authorized quantity cannot be reduced below already allocated shares (${allocatedSoFar}).`,
      });
      return;
    }

    const nextAvailable = parsed.data.totalAuthorizedQuantity - allocatedSoFar;
    await db('share_offerings').where({ id }).update({
      title: parsed.data.title,
      sector: parsed.data.sector,
      summary: parsed.data.summary,
      description: parsed.data.description,
      currency: parsed.data.currency.toUpperCase(),
      share_price: bounds.sharePrice,
      roi_percent: parsed.data.roiPercent,
      duration_unit: bounds.durationUnit,
      duration_value: bounds.durationValue,
      duration_months: bounds.durationMonths,
      duration_days: bounds.durationDays,
      duration_hours: bounds.durationHours,
      min_amount: bounds.minAmount,
      max_amount: bounds.maxAmount,
      min_quantity: bounds.minQuantity,
      max_quantity: bounds.maxQuantity,
      total_authorized_quantity: parsed.data.totalAuthorizedQuantity,
      available_quantity: nextAvailable,
      opening_date: bounds.openingDate,
      closing_date: bounds.closingDate,
      status: parsed.data.status,
      risk_disclosures: parsed.data.riskDisclosures,
      requires_kyc: parsed.data.requiresKyc,
      updated_at: new Date(),
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'offering.updated',
      entityType: 'share_offering',
      entityId: id,
      previousData: existing,
      newData: parsed.data,
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/offerings/:id/status', requireAdmin('offerings.manage'), async (req, res, next) => {
  try {
    const schema = z.object({ status: z.enum(['draft', 'published', 'suspended', 'closed']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid offering status.' });
      return;
    }
    const db = getDb();
    const id = Number(req.params.id);
    const existing = await db('share_offerings').where({ id }).first();
    if (!existing) {
      res.status(404).json({ error: 'Share offering not found.' });
      return;
    }
    await db('share_offerings').where({ id }).update({ status: parsed.data.status, updated_at: new Date() });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: `offering.status_${parsed.data.status}`,
      entityType: 'share_offering',
      entityId: id,
      previousData: { status: existing.status },
      newData: { status: parsed.data.status },
      req,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/offerings/:id/documents', requireAdmin('offerings.manage'), offeringDocUploader.single('document'), async (req, res, next) => {
  try {
    const db = getDb();
    const offeringId = Number(req.params.id);
    const offering = await db('share_offerings').where({ id: offeringId }).first();
    if (!offering) {
      res.status(404).json({ error: 'Share offering not found.' });
      return;
    }

    const title = String(req.body?.title || '').trim();
    const documentType = String(req.body?.documentType || 'Prospectus Supplement').trim();
    const summaryNotes = String(req.body?.summaryNotes || '').trim();
    const isPublic = req.body?.isPublic !== 'false';

    if (!title) {
      res.status(400).json({ error: 'Document title is required.' });
      return;
    }

    const [docId] = await db('offering_documents').insert({
      offering_id: offeringId,
      title,
      document_type: documentType,
      original_filename: req.file?.originalname || null,
      stored_filename: req.file?.filename || null,
      mime_type: req.file?.mimetype || null,
      file_size: req.file?.size || null,
      storage_path: req.file?.path || null,
      summary_notes: summaryNotes || null,
      is_public: isPublic,
      uploaded_by: req.authUser!.id,
    });

    res.status(201).json({ ok: true, id: docId });
  } catch (err) {
    next(err);
  }
});

// D. INVESTMENT REQUEST MANAGEMENT & ATOMIC ALLOCATION

adminRouter.get('/investments', requireAdmin('investments.manage'), async (_req, res, next) => {
  try {
    const db = getDb();
    const requests = await db('investment_requests')
      .join('share_offerings', 'investment_requests.offering_id', 'share_offerings.id')
      .join('investor_profiles', 'investment_requests.user_id', 'investor_profiles.user_id')
      .join('users', 'investment_requests.user_id', 'users.id')
      .orderBy('investment_requests.created_at', 'desc')
      .select(
        'investment_requests.*',
        'share_offerings.title as offering_title',
        'share_offerings.reference_code as offering_reference',
        'investor_profiles.account_number',
        'investor_profiles.first_name',
        'investor_profiles.last_name',
        'investor_profiles.kyc_status',
        'users.email'
      );

    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

const ALLOWED_REQUEST_TRANSITIONS: Record<string, string[]> = {
  submitted: ['under_review', 'awaiting_payment', 'rejected'],
  under_review: ['awaiting_payment', 'rejected'],
  awaiting_payment: ['rejected', 'cancelled'],
  payment_submitted: ['payment_verification_pending', 'rejected'],
  payment_verification_pending: ['approved', 'rejected'],
  approved: ['completed', 'rejected'],
};

adminRouter.post('/investments/:id/decision', requireAdmin('investments.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      nextStatus: z.enum(['under_review', 'awaiting_payment', 'approved', 'rejected', 'cancelled', 'completed']),
      adminNotes: z.string().trim().max(1000).optional().default(''),
      rejectionReason: z.string().trim().max(1000).optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid investment decision payload.' });
      return;
    }

    const db = getDb();
    const reqRow = await db('investment_requests').where({ id: Number(req.params.id) }).first();
    if (!reqRow) {
      res.status(404).json({ error: 'Investment request not found.' });
      return;
    }

    const allowedNext = ALLOWED_REQUEST_TRANSITIONS[reqRow.status] || [];
    if (!allowedNext.includes(parsed.data.nextStatus)) {
      res.status(400).json({
        error: `Invalid status transition from "${reqRow.status}" to "${parsed.data.nextStatus}".`,
      });
      return;
    }

    if (parsed.data.nextStatus === 'rejected' && !parsed.data.rejectionReason) {
      res.status(400).json({ error: 'Please specify a rejection reason.' });
      return;
    }

    let allocationSummary: any = null;

    await db.transaction(async (trx) => {
      if (parsed.data.nextStatus === 'completed') {
        const verifiedPayment = await trx('payment_submissions')
          .where({ investment_request_id: reqRow.id, status: 'approved' })
          .first();
        if (!verifiedPayment) {
          throw new Error('Cannot complete allocation without an approved payment verification record.');
        }
        allocationSummary = await executeShareAllocationTx(trx, reqRow, verifiedPayment.id, req.authUser!.id);
      } else {
        await trx('investment_requests').where({ id: reqRow.id }).update({
          status: parsed.data.nextStatus,
          admin_notes: parsed.data.adminNotes || reqRow.admin_notes,
          rejection_reason: parsed.data.nextStatus === 'rejected' ? parsed.data.rejectionReason : reqRow.rejection_reason,
          reviewed_by: req.authUser!.id,
          reviewed_at: new Date(),
          updated_at: new Date(),
        });
      }
    });

    const statusLabel = parsed.data.nextStatus.replace(/_/g, ' ').toUpperCase();
    await createNotification({
      userId: reqRow.user_id,
      category: parsed.data.nextStatus === 'rejected' ? 'investment_rejection' : 'investment_approval',
      title: `Investment Request ${reqRow.request_reference}: ${statusLabel}`,
      message:
        parsed.data.nextStatus === 'awaiting_payment'
          ? `Your investment request ${reqRow.request_reference} is approved for settlement. Please proceed to cryptocurrency payment submission.`
          : parsed.data.nextStatus === 'rejected'
          ? `Your investment request ${reqRow.request_reference} was rejected: ${parsed.data.rejectionReason}`
          : allocationSummary
          ? `Shares allocated (${allocationSummary.allocationRef}) and posted to your portfolio ledger.`
          : `Request ${reqRow.request_reference} moved to ${statusLabel}.`,
      relatedEntityType: 'investment_request',
      relatedEntityId: reqRow.id,
      sendEmail: true,
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: `investment_request.${parsed.data.nextStatus}`,
      entityType: 'investment_request',
      entityId: reqRow.id,
      previousData: { status: reqRow.status },
      newData: { status: parsed.data.nextStatus, notes: parsed.data.adminNotes, allocationSummary },
      req,
    });

    res.json({ ok: true, allocationSummary });
  } catch (err: any) {
    if (err?.message?.includes('Over-allocation') || err?.message?.includes('Cannot complete')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// E. CRYPTOCURRENCY PAYMENT MANAGEMENT
adminRouter.get('/payments/methods', requireAdmin('payments.manage'), async (_req, res, next) => {
  try {
    const db = getDb();
    const [methods, wallets, settings] = await Promise.all([
      db('payment_methods').orderBy('sort_order', 'asc').orderBy('id', 'asc'),
      db('payment_wallets').orderBy('id', 'desc'),
      getCryptoProcessingSettings(db),
    ]);
    res.json({ methods, wallets, settings });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/payments/settings', requireAdmin('payments.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      processingMode: z.enum(['manual', 'automatic']),
      autoAllocateShares: z.boolean(),
      autoRequireFullAmount: z.boolean(),
      autoMinTxidLength: z.number().int().min(8).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid crypto payment settings.' });
      return;
    }

    const db = getDb();
    const updates: Array<{ key: string; value: string; type: string; desc: string }> = [
      {
        key: 'crypto_processing_mode',
        value: parsed.data.processingMode,
        type: 'string',
        desc: 'Default crypto settlement mode: manual or automatic',
      },
      {
        key: 'crypto_auto_allocate_shares',
        value: String(parsed.data.autoAllocateShares),
        type: 'boolean',
        desc: 'Automatically allocate shares upon automatic payment confirmation',
      },
      {
        key: 'crypto_auto_require_full_amount',
        value: String(parsed.data.autoRequireFullAmount),
        type: 'boolean',
        desc: 'Require remitted amount to cover requested investment amount for automatic processing',
      },
      {
        key: 'crypto_auto_min_txid_length',
        value: String(parsed.data.autoMinTxidLength),
        type: 'number',
        desc: 'Minimum blockchain TXID character length for automatic processing',
      },
    ];

    const now = new Date();
    await db.transaction(async (trx) => {
      for (const item of updates) {
        const existing = await trx('system_settings').where({ setting_key: item.key }).first();
        if (existing) {
          await trx('system_settings')
            .where({ setting_key: item.key })
            .update({ setting_value: item.value, updated_by: req.authUser!.id, updated_at: now });
        } else {
          await trx('system_settings').insert({
            setting_key: item.key,
            setting_value: item.value,
            value_type: item.type,
            group_name: 'payments',
            description: item.desc,
            is_public: false,
            updated_by: req.authUser!.id,
            updated_at: now,
          });
        }
      }
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'crypto_payment_settings.updated',
      entityType: 'system_settings',
      entityId: 0,
      newData: parsed.data,
      req,
    });

    res.json({ ok: true, settings: parsed.data });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/payments/methods', requireAdmin('payments.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      code: z
        .string()
        .trim()
        .min(2, 'Method code is required.')
        .max(40)
        .regex(/^[A-Za-z0-9_-]+$/, 'Code may only contain letters, numbers, underscores, and hyphens.'),
      name: z.string().trim().min(2, 'Coin / method name is required.').max(120),
      symbol: z.string().trim().min(1, 'Symbol is required.').max(24),
      network: z.string().trim().min(2, 'Network is required.').max(80),
      processingMode: z.enum(['inherit', 'manual', 'automatic']).default('inherit'),
      isEnabled: z.boolean().default(true),
      label: z.string().trim().min(2, 'Wallet label is required.').max(120),
      walletAddress: z.string().trim().min(16, 'Valid deposit wallet address is required.').max(191),
      minPaymentAmount: z.number().positive('Minimum payment must be greater than 0.'),
      paymentInstructions: z.string().trim().min(10, 'Payment instructions must be at least 10 characters.').max(2000),
      isActive: z.boolean().default(true),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid crypto payment method.' });
      return;
    }

    const db = getDb();
    const normalizedCode = parsed.data.code.toUpperCase();
    const existing = await db('payment_methods').where({ code: normalizedCode }).first();
    if (existing) {
      res.status(409).json({ error: `A payment method with code "${normalizedCode}" already exists.` });
      return;
    }

    const maxSortRow = await db('payment_methods').max('sort_order as maxOrder').first();
    const nextSort = Number(maxSortRow?.maxOrder || 0) + 1;

    let createdMethodId = 0;
    let createdWalletId = 0;

    await db.transaction(async (trx) => {
      const [methodId] = await trx('payment_methods').insert({
        code: normalizedCode,
        name: parsed.data.name,
        symbol: parsed.data.symbol.toUpperCase(),
        network: parsed.data.network,
        processing_mode: parsed.data.processingMode,
        is_enabled: parsed.data.isEnabled,
        sort_order: nextSort,
      });
      createdMethodId = methodId;

      const [walletId] = await trx('payment_wallets').insert({
        payment_method_id: methodId,
        label: parsed.data.label,
        wallet_address: parsed.data.walletAddress,
        network: parsed.data.network,
        min_payment_amount: parsed.data.minPaymentAmount,
        payment_instructions: parsed.data.paymentInstructions,
        is_active: parsed.data.isActive,
        updated_by: req.authUser!.id,
      });
      createdWalletId = walletId;
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'payment_method.created',
      entityType: 'payment_method',
      entityId: createdMethodId,
      newData: { code: normalizedCode, name: parsed.data.name, processingMode: parsed.data.processingMode },
      req,
    });

    res.status(201).json({ ok: true, id: createdMethodId, walletId: createdWalletId });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/payments/methods/:id', requireAdmin('payments.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().trim().min(2).max(120),
      network: z.string().trim().min(2).max(80),
      symbol: z.string().trim().min(1).max(24).optional(),
      processingMode: z.enum(['inherit', 'manual', 'automatic']).optional(),
      isEnabled: z.boolean(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payment method parameters.' });
      return;
    }
    const db = getDb();
    const id = Number(req.params.id);
    const prev = await db('payment_methods').where({ id }).first();
    if (!prev) {
      res.status(404).json({ error: 'Payment method not found.' });
      return;
    }

    await db('payment_methods').where({ id }).update({
      name: parsed.data.name,
      network: parsed.data.network,
      ...(parsed.data.symbol ? { symbol: parsed.data.symbol.toUpperCase() } : {}),
      ...(parsed.data.processingMode ? { processing_mode: parsed.data.processingMode } : {}),
      is_enabled: parsed.data.isEnabled,
      updated_at: new Date(),
    });
    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'payment_method.updated',
      entityType: 'payment_method',
      entityId: id,
      newData: parsed.data,
      req,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/payments/methods/:id', requireAdmin('payments.manage'), async (req, res, next) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const method = await db('payment_methods').where({ id }).first();
    if (!method) {
      res.status(404).json({ error: 'Payment method not found.' });
      return;
    }
    const existingSub = await db('payment_submissions').where({ payment_method_id: id }).first();
    if (existingSub) {
      res.status(409).json({
        error: 'Cannot delete a payment method that has existing payment records. Disable it instead.',
      });
      return;
    }
    await db('payment_methods').where({ id }).delete();
    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'payment_method.deleted',
      entityType: 'payment_method',
      entityId: id,
      previousData: { code: method.code, name: method.name },
      req,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const walletSchema = z.object({
  paymentMethodId: z.number().int().positive(),
  label: z.string().trim().min(2).max(120),
  walletAddress: z.string().trim().min(16).max(191),
  network: z.string().trim().min(2).max(80),
  minPaymentAmount: z.number().positive(),
  paymentInstructions: z.string().trim().min(10).max(2000),
  isActive: z.boolean().default(true),
});

adminRouter.post('/payments/wallets', requireAdmin('payments.manage'), async (req, res, next) => {
  try {
    const parsed = walletSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid wallet settings.' });
      return;
    }
    const db = getDb();
    const [id] = await db('payment_wallets').insert({
      payment_method_id: parsed.data.paymentMethodId,
      label: parsed.data.label,
      wallet_address: parsed.data.walletAddress,
      network: parsed.data.network,
      min_payment_amount: parsed.data.minPaymentAmount,
      payment_instructions: parsed.data.paymentInstructions,
      is_active: parsed.data.isActive,
      updated_by: req.authUser!.id,
    });
    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'payment_wallet.created',
      entityType: 'payment_wallet',
      entityId: id,
      newData: { label: parsed.data.label, network: parsed.data.network },
      req,
    });
    res.status(201).json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/payments/wallets/:id', requireAdmin('payments.manage'), async (req, res, next) => {
  try {
    const parsed = walletSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid wallet settings.' });
      return;
    }
    const db = getDb();
    const id = Number(req.params.id);
    const prev = await db('payment_wallets').where({ id }).first();
    if (!prev) {
      res.status(404).json({ error: 'Wallet not found.' });
      return;
    }
    await db('payment_wallets').where({ id }).update({
      payment_method_id: parsed.data.paymentMethodId,
      label: parsed.data.label,
      wallet_address: parsed.data.walletAddress,
      network: parsed.data.network,
      min_payment_amount: parsed.data.minPaymentAmount,
      payment_instructions: parsed.data.paymentInstructions,
      is_active: parsed.data.isActive,
      updated_by: req.authUser!.id,
      updated_at: new Date(),
    });
    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'payment_wallet.updated',
      entityType: 'payment_wallet',
      entityId: id,
      previousData: { wallet_address: prev.wallet_address, is_active: prev.is_active },
      newData: { wallet_address: parsed.data.walletAddress, is_active: parsed.data.isActive },
      req,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/payments/submissions', requireAdmin('payments.manage'), async (_req, res, next) => {
  try {
    const db = getDb();
    const submissions = await db('payment_submissions')
      .join('investment_requests', 'payment_submissions.investment_request_id', 'investment_requests.id')
      .join('share_offerings', 'investment_requests.offering_id', 'share_offerings.id')
      .join('payment_methods', 'payment_submissions.payment_method_id', 'payment_methods.id')
      .join('investor_profiles', 'payment_submissions.user_id', 'investor_profiles.user_id')
      .orderBy('payment_submissions.created_at', 'desc')
      .select(
        'payment_submissions.*',
        'investment_requests.request_reference',
        'investment_requests.requested_quantity',
        'investment_requests.status as request_status',
        'share_offerings.title as offering_title',
        'payment_methods.name as payment_method_name',
        'payment_methods.network as payment_network',
        'investor_profiles.account_number',
        'investor_profiles.first_name',
        'investor_profiles.last_name'
      );

    res.json({ submissions });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/payments/submissions/:id/evidence', requireAdmin('payments.manage'), async (req, res, next) => {
  try {
    const db = getDb();
    const sub = await db('payment_submissions').where({ id: Number(req.params.id) }).first();
    if (!sub || !sub.evidence_storage_path) {
      res.status(404).json({ error: 'Payment evidence not available.' });
      return;
    }
    const safePath = resolveSafeStoragePath(sub.evidence_storage_path);
    if (!safePath) {
      res.status(404).json({ error: 'Evidence file not found on disk.' });
      return;
    }
    res.download(safePath, sub.evidence_filename || 'payment-evidence');
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/payments/submissions/:id/decision', requireAdmin('payments.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      decision: z.enum(['additional_evidence_required', 'approved', 'rejected']),
      verificationNotes: z.string().trim().min(2).max(1500),
      allocateSharesNow: z.boolean().optional().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Verification notes are required.' });
      return;
    }

    const db = getDb();
    const payRow = await db('payment_submissions').where({ id: Number(req.params.id) }).first();
    if (!payRow) {
      res.status(404).json({ error: 'Payment submission not found.' });
      return;
    }
    if (!['submitted', 'verification_pending', 'additional_evidence_required'].includes(payRow.status)) {
      res.status(400).json({ error: `Payment submission is already finalized (${payRow.status}).` });
      return;
    }

    const reqRow = await db('investment_requests').where({ id: payRow.investment_request_id }).first();
    if (!reqRow) {
      res.status(404).json({ error: 'Associated investment request not found.' });
      return;
    }

    let allocationSummary: any = null;

    await db.transaction(async (trx) => {
      const now = new Date();
      await trx('payment_submissions').where({ id: payRow.id }).update({
        status: parsed.data.decision,
        verification_notes: parsed.data.verificationNotes,
        rejection_reason: parsed.data.decision === 'rejected' ? parsed.data.verificationNotes : null,
        verified_by: req.authUser!.id,
        verified_at: now,
        updated_at: now,
      });

      if (parsed.data.decision === 'approved') {
        await trx('investment_requests').where({ id: reqRow.id }).update({
          status: 'approved',
          reviewed_by: req.authUser!.id,
          reviewed_at: now,
          updated_at: now,
        });
        if (parsed.data.allocateSharesNow) {
          allocationSummary = await executeShareAllocationTx(trx, reqRow, payRow.id, req.authUser!.id);
        }
      } else if (parsed.data.decision === 'additional_evidence_required') {
        await trx('investment_requests').where({ id: reqRow.id }).update({
          status: 'awaiting_payment',
          admin_notes: parsed.data.verificationNotes,
          updated_at: now,
        });
      } else if (parsed.data.decision === 'rejected') {
        await trx('investment_requests').where({ id: reqRow.id }).update({
          status: 'rejected',
          rejection_reason: parsed.data.verificationNotes,
          reviewed_by: req.authUser!.id,
          reviewed_at: now,
          updated_at: now,
        });
      }
    });

    await createNotification({
      userId: payRow.user_id,
      category: parsed.data.decision === 'approved' ? 'payment_approval' : 'payment_rejection',
      title: `Payment ${payRow.payment_reference}: ${parsed.data.decision.replace(/_/g, ' ').toUpperCase()}`,
      message:
        parsed.data.decision === 'approved'
          ? allocationSummary
            ? `Treasury verified payment ${payRow.payment_reference}. ${reqRow.requested_quantity} shares allocated (${allocationSummary.allocationRef}).`
            : `Treasury verified payment ${payRow.payment_reference}.`
          : `Treasury verification update for ${payRow.payment_reference}: ${parsed.data.verificationNotes}`,
      relatedEntityType: 'payment_submission',
      relatedEntityId: payRow.id,
      sendEmail: true,
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: `payment.${parsed.data.decision}`,
      entityType: 'payment_submission',
      entityId: payRow.id,
      previousData: { status: payRow.status },
      newData: { decision: parsed.data.decision, notes: parsed.data.verificationNotes, allocationSummary },
      req,
    });

    res.json({ ok: true, allocationSummary });
  } catch (err: any) {
    if (err?.message?.includes('Over-allocation') || err?.message?.includes('already been allocated')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

adminRouter.post('/payments/submissions/:id/auto-process', requireAdmin('payments.manage'), async (req, res, next) => {
  try {
    const db = getDb();
    const payRow = await db('payment_submissions').where({ id: Number(req.params.id) }).first();
    if (!payRow) {
      res.status(404).json({ error: 'Payment submission not found.' });
      return;
    }
    if (!['submitted', 'verification_pending', 'additional_evidence_required'].includes(payRow.status)) {
      res.status(400).json({ error: `Payment submission is already finalized (${payRow.status}).` });
      return;
    }

    const reqRow = await db('investment_requests').where({ id: payRow.investment_request_id }).first();
    if (!reqRow) {
      res.status(404).json({ error: 'Associated investment request not found.' });
      return;
    }

    const settings = await getCryptoProcessingSettings(db);
    const check = await evaluateAutomaticCryptoVerification(db, {
      txHash: String(payRow.transaction_hash || ''),
      submittedAmount: Number(payRow.submitted_amount || 0),
      expectedAmount: Number(payRow.expected_amount || reqRow.total_amount || 0),
      minTxidLength: settings.autoMinTxidLength,
      requireFullAmount: settings.autoRequireFullAmount,
      excludePaymentId: payRow.id,
    });

    if (!check.approved) {
      await db('payment_submissions').where({ id: payRow.id }).update({
        verification_notes: check.reason,
        updated_at: new Date(),
      });
      res.status(400).json({ error: check.reason });
      return;
    }

    let allocationSummary: any = null;
    const now = new Date();

    await db.transaction(async (trx) => {
      await trx('payment_submissions').where({ id: payRow.id }).update({
        status: 'approved',
        processing_mode: 'automatic',
        verification_channel: 'automatic_settlement_engine',
        verification_notes: check.reason,
        verified_by: req.authUser!.id,
        verified_at: now,
        auto_verified_at: now,
        updated_at: now,
      });

      await trx('investment_requests').where({ id: reqRow.id }).update({
        status: 'approved',
        reviewed_by: req.authUser!.id,
        reviewed_at: now,
        updated_at: now,
      });

      if (settings.autoAllocateShares) {
        allocationSummary = await executeShareAllocationTx(trx, reqRow, payRow.id, req.authUser!.id);
      }
    });

    await createNotification({
      userId: payRow.user_id,
      category: 'payment_approval',
      title: `Payment ${payRow.payment_reference}: AUTOMATICALLY VERIFIED`,
      message: allocationSummary
        ? `Payment ${payRow.payment_reference} was verified via Automatic Processing and ${reqRow.requested_quantity} units were allocated (${allocationSummary.allocationRef}).`
        : `Payment ${payRow.payment_reference} was verified via Automatic Processing.`,
      relatedEntityType: 'payment_submission',
      relatedEntityId: payRow.id,
      sendEmail: true,
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'payment.auto_processed_by_admin',
      entityType: 'payment_submission',
      entityId: payRow.id,
      newData: { decision: 'approved', processing_mode: 'automatic', allocationSummary },
      req,
    });

    res.json({ ok: true, allocationSummary });
  } catch (err: any) {
    if (err?.message?.includes('Over-allocation') || err?.message?.includes('already been allocated')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// F. PORTFOLIO & DIVIDEND MANAGEMENT
adminRouter.get('/portfolios', requireAdmin('portfolio.manage'), async (_req, res, next) => {
  try {
    const db = getDb();
    const holdings = await db('investor_portfolios')
      .join('investor_profiles', 'investor_portfolios.user_id', 'investor_profiles.user_id')
      .join('share_offerings', 'investor_portfolios.offering_id', 'share_offerings.id')
      .orderBy('investor_portfolios.updated_at', 'desc')
      .select(
        'investor_portfolios.*',
        'investor_profiles.account_number',
        'investor_profiles.first_name',
        'investor_profiles.last_name',
        'share_offerings.title as offering_title',
        'share_offerings.reference_code as offering_reference'
      );

    const allocations = await db('share_allocations')
      .join('investor_profiles', 'share_allocations.user_id', 'investor_profiles.user_id')
      .join('share_offerings', 'share_allocations.offering_id', 'share_offerings.id')
      .orderBy('share_allocations.allocated_at', 'desc')
      .select(
        'share_allocations.*',
        'investor_profiles.account_number',
        'investor_profiles.first_name',
        'investor_profiles.last_name',
        'share_offerings.title as offering_title'
      );

    res.json({ holdings, allocations });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/portfolios/:id/valuation', requireAdmin('portfolio.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      currentUnitValuation: z.number().positive(),
      valuationNotes: z.string().trim().min(3).max(500),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid unit valuation and accounting notes are required.' });
      return;
    }
    const db = getDb();
    const id = Number(req.params.id);
    const existing = await db('investor_portfolios').where({ id }).first();
    if (!existing) {
      res.status(404).json({ error: 'Portfolio holding not found.' });
      return;
    }
    await db('investor_portfolios').where({ id }).update({
      current_unit_valuation: parsed.data.currentUnitValuation,
      valuation_notes: parsed.data.valuationNotes,
      valuation_updated_at: new Date(),
      updated_at: new Date(),
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'portfolio.valuation_updated',
      entityType: 'investor_portfolio',
      entityId: id,
      previousData: { current_unit_valuation: existing.current_unit_valuation },
      newData: parsed.data,
      req,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/dividends', requireAdmin('portfolio.manage'), async (_req, res, next) => {
  try {
    const db = getDb();
    const dividends = await db('dividend_records')
      .join('investor_profiles', 'dividend_records.user_id', 'investor_profiles.user_id')
      .join('share_offerings', 'dividend_records.offering_id', 'share_offerings.id')
      .orderBy('dividend_records.declared_at', 'desc')
      .select(
        'dividend_records.*',
        'investor_profiles.account_number',
        'investor_profiles.first_name',
        'investor_profiles.last_name',
        'share_offerings.title as offering_title'
      );
    res.json({ dividends });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/dividends', requireAdmin('portfolio.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      userId: z.number().int().positive(),
      offeringId: z.number().int().positive(),
      periodLabel: z.string().trim().min(2).max(80),
      ratePerShare: z.number().positive(),
      accountingReference: z.string().trim().min(3).max(80),
      paymentReference: z.string().trim().max(120).optional().default(''),
      notes: z.string().trim().max(500).optional().default(''),
      distributeImmediately: z.boolean().default(false),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid dividend entry.' });
      return;
    }

    const db = getDb();
    const holding = await db('investor_portfolios')
      .where({ user_id: parsed.data.userId, offering_id: parsed.data.offeringId })
      .first();
    if (!holding || Number(holding.total_shares) <= 0) {
      res.status(400).json({ error: 'Investor holds zero eligible shares in this offering.' });
      return;
    }

    const grossAmount = Number((Number(holding.total_shares) * parsed.data.ratePerShare).toFixed(2));
    const dividendRef = generateReference('RINV-DIV');
    const now = new Date();
    const status = parsed.data.distributeImmediately ? 'distributed' : 'declared';

    let createdId = 0;
    await db.transaction(async (trx) => {
      const [id] = await trx('dividend_records').insert({
        dividend_reference: dividendRef,
        user_id: parsed.data.userId,
        offering_id: parsed.data.offeringId,
        period_label: parsed.data.periodLabel,
        shares_eligible: holding.total_shares,
        rate_per_share: parsed.data.ratePerShare,
        gross_amount: grossAmount,
        currency: holding.currency,
        status,
        accounting_reference: parsed.data.accountingReference,
        payment_reference: parsed.data.paymentReference || null,
        notes: parsed.data.notes || null,
        recorded_by: req.authUser!.id,
        declared_at: now,
        distributed_at: parsed.data.distributeImmediately ? now : null,
      });
      createdId = id;

      if (parsed.data.distributeImmediately) {
        await trx('portfolio_transactions').insert({
          transaction_reference: generateReference('RINV-TX'),
          user_id: parsed.data.userId,
          offering_id: parsed.data.offeringId,
          transaction_type: 'dividend_credit',
          quantity: holding.total_shares,
          unit_price: parsed.data.ratePerShare,
          amount: grossAmount,
          currency: holding.currency,
          accounting_reference: parsed.data.accountingReference,
          description: `Dividend distribution (${parsed.data.periodLabel}) - ${dividendRef}`,
          recorded_by: req.authUser!.id,
          occurred_at: now,
        });
      }
    });

    await createNotification({
      userId: parsed.data.userId,
      category: 'dividend',
      title: `Dividend ${status === 'distributed' ? 'Distributed' : 'Declared'} (${dividendRef})`,
      message: `A dividend of ${holding.currency} ${grossAmount.toLocaleString()} (${parsed.data.periodLabel}) was recorded under reference ${parsed.data.accountingReference}.`,
      relatedEntityType: 'dividend_record',
      relatedEntityId: createdId,
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: `dividend.${status}`,
      entityType: 'dividend_record',
      entityId: createdId,
      newData: { dividendRef, grossAmount, accountingReference: parsed.data.accountingReference },
      req,
    });

    res.status(201).json({ ok: true, id: createdId, dividendRef });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/dividends/:id/status', requireAdmin('portfolio.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(['distributed', 'cancelled']),
      paymentReference: z.string().trim().max(120).optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid dividend status transition.' });
      return;
    }

    const db = getDb();
    const div = await db('dividend_records').where({ id: Number(req.params.id) }).first();
    if (!div || div.status !== 'declared') {
      res.status(400).json({ error: 'Only declared dividends can be distributed or cancelled.' });
      return;
    }

    const now = new Date();
    await db.transaction(async (trx) => {
      await trx('dividend_records').where({ id: div.id }).update({
        status: parsed.data.status,
        payment_reference: parsed.data.paymentReference || div.payment_reference,
        distributed_at: parsed.data.status === 'distributed' ? now : null,
      });
      if (parsed.data.status === 'distributed') {
        await trx('portfolio_transactions').insert({
          transaction_reference: generateReference('RINV-TX'),
          user_id: div.user_id,
          offering_id: div.offering_id,
          transaction_type: 'dividend_credit',
          quantity: div.shares_eligible,
          unit_price: div.rate_per_share,
          amount: div.gross_amount,
          currency: div.currency,
          accounting_reference: div.accounting_reference,
          description: `Dividend distribution (${div.period_label}) - ${div.dividend_reference}`,
          recorded_by: req.authUser!.id,
          occurred_at: now,
        });
      }
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: `dividend.${parsed.data.status}`,
      entityType: 'dividend_record',
      entityId: div.id,
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// G. CONTENT MANAGEMENT
adminRouter.get('/cms/pages', requireAdmin('cms.manage'), async (_req, res, next) => {
  try {
    const db = getDb();
    const pages = await db('website_pages').orderBy('id', 'asc');
    res.json({ pages });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/cms/pages/:slug', requireAdmin('cms.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(2).max(191),
      subtitle: z.string().trim().max(255).optional().default(''),
      heroKicker: z.string().trim().max(120).optional().default(''),
      metaDescription: z.string().trim().max(255).optional().default(''),
      contentJson: z.string().min(2),
      isPublished: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid CMS page update.' });
      return;
    }
    try {
      JSON.parse(parsed.data.contentJson);
    } catch {
      res.status(400).json({ error: 'Page content must be valid JSON.' });
      return;
    }

    const db = getDb();
    const existing = await db('website_pages').where({ slug: req.params.slug }).first();
    if (!existing) {
      res.status(404).json({ error: 'Website page not found.' });
      return;
    }
    await db('website_pages').where({ slug: req.params.slug }).update({
      title: parsed.data.title,
      subtitle: parsed.data.subtitle || null,
      hero_kicker: parsed.data.heroKicker || null,
      meta_description: parsed.data.metaDescription || null,
      content_json: parsed.data.contentJson,
      is_published: parsed.data.isPublished,
      updated_by: req.authUser!.id,
      updated_at: new Date(),
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'cms_page.updated',
      entityType: 'website_page',
      entityId: req.params.slug,
      req,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/cms/announcements', requireAdmin('cms.manage'), async (_req, res, next) => {
  try {
    const db = getDb();
    const announcements = await db('announcements').orderBy('published_at', 'desc');
    res.json({ announcements });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/cms/announcements', requireAdmin('cms.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(3).max(191),
      category: z.string().trim().min(2).max(80),
      summary: z.string().trim().min(10).max(1000),
      body: z.string().trim().min(10).max(10000),
      isPublished: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid announcement fields are required.' });
      return;
    }
    const db = getDb();
    const slug = `${parsed.data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 120)}-${Date.now().toString(36)}`;
    const [id] = await db('announcements').insert({
      slug,
      title: parsed.data.title,
      category: parsed.data.category,
      summary: parsed.data.summary,
      body: parsed.data.body,
      is_published: parsed.data.isPublished,
      author_id: req.authUser!.id,
      published_at: new Date(),
    });
    res.status(201).json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/cms/announcements/:id', requireAdmin('cms.manage'), async (req, res, next) => {
  try {
    const db = getDb();
    await db('announcements').where({ id: Number(req.params.id) }).delete();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/cms/faqs', requireAdmin('cms.manage'), async (_req, res, next) => {
  try {
    const db = getDb();
    const faqs = await db('faq_entries').orderBy('sort_order', 'asc');
    res.json({ faqs });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/cms/faqs', requireAdmin('cms.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      category: z.string().trim().min(2).max(80),
      question: z.string().trim().min(5).max(255),
      answer: z.string().trim().min(10).max(5000),
      sortOrder: z.number().int().default(10),
      isPublished: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid FAQ fields are required.' });
      return;
    }
    const db = getDb();
    const [id] = await db('faq_entries').insert({
      category: parsed.data.category,
      question: parsed.data.question,
      answer: parsed.data.answer,
      sort_order: parsed.data.sortOrder,
      is_published: parsed.data.isPublished,
    });
    res.status(201).json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/cms/faqs/:id', requireAdmin('cms.manage'), async (req, res, next) => {
  try {
    const db = getDb();
    await db('faq_entries').where({ id: Number(req.params.id) }).delete();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/cms/inquiries', requireAdmin('cms.manage'), async (_req, res, next) => {
  try {
    const db = getDb();
    const inquiries = await db('contact_inquiries').orderBy('created_at', 'desc');
    res.json({ inquiries });
  } catch (err) {
    next(err);
  }
});

// H. SYSTEM SETTINGS & PERMISSIONS
adminRouter.get('/settings', requireAdmin('settings.manage'), async (_req, res, next) => {
  try {
    const db = getDb();
    const settings = await db('system_settings').orderBy('group_name', 'asc');
    const roles = await db('roles').orderBy('id', 'asc');
    const permissions = await db('permissions').orderBy('module', 'asc');
    const rolePermissions = await db('role_permissions').select('*');
    const adminUsers = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.account_type', 'admin')
      .select('users.id', 'users.email', 'users.account_status', 'users.last_login_at', 'roles.slug as role_slug', 'roles.name as role_name');

    res.json({ settings, roles, permissions, rolePermissions, adminUsers });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/settings', requireAdmin('settings.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      updates: z.array(
        z.object({
          settingKey: z.string().trim().min(1),
          settingValue: z.string().max(4000),
        })
      ),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid settings update payload.' });
      return;
    }

    const db = getDb();
    for (const u of parsed.data.updates) {
      await db('system_settings').where({ setting_key: u.settingKey }).update({
        setting_value: u.settingValue,
        updated_by: req.authUser!.id,
        updated_at: new Date(),
      });
    }

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'system_settings.updated',
      entityType: 'system_settings',
      newData: parsed.data.updates,
      req,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/admin-users', requireAdmin('settings.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().trim().email().max(191),
      password: z.string().min(10).max(128),
      roleSlug: z.enum(['super_admin', 'compliance_officer', 'operations_admin']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid admin user data.' });
      return;
    }
    const db = getDb();
    const email = parsed.data.email.toLowerCase();
    const exists = await db('users').where({ email }).first();
    if (exists) {
      res.status(409).json({ error: 'Email address already exists.' });
      return;
    }
    const role = await db('roles').where({ slug: parsed.data.roleSlug }).first();
    if (!role) {
      res.status(400).json({ error: 'Invalid role.' });
      return;
    }
    const [id] = await db('users').insert({
      role_id: role.id,
      email,
      password_hash: await hashPassword(parsed.data.password),
      account_type: 'admin',
      account_status: 'active',
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: 'admin_user.created',
      entityType: 'user',
      entityId: id,
      newData: { email, roleSlug: parsed.data.roleSlug },
      req,
    });
    res.status(201).json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

// I. REPORTS (JSON + CSV)
adminRouter.get('/reports/:type', requireAdmin('reports.view'), async (req, res, next) => {
  try {
    const db = getDb();
    const type = req.params.type;
    const format = String(req.query.format || 'json').toLowerCase();
    let rows: Record<string, any>[] = [];

    switch (type) {
      case 'investors':
        rows = await db('users')
          .join('investor_profiles', 'users.id', 'investor_profiles.user_id')
          .where('users.account_type', 'investor')
          .select(
            'investor_profiles.account_number',
            'investor_profiles.first_name',
            'investor_profiles.last_name',
            'users.email',
            'investor_profiles.country_of_residence',
            'investor_profiles.kyc_status',
            'users.account_status',
            'users.created_at'
          );
        break;
      case 'kyc':
        rows = await db('kyc_submissions')
          .join('investor_profiles', 'kyc_submissions.user_id', 'investor_profiles.user_id')
          .select(
            'kyc_submissions.submission_reference',
            'investor_profiles.account_number',
            'investor_profiles.first_name',
            'investor_profiles.last_name',
            'kyc_submissions.document_type',
            'kyc_submissions.issuing_country',
            'kyc_submissions.status',
            'kyc_submissions.created_at',
            'kyc_submissions.reviewed_at'
          );
        break;
      case 'investments':
        rows = await db('investment_requests')
          .join('investor_profiles', 'investment_requests.user_id', 'investor_profiles.user_id')
          .join('share_offerings', 'investment_requests.offering_id', 'share_offerings.id')
          .select(
            'investment_requests.request_reference',
            'investor_profiles.account_number',
            'share_offerings.reference_code as offering_reference',
            'share_offerings.title as offering_title',
            'investment_requests.requested_quantity',
            'investment_requests.unit_price',
            'investment_requests.total_amount',
            'investment_requests.currency',
            'investment_requests.status',
            'investment_requests.created_at'
          );
        break;
      case 'payments':
        rows = await db('payment_submissions')
          .join('investor_profiles', 'payment_submissions.user_id', 'investor_profiles.user_id')
          .join('payment_methods', 'payment_submissions.payment_method_id', 'payment_methods.id')
          .select(
            'payment_submissions.payment_reference',
            'investor_profiles.account_number',
            'payment_methods.code as payment_method',
            'payment_submissions.expected_amount',
            'payment_submissions.submitted_amount',
            'payment_submissions.currency',
            'payment_submissions.transaction_hash',
            'payment_submissions.status',
            'payment_submissions.created_at',
            'payment_submissions.verified_at'
          );
        break;
      case 'allocations':
        rows = await db('share_allocations')
          .join('investor_profiles', 'share_allocations.user_id', 'investor_profiles.user_id')
          .join('share_offerings', 'share_allocations.offering_id', 'share_offerings.id')
          .select(
            'share_allocations.allocation_reference',
            'investor_profiles.account_number',
            'share_offerings.reference_code as offering_reference',
            'share_allocations.allocated_quantity',
            'share_allocations.acquisition_price',
            'share_allocations.total_cost',
            'share_allocations.currency',
            'share_allocations.allocated_at'
          );
        break;
      case 'portfolios':
        rows = await db('investor_portfolios')
          .join('investor_profiles', 'investor_portfolios.user_id', 'investor_profiles.user_id')
          .join('share_offerings', 'investor_portfolios.offering_id', 'share_offerings.id')
          .select(
            'investor_profiles.account_number',
            'investor_profiles.first_name',
            'investor_profiles.last_name',
            'share_offerings.title as offering_title',
            'investor_portfolios.total_shares',
            'investor_portfolios.average_acquisition_price',
            'investor_portfolios.total_invested_amount',
            'investor_portfolios.current_unit_valuation',
            'investor_portfolios.currency'
          );
        break;
      case 'dividends':
        rows = await db('dividend_records')
          .join('investor_profiles', 'dividend_records.user_id', 'investor_profiles.user_id')
          .join('share_offerings', 'dividend_records.offering_id', 'share_offerings.id')
          .select(
            'dividend_records.dividend_reference',
            'investor_profiles.account_number',
            'share_offerings.title as offering_title',
            'dividend_records.period_label',
            'dividend_records.shares_eligible',
            'dividend_records.rate_per_share',
            'dividend_records.gross_amount',
            'dividend_records.currency',
            'dividend_records.status',
            'dividend_records.accounting_reference',
            'dividend_records.declared_at'
          );
        break;
      case 'audit':
        rows = await db('admin_audit_logs')
          .leftJoin('users', 'admin_audit_logs.actor_user_id', 'users.id')
          .orderBy('admin_audit_logs.created_at', 'desc')
          .limit(500)
          .select(
            'admin_audit_logs.id',
            'users.email as actor_email',
            'admin_audit_logs.action',
            'admin_audit_logs.entity_type',
            'admin_audit_logs.entity_id',
            'admin_audit_logs.ip_address',
            'admin_audit_logs.created_at'
          );
        break;
      default:
        res.status(404).json({ error: 'Unknown report type.' });
        return;
    }

    if (format === 'csv') {
      const csv = toCsv(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="richmond-inv-${type}-report.csv"`);
      res.send(csv);
      return;
    }

    res.json({ type, rows });
  } catch (err) {
    next(err);
  }
});

// H. WITHDRAWAL MANAGEMENT
adminRouter.get('/withdrawals', requireAdmin('payments.manage'), async (_req, res, next) => {
  try {
    const db = getDb();
    const withdrawals = await db('withdrawal_requests')
      .join('investor_profiles', 'withdrawal_requests.user_id', 'investor_profiles.user_id')
      .join('users', 'withdrawal_requests.user_id', 'users.id')
      .orderBy('withdrawal_requests.created_at', 'desc')
      .select(
        'withdrawal_requests.*',
        'users.email as investor_email',
        'investor_profiles.account_number',
        'investor_profiles.first_name',
        'investor_profiles.last_name'
      );
    res.json({ withdrawals });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/withdrawals/:id/decision', requireAdmin('payments.manage'), async (req, res, next) => {
  try {
    const schema = z.object({
      decision: z.enum(['approved', 'completed', 'rejected']),
      adminNotes: z.string().trim().min(2, 'Administrative notes are required.').max(1500),
      transactionHash: z.string().trim().max(191).optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid withdrawal decision.' });
      return;
    }

    const db = getDb();
    const id = Number(req.params.id);
    const row = await db('withdrawal_requests').where({ id }).first();
    if (!row) {
      res.status(404).json({ error: 'Withdrawal request not found.' });
      return;
    }
    if (!['pending', 'approved'].includes(row.status)) {
      res.status(400).json({ error: `Withdrawal request is already finalized (${row.status}).` });
      return;
    }

    const now = new Date();
    await db.transaction(async (trx) => {
      await trx('withdrawal_requests').where({ id }).update({
        status: parsed.data.decision,
        admin_notes: parsed.data.adminNotes,
        rejection_reason: parsed.data.decision === 'rejected' ? parsed.data.adminNotes : null,
        transaction_hash: parsed.data.transactionHash || row.transaction_hash || null,
        reviewed_by: req.authUser!.id,
        reviewed_at: now,
        updated_at: now,
      });

      if (parsed.data.decision === 'completed') {
        await trx('portfolio_transactions').insert({
          transaction_reference: generateReference('RINV-TX'),
          user_id: row.user_id,
          offering_id: null,
          investment_request_id: null,
          transaction_type: 'withdrawal',
          quantity: 0,
          unit_price: 0,
          amount: -Number(row.amount),
          currency: row.currency,
          accounting_reference: row.withdrawal_reference,
          description: `Withdrawal payout via ${row.payout_method} (${row.destination_address.slice(0, 16)}...)`,
          recorded_by: req.authUser!.id,
          occurred_at: now,
        });
      }
    });

    await createNotification({
      userId: row.user_id,
      category: parsed.data.decision === 'rejected' ? 'withdrawal_rejected' : 'withdrawal_update',
      title: `Withdrawal ${row.withdrawal_reference}: ${parsed.data.decision.toUpperCase()}`,
      message:
        parsed.data.decision === 'completed'
          ? `Your withdrawal of ${row.currency} ${Number(row.amount).toLocaleString()} has been settled.${parsed.data.transactionHash ? ` TXID: ${parsed.data.transactionHash}` : ''}`
          : `Withdrawal update (${row.withdrawal_reference}): ${parsed.data.adminNotes}`,
      relatedEntityType: 'withdrawal_request',
      relatedEntityId: id,
    });

    await writeAuditLog({
      actorUserId: req.authUser!.id,
      action: `withdrawal.${parsed.data.decision}`,
      entityType: 'withdrawal_request',
      entityId: id,
      previousData: { status: row.status },
      newData: parsed.data,
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
