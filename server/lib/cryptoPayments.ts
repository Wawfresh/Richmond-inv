import type { Knex } from 'knex';
import { generateReference } from './crypto.ts';

export type CryptoProcessingMode = 'manual' | 'automatic';
export type MethodProcessingMode = 'inherit' | 'manual' | 'automatic';

export interface CryptoProcessingSettings {
  processingMode: CryptoProcessingMode;
  autoAllocateShares: boolean;
  autoRequireFullAmount: boolean;
  autoMinTxidLength: number;
}

export async function getCryptoProcessingSettings(db: Knex): Promise<CryptoProcessingSettings> {
  const rows = await db('system_settings')
    .whereIn('setting_key', [
      'crypto_processing_mode',
      'crypto_auto_allocate_shares',
      'crypto_auto_require_full_amount',
      'crypto_auto_min_txid_length',
    ])
    .select('setting_key', 'setting_value');

  const map = new Map<string, string>(rows.map((r: any) => [r.setting_key, String(r.setting_value ?? '')]));
  const rawMode = map.get('crypto_processing_mode');
  const processingMode: CryptoProcessingMode = rawMode === 'automatic' ? 'automatic' : 'manual';
  const autoAllocateShares = map.get('crypto_auto_allocate_shares') !== 'false';
  const autoRequireFullAmount = map.get('crypto_auto_require_full_amount') !== 'false';
  const parsedMinTxid = Number(map.get('crypto_auto_min_txid_length') || 16);
  const autoMinTxidLength = Number.isFinite(parsedMinTxid) ? Math.max(8, Math.min(128, Math.floor(parsedMinTxid))) : 16;

  return {
    processingMode,
    autoAllocateShares,
    autoRequireFullAmount,
    autoMinTxidLength,
  };
}

export function resolveEffectiveProcessingMode(
  methodMode: string | null | undefined,
  globalMode: CryptoProcessingMode
): CryptoProcessingMode {
  if (methodMode === 'automatic') return 'automatic';
  if (methodMode === 'manual') return 'manual';
  return globalMode;
}

export async function evaluateAutomaticCryptoVerification(
  db: Knex,
  params: {
    txHash: string;
    submittedAmount: number;
    expectedAmount: number;
    minTxidLength: number;
    requireFullAmount: boolean;
    excludePaymentId?: number;
  }
): Promise<{ approved: boolean; reason: string }> {
  const tx = params.txHash.trim();
  if (tx.length < params.minTxidLength) {
    return {
      approved: false,
      reason: `Held for manual review: transaction hash length (${tx.length}) is below automatic threshold (${params.minTxidLength} characters).`,
    };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(tx)) {
    return {
      approved: false,
      reason: 'Held for manual review: transaction hash contains non-standard characters.',
    };
  }

  let dupQuery = db('payment_submissions')
    .whereRaw('LOWER(transaction_hash) = ?', [tx.toLowerCase()])
    .whereIn('status', ['submitted', 'verification_pending', 'approved']);
  if (params.excludePaymentId) {
    dupQuery = dupQuery.whereNot('id', params.excludePaymentId);
  }
  const duplicate = await dupQuery.first();
  if (duplicate) {
    return {
      approved: false,
      reason: `Held for manual review: transaction hash already appears on payment ${duplicate.payment_reference}.`,
    };
  }

  if (params.requireFullAmount && params.submittedAmount + 0.01 < params.expectedAmount) {
    return {
      approved: false,
      reason: `Held for manual review: remitted amount (${params.submittedAmount}) is below expected amount (${params.expectedAmount}).`,
    };
  }

  return {
    approved: true,
    reason: 'Automatically verified by Treasury Settlement Engine (unique TXID format & full requested amount matched).',
  };
}

export async function executeShareAllocationTx(
  trx: Knex.Transaction | Knex,
  requestRow: any,
  paymentSubmissionId: number | null,
  actorUserId: number | null
) {
  const existingAlloc = await trx('share_allocations').where({ investment_request_id: requestRow.id }).first();
  if (existingAlloc) {
    throw new Error('Shares have already been allocated for this investment request.');
  }

  const offering = await trx('share_offerings').where({ id: requestRow.offering_id }).first();
  if (!offering) {
    throw new Error('Investment plan not found.');
  }
  if (Number(offering.available_quantity) < Number(requestRow.requested_quantity)) {
    throw new Error(`Over-allocation prevented: only ${offering.available_quantity} units remain available.`);
  }

  // Optimistic concurrency guard preventing concurrent over-allocation on MySQL & SQLite
  const updatedOfferingRows = await trx('share_offerings')
    .where({ id: offering.id })
    .where('available_quantity', '>=', requestRow.requested_quantity)
    .update({
      available_quantity: Number(offering.available_quantity) - Number(requestRow.requested_quantity),
      updated_at: new Date(),
    });

  if (!updatedOfferingRows) {
    throw new Error('Concurrent allocation conflict detected. Please verify available share quantity.');
  }

  const allocationRef = generateReference('RINV-ALLOC');
  const txRef = generateReference('RINV-TX');
  const now = new Date();

  await trx('share_allocations').insert({
    allocation_reference: allocationRef,
    user_id: requestRow.user_id,
    offering_id: requestRow.offering_id,
    investment_request_id: requestRow.id,
    payment_submission_id: paymentSubmissionId,
    allocated_quantity: requestRow.requested_quantity,
    acquisition_price: requestRow.unit_price,
    total_cost: requestRow.total_amount,
    currency: requestRow.currency,
    allocated_by: actorUserId,
    allocated_at: now,
  });

  const existingPortfolio = await trx('investor_portfolios')
    .where({ user_id: requestRow.user_id, offering_id: requestRow.offering_id })
    .first();

  if (existingPortfolio) {
    const newShares = Number(existingPortfolio.total_shares) + Number(requestRow.requested_quantity);
    const newInvested = Number(existingPortfolio.total_invested_amount) + Number(requestRow.total_amount);
    const avgPrice = newShares > 0 ? Number((newInvested / newShares).toFixed(2)) : 0;

    await trx('investor_portfolios').where({ id: existingPortfolio.id }).update({
      total_shares: newShares,
      total_invested_amount: Number(newInvested.toFixed(2)),
      average_acquisition_price: avgPrice,
      updated_at: now,
    });
  } else {
    await trx('investor_portfolios').insert({
      user_id: requestRow.user_id,
      offering_id: requestRow.offering_id,
      total_shares: requestRow.requested_quantity,
      average_acquisition_price: requestRow.unit_price,
      total_invested_amount: requestRow.total_amount,
      currency: requestRow.currency,
      updated_at: now,
    });
  }

  await trx('portfolio_transactions').insert({
    transaction_reference: txRef,
    user_id: requestRow.user_id,
    offering_id: requestRow.offering_id,
    investment_request_id: requestRow.id,
    transaction_type: 'share_acquisition',
    quantity: requestRow.requested_quantity,
    unit_price: requestRow.unit_price,
    amount: requestRow.total_amount,
    currency: requestRow.currency,
    accounting_reference: allocationRef,
    description: `Share allocation for ${offering.title} (${requestRow.request_reference})`,
    recorded_by: actorUserId,
    occurred_at: now,
  });

  await trx('investment_requests').where({ id: requestRow.id }).update({
    status: 'completed',
    completed_at: now,
    reviewed_by: actorUserId,
    reviewed_at: now,
    updated_at: now,
  });

  return { allocationRef, txRef, offeringTitle: offering.title };
}
