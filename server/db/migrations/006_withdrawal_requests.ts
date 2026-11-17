import type { Knex } from 'knex';
import type { AppMigration } from './001_initial_schema.ts';

export const migration006WithdrawalRequests: AppMigration = {
  name: '006_withdrawal_requests',
  async up(knex: Knex) {
    const hasTable = await knex.schema.hasTable('withdrawal_requests');
    if (!hasTable) {
      await knex.schema.createTable('withdrawal_requests', (t) => {
        t.increments('id').primary();
        t.string('withdrawal_reference', 48).notNullable().unique();
        t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        t.decimal('amount', 18, 2).notNullable();
        t.string('currency', 12).notNullable().defaultTo('USD');
        t.string('payout_method', 80).notNullable();
        t.string('network', 80).nullable();
        t.string('destination_address', 255).notNullable();
        t.string('source_type', 40).notNullable().defaultTo('available_balance');
        t.string('status', 32).notNullable().defaultTo('pending');
        t.text('investor_notes').nullable();
        t.text('admin_notes').nullable();
        t.text('rejection_reason').nullable();
        t.string('transaction_hash', 191).nullable();
        t.integer('reviewed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
        t.timestamp('reviewed_at').nullable();
        t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
        t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
        t.index(['user_id', 'status']);
      });
    }
  },
  async down(knex: Knex) {
    await knex.schema.dropTableIfExists('withdrawal_requests');
  },
};
