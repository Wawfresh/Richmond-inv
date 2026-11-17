import type { Knex } from 'knex';

export interface AppMigration {
  name: string;
  up: (knex: Knex) => Promise<void>;
  down: (knex: Knex) => Promise<void>;
}

export const migration001InitialSchema: AppMigration = {
  name: '001_initial_schema',
  async up(knex: Knex) {
    await knex.schema.createTable('roles', (t) => {
      t.increments('id').primary();
      t.string('slug', 64).notNullable().unique();
      t.string('name', 120).notNullable();
      t.text('description').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    });

    await knex.schema.createTable('permissions', (t) => {
      t.increments('id').primary();
      t.string('key', 120).notNullable().unique();
      t.string('name', 120).notNullable();
      t.string('module', 80).notNullable();
      t.text('description').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    });

    await knex.schema.createTable('role_permissions', (t) => {
      t.integer('role_id').unsigned().notNullable().references('id').inTable('roles').onDelete('CASCADE');
      t.integer('permission_id').unsigned().notNullable().references('id').inTable('permissions').onDelete('CASCADE');
      t.primary(['role_id', 'permission_id']);
    });

    await knex.schema.createTable('users', (t) => {
      t.increments('id').primary();
      t.integer('role_id').unsigned().notNullable().references('id').inTable('roles').onDelete('RESTRICT');
      t.string('email', 191).notNullable().unique();
      t.string('password_hash', 255).notNullable();
      t.string('account_type', 24).notNullable().defaultTo('investor');
      t.string('account_status', 24).notNullable().defaultTo('active');
      t.integer('failed_login_attempts').notNullable().defaultTo(0);
      t.timestamp('locked_until').nullable();
      t.timestamp('last_login_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['account_type', 'account_status']);
    });

    await knex.schema.createTable('user_sessions', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('token_hash', 128).notNullable().unique();
      t.string('csrf_token', 128).notNullable();
      t.string('ip_address', 64).nullable();
      t.string('user_agent', 255).nullable();
      t.timestamp('expires_at').notNullable();
      t.timestamp('revoked_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['user_id', 'expires_at']);
    });

    await knex.schema.createTable('password_reset_tokens', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('token_hash', 128).notNullable().unique();
      t.timestamp('expires_at').notNullable();
      t.timestamp('used_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['user_id', 'expires_at']);
    });

    await knex.schema.createTable('investor_profiles', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
      t.string('account_number', 40).notNullable().unique();
      t.string('first_name', 100).notNullable();
      t.string('middle_name', 100).nullable();
      t.string('last_name', 100).notNullable();
      t.string('telephone', 40).notNullable();
      t.date('date_of_birth').notNullable();
      t.string('country_of_residence', 100).notNullable();
      t.string('residential_address', 255).notNullable();
      t.string('city', 100).notNullable();
      t.string('state_region', 100).notNullable();
      t.string('postal_code', 40).notNullable();
      t.string('kyc_status', 40).notNullable().defaultTo('not_submitted');
      t.timestamp('terms_accepted_at').notNullable();
      t.timestamp('privacy_accepted_at').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['kyc_status']);
    });

    await knex.schema.createTable('profile_change_requests', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('field_name', 80).notNullable();
      t.text('previous_value').nullable();
      t.text('requested_value').notNullable();
      t.text('reason').nullable();
      t.string('status', 32).notNullable().defaultTo('pending');
      t.integer('reviewed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.text('review_notes').nullable();
      t.timestamp('reviewed_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['user_id', 'status']);
    });

    await knex.schema.createTable('kyc_submissions', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('submission_reference', 48).notNullable().unique();
      t.string('document_type', 40).notNullable();
      t.string('document_number', 100).notNullable();
      t.string('issuing_country', 100).notNullable();
      t.date('expiry_date').notNullable();
      t.string('address_proof_type', 80).notNullable();
      t.string('status', 40).notNullable().defaultTo('submitted');
      t.text('investor_notes').nullable();
      t.text('admin_comments').nullable();
      t.integer('reviewed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('reviewed_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['user_id', 'status']);
    });

    await knex.schema.createTable('kyc_documents', (t) => {
      t.increments('id').primary();
      t.integer('kyc_submission_id').unsigned().notNullable().references('id').inTable('kyc_submissions').onDelete('CASCADE');
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('category', 40).notNullable();
      t.string('original_filename', 255).notNullable();
      t.string('stored_filename', 255).notNullable();
      t.string('mime_type', 120).notNullable();
      t.integer('file_size').notNullable();
      t.string('storage_path', 500).notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['kyc_submission_id']);
    });

    await knex.schema.createTable('kyc_status_history', (t) => {
      t.increments('id').primary();
      t.integer('kyc_submission_id').unsigned().notNullable().references('id').inTable('kyc_submissions').onDelete('CASCADE');
      t.string('from_status', 40).nullable();
      t.string('to_status', 40).notNullable();
      t.integer('changed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.text('notes').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    });

    await knex.schema.createTable('share_offerings', (t) => {
      t.increments('id').primary();
      t.string('reference_code', 48).notNullable().unique();
      t.string('title', 191).notNullable();
      t.string('slug', 191).notNullable().unique();
      t.string('sector', 120).notNullable();
      t.text('summary').notNullable();
      t.text('description').notNullable();
      t.string('currency', 12).notNullable().defaultTo('USD');
      t.decimal('share_price', 18, 2).notNullable();
      t.integer('min_quantity').notNullable().defaultTo(1);
      t.integer('max_quantity').notNullable().defaultTo(10000);
      t.integer('total_authorized_quantity').notNullable();
      t.integer('available_quantity').notNullable();
      t.date('opening_date').notNullable();
      t.date('closing_date').notNullable();
      t.string('status', 32).notNullable().defaultTo('draft');
      t.text('risk_disclosures').notNullable();
      t.boolean('requires_kyc').notNullable().defaultTo(true);
      t.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['status']);
    });

    await knex.schema.createTable('offering_documents', (t) => {
      t.increments('id').primary();
      t.integer('offering_id').unsigned().notNullable().references('id').inTable('share_offerings').onDelete('CASCADE');
      t.string('title', 191).notNullable();
      t.string('document_type', 64).notNullable();
      t.string('original_filename', 255).nullable();
      t.string('stored_filename', 255).nullable();
      t.string('mime_type', 120).nullable();
      t.integer('file_size').nullable();
      t.string('storage_path', 500).nullable();
      t.text('summary_notes').nullable();
      t.boolean('is_public').notNullable().defaultTo(true);
      t.integer('uploaded_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['offering_id']);
    });

    await knex.schema.createTable('investment_requests', (t) => {
      t.increments('id').primary();
      t.string('request_reference', 48).notNullable().unique();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('offering_id').unsigned().notNullable().references('id').inTable('share_offerings').onDelete('RESTRICT');
      t.integer('requested_quantity').notNullable();
      t.decimal('unit_price', 18, 2).notNullable();
      t.decimal('total_amount', 18, 2).notNullable();
      t.string('currency', 12).notNullable().defaultTo('USD');
      t.string('status', 48).notNullable().defaultTo('submitted');
      t.boolean('eligibility_passed').notNullable().defaultTo(false);
      t.boolean('terms_confirmed').notNullable().defaultTo(false);
      t.text('investor_notes').nullable();
      t.text('admin_notes').nullable();
      t.text('rejection_reason').nullable();
      t.string('idempotency_key', 128).nullable();
      t.integer('reviewed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('reviewed_at').nullable();
      t.timestamp('completed_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['user_id', 'status']);
      t.index(['offering_id', 'status']);
      t.unique(['user_id', 'idempotency_key']);
    });

    await knex.schema.createTable('investment_eligibility_records', (t) => {
      t.increments('id').primary();
      t.integer('investment_request_id').unsigned().nullable().references('id').inTable('investment_requests').onDelete('CASCADE');
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('offering_id').unsigned().notNullable().references('id').inTable('share_offerings').onDelete('CASCADE');
      t.boolean('kyc_verified').notNullable();
      t.boolean('account_active').notNullable();
      t.boolean('quantity_within_limits').notNullable();
      t.boolean('shares_available').notNullable();
      t.boolean('eligible').notNullable();
      t.text('evaluation_summary').notNullable();
      t.timestamp('evaluated_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['user_id', 'offering_id']);
    });

    await knex.schema.createTable('payment_methods', (t) => {
      t.increments('id').primary();
      t.string('code', 40).notNullable().unique();
      t.string('name', 120).notNullable();
      t.string('network', 80).notNullable();
      t.string('symbol', 24).notNullable();
      t.boolean('is_enabled').notNullable().defaultTo(true);
      t.integer('sort_order').notNullable().defaultTo(0);
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    });

    await knex.schema.createTable('payment_wallets', (t) => {
      t.increments('id').primary();
      t.integer('payment_method_id').unsigned().notNullable().references('id').inTable('payment_methods').onDelete('CASCADE');
      t.string('label', 120).notNullable();
      t.string('wallet_address', 191).notNullable();
      t.string('network', 80).notNullable();
      t.decimal('min_payment_amount', 18, 2).notNullable().defaultTo(100.0);
      t.text('payment_instructions').notNullable();
      t.boolean('is_active').notNullable().defaultTo(true);
      t.integer('updated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['payment_method_id', 'is_active']);
    });

    await knex.schema.createTable('payment_submissions', (t) => {
      t.increments('id').primary();
      t.string('payment_reference', 48).notNullable().unique();
      t.integer('investment_request_id').unsigned().notNullable().references('id').inTable('investment_requests').onDelete('CASCADE');
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('payment_method_id').unsigned().notNullable().references('id').inTable('payment_methods').onDelete('RESTRICT');
      t.integer('payment_wallet_id').unsigned().notNullable().references('id').inTable('payment_wallets').onDelete('RESTRICT');
      t.decimal('expected_amount', 18, 2).notNullable();
      t.string('currency', 12).notNullable().defaultTo('USD');
      t.decimal('submitted_amount', 18, 2).notNullable();
      t.string('transaction_hash', 191).notNullable();
      t.string('sender_wallet_address', 191).nullable();
      t.string('evidence_filename', 255).nullable();
      t.string('evidence_storage_path', 500).nullable();
      t.string('evidence_mime_type', 120).nullable();
      t.string('status', 48).notNullable().defaultTo('submitted');
      t.text('investor_notes').nullable();
      t.text('verification_notes').nullable();
      t.text('rejection_reason').nullable();
      t.integer('verified_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('verified_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['investment_request_id', 'status']);
      t.index(['user_id', 'status']);
    });

    await knex.schema.createTable('share_allocations', (t) => {
      t.increments('id').primary();
      t.string('allocation_reference', 48).notNullable().unique();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('offering_id').unsigned().notNullable().references('id').inTable('share_offerings').onDelete('RESTRICT');
      t.integer('investment_request_id').unsigned().notNullable().unique().references('id').inTable('investment_requests').onDelete('RESTRICT');
      t.integer('payment_submission_id').unsigned().nullable().references('id').inTable('payment_submissions').onDelete('SET NULL');
      t.integer('allocated_quantity').notNullable();
      t.decimal('acquisition_price', 18, 2).notNullable();
      t.decimal('total_cost', 18, 2).notNullable();
      t.string('currency', 12).notNullable().defaultTo('USD');
      t.integer('allocated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('allocated_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['user_id', 'offering_id']);
    });

    await knex.schema.createTable('investor_portfolios', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('offering_id').unsigned().notNullable().references('id').inTable('share_offerings').onDelete('RESTRICT');
      t.integer('total_shares').notNullable().defaultTo(0);
      t.decimal('average_acquisition_price', 18, 2).notNullable().defaultTo(0);
      t.decimal('total_invested_amount', 18, 2).notNullable().defaultTo(0);
      t.decimal('current_unit_valuation', 18, 2).nullable();
      t.timestamp('valuation_updated_at').nullable();
      t.text('valuation_notes').nullable();
      t.string('currency', 12).notNullable().defaultTo('USD');
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
      t.unique(['user_id', 'offering_id']);
    });

    await knex.schema.createTable('portfolio_transactions', (t) => {
      t.increments('id').primary();
      t.string('transaction_reference', 48).notNullable().unique();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('offering_id').unsigned().nullable().references('id').inTable('share_offerings').onDelete('SET NULL');
      t.integer('investment_request_id').unsigned().nullable().references('id').inTable('investment_requests').onDelete('SET NULL');
      t.string('transaction_type', 40).notNullable();
      t.integer('quantity').notNullable().defaultTo(0);
      t.decimal('unit_price', 18, 2).notNullable().defaultTo(0);
      t.decimal('amount', 18, 2).notNullable();
      t.string('currency', 12).notNullable().defaultTo('USD');
      t.string('accounting_reference', 80).nullable();
      t.text('description').notNullable();
      t.integer('recorded_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('occurred_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['user_id', 'occurred_at']);
    });

    await knex.schema.createTable('dividend_records', (t) => {
      t.increments('id').primary();
      t.string('dividend_reference', 48).notNullable().unique();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('offering_id').unsigned().notNullable().references('id').inTable('share_offerings').onDelete('RESTRICT');
      t.string('period_label', 80).notNullable();
      t.integer('shares_eligible').notNullable();
      t.decimal('rate_per_share', 18, 4).notNullable();
      t.decimal('gross_amount', 18, 2).notNullable();
      t.string('currency', 12).notNullable().defaultTo('USD');
      t.string('status', 32).notNullable().defaultTo('declared');
      t.string('accounting_reference', 80).notNullable();
      t.string('payment_reference', 120).nullable();
      t.text('notes').nullable();
      t.integer('recorded_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('declared_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('distributed_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['user_id', 'status']);
    });

    await knex.schema.createTable('notifications', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('category', 64).notNullable();
      t.string('title', 191).notNullable();
      t.text('message').notNullable();
      t.string('related_entity_type', 64).nullable();
      t.integer('related_entity_id').nullable();
      t.boolean('is_read').notNullable().defaultTo(false);
      t.timestamp('read_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['user_id', 'is_read']);
    });

    await knex.schema.createTable('announcements', (t) => {
      t.increments('id').primary();
      t.string('slug', 191).notNullable().unique();
      t.string('title', 191).notNullable();
      t.string('category', 80).notNullable();
      t.text('summary').notNullable();
      t.text('body').notNullable();
      t.boolean('is_published').notNullable().defaultTo(true);
      t.timestamp('published_at').defaultTo(knex.fn.now()).notNullable();
      t.integer('author_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['is_published', 'published_at']);
    });

    await knex.schema.createTable('website_pages', (t) => {
      t.increments('id').primary();
      t.string('slug', 120).notNullable().unique();
      t.string('title', 191).notNullable();
      t.string('subtitle', 255).nullable();
      t.string('hero_kicker', 120).nullable();
      t.text('content_json').notNullable();
      t.string('meta_description', 255).nullable();
      t.boolean('is_published').notNullable().defaultTo(true);
      t.integer('updated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    });

    await knex.schema.createTable('faq_entries', (t) => {
      t.increments('id').primary();
      t.string('category', 80).notNullable();
      t.string('question', 255).notNullable();
      t.text('answer').notNullable();
      t.integer('sort_order').notNullable().defaultTo(0);
      t.boolean('is_published').notNullable().defaultTo(true);
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    });

    await knex.schema.createTable('admin_audit_logs', (t) => {
      t.increments('id').primary();
      t.integer('actor_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.string('action', 120).notNullable();
      t.string('entity_type', 80).notNullable();
      t.string('entity_id', 80).nullable();
      t.text('previous_data_json').nullable();
      t.text('new_data_json').nullable();
      t.string('ip_address', 64).nullable();
      t.string('user_agent', 255).nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
      t.index(['entity_type', 'created_at']);
      t.index(['actor_user_id', 'created_at']);
    });

    await knex.schema.createTable('system_settings', (t) => {
      t.increments('id').primary();
      t.string('setting_key', 120).notNullable().unique();
      t.text('setting_value').notNullable();
      t.string('value_type', 32).notNullable().defaultTo('string');
      t.string('group_name', 64).notNullable().defaultTo('general');
      t.string('description', 255).nullable();
      t.boolean('is_public').notNullable().defaultTo(false);
      t.integer('updated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    });

    await knex.schema.createTable('contact_inquiries', (t) => {
      t.increments('id').primary();
      t.string('reference_code', 48).notNullable().unique();
      t.string('full_name', 150).notNullable();
      t.string('email', 191).notNullable();
      t.string('organization', 150).nullable();
      t.string('subject', 191).notNullable();
      t.text('message').notNullable();
      t.string('status', 32).notNullable().defaultTo('new');
      t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    });
  },
  async down(knex: Knex) {
    const tables = [
      'contact_inquiries',
      'system_settings',
      'admin_audit_logs',
      'faq_entries',
      'website_pages',
      'announcements',
      'notifications',
      'dividend_records',
      'portfolio_transactions',
      'investor_portfolios',
      'share_allocations',
      'payment_submissions',
      'payment_wallets',
      'payment_methods',
      'investment_eligibility_records',
      'investment_requests',
      'offering_documents',
      'share_offerings',
      'kyc_status_history',
      'kyc_documents',
      'kyc_submissions',
      'profile_change_requests',
      'investor_profiles',
      'password_reset_tokens',
      'user_sessions',
      'users',
      'role_permissions',
      'permissions',
      'roles',
    ];
    for (const table of tables) {
      await knex.schema.dropTableIfExists(table);
    }
  },
};
