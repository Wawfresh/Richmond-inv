import type { Knex } from 'knex';
import type { AppMigration } from './001_initial_schema.ts';

export const migration003InvestmentPlansMinMaxAmount: AppMigration = {
  name: '003_investment_plans_min_max_amount',
  async up(knex: Knex) {
    const hasMinAmt = await knex.schema.hasColumn('share_offerings', 'min_amount');
    const hasMaxAmt = await knex.schema.hasColumn('share_offerings', 'max_amount');

    await knex.schema.alterTable('share_offerings', (t) => {
      if (!hasMinAmt) t.decimal('min_amount', 18, 2).notNullable().defaultTo(0);
      if (!hasMaxAmt) t.decimal('max_amount', 18, 2).notNullable().defaultTo(0);
    });

    const rows = await knex('share_offerings').select('id', 'share_price', 'min_quantity', 'max_quantity', 'min_amount', 'max_amount');
    for (const r of rows as any[]) {
      const price = Number(r.share_price || 0);
      const minAmt = Number(r.min_amount || 0) > 0 ? Number(r.min_amount) : Number((Number(r.min_quantity || 1) * price).toFixed(2));
      const maxAmt = Number(r.max_amount || 0) > 0 ? Number(r.max_amount) : Number((Number(r.max_quantity || 1) * price).toFixed(2));
      await knex('share_offerings').where({ id: r.id }).update({
        min_amount: minAmt,
        max_amount: maxAmt,
      });
    }
  },
  async down(knex: Knex) {
    await knex.schema.alterTable('share_offerings', (t) => {
      t.dropColumn('min_amount');
      t.dropColumn('max_amount');
    });
  },
};
