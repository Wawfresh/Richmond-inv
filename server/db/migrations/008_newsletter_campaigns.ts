import type { Knex } from 'knex';
import type { AppMigration } from './001_initial_schema.ts';

export const migration008NewsletterCampaigns: AppMigration = {
  name: '008_newsletter_campaigns',
  async up(db: Knex) {
    const hasCampaigns = await db.schema.hasTable('newsletter_campaigns');
    if (!hasCampaigns) {
      await db.schema.createTable('newsletter_campaigns', (t) => {
        t.increments('id').primary();
        t.string('campaign_reference', 48).notNullable().unique();
        t.string('subject', 255).notNullable();
        t.string('headline', 255).nullable();
        t.text('body').notNullable();
        t.string('cta_label', 120).nullable();
        t.string('cta_url', 500).nullable();
        t.string('audience_type', 40).notNullable().defaultTo('all_active');
        t.integer('recipient_count').notNullable().defaultTo(0);
        t.integer('sent_count').notNullable().defaultTo(0);
        t.integer('failed_count').notNullable().defaultTo(0);
        t.string('status', 40).notNullable().defaultTo('sent');
        t.text('error_summary').nullable();
        t.integer('sent_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
        t.timestamp('created_at').defaultTo(db.fn.now()).notNullable();
      });
    }

    const hasSettings = await db.schema.hasTable('system_settings');
    if (hasSettings) {
      const extraSmtpSettings = [
        {
          setting_key: 'smtp_secure',
          setting_value: 'true',
          value_type: 'boolean',
          group_name: 'smtp',
          description: 'Use implicit TLS/SSL (true for port 465, false for STARTTLS port 587)',
          is_public: false,
        },
        {
          setting_key: 'smtp_pass',
          setting_value: '',
          value_type: 'secret',
          group_name: 'smtp',
          description: 'Outbound SMTP account password (stored privately; optional if set in .env)',
          is_public: false,
        },
      ];

      for (const setting of extraSmtpSettings) {
        const exists = await db('system_settings').where({ setting_key: setting.setting_key }).first();
        if (!exists) {
          await db('system_settings').insert(setting);
        }
      }
    }
  },
  async down(db: Knex) {
    await db.schema.dropTableIfExists('newsletter_campaigns');
  },
};
