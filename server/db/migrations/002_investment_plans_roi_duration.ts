import type { Knex } from 'knex';
import type { AppMigration } from './001_initial_schema.ts';

export const migration002InvestmentPlansRoiDuration: AppMigration = {
  name: '002_investment_plans_roi_duration',
  async up(knex: Knex) {
    const hasRoi = await knex.schema.hasColumn('share_offerings', 'roi_percent');
    const hasMonths = await knex.schema.hasColumn('share_offerings', 'duration_months');
    const hasDays = await knex.schema.hasColumn('share_offerings', 'duration_days');
    const hasHours = await knex.schema.hasColumn('share_offerings', 'duration_hours');

    await knex.schema.alterTable('share_offerings', (t) => {
      if (!hasRoi) t.decimal('roi_percent', 8, 2).notNullable().defaultTo(0);
      if (!hasMonths) t.integer('duration_months').notNullable().defaultTo(0);
      if (!hasDays) t.integer('duration_days').notNullable().defaultTo(0);
      if (!hasHours) t.integer('duration_hours').notNullable().defaultTo(0);
    });

    // Populate sensible baseline terms for initial seeded tranches if still at defaults
    const defaultsByRef: Record<string, { roi_percent: number; duration_months: number; duration_days: number; duration_hours: number }> = {
      'RINV-OFF-2026-01': { roi_percent: 12.5, duration_months: 12, duration_days: 0, duration_hours: 0 },
      'RINV-OFF-2026-02': { roi_percent: 8.5, duration_months: 6, duration_days: 0, duration_hours: 0 },
      'RINV-OFF-2026-03': { roi_percent: 16.0, duration_months: 18, duration_days: 0, duration_hours: 0 },
    };

    for (const [ref, vals] of Object.entries(defaultsByRef)) {
      const row = await knex('share_offerings').where({ reference_code: ref }).first();
      if (row && Number(row.roi_percent || 0) === 0 && Number(row.duration_months || 0) === 0 && Number(row.duration_days || 0) === 0 && Number(row.duration_hours || 0) === 0) {
        await knex('share_offerings').where({ id: row.id }).update(vals);
      }
    }
  },
  async down(knex: Knex) {
    await knex.schema.alterTable('share_offerings', (t) => {
      t.dropColumn('roi_percent');
      t.dropColumn('duration_months');
      t.dropColumn('duration_days');
      t.dropColumn('duration_hours');
    });
  },
};
