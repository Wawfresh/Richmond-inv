import type { Knex } from 'knex';
import type { AppMigration } from './001_initial_schema.ts';

const PREVIOUS_DEFAULT_ADDRESS = '24 Bishopsgate, London EC2N 4BQ, United Kingdom';
const NEW_DEFAULT_ADDRESS = 'Saint Johns, Auckland, 1072, New Zealand';

export const migration007UpdateHeadquartersAddress: AppMigration = {
  name: '007_update_headquarters_address',
  async up(db: Knex) {
    const hasTable = await db.schema.hasTable('system_settings');
    if (!hasTable) return;

    await db('system_settings')
      .where({
        setting_key: 'headquarters_address',
        setting_value: PREVIOUS_DEFAULT_ADDRESS,
      })
      .update({
        setting_value: NEW_DEFAULT_ADDRESS,
        updated_at: db.fn.now(),
      });
  },
  async down(db: Knex) {
    const hasTable = await db.schema.hasTable('system_settings');
    if (!hasTable) return;

    await db('system_settings')
      .where({
        setting_key: 'headquarters_address',
        setting_value: NEW_DEFAULT_ADDRESS,
      })
      .update({
        setting_value: PREVIOUS_DEFAULT_ADDRESS,
        updated_at: db.fn.now(),
      });
  },
};
