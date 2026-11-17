import { getDb } from './connection.ts';
import { migration001InitialSchema, type AppMigration } from './migrations/001_initial_schema.ts';
import { migration002InvestmentPlansRoiDuration } from './migrations/002_investment_plans_roi_duration.ts';
import { migration003InvestmentPlansMinMaxAmount } from './migrations/003_investment_plans_min_max_amount.ts';
import { migration004InvestmentPlansDurationUnit } from './migrations/004_investment_plans_duration_unit.ts';
import { migration005CryptoPaymentProcessing } from './migrations/005_crypto_payment_processing.ts';
import { migration006WithdrawalRequests } from './migrations/006_withdrawal_requests.ts';

const MIGRATIONS: AppMigration[] = [
  migration001InitialSchema,
  migration002InvestmentPlansRoiDuration,
  migration003InvestmentPlansMinMaxAmount,
  migration004InvestmentPlansDurationUnit,
  migration005CryptoPaymentProcessing,
  migration006WithdrawalRequests,
];

export async function runMigrations(): Promise<string[]> {
  const db = getDb();
  const hasMigrationsTable = await db.schema.hasTable('schema_migrations');
  if (!hasMigrationsTable) {
    await db.schema.createTable('schema_migrations', (t) => {
      t.increments('id').primary();
      t.string('name', 191).notNullable().unique();
      t.timestamp('applied_at').defaultTo(db.fn.now()).notNullable();
    });
  }

  const appliedRows = await db('schema_migrations').select('name');
  const applied = new Set(appliedRows.map((r: { name: string }) => r.name));
  const newlyApplied: string[] = [];

  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.name)) {
      await migration.up(db);
      await db('schema_migrations').insert({ name: migration.name });
      newlyApplied.push(migration.name);
    }
  }

  return newlyApplied;
}
