import type { Knex } from 'knex';
import type { AppMigration } from './001_initial_schema.ts';

export const migration004InvestmentPlansDurationUnit: AppMigration = {
  name: '004_investment_plans_duration_unit',
  async up(knex: Knex) {
    const hasUnit = await knex.schema.hasColumn('share_offerings', 'duration_unit');
    const hasValue = await knex.schema.hasColumn('share_offerings', 'duration_value');

    await knex.schema.alterTable('share_offerings', (t) => {
      if (!hasUnit) t.string('duration_unit', 16).notNullable().defaultTo('month');
      if (!hasValue) t.integer('duration_value').notNullable().defaultTo(0);
    });

    const rows = await knex('share_offerings').select(
      'id',
      'duration_unit',
      'duration_value',
      'duration_months',
      'duration_days',
      'duration_hours'
    );

    for (const r of rows as any[]) {
      if (Number(r.duration_value || 0) > 0 && r.duration_unit) continue;

      const m = Number(r.duration_months || 0);
      const d = Number(r.duration_days || 0);
      const h = Number(r.duration_hours || 0);

      let unit = 'month';
      let val = m;
      if (m > 0) {
        unit = 'month';
        val = m;
      } else if (d > 0) {
        unit = 'days';
        val = d;
      } else if (h > 0) {
        unit = 'hours';
        val = h;
      }

      await knex('share_offerings').where({ id: r.id }).update({
        duration_unit: unit,
        duration_value: val,
      });
    }
  },
  async down(knex: Knex) {
    await knex.schema.alterTable('share_offerings', (t) => {
      t.dropColumn('duration_unit');
      t.dropColumn('duration_value');
    });
  },
};
