import type { Knex } from 'knex';
import type { AppMigration } from './001_initial_schema.ts';

export const migration005CryptoPaymentProcessing: AppMigration = {
  name: '005_crypto_payment_processing',
  async up(knex: Knex) {
    const hasMethodMode = await knex.schema.hasColumn('payment_methods', 'processing_mode');
    if (!hasMethodMode) {
      await knex.schema.alterTable('payment_methods', (t) => {
        t.string('processing_mode', 24).notNullable().defaultTo('inherit');
      });
    }

    const hasSubMode = await knex.schema.hasColumn('payment_submissions', 'processing_mode');
    if (!hasSubMode) {
      await knex.schema.alterTable('payment_submissions', (t) => {
        t.string('processing_mode', 24).notNullable().defaultTo('manual');
        t.timestamp('auto_verified_at').nullable();
        t.string('verification_channel', 64).nullable();
      });
    }
  },
  async down(knex: Knex) {
    const hasMethodMode = await knex.schema.hasColumn('payment_methods', 'processing_mode');
    if (hasMethodMode) {
      await knex.schema.alterTable('payment_methods', (t) => {
        t.dropColumn('processing_mode');
      });
    }

    const hasSubMode = await knex.schema.hasColumn('payment_submissions', 'processing_mode');
    if (hasSubMode) {
      await knex.schema.alterTable('payment_submissions', (t) => {
        t.dropColumn('processing_mode');
        t.dropColumn('auto_verified_at');
        t.dropColumn('verification_channel');
      });
    }
  },
};
