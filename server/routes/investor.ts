import fs from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { getDb } from '../db/connection.ts';
import { generateReference, hashPassword, verifyPassword } from '../lib/crypto.ts';
import { writeAuditLog } from '../lib/audit.ts';
import { createNotification, notifyAllAdmins } from '../lib/notifications.ts';
import { createPrivateUploader, resolveSafeStoragePath, saveBase64PrivateFile, type SavedPrivateFile } from '../lib/uploads.ts';
import {
  evaluateAutomaticCryptoVerification,
  executeShareAllocationTx,
  getCryptoProcessingSettings,
  resolveEffectiveProcessingMode,
} from '../lib/cryptoPayments.ts';
import { computeInvestorWithdrawableSummary } from '../lib/withdrawals.ts';
import { generatePortfolioStatementPdf } from '../lib/pdfStatements.ts';
import { requireInvestor } from '../middleware/auth.ts';

export const investorRouter = Router();
investorRouter.use(requireInvestor);

const kycUploader = createPrivateUploader('kyc');
const paymentUploader = createPrivateUploader('payments');

async function evaluateEligibility(
  userId: number,
  offeringId: number,
  input: { amount?: number; quantity?: number }
) {
  const db = getDb();
  const user = await db('users').where({ id: userId }).first();
  const profile = await db('investor_profiles').where({ user_id: userId }).first();
  const offering = await db('share_offerings').where({ id: offeringId }).first();

  if (!offering) {
    return {
      found: false,
      eligible: false,
      kycVerified: false,
      accountActive: false,
      quantityWithinLimits: false,
      sharesAvailable: false,
      effectiveQuantity: 0,
      effectiveAmount: 0,
      summary: 'Investment plan does not exist.',
      offering: null,
    };
  }

  const unitPrice = Math.max(0.01, Number(offering.share_price || 1));
  const minAmount = Number(offering.min_amount || Number(offering.min_quantity || 1) * unitPrice);
  const maxAmount = Number(offering.max_amount || Number(offering.max_quantity || 10000) * unitPrice);

  const hasAmount = typeof input.amount === 'number' && !Number.isNaN(input.amount) && input.amount > 0;
  const effectiveAmount = hasAmount
    ? Number(input.amount!.toFixed(2))
    : Number(((input.quantity || 0) * unitPrice).toFixed(2));
  const effectiveQuantity = hasAmount
    ? Math.max(1, Math.round(effectiveAmount / unitPrice))
    : Math.max(0, Math.floor(input.quantity || 0));

  const accountActive = Boolean(user && user.account_status === 'active');
  const kycVerified = offering.requires_kyc ? profile?.kyc_status === 'approved' : true;
  const quantityWithinLimits = hasAmount
    ? effectiveAmount >= minAmount && effectiveAmount <= maxAmount
    : Number.isInteger(effectiveQuantity) &&
      effectiveQuantity >= offering.min_quantity &&
      effectiveQuantity <= offering.max_quantity;
  const sharesAvailable = offering.status === 'published' && offering.available_quantity >= effectiveQuantity;

  const reasons: string[] = [];
  if (!accountActive) reasons.push('Investor account is not active.');
  if (offering.status !== 'published') reasons.push('Investment plan is not currently open for subscription.');
  if (!kycVerified) reasons.push('Approved KYC verification is required prior to submitting an investment.');
  if (!quantityWithinLimits) {
    reasons.push(
      `Investment amount must be between ${offering.currency} ${minAmount.toLocaleString()} and ${offering.currency} ${maxAmount.toLocaleString()}.`
    );
  }
  if (!sharesAvailable) {
    reasons.push(`Insufficient authorized pool capacity remaining (${offering.available_quantity} units available).`);
  }

  const eligible = accountActive && kycVerified && quantityWithinLimits && sharesAvailable;
  const summary = eligible ? 'All eligibility checks passed.' : reasons.join(' ');

  return {
    found: true,
    eligible,
    kycVerified,
    accountActive,
    quantityWithinLimits,
    sharesAvailable,
    effectiveQuantity,
    effectiveAmount,
    summary,
    offering,
  };
}

investorRouter.get('/dashboard', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;

    const [
      userRow,
      profile,
      portfolios,
      requests,
      dividends,
      recentTransactions,
      notifications,
      unreadRow,
      availableOfferings,
      withdrawals,
      payoutMethods,
      withdrawalSummary,
    ] = await Promise.all([
      db('users').where({ id: userId }).select('id', 'email', 'account_status', 'last_login_at', 'created_at').first(),
      db('investor_profiles').where({ user_id: userId }).first(),
      db('investor_portfolios')
        .join('share_offerings', 'investor_portfolios.offering_id', 'share_offerings.id')
        .where('investor_portfolios.user_id', userId)
        .select(
          'investor_portfolios.*',
          'share_offerings.title as offering_title',
          'share_offerings.reference_code as offering_reference'
        ),
      db('investment_requests')
        .join('share_offerings', 'investment_requests.offering_id', 'share_offerings.id')
        .where('investment_requests.user_id', userId)
        .orderBy('investment_requests.created_at', 'desc')
        .select(
          'investment_requests.*',
          'share_offerings.title as offering_title',
          'share_offerings.reference_code as offering_reference'
        ),
      db('dividend_records')
        .join('share_offerings', 'dividend_records.offering_id', 'share_offerings.id')
        .where('dividend_records.user_id', userId)
        .orderBy('dividend_records.declared_at', 'desc')
        .select('dividend_records.*', 'share_offerings.title as offering_title'),
      db('portfolio_transactions')
        .leftJoin('share_offerings', 'portfolio_transactions.offering_id', 'share_offerings.id')
        .where('portfolio_transactions.user_id', userId)
        .orderBy('portfolio_transactions.occurred_at', 'desc')
        .limit(10)
        .select('portfolio_transactions.*', 'share_offerings.title as offering_title'),
      db('notifications').where({ user_id: userId }).orderBy('created_at', 'desc').limit(8),
      db('notifications').where({ user_id: userId, is_read: false }).count('id as count').first(),
      db('share_offerings').where({ status: 'published' }).orderBy('created_at', 'desc').limit(6),
      db('withdrawal_requests').where({ user_id: userId }).orderBy('created_at', 'desc').limit(20),
      db('payment_methods').where({ is_enabled: true }).orderBy('sort_order', 'asc').orderBy('id', 'asc'),
      computeInvestorWithdrawableSummary(db, userId),
    ]);

    const totalShareholdings = portfolios.reduce((sum: number, p: any) => sum + Number(p.total_shares || 0), 0);

    const pendingStatuses = new Set([
      'draft',
      'submitted',
      'under_review',
      'awaiting_payment',
      'payment_submitted',
      'payment_verification_pending',
      'approved',
    ]);
    const pendingRequestsCount = requests.filter((r: any) => pendingStatuses.has(r.status)).length;
    const completedInvestmentsCount = requests.filter((r: any) => r.status === 'completed').length;

    res.json({
      email: userRow?.email || req.authUser!.email,
      accountStatus: userRow?.account_status || 'active',
      profile,
      metrics: {
        totalInvestedCapital: withdrawalSummary.totalInvestedCapital,
        totalShareholdings,
        portfolioValuation: withdrawalSummary.portfolioValuation,
        pendingRequestsCount,
        completedInvestmentsCount,
        totalDividendsDistributed: withdrawalSummary.totalDividendsDistributed,
        availableBalance: withdrawalSummary.availableBalance,
        pendingWithdrawals: withdrawalSummary.pendingWithdrawals,
        totalWithdrawn: withdrawalSummary.totalWithdrawn,
        unreadNotificationsCount: Number(unreadRow?.count || 0),
      },
      portfolios,
      recentRequests: requests.slice(0, 6),
      dividends: dividends.slice(0, 5),
      recentTransactions,
      notifications,
      availableOfferings,
      withdrawals,
      payoutMethods,
    });
  } catch (err) {
    next(err);
  }
});

investorRouter.get('/offerings', async (_req, res, next) => {
  try {
    const db = getDb();
    const offerings = await db('share_offerings').where({ status: 'published' }).orderBy('created_at', 'desc');
    const docs = await db('offering_documents')
      .where({ is_public: true })
      .select('id', 'offering_id', 'title', 'document_type', 'original_filename', 'summary_notes', 'created_at');
    const docsByOffering = new Map<number, any[]>();
    for (const d of docs) {
      const list = docsByOffering.get(d.offering_id) || [];
      list.push(d);
      docsByOffering.set(d.offering_id, list);
    }
    res.json({
      offerings: offerings.map((o: any) => ({ ...o, documents: docsByOffering.get(o.id) || [] })),
    });
  } catch (err) {
    next(err);
  }
});

investorRouter.post('/offerings/:id/eligibility', async (req, res, next) => {
  try {
    const offeringId = Number(req.params.id);
    const rawAmount = req.body?.amount !== undefined ? Number(req.body.amount) : undefined;
    const rawQuantity = req.body?.quantity !== undefined ? Number(req.body.quantity) : undefined;
    const result = await evaluateEligibility(req.authUser!.id, offeringId, {
      amount: rawAmount,
      quantity: rawQuantity,
    });
    if (!result.found) {
      res.status(404).json({ error: 'Investment plan not found.' });
      return;
    }

    const db = getDb();
    await db('investment_eligibility_records').insert({
      user_id: req.authUser!.id,
      offering_id: offeringId,
      kyc_verified: result.kycVerified,
      account_active: result.accountActive,
      quantity_within_limits: result.quantityWithinLimits,
      shares_available: result.sharesAvailable,
      eligible: result.eligible,
      evaluation_summary: result.summary,
    });

    res.json({
      eligible: result.eligible,
      kycVerified: result.kycVerified,
      accountActive: result.accountActive,
      quantityWithinLimits: result.quantityWithinLimits,
      sharesAvailable: result.sharesAvailable,
      summary: result.summary,
      calculatedTotal: result.effectiveAmount,
      currency: result.offering?.currency || 'USD',
    });
  } catch (err) {
    next(err);
  }
});

const createInvestmentSchema = z
  .object({
    offeringId: z.number().int().positive(),
    amount: z.number().positive().optional(),
    quantity: z.number().int().positive().optional(),
    saveAsDraft: z.boolean().optional().default(false),
    termsConfirmed: z.boolean(),
    investorNotes: z.string().trim().max(1000).optional().default(''),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .refine((d) => d.amount !== undefined || d.quantity !== undefined, {
    message: 'Investment amount is required.',
  });

investorRouter.get('/investments', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;
    const requests = await db('investment_requests')
      .join('share_offerings', 'investment_requests.offering_id', 'share_offerings.id')
      .where('investment_requests.user_id', userId)
      .orderBy('investment_requests.created_at', 'desc')
      .select(
        'investment_requests.*',
        'share_offerings.title as offering_title',
        'share_offerings.reference_code as offering_reference',
        'share_offerings.sector as offering_sector'
      );

    const payments = await db('payment_submissions')
      .join('payment_methods', 'payment_submissions.payment_method_id', 'payment_methods.id')
      .where('payment_submissions.user_id', userId)
      .orderBy('payment_submissions.created_at', 'desc')
      .select(
        'payment_submissions.*',
        'payment_methods.name as payment_method_name',
        'payment_methods.code as payment_method_code',
        'payment_methods.network as payment_network'
      );

    const paymentsByReq = new Map<number, any[]>();
    for (const p of payments) {
      const list = paymentsByReq.get(p.investment_request_id) || [];
      list.push(p);
      paymentsByReq.set(p.investment_request_id, list);
    }

    res.json({
      requests: requests.map((r: any) => ({
        ...r,
        payments: paymentsByReq.get(r.id) || [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

investorRouter.get('/investments/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;
    const requestId = Number(req.params.id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      res.status(400).json({ error: 'Invalid investment request ID.' });
      return;
    }

    const requestRow = await db('investment_requests')
      .join('share_offerings', 'investment_requests.offering_id', 'share_offerings.id')
      .where({ 'investment_requests.id': requestId, 'investment_requests.user_id': userId })
      .select(
        'investment_requests.*',
        'share_offerings.title as offering_title',
        'share_offerings.reference_code as offering_reference',
        'share_offerings.sector as offering_sector',
        'share_offerings.roi_percent as roi_percent',
        'share_offerings.duration_unit as duration_unit',
        'share_offerings.duration_value as duration_value',
        'share_offerings.duration_months as duration_months',
        'share_offerings.duration_days as duration_days',
        'share_offerings.duration_hours as duration_hours'
      )
      .first();

    if (!requestRow) {
      res.status(404).json({ error: 'Investment request not found.' });
      return;
    }

    const payments = await db('payment_submissions')
      .join('payment_methods', 'payment_submissions.payment_method_id', 'payment_methods.id')
      .where({ 'payment_submissions.investment_request_id': requestRow.id, 'payment_submissions.user_id': userId })
      .orderBy('payment_submissions.created_at', 'desc')
      .select(
        'payment_submissions.*',
        'payment_methods.name as payment_method_name',
        'payment_methods.code as payment_method_code',
        'payment_methods.network as payment_network'
      );

    res.json({ request: { ...requestRow, payments } });
  } catch (err) {
    next(err);
  }
});

investorRouter.post('/investments', async (req, res, next) => {
  try {
    const parsed = createInvestmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid investment request.' });
      return;
    }

    const db = getDb();
    const userId = req.authUser!.id;

    if (parsed.data.idempotencyKey) {
      const dup = await db('investment_requests')
        .where({ user_id: userId, idempotency_key: parsed.data.idempotencyKey })
        .first();
      if (dup) {
        res.status(200).json({ ok: true, request: dup, deduplicated: true });
        return;
      }
    }

    if (!parsed.data.saveAsDraft && !parsed.data.termsConfirmed) {
      res.status(400).json({ error: 'You must confirm offering terms and risk disclosures before submitting.' });
      return;
    }

    const elig = await evaluateEligibility(userId, parsed.data.offeringId, {
      amount: parsed.data.amount,
      quantity: parsed.data.quantity,
    });
    if (!elig.found || !elig.offering) {
      res.status(404).json({ error: 'Investment plan not found.' });
      return;
    }

    if (!parsed.data.saveAsDraft && !elig.eligible) {
      res.status(400).json({ error: elig.summary });
      return;
    }

    const unitPrice = Number(elig.offering.share_price);
    const totalAmount = elig.effectiveAmount;
    const requestedQuantity = elig.effectiveQuantity;
    const requestReference = generateReference('RINV-REQ');
    const initialStatus = parsed.data.saveAsDraft ? 'draft' : 'awaiting_payment';

    let createdId = 0;
    await db.transaction(async (trx) => {
      const [id] = await trx('investment_requests').insert({
        request_reference: requestReference,
        user_id: userId,
        offering_id: elig.offering.id,
        requested_quantity: requestedQuantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
        currency: elig.offering.currency,
        status: initialStatus,
        eligibility_passed: elig.eligible,
        terms_confirmed: parsed.data.termsConfirmed,
        investor_notes: parsed.data.investorNotes || null,
        idempotency_key: parsed.data.idempotencyKey || null,
      });
      createdId = id;

      await trx('investment_eligibility_records').insert({
        investment_request_id: id,
        user_id: userId,
        offering_id: elig.offering.id,
        kyc_verified: elig.kycVerified,
        account_active: elig.accountActive,
        quantity_within_limits: elig.quantityWithinLimits,
        shares_available: elig.sharesAvailable,
        eligible: elig.eligible,
        evaluation_summary: elig.summary,
      });
    });

    const created = await db('investment_requests').where({ id: createdId }).first();

    if (initialStatus === 'awaiting_payment') {
      await createNotification({
        userId,
        category: 'investment_submission',
        title: `Investment Request Created (${requestReference})`,
        message: `Your investment request for ${elig.offering.title} (${elig.offering.currency} ${totalAmount.toLocaleString()}) is awaiting cryptocurrency payment settlement.`,
        relatedEntityType: 'investment_request',
        relatedEntityId: createdId,
      });

      await notifyAllAdmins(
        'investment_submission',
        `New Investment Request (${requestReference})`,
        `An investor submitted ${requestReference} for ${elig.offering.currency} ${totalAmount.toLocaleString()} (awaiting payment).`,
        'investment_request',
        createdId
      );
    }

    await writeAuditLog({
      actorUserId: userId,
      action: `investment_request.${initialStatus}`,
      entityType: 'investment_request',
      entityId: createdId,
      newData: { requestReference, quantity: requestedQuantity, totalAmount },
      req,
    });

    res.status(201).json({ ok: true, request: created });
  } catch (err) {
    next(err);
  }
});

investorRouter.post('/investments/:id/submit', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;
    const reqRow = await db('investment_requests').where({ id: Number(req.params.id), user_id: userId }).first();
    if (!reqRow) {
      res.status(404).json({ error: 'Investment request not found.' });
      return;
    }
    if (reqRow.status !== 'draft') {
      res.status(400).json({ error: 'Only draft investment requests can be submitted.' });
      return;
    }

    const elig = await evaluateEligibility(userId, reqRow.offering_id, {
      amount: Number(reqRow.total_amount),
      quantity: Number(reqRow.requested_quantity),
    });
    if (!elig.eligible) {
      res.status(400).json({ error: elig.summary });
      return;
    }

    await db('investment_requests').where({ id: reqRow.id }).update({
      status: 'awaiting_payment',
      eligibility_passed: true,
      terms_confirmed: true,
      updated_at: new Date(),
    });

    await createNotification({
      userId,
      category: 'investment_submission',
      title: `Investment Request Ready for Payment (${reqRow.request_reference})`,
      message: `Your draft investment request ${reqRow.request_reference} has been submitted and is awaiting payment settlement.`,
      relatedEntityType: 'investment_request',
      relatedEntityId: reqRow.id,
    });

    await notifyAllAdmins(
      'investment_submission',
      `New Investment Request (${reqRow.request_reference})`,
      `Investment request ${reqRow.request_reference} was submitted (awaiting payment).`,
      'investment_request',
      reqRow.id
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

investorRouter.post('/investments/:id/cancel', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;
    const reqRow = await db('investment_requests').where({ id: Number(req.params.id), user_id: userId }).first();
    if (!reqRow) {
      res.status(404).json({ error: 'Investment request not found.' });
      return;
    }
    if (!['draft', 'submitted', 'awaiting_payment'].includes(reqRow.status)) {
      res.status(400).json({ error: 'This investment request can no longer be cancelled.' });
      return;
    }
    await db('investment_requests').where({ id: reqRow.id }).update({
      status: 'cancelled',
      updated_at: new Date(),
    });

    await writeAuditLog({
      actorUserId: userId,
      action: 'investment_request.cancelled_by_investor',
      entityType: 'investment_request',
      entityId: reqRow.id,
      previousData: { status: reqRow.status },
      newData: { status: 'cancelled' },
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

investorRouter.get('/payment-methods', async (_req, res, next) => {
  try {
    const db = getDb();
    const [methods, wallets, settings] = await Promise.all([
      db('payment_methods').where({ is_enabled: true }).orderBy('sort_order', 'asc').orderBy('id', 'asc'),
      db('payment_wallets').where({ is_active: true }).orderBy('id', 'desc'),
      getCryptoProcessingSettings(db),
    ]);

    const enriched = await Promise.all(
      methods.map(async (m: any) => {
        const wallet = wallets.find((w: any) => w.payment_method_id === m.id) || null;
        let qrDataUrl: string | null = null;
        if (wallet?.wallet_address) {
          qrDataUrl = await QRCode.toDataURL(wallet.wallet_address, {
            width: 220,
            margin: 1,
            color: { dark: '#0B172A', light: '#FFFFFF' },
          });
        }
        return {
          ...m,
          effectiveProcessingMode: resolveEffectiveProcessingMode(m.processing_mode, settings.processingMode),
          wallet: wallet ? { ...wallet, qrDataUrl } : null,
        };
      })
    );

    res.json({
      paymentMethods: enriched.filter((m) => m.wallet !== null),
      globalProcessingMode: settings.processingMode,
    });
  } catch (err) {
    next(err);
  }
});

investorRouter.post('/payments', paymentUploader.single('evidence'), async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;
    const investmentRequestId = Number(req.body?.investmentRequestId);
    const paymentMethodId = Number(req.body?.paymentMethodId);
    const submittedAmount = Number(req.body?.submittedAmount);
    const transactionHash = String(req.body?.transactionHash || '').trim();
    const senderWalletAddress = String(req.body?.senderWalletAddress || '').trim();
    const investorNotes = String(req.body?.investorNotes || '').trim();

    if (!investmentRequestId || !paymentMethodId || !transactionHash || transactionHash.length < 12) {
      res.status(400).json({ error: 'Valid investment request, payment method, and blockchain transaction hash are required.' });
      return;
    }

    const reqRow = await db('investment_requests').where({ id: investmentRequestId, user_id: userId }).first();
    if (!reqRow) {
      res.status(404).json({ error: 'Investment request not found.' });
      return;
    }

    const allowedReqStatuses = ['submitted', 'under_review', 'awaiting_payment', 'payment_verification_pending'];
    if (!allowedReqStatuses.includes(reqRow.status)) {
      res.status(400).json({
        error: 'Payment can only be submitted for active investment requests awaiting settlement.',
      });
      return;
    }

    const existingPending = await db('payment_submissions')
      .where({ investment_request_id: reqRow.id })
      .whereIn('status', ['submitted', 'verification_pending', 'approved'])
      .first();
    if (existingPending) {
      res.status(409).json({
        error: 'A payment submission for this request is already awaiting verification or has been approved.',
      });
      return;
    }

    const method = await db('payment_methods').where({ id: paymentMethodId, is_enabled: true }).first();
    const wallet = await db('payment_wallets').where({ payment_method_id: paymentMethodId, is_active: true }).first();
    if (!method || !wallet) {
      res.status(400).json({ error: 'Selected cryptocurrency payment method is not currently available.' });
      return;
    }

    const minimumAllowed = Math.min(Number(wallet.min_payment_amount || 0), Number(reqRow.total_amount || 0));
    if (Number.isNaN(submittedAmount) || submittedAmount <= 0 || submittedAmount < minimumAllowed) {
      res.status(400).json({
        error: `Submitted settlement amount must be at least ${reqRow.currency} ${minimumAllowed}.`,
      });
      return;
    }

    const paymentReference = generateReference('RINV-PAY');
    const settings = await getCryptoProcessingSettings(db);
    const effectiveMode = resolveEffectiveProcessingMode(method.processing_mode, settings.processingMode);

    let autoCheck: { approved: boolean; reason: string } | null = null;
    if (effectiveMode === 'automatic') {
      autoCheck = await evaluateAutomaticCryptoVerification(db, {
        txHash: transactionHash,
        submittedAmount,
        expectedAmount: Number(reqRow.total_amount),
        minTxidLength: settings.autoMinTxidLength,
        requireFullAmount: settings.autoRequireFullAmount,
      });
    }

    const autoApproved = effectiveMode === 'automatic' && Boolean(autoCheck?.approved);
    let createdPaymentId = 0;
    let allocationSummary: any = null;
    const now = new Date();

    await db.transaction(async (trx) => {
      const [payId] = await trx('payment_submissions').insert({
        payment_reference: paymentReference,
        investment_request_id: reqRow.id,
        user_id: userId,
        payment_method_id: method.id,
        payment_wallet_id: wallet.id,
        expected_amount: reqRow.total_amount,
        currency: reqRow.currency,
        submitted_amount: submittedAmount,
        transaction_hash: transactionHash,
        sender_wallet_address: senderWalletAddress || null,
        evidence_filename: req.file?.originalname || null,
        evidence_storage_path: req.file?.path || null,
        evidence_mime_type: req.file?.mimetype || null,
        status: autoApproved ? 'approved' : 'verification_pending',
        processing_mode: autoApproved ? 'automatic' : 'manual',
        verification_channel: autoApproved ? 'automatic_settlement_engine' : 'manual_treasury_review',
        verification_notes: autoCheck?.reason || null,
        verified_at: autoApproved ? now : null,
        auto_verified_at: autoApproved ? now : null,
        investor_notes: investorNotes || null,
      });
      createdPaymentId = payId;

      if (autoApproved) {
        await trx('investment_requests').where({ id: reqRow.id }).update({
          status: 'approved',
          reviewed_at: now,
          updated_at: now,
        });
        if (settings.autoAllocateShares) {
          allocationSummary = await executeShareAllocationTx(trx, reqRow, payId, null);
        }
      } else {
        await trx('investment_requests').where({ id: reqRow.id }).update({
          status: 'payment_verification_pending',
          updated_at: now,
        });
      }
    });

    await createNotification({
      userId,
      category: autoApproved ? 'payment_approval' : 'payment_submission',
      title: autoApproved
        ? `Payment Automatically Verified (${paymentReference})`
        : `Payment Evidence Submitted (${paymentReference})`,
      message: autoApproved
        ? allocationSummary
          ? `Your cryptocurrency settlement (${transactionHash.slice(0, 16)}...) was automatically verified and allocated (${allocationSummary.allocationRef}).`
          : `Your cryptocurrency settlement (${transactionHash.slice(0, 16)}...) was automatically verified.`
        : `Your cryptocurrency settlement reference (${transactionHash.slice(0, 16)}...) has been logged and is pending manual treasury verification.`,
      relatedEntityType: 'payment_submission',
      relatedEntityId: createdPaymentId,
    });

    await notifyAllAdmins(
      autoApproved ? 'payment_approval' : 'payment_submission',
      autoApproved
        ? `Crypto Payment Auto-Settled (${paymentReference})`
        : `Crypto Payment Pending Verification (${paymentReference})`,
      autoApproved
        ? `Payment ${paymentReference} for request ${reqRow.request_reference} via ${method.name} was automatically verified and settled.`
        : `Payment ${paymentReference} submitted for request ${reqRow.request_reference} via ${method.name}. Manual treasury verification required.`,
      'payment_submission',
      createdPaymentId
    );

    await writeAuditLog({
      actorUserId: userId,
      action: autoApproved ? 'payment.auto_processed' : 'payment.submitted',
      entityType: 'payment_submission',
      entityId: createdPaymentId,
      newData: {
        paymentReference,
        transactionHash,
        method: method.code,
        processingMode: autoApproved ? 'automatic' : 'manual',
        allocationSummary,
      },
      req,
    });

    res.status(201).json({
      ok: true,
      paymentReference,
      status: autoApproved ? 'approved' : 'verification_pending',
      processingMode: autoApproved ? 'automatic' : 'manual',
      autoProcessed: autoApproved,
      allocationSummary,
      reviewReason: !autoApproved && autoCheck ? autoCheck.reason : undefined,
    });
  } catch (err) {
    next(err);
  }
});

investorRouter.get('/payments/:id/evidence', async (req, res, next) => {
  try {
    const db = getDb();
    const row = await db('payment_submissions')
      .where({ id: Number(req.params.id), user_id: req.authUser!.id })
      .first();
    if (!row || !row.evidence_storage_path) {
      res.status(404).json({ error: 'Payment evidence file not found.' });
      return;
    }
    const safePath = resolveSafeStoragePath(row.evidence_storage_path);
    if (!safePath) {
      res.status(404).json({ error: 'Evidence file missing from storage.' });
      return;
    }
    res.download(safePath, row.evidence_filename || 'payment-evidence');
  } catch (err) {
    next(err);
  }
});

investorRouter.get('/kyc', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;
    const profile = await db('investor_profiles').where({ user_id: userId }).first();
    const submissions = await db('kyc_submissions').where({ user_id: userId }).orderBy('created_at', 'desc');
    const documents = await db('kyc_documents')
      .where({ user_id: userId })
      .select('id', 'kyc_submission_id', 'category', 'original_filename', 'mime_type', 'file_size', 'created_at');
    const history = submissions.length
      ? await db('kyc_status_history')
          .whereIn(
            'kyc_submission_id',
            submissions.map((s: any) => s.id)
          )
          .orderBy('created_at', 'desc')
      : [];

    res.json({
      kycStatus: profile?.kyc_status || 'not_submitted',
      submissions,
      documents,
      history,
    });
  } catch (err) {
    next(err);
  }
});

const kycUploadMiddleware = (req: any, res: any, next: any) => {
  if (req.is('multipart/form-data')) {
    return kycUploader.fields([
      { name: 'identityDocument', maxCount: 1 },
      { name: 'addressProofDocument', maxCount: 1 },
      { name: 'supportingDocument', maxCount: 1 },
    ])(req, res, next);
  }
  return next();
};

investorRouter.post('/kyc', kycUploadMiddleware, async (req, res, next) => {
  const savedFiles: SavedPrivateFile[] = [];
  const cleanupUploadedFiles = () => {
    for (const f of savedFiles) {
      if (f?.path) {
        try {
          fs.unlinkSync(f.path);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  };

  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    let idDoc: SavedPrivateFile | undefined = files?.identityDocument?.[0];
    let addrDoc: SavedPrivateFile | undefined = files?.addressProofDocument?.[0];
    let supDoc: SavedPrivateFile | undefined = files?.supportingDocument?.[0];

    if (idDoc) savedFiles.push(idDoc);
    if (addrDoc) savedFiles.push(addrDoc);
    if (supDoc) savedFiles.push(supDoc);

    const db = getDb();
    const userId = req.authUser!.id;
    const profile = await db('investor_profiles').where({ user_id: userId }).first();
    if (profile?.kyc_status === 'approved') {
      cleanupUploadedFiles();
      res.status(409).json({
        error: 'Your account KYC is permanently approved. No further identity verification is required.',
      });
      return;
    }

    const schema = z.object({
      documentType: z.enum(['passport', 'national_id', 'drivers_licence']),
      documentNumber: z.string().trim().min(3, 'Document number must be at least 3 characters.').max(100),
      issuingCountry: z.string().trim().min(2, 'Issuing country is required.').max(100),
      expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid expiry date (YYYY-MM-DD) is required.'),
      addressProofType: z.string().trim().min(2, 'Address proof type is required.').max(80),
      investorNotes: z.string().trim().max(1000).optional().default(''),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      cleanupUploadedFiles();
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid KYC metadata.' });
      return;
    }

    // Support JSON base64 uploads (avoids mobile Safari FormData / shared-hosting multipart drops)
    if (!idDoc && req.body?.identityDocument?.dataBase64) {
      try {
        idDoc = saveBase64PrivateFile('kyc', req.body.identityDocument);
        savedFiles.push(idDoc);
      } catch (fileErr: any) {
        cleanupUploadedFiles();
        res.status(400).json({ error: fileErr?.message || 'Invalid identity document file.' });
        return;
      }
    }
    if (!addrDoc && req.body?.addressProofDocument?.dataBase64) {
      try {
        addrDoc = saveBase64PrivateFile('kyc', req.body.addressProofDocument);
        savedFiles.push(addrDoc);
      } catch (fileErr: any) {
        cleanupUploadedFiles();
        res.status(400).json({ error: fileErr?.message || 'Invalid proof of address file.' });
        return;
      }
    }
    if (!supDoc && req.body?.supportingDocument?.dataBase64) {
      try {
        supDoc = saveBase64PrivateFile('kyc', req.body.supportingDocument);
        savedFiles.push(supDoc);
      } catch (fileErr: any) {
        cleanupUploadedFiles();
        res.status(400).json({ error: fileErr?.message || 'Invalid supporting document file.' });
        return;
      }
    }

    if (!idDoc || !addrDoc) {
      cleanupUploadedFiles();
      res.status(400).json({ error: 'Both an identity document and a proof of address document are required.' });
      return;
    }

    const submissionRef = generateReference('RINV-KYC');
    let submissionId = 0;

      await db.transaction(async (trx) => {
        const [subId] = await trx('kyc_submissions').insert({
          user_id: userId,
          submission_reference: submissionRef,
          document_type: parsed.data.documentType,
          document_number: parsed.data.documentNumber,
          issuing_country: parsed.data.issuingCountry,
          expiry_date: parsed.data.expiryDate,
          address_proof_type: parsed.data.addressProofType,
          status: 'submitted',
          investor_notes: parsed.data.investorNotes || null,
        });
        submissionId = subId;

        const docRows = [
          { file: idDoc, category: 'identity' },
          { file: addrDoc, category: 'proof_of_address' },
          ...(supDoc ? [{ file: supDoc, category: 'supporting' }] : []),
        ];

        for (const item of docRows) {
          await trx('kyc_documents').insert({
            kyc_submission_id: subId,
            user_id: userId,
            category: item.category,
            original_filename: item.file.originalname,
            stored_filename: item.file.filename,
            mime_type: item.file.mimetype,
            file_size: item.file.size,
            storage_path: item.file.path,
          });
        }

        await trx('kyc_status_history').insert({
          kyc_submission_id: subId,
          from_status: profile?.kyc_status || 'not_submitted',
          to_status: 'submitted',
          changed_by: userId,
          notes: 'KYC package submitted by investor.',
        });

        await trx('investor_profiles').where({ user_id: userId }).update({
          kyc_status: 'submitted',
          updated_at: new Date(),
        });
      });

      await createNotification({
        userId,
        category: 'kyc_submission',
        title: `KYC Verification Submitted (${submissionRef})`,
        message: 'Your identity and proof-of-address documents have been securely received for compliance review.',
        relatedEntityType: 'kyc_submission',
        relatedEntityId: submissionId,
      });

      await notifyAllAdmins(
        'kyc_submission',
        `New KYC Package (${submissionRef})`,
        `Investor account ${profile?.account_number || userId} submitted KYC package ${submissionRef} for compliance review.`,
        'kyc_submission',
        submissionId
      );

      await writeAuditLog({
        actorUserId: userId,
        action: 'kyc.submitted',
        entityType: 'kyc_submission',
        entityId: submissionId,
        newData: { submissionRef, documentType: parsed.data.documentType },
        req,
      });

      res.status(201).json({ ok: true, submissionReference: submissionRef, status: 'submitted' });
    } catch (err) {
      cleanupUploadedFiles();
      next(err);
    }
});

investorRouter.get('/kyc/documents/:docId', async (req, res, next) => {
  try {
    const db = getDb();
    const doc = await db('kyc_documents')
      .where({ id: Number(req.params.docId), user_id: req.authUser!.id })
      .first();
    if (!doc) {
      res.status(404).json({ error: 'KYC document not found.' });
      return;
    }
    const safePath = resolveSafeStoragePath(doc.storage_path);
    if (!safePath) {
      res.status(404).json({ error: 'Stored document file not found.' });
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

investorRouter.get('/portfolio', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;
    const profile = await db('investor_profiles').where({ user_id: userId }).first();

    const holdings = await db('investor_portfolios')
      .join('share_offerings', 'investor_portfolios.offering_id', 'share_offerings.id')
      .where('investor_portfolios.user_id', userId)
      .select(
        'investor_portfolios.*',
        'share_offerings.title as offering_title',
        'share_offerings.reference_code as offering_reference',
        'share_offerings.sector as offering_sector'
      );

    const allocations = await db('share_allocations')
      .join('share_offerings', 'share_allocations.offering_id', 'share_offerings.id')
      .where('share_allocations.user_id', userId)
      .orderBy('share_allocations.allocated_at', 'desc')
      .select('share_allocations.*', 'share_offerings.title as offering_title', 'share_offerings.reference_code as offering_reference');

    const transactions = await db('portfolio_transactions')
      .leftJoin('share_offerings', 'portfolio_transactions.offering_id', 'share_offerings.id')
      .where('portfolio_transactions.user_id', userId)
      .orderBy('portfolio_transactions.occurred_at', 'desc')
      .select('portfolio_transactions.*', 'share_offerings.title as offering_title');

    const dividends = await db('dividend_records')
      .join('share_offerings', 'dividend_records.offering_id', 'share_offerings.id')
      .where('dividend_records.user_id', userId)
      .orderBy('dividend_records.declared_at', 'desc')
      .select('dividend_records.*', 'share_offerings.title as offering_title');

    res.json({ profile, holdings, allocations, transactions, dividends });
  } catch (err) {
    next(err);
  }
});

investorRouter.get('/portfolio/export-csv', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;
    const rows = await db('portfolio_transactions')
      .leftJoin('share_offerings', 'portfolio_transactions.offering_id', 'share_offerings.id')
      .where('portfolio_transactions.user_id', userId)
      .orderBy('portfolio_transactions.occurred_at', 'desc')
      .select(
        'portfolio_transactions.transaction_reference',
        'portfolio_transactions.transaction_type',
        'share_offerings.title as offering_title',
        'portfolio_transactions.quantity',
        'portfolio_transactions.unit_price',
        'portfolio_transactions.amount',
        'portfolio_transactions.currency',
        'portfolio_transactions.accounting_reference',
        'portfolio_transactions.occurred_at'
      );

    const header = 'Reference,Type,Offering,Quantity,UnitPrice,Amount,Currency,AccountingRef,OccurredAt\n';
    const csvLines = rows.map((r: any) =>
      [
        r.transaction_reference,
        r.transaction_type,
        `"${String(r.offering_title || '').replace(/"/g, '""')}"`,
        r.quantity,
        r.unit_price,
        r.amount,
        r.currency,
        r.accounting_reference || '',
        new Date(r.occurred_at).toISOString(),
      ].join(',')
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="richmond-inv-portfolio-ledger.csv"');
    res.send(header + csvLines.join('\n'));
  } catch (err) {
    next(err);
  }
});

investorRouter.get('/portfolio/statement-pdf', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;

    const [userRow, profile, holdings, dividends, transactions, summary, settingsRows] = await Promise.all([
      db('users').where({ id: userId }).select('id', 'email', 'account_status').first(),
      db('investor_profiles').where({ user_id: userId }).first(),
      db('investor_portfolios')
        .join('share_offerings', 'investor_portfolios.offering_id', 'share_offerings.id')
        .where('investor_portfolios.user_id', userId)
        .select(
          'investor_portfolios.*',
          'share_offerings.title as offering_title',
          'share_offerings.reference_code as offering_reference'
        ),
      db('dividend_records')
        .join('share_offerings', 'dividend_records.offering_id', 'share_offerings.id')
        .where('dividend_records.user_id', userId)
        .orderBy('dividend_records.declared_at', 'desc')
        .select('dividend_records.*', 'share_offerings.title as offering_title'),
      db('portfolio_transactions')
        .leftJoin('share_offerings', 'portfolio_transactions.offering_id', 'share_offerings.id')
        .where('portfolio_transactions.user_id', userId)
        .orderBy('portfolio_transactions.occurred_at', 'desc')
        .limit(30)
        .select('portfolio_transactions.*', 'share_offerings.title as offering_title'),
      computeInvestorWithdrawableSummary(db, userId),
      db('system_settings').where({ is_public: true }).select('setting_key', 'setting_value'),
    ]);

    if (!userRow || !profile) {
      res.status(404).json({ error: 'Investor profile not found.' });
      return;
    }

    const settings = Object.fromEntries(settingsRows.map((r: any) => [r.setting_key, r.setting_value]));
    const statementReference = generateReference('RINV-STMT');
    const generatedAt = new Date();
    const fullName = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ');

    const pdfBuffer = await generatePortfolioStatementPdf({
      companyName: settings.company_name || 'RICHMOND-INV',
      legalName: settings.company_legal_name || 'Richmond Investment Holdings Ltd.',
      contactEmail: settings.contact_email || 'investor.relations@richmond-inv.com',
      hqAddress: settings.headquarters_address || '24 Bishopsgate, London EC2N 4BQ, United Kingdom',
      statementReference,
      generatedAt,
      investor: {
        fullName: fullName || userRow.email,
        email: userRow.email,
        accountNumber: profile.account_number,
        country: profile.country_of_residence || '—',
        kycStatus: profile.kyc_status || 'not_submitted',
        accountStatus: userRow.account_status || 'active',
      },
      summary,
      holdings,
      dividends,
      transactions,
    });

    await writeAuditLog({
      actorUserId: userId,
      action: 'portfolio.statement_pdf_downloaded',
      entityType: 'investor_portfolio',
      entityId: userId,
      newData: { statementReference },
      req,
    });

    const safeAccount = String(profile.account_number || 'INVESTOR').replace(/[^A-Za-z0-9_-]/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RICHMOND-INV-Portfolio-Statement-${safeAccount}.pdf"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

investorRouter.get('/account', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;
    const user = await db('users').where({ id: userId }).select('id', 'email', 'account_status', 'last_login_at', 'created_at').first();
    const profile = await db('investor_profiles').where({ user_id: userId }).first();
    const changeRequests = await db('profile_change_requests')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
    const notifications = await db('notifications')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(50);

    res.json({ user, profile, changeRequests, notifications });
  } catch (err) {
    next(err);
  }
});

const changeRequestSchema = z.object({
  fieldName: z.enum([
    'first_name',
    'middle_name',
    'last_name',
    'telephone',
    'country_of_residence',
    'residential_address',
    'city',
    'state_region',
    'postal_code',
  ]),
  requestedValue: z.string().trim().min(1, 'Requested value is required.').max(255),
  reason: z.string().trim().min(3, 'Please state a reason for the profile update.').max(500),
});

investorRouter.post('/account/change-request', async (req, res, next) => {
  try {
    const parsed = changeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile change request.' });
      return;
    }

    const db = getDb();
    const userId = req.authUser!.id;
    const profile = await db('investor_profiles').where({ user_id: userId }).first();
    if (!profile) {
      res.status(404).json({ error: 'Investor profile not found.' });
      return;
    }

    const previousValue = String(profile[parsed.data.fieldName] ?? '');
    const [id] = await db('profile_change_requests').insert({
      user_id: userId,
      field_name: parsed.data.fieldName,
      previous_value: previousValue,
      requested_value: parsed.data.requestedValue,
      reason: parsed.data.reason,
      status: 'pending',
    });

    await notifyAllAdmins(
      'profile_change_request',
      'Profile Change Request Submitted',
      `Investor ${profile.account_number} requested an update to ${parsed.data.fieldName}.`,
      'profile_change_request',
      id
    );

    await writeAuditLog({
      actorUserId: userId,
      action: 'profile_change.requested',
      entityType: 'profile_change_request',
      entityId: id,
      newData: parsed.data,
      req,
    });

    res.status(201).json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

const changePassSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(10, 'New password must be at least 10 characters.').max(128),
    confirmPassword: z.string().min(10),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'New password and confirmation do not match.',
    path: ['confirmPassword'],
  });

investorRouter.post('/account/change-password', async (req, res, next) => {
  try {
    const parsed = changePassSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid password update.' });
      return;
    }

    const db = getDb();
    const userId = req.authUser!.id;
    const user = await db('users').where({ id: userId }).first();
    if (!user || !(await verifyPassword(parsed.data.currentPassword, user.password_hash))) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    await db('users').where({ id: userId }).update({
      password_hash: newHash,
      updated_at: new Date(),
    });

    await createNotification({
      userId,
      category: 'security',
      title: 'Account Password Changed',
      message: 'Your investor portal password was successfully updated.',
    });

    await writeAuditLog({
      actorUserId: userId,
      action: 'investor.password_changed',
      entityType: 'user',
      entityId: userId,
      req,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

investorRouter.get('/notifications', async (req, res, next) => {
  try {
    const db = getDb();
    const notifications = await db('notifications')
      .where({ user_id: req.authUser!.id })
      .orderBy('created_at', 'desc')
      .limit(100);
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

investorRouter.post('/notifications/:id/read', async (req, res, next) => {
  try {
    const db = getDb();
    await db('notifications')
      .where({ id: Number(req.params.id), user_id: req.authUser!.id })
      .update({ is_read: true, read_at: new Date() });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

investorRouter.put('/profile', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;
    const user = await db('users').where({ id: userId }).first();
    const existingProfile = await db('investor_profiles').where({ user_id: userId }).first();

    if (!user || !existingProfile) {
      res.status(404).json({ error: 'Investor profile not found.' });
      return;
    }

    if (
      typeof req.body?.email === 'string' &&
      req.body.email.trim().toLowerCase() !== String(user.email).toLowerCase()
    ) {
      res.status(400).json({ error: 'Registered email address is locked and cannot be modified.' });
      return;
    }

    const schema = z.object({
      firstName: z.string().trim().min(1, 'First name is required.').max(100),
      middleName: z.string().trim().max(100).optional().default(''),
      lastName: z.string().trim().min(1, 'Last name is required.').max(100),
      telephone: z.string().trim().min(4, 'Telephone number is required.').max(40),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD.'),
      countryOfResidence: z.string().trim().min(2, 'Country of residence is required.').max(100),
      residentialAddress: z.string().trim().min(2, 'Residential address is required.').max(255),
      city: z.string().trim().min(1, 'City is required.').max(100),
      stateRegion: z.string().trim().min(1, 'State or region is required.').max(100),
      postalCode: z.string().trim().min(1, 'Postal code is required.').max(40),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile update.' });
      return;
    }

    const dob = new Date(parsed.data.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      res.status(400).json({ error: 'Invalid date of birth.' });
      return;
    }

    await db('investor_profiles').where({ user_id: userId }).update({
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
      updated_at: new Date(),
    });

    const updatedProfile = await db('investor_profiles').where({ user_id: userId }).first();

    await writeAuditLog({
      actorUserId: userId,
      action: 'investor.profile_updated',
      entityType: 'investor_profile',
      entityId: existingProfile.id,
      previousData: {
        first_name: existingProfile.first_name,
        last_name: existingProfile.last_name,
        telephone: existingProfile.telephone,
        country_of_residence: existingProfile.country_of_residence,
      },
      newData: parsed.data,
      req,
    });

    res.json({ ok: true, profile: updatedProfile });
  } catch (err) {
    next(err);
  }
});

investorRouter.get('/withdrawals', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;
    const [withdrawals, summary, payoutMethods] = await Promise.all([
      db('withdrawal_requests').where({ user_id: userId }).orderBy('created_at', 'desc'),
      computeInvestorWithdrawableSummary(db, userId),
      db('payment_methods').where({ is_enabled: true }).orderBy('sort_order', 'asc').orderBy('id', 'asc'),
    ]);
    res.json({ withdrawals, summary, payoutMethods });
  } catch (err) {
    next(err);
  }
});

investorRouter.post('/withdrawals', async (req, res, next) => {
  try {
    const schema = z.object({
      amount: z.number().positive('Withdrawal amount must be greater than 0.'),
      payoutMethod: z.string().trim().min(2, 'Select a payout method or network.').max(80),
      network: z.string().trim().max(80).optional().default(''),
      destinationAddress: z.string().trim().min(8, 'Enter a valid destination wallet address or account reference.').max(255),
      sourceType: z.enum(['available_balance', 'dividends', 'portfolio_returns']).optional().default('available_balance'),
      investorNotes: z.string().trim().max(500).optional().default(''),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid withdrawal request.' });
      return;
    }

    const db = getDb();
    const userId = req.authUser!.id;
    const user = await db('users').where({ id: userId }).first();
    const profile = await db('investor_profiles').where({ user_id: userId }).first();
    if (!user || user.account_status !== 'active' || !profile) {
      res.status(403).json({ error: 'Investor account is not active for withdrawals.' });
      return;
    }

    const amount = Number(parsed.data.amount.toFixed(2));
    const withdrawalReference = generateReference('RINV-WDR');
    let createdId = 0;

    try {
      await db.transaction(async (trx) => {
        const summary = await computeInvestorWithdrawableSummary(trx, userId);
        if (amount > summary.availableBalance) {
          throw new Error(
            `Requested withdrawal ($${amount.toLocaleString()}) exceeds your available withdrawable balance ($${summary.availableBalance.toLocaleString()}).`
          );
        }

        const [id] = await trx('withdrawal_requests').insert({
          withdrawal_reference: withdrawalReference,
          user_id: userId,
          amount,
          currency: 'USD',
          payout_method: parsed.data.payoutMethod,
          network: parsed.data.network || null,
          destination_address: parsed.data.destinationAddress,
          source_type: parsed.data.sourceType,
          status: 'pending',
          investor_notes: parsed.data.investorNotes || null,
        });
        createdId = id;
      });
    } catch (txErr: any) {
      if (txErr?.message?.includes('exceeds your available withdrawable balance')) {
        res.status(400).json({ error: txErr.message });
        return;
      }
      throw txErr;
    }

    const [created, summary] = await Promise.all([
      db('withdrawal_requests').where({ id: createdId }).first(),
      computeInvestorWithdrawableSummary(db, userId),
    ]);

    await createNotification({
      userId,
      category: 'withdrawal_request',
      title: `Withdrawal Request Submitted (${withdrawalReference})`,
      message: `Your withdrawal request for USD ${amount.toLocaleString()} via ${parsed.data.payoutMethod} has been logged for Treasury settlement.`,
      relatedEntityType: 'withdrawal_request',
      relatedEntityId: createdId,
    });

    await notifyAllAdmins(
      'withdrawal_request',
      `New Withdrawal Request (${withdrawalReference})`,
      `Investor ${profile.account_number} requested a withdrawal of USD ${amount.toLocaleString()} via ${parsed.data.payoutMethod}.`,
      'withdrawal_request',
      createdId
    );

    await writeAuditLog({
      actorUserId: userId,
      action: 'withdrawal.requested',
      entityType: 'withdrawal_request',
      entityId: createdId,
      newData: {
        withdrawalReference,
        amount,
        payoutMethod: parsed.data.payoutMethod,
        destinationAddress: parsed.data.destinationAddress,
      },
      req,
    });

    res.status(201).json({ ok: true, withdrawal: created, summary });
  } catch (err) {
    next(err);
  }
});

investorRouter.post('/withdrawals/:id/cancel', async (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.authUser!.id;
    const id = Number(req.params.id);
    const row = await db('withdrawal_requests').where({ id, user_id: userId }).first();
    if (!row) {
      res.status(404).json({ error: 'Withdrawal request not found.' });
      return;
    }
    if (row.status !== 'pending') {
      res.status(400).json({ error: 'Only pending withdrawal requests can be cancelled.' });
      return;
    }

    await db('withdrawal_requests').where({ id }).update({
      status: 'cancelled',
      updated_at: new Date(),
    });

    await writeAuditLog({
      actorUserId: userId,
      action: 'withdrawal.cancelled_by_investor',
      entityType: 'withdrawal_request',
      entityId: id,
      previousData: { status: row.status },
      newData: { status: 'cancelled' },
      req,
    });

    const summary = await computeInvestorWithdrawableSummary(db, userId);
    res.json({ ok: true, summary });
  } catch (err) {
    next(err);
  }
});

investorRouter.post('/notifications/read-all', async (req, res, next) => {
  try {
    const db = getDb();
    await db('notifications')
      .where({ user_id: req.authUser!.id, is_read: false })
      .update({ is_read: true, read_at: new Date() });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
