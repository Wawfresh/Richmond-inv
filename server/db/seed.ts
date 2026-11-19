import bcrypt from 'bcryptjs';
import { getDb } from './connection.ts';

export async function runBootstrapSeed(): Promise<void> {
  const db = getDb();

  // 1. Seed Roles
  const roleSeeds = [
    { slug: 'super_admin', name: 'Super Administrator', description: 'Full institutional platform governance, configuration, and financial authorization.' },
    { slug: 'compliance_officer', name: 'Compliance Officer', description: 'KYC document verification, investor eligibility, and regulatory compliance oversight.' },
    { slug: 'operations_admin', name: 'Operations Administrator', description: 'Share offerings, investment request review, payment verification, and portfolio administration.' },
    { slug: 'investor', name: 'Investor', description: 'Registered private or institutional investor account.' },
  ];

  for (const role of roleSeeds) {
    const existing = await db('roles').where({ slug: role.slug }).first();
    if (!existing) {
      await db('roles').insert(role);
    }
  }

  // 2. Seed Permissions
  const permissionSeeds = [
    { key: 'investors.view', name: 'View Investors', module: 'investors', description: 'View investor directory and profiles' },
    { key: 'investors.manage', name: 'Manage Investors', module: 'investors', description: 'Suspend, reactivate, and approve profile changes' },
    { key: 'kyc.review', name: 'Review KYC', module: 'kyc', description: 'Inspect KYC documents and approve/reject verification' },
    { key: 'offerings.manage', name: 'Manage Share Offerings', module: 'offerings', description: 'Create, edit, publish, suspend, and close share offerings' },
    { key: 'investments.manage', name: 'Manage Investment Requests', module: 'investments', description: 'Review and update investment request statuses' },
    { key: 'payments.manage', name: 'Manage Crypto Payments', module: 'payments', description: 'Configure wallets and verify/reject submitted payments' },
    { key: 'portfolio.manage', name: 'Manage Portfolios & Dividends', module: 'portfolio', description: 'Record share allocations, valuations, and dividend distributions' },
    { key: 'cms.manage', name: 'Manage Corporate Content', module: 'cms', description: 'Edit website pages, announcements, and FAQs' },
    { key: 'settings.manage', name: 'Manage System Settings', module: 'settings', description: 'Configure corporate details, currency, SMTP, and permissions' },
    { key: 'reports.view', name: 'View & Export Reports', module: 'reports', description: 'Access financial, KYC, and audit reports' },
  ];

  for (const perm of permissionSeeds) {
    const existing = await db('permissions').where({ key: perm.key }).first();
    if (!existing) {
      await db('permissions').insert(perm);
    }
  }

  const allRoles = await db('roles').select('id', 'slug');
  const allPerms = await db('permissions').select('id', 'key');
  const roleBySlug = new Map(allRoles.map((r: any) => [r.slug, r.id]));
  const permByKey = new Map(allPerms.map((p: any) => [p.key, p.id]));

  const rolePermMap: Record<string, string[]> = {
    super_admin: permissionSeeds.map((p) => p.key),
    compliance_officer: ['investors.view', 'investors.manage', 'kyc.review', 'reports.view'],
    operations_admin: ['investors.view', 'offerings.manage', 'investments.manage', 'payments.manage', 'portfolio.manage', 'cms.manage', 'reports.view'],
    investor: [],
  };

  for (const [slug, keys] of Object.entries(rolePermMap)) {
    const roleId = roleBySlug.get(slug);
    if (!roleId) continue;
    for (const key of keys) {
      const permId = permByKey.get(key);
      if (!permId) continue;
      const exists = await db('role_permissions').where({ role_id: roleId, permission_id: permId }).first();
      if (!exists) {
        await db('role_permissions').insert({ role_id: roleId, permission_id: permId });
      }
    }
  }

  // 3. Bootstrap Initial Administrator Account ONLY (no fake investor accounts)
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@richmond-inv.com').toLowerCase();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'RichmondAdmin!2026';
  const superAdminRoleId = roleBySlug.get('super_admin');
  const existingAdmin = await db('users').where({ email: adminEmail }).first();
  if (!existingAdmin && superAdminRoleId) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db('users').insert({
      role_id: superAdminRoleId,
      email: adminEmail,
      password_hash: passwordHash,
      account_type: 'admin',
      account_status: 'active',
    });
  }

  // 4. Seed System Settings (administrator-configurable corporate & operational settings)
  const settingSeeds = [
    { setting_key: 'company_name', setting_value: 'RICHMOND-INV', value_type: 'string', group_name: 'corporate', description: 'Primary institutional wordmark', is_public: true },
    { setting_key: 'company_legal_name', setting_value: 'Richmond Investment Holdings Ltd.', value_type: 'string', group_name: 'corporate', description: 'Legal entity name (configure in Admin Settings)', is_public: true },
    { setting_key: 'company_registration_note', setting_value: '', value_type: 'string', group_name: 'corporate', description: 'Administrator-managed legal registration notice', is_public: true },
    { setting_key: 'headquarters_address', setting_value: '24 Bishopsgate, London EC2N 4BQ, United Kingdom', value_type: 'string', group_name: 'corporate', description: 'Corporate office address', is_public: true },
    { setting_key: 'contact_email', setting_value: 'investor.relations@richmond-inv.com', value_type: 'string', group_name: 'corporate', description: 'Investor relations contact email', is_public: true },
    { setting_key: 'contact_phone', setting_value: '+44 20 7946 0180', value_type: 'string', group_name: 'corporate', description: 'Investor relations telephone', is_public: true },
    { setting_key: 'base_currency', setting_value: 'USD', value_type: 'string', group_name: 'financial', description: 'Platform base settlement currency', is_public: true },
    { setting_key: 'require_kyc_for_investment', setting_value: 'true', value_type: 'boolean', group_name: 'compliance', description: 'Require approved KYC before submitting investment orders', is_public: true },
    { setting_key: 'max_login_attempts', setting_value: '5', value_type: 'number', group_name: 'security', description: 'Failed login threshold before temporary lock', is_public: false },
    { setting_key: 'lockout_minutes', setting_value: '15', value_type: 'number', group_name: 'security', description: 'Temporary lockout duration in minutes', is_public: false },
    { setting_key: 'smtp_host', setting_value: '', value_type: 'string', group_name: 'smtp', description: 'Outbound SMTP host', is_public: false },
    { setting_key: 'smtp_port', setting_value: '465', value_type: 'number', group_name: 'smtp', description: 'Outbound SMTP port', is_public: false },
    { setting_key: 'smtp_user', setting_value: '', value_type: 'string', group_name: 'smtp', description: 'Outbound SMTP username', is_public: false },
    { setting_key: 'smtp_from', setting_value: 'Investor Relations <noreply@richmond-inv.com>', value_type: 'string', group_name: 'smtp', description: 'Outbound SMTP sender header', is_public: false },
    { setting_key: 'crypto_processing_mode', setting_value: 'manual', value_type: 'string', group_name: 'payments', description: 'Default crypto settlement mode: manual or automatic', is_public: false },
    { setting_key: 'crypto_auto_allocate_shares', setting_value: 'true', value_type: 'boolean', group_name: 'payments', description: 'Automatically allocate shares upon automatic payment confirmation', is_public: false },
    { setting_key: 'crypto_auto_require_full_amount', setting_value: 'true', value_type: 'boolean', group_name: 'payments', description: 'Require remitted amount to cover requested investment amount for automatic processing', is_public: false },
    { setting_key: 'crypto_auto_min_txid_length', setting_value: '16', value_type: 'number', group_name: 'payments', description: 'Minimum blockchain TXID character length for automatic processing', is_public: false },
  ];

  for (const s of settingSeeds) {
    const existing = await db('system_settings').where({ setting_key: s.setting_key }).first();
    if (!existing) {
      await db('system_settings').insert(s);
    }
  }

  // 5. Seed Supported Cryptocurrency Payment Methods & Configurable Wallets (zero private keys)
  const paymentMethodSeeds = [
    { code: 'BTC', name: 'Bitcoin', network: 'Bitcoin Mainnet', symbol: 'BTC', is_enabled: true, sort_order: 1 },
    { code: 'ETH', name: 'Ethereum', network: 'Ethereum ERC20', symbol: 'ETH', is_enabled: true, sort_order: 2 },
    { code: 'USDT_TRC20', name: 'Tether USD (TRC20)', network: 'TRON TRC20', symbol: 'USDT', is_enabled: true, sort_order: 3 },
    { code: 'USDT_ERC20', name: 'Tether USD (ERC20)', network: 'Ethereum ERC20', symbol: 'USDT', is_enabled: true, sort_order: 4 },
  ];

  for (const pm of paymentMethodSeeds) {
    const existing = await db('payment_methods').where({ code: pm.code }).first();
    if (!existing) {
      await db('payment_methods').insert(pm);
    }
  }

  const methods = await db('payment_methods').select('id', 'code', 'network');
  const walletDefaults: Record<string, { label: string; wallet_address: string; min_payment_amount: number; payment_instructions: string }> = {
    BTC: {
      label: 'Primary BTC Treasury Custody Address',
      wallet_address: 'bc1qrichmondcustodyconfigureinadmin00000000',
      min_payment_amount: 500,
      payment_instructions: 'Transfer the exact USD-equivalent BTC value over Bitcoin Mainnet. Record your transaction hash (TXID) and upload confirmation evidence for manual treasury reconciliation.',
    },
    ETH: {
      label: 'Primary ETH Treasury Custody Address',
      wallet_address: '0x0000000000000000000000000000RICHMONDETH0',
      min_payment_amount: 500,
      payment_instructions: 'Send funds strictly on Ethereum Mainnet (ERC20). Do not send via Layer-2 bridges unless instructed by Treasury Operations. Submit TXID after broadcast.',
    },
    USDT_TRC20: {
      label: 'USDT TRC20 Settlement Wallet',
      wallet_address: 'TRichmondTreasuryConfigureInAdminPortal000',
      min_payment_amount: 250,
      payment_instructions: 'Transfer USDT strictly via TRON (TRC20) network. Verify destination address character-for-character before signing.',
    },
    USDT_ERC20: {
      label: 'USDT ERC20 Settlement Wallet',
      wallet_address: '0x000000000000000000000000000RICHMONDUSDT0',
      min_payment_amount: 250,
      payment_instructions: 'Transfer USDT strictly via Ethereum Mainnet (ERC20). Include transaction hash and screenshot or explorer receipt.',
    },
  };

  for (const m of methods) {
    const existingWallet = await db('payment_wallets').where({ payment_method_id: m.id }).first();
    if (!existingWallet && walletDefaults[m.code]) {
      const w = walletDefaults[m.code];
      await db('payment_wallets').insert({
        payment_method_id: m.id,
        label: w.label,
        wallet_address: w.wallet_address,
        network: m.network,
        min_payment_amount: w.min_payment_amount,
        payment_instructions: w.payment_instructions,
        is_active: true,
      });
    }
  }

  // 6. Seed Corporate Website Pages (Editable from Admin CMS)
  const pageSeeds = [
    {
      slug: 'homepage',
      title: 'Disciplined Capital Stewardship for Global Share Offerings',
      subtitle: 'RICHMOND-INV structures direct equity and fixed-income participation offerings for verified private and institutional investors under transparent governance.',
      hero_kicker: 'Institutional Share & Asset Stewardship',
      meta_description: 'RICHMOND-INV provides structured corporate share offerings, verified investor onboarding, and institutional portfolio administration.',
      content_json: JSON.stringify({
        introHeading: 'Institutional Rigor, Direct Shareholder Access',
        introBody: 'RICHMOND-INV operates a unified investment and investor relations architecture designed to connect qualified capital with long-horizon real asset, infrastructure, and industrial equity tranches.',
        pillars: [
          { index: '01', title: 'Direct Share Issuance', body: 'Structured participation across vetted corporate equity and preference share tranches with transparent pricing and allocation limits.' },
          { index: '02', title: 'Verified Compliance Workflow', body: 'Mandatory identity verification, documented suitability checks, and full administrative audit trails prior to capital settlement.' },
          { index: '03', title: 'Auditable Digital Settlement', body: 'Administrator-verified cryptocurrency settlement across Bitcoin, Ethereum, and Tether rails with manual treasury reconciliation.' },
          { index: '04', title: 'Transparent Portfolio Ledger', body: 'Real-time visibility into share allocations, acquisition cost basis, authorized valuation updates, and declared dividend records.' },
        ],
        processSteps: [
          { step: '01', title: 'Investor Registration & KYC', description: 'Complete your investor profile and submit identity and address verification documents through our encrypted private portal.' },
          { step: '02', title: 'Offering Selection & Eligibility', description: 'Review offering prospectuses, risk disclosures, and minimum/maximum share limits before submitting an investment request.' },
          { step: '03', title: 'Treasury Settlement Verification', description: 'Upon request approval, remit settlement via configured cryptocurrency channels and submit the transaction hash for treasury review.' },
          { step: '04', title: 'Share Allocation & Reporting', description: 'Once payment is verified by an authorized administrator, shares are formally allocated to your portfolio ledger with downloadable statements.' },
        ],
        benefits: [
          { title: 'Segregated Investor Ledgers', description: 'Every shareholding, transaction, and dividend entry is tied to an explicit administrative accounting reference.' },
          { title: 'Institutional Governance', description: 'Multi-role compliance and operations controls prevent unauthorized allocations or unverified payment confirmations.' },
          { title: 'On-Demand Documentation', description: 'Access offering memoranda, risk disclosures, and printable portfolio statements directly from your investor dashboard.' },
        ],
      }),
    },
    {
      slug: 'about',
      title: 'About RICHMOND-INV',
      subtitle: 'Built on long-term capital preservation, disciplined underwriting, and accountable shareholder communication.',
      hero_kicker: 'Institutional Identity',
      meta_description: 'Learn about RICHMOND-INV heritage, fiduciary standards, and institutional investment administration.',
      content_json: JSON.stringify({
        sections: [
          { heading: 'Our Mandate', body: 'RICHMOND-INV was established to provide structured corporate share offerings with institutional-grade investor relations, rigorous compliance review, and transparent ledger administration.' },
          { heading: 'Fiduciary & Operational Discipline', body: 'Every offering listed on the RICHMOND-INV platform undergoes internal structuring, explicit risk disclosure documentation, and multi-stage allocation oversight. Capital movements are never self-certified; all settlements are reconciled by authorized treasury administrators.' },
          { heading: 'International Investor Reach', body: 'Our platform serves verified private and corporate participants across international jurisdictions, supporting transparent onboarding, profile governance, and structured reporting.' },
        ],
      }),
    },
    {
      slug: 'company-overview',
      title: 'Company Overview',
      subtitle: 'Operational structure, capital allocation framework, and shareholder administration.',
      hero_kicker: 'Corporate Profile',
      meta_description: 'Overview of RICHMOND-INV corporate operations, capital structure, and investor services.',
      content_json: JSON.stringify({
        sections: [
          { heading: 'Corporate Architecture', body: 'RICHMOND-INV integrates public investor communications, regulated onboarding workflows, offering management, and portfolio accounting inside a single auditable platform.' },
          { heading: 'Separation of Duties', body: 'Compliance officers oversee identity verification and account standing, while operations administrators manage share offerings, treasury reconciliation, and dividend declarations.' },
        ],
      }),
    },
    {
      slug: 'investment-philosophy',
      title: 'Investment Philosophy',
      subtitle: 'Capital preservation first, measured risk exposure, and alignment between issuers and shareholders.',
      hero_kicker: 'Guiding Principles',
      meta_description: 'RICHMOND-INV investment philosophy anchored in fundamental valuation and downside discipline.',
      content_json: JSON.stringify({
        sections: [
          { heading: 'Fundamental Underwriting', body: 'We evaluate every underlying asset and corporate tranche on cash-flow durability, balance-sheet resilience, and identifiable collateral backing rather than short-term market sentiment.' },
          { heading: 'Zero Guaranteed Return Claims', body: 'All equity and participation offerings carry capital risk. RICHMOND-INV explicitly prohibits speculative return guarantees and discloses material risk factors prior to every order.' },
        ],
      }),
    },
    {
      slug: 'investment-strategy',
      title: 'Investment Strategy',
      subtitle: 'Focused deployment across infrastructure, essential industrials, and sovereign-linked credit participations.',
      hero_kicker: 'Capital Deployment',
      meta_description: 'Strategic sector focus and portfolio construction methodology at RICHMOND-INV.',
      content_json: JSON.stringify({
        sections: [
          { heading: 'Core Allocation Sectors', body: 'Offerings span contracted infrastructure concessions, mid-market industrial equity, and structured income participations engineered for predictable operating cash flows.' },
          { heading: 'Tranche Sizing & Liquidity Planning', body: 'Each offering specifies authorized share pools, minimum subscription thresholds, maximum per-investor concentration caps, and defined subscription windows.' },
        ],
      }),
    },
    {
      slug: 'portfolio-information',
      title: 'Portfolio Information',
      subtitle: 'How holdings, acquisition prices, valuations, and dividend distributions are recorded.',
      hero_kicker: 'Shareholder Accounting',
      meta_description: 'Understand portfolio accounting, share allocation records, and dividend tracking on RICHMOND-INV.',
      content_json: JSON.stringify({
        sections: [
          { heading: 'Verified Ledger Accounting', body: 'Investor portfolios reflect only formally approved and settled share allocations. Pending requests and unverified payment submissions never inflate reported holdings.' },
          { heading: 'Statements & Valuations', body: 'Valuations are updated exclusively from authorized administrative entries, and investors may export printable portfolio statements and CSV transaction histories at any time.' },
        ],
      }),
    },
    {
      slug: 'investor-relations',
      title: 'Investor Relations',
      subtitle: 'Dedicated shareholder communications, announcements, and compliance correspondence.',
      hero_kicker: 'Shareholder Desk',
      meta_description: 'RICHMOND-INV Investor Relations hub for corporate notices, documentation, and shareholder inquiries.',
      content_json: JSON.stringify({
        sections: [
          { heading: 'Continuous Disclosure', body: 'Material updates regarding share offerings, settlement protocols, governance resolutions, and distribution schedules are published through our official Announcements register.' },
          { heading: 'Shareholder Support', body: 'Verified investors may submit profile update requests, track compliance reviews, and communicate with our Investor Relations desk through the Contact page or portal notifications.' },
        ],
      }),
    },
    {
      slug: 'corporate-governance',
      title: 'Corporate Governance',
      subtitle: 'Internal controls, audit logging, role-based access enforcement, and ethical standards.',
      hero_kicker: 'Governance Framework',
      meta_description: 'RICHMOND-INV corporate governance standards, administrative controls, and audit logging.',
      content_json: JSON.stringify({
        sections: [
          { heading: 'Auditability & Oversight', body: 'Every administrative decision—including KYC approvals, offering status changes, payment verifications, share allocations, and profile amendments—is recorded in an immutable audit log.' },
          { heading: 'Configurable Legal Disclosures', body: 'Company registration numbers, jurisdictional disclosures, and regulatory notices are maintained by authorized administrators to remain accurate and verifiable.' },
        ],
      }),
    },
    {
      slug: 'risk-disclosures',
      title: 'Risk Disclosures',
      subtitle: 'Important information regarding capital risk, illiquidity, and digital asset settlement.',
      hero_kicker: 'Regulatory & Capital Risk',
      meta_description: 'Comprehensive investment and settlement risk disclosures for RICHMOND-INV participants.',
      content_json: JSON.stringify({
        sections: [
          { heading: 'Capital at Risk', body: 'Investing in corporate shares and private placement offerings involves substantial risk, including the possible loss of the entire invested capital. Past performance is not indicative of future results.' },
          { heading: 'Digital Asset Settlement Risks', body: 'Cryptocurrency transfers are irreversible. Investors must verify the exact destination address, blockchain network, and minimum settlement threshold prior to initiating any transfer.' },
        ],
      }),
    },
    {
      slug: 'privacy-policy',
      title: 'Privacy Policy',
      subtitle: 'How RICHMOND-INV collects, stores, and protects investor personal and KYC records.',
      hero_kicker: 'Data Protection',
      meta_description: 'RICHMOND-INV privacy policy governing investor registration data and private KYC document storage.',
      content_json: JSON.stringify({
        sections: [
          { heading: 'Purpose of Data Collection', body: 'Personal identification, residential address, and identity documentation are collected strictly for investor onboarding, KYC verification, share registry administration, and legal compliance.' },
          { heading: 'Document Security', body: 'Uploaded KYC files and payment evidence are stored in restricted directories outside public web roots and are accessible solely to the owning investor and authorized compliance administrators.' },
        ],
      }),
    },
    {
      slug: 'terms-conditions',
      title: 'Terms and Conditions',
      subtitle: 'Governing terms for platform access, share subscription requests, and investor conduct.',
      hero_kicker: 'Platform Terms',
      meta_description: 'Terms and Conditions governing use of the RICHMOND-INV corporate website and investor portal.',
      content_json: JSON.stringify({
        sections: [
          { heading: 'Subscription Requests', body: 'Submission of an investment request does not constitute an automatic share allotment. Allotment occurs strictly after administrative eligibility review, treasury payment verification, and formal allocation.' },
          { heading: 'Account Integrity', body: 'Investors must provide truthful registration details and notify RICHMOND-INV promptly of material residential or contact changes via the controlled profile change workflow.' },
        ],
      }),
    },
    {
      slug: 'investment-risk-disclosures',
      title: 'Investment Risk Disclosures',
      subtitle: 'Specific disclosures applicable to private share offerings and cross-border participation.',
      hero_kicker: 'Prospectus Supplement',
      meta_description: 'Detailed investment risk disclosures covering liquidity, valuation, and dividend variability.',
      content_json: JSON.stringify({
        sections: [
          { heading: 'No Guaranteed Dividends or Liquidity', body: 'Dividends are declared solely at board discretion based on distributable earnings. Secondary market liquidity for private share tranches may be restricted or unavailable.' },
          { heading: 'Independent Advice', body: 'Prospective investors should consult independent legal, tax, and financial advisors prior to committing capital to any offering.' },
        ],
      }),
    },
  ];

  for (const page of pageSeeds) {
    const existing = await db('website_pages').where({ slug: page.slug }).first();
    if (!existing) {
      await db('website_pages').insert(page);
    }
  }

  // 7. Seed FAQs
  const existingFaqs = await db('faq_entries').count('id as count').first();
  if (!existingFaqs || Number(existingFaqs.count) === 0) {
    await db('faq_entries').insert([
      {
        category: 'Onboarding & KYC',
        question: 'How do I become a verified investor on RICHMOND-INV?',
        answer: 'Register an investor account with your full residential details, then navigate to the KYC Verification module in your investor portal to upload a government-issued identity document and proof of address. Compliance officers review submissions and update your status.',
        sort_order: 1,
      },
      {
        category: 'Share Offerings',
        question: 'When are shares formally allocated to my portfolio?',
        answer: 'Shares are allocated only after your investment request passes eligibility checks, is approved for payment, your cryptocurrency transaction hash and evidence are manually verified by Treasury Administration, and the allocation entry is posted to the ledger.',
        sort_order: 2,
      },
      {
        category: 'Cryptocurrency Settlement',
        question: 'Are cryptocurrency payments confirmed automatically on submission?',
        answer: 'No. Submitting a transaction hash places your payment in verification pending status. An authorized administrator inspects the transaction reference and supporting evidence before approving settlement.',
        sort_order: 3,
      },
      {
        category: 'Account Governance',
        question: 'How do I update my legal name or residential address?',
        answer: 'Sensitive profile fields are protected by change control. From your Investor Account Management page, submit a Profile Change Request specifying the updated value and reason; administrators review and log both previous and updated values upon approval.',
        sort_order: 4,
      },
      {
        category: 'Dividends & Reporting',
        question: 'Can I download statements of my shareholdings and transactions?',
        answer: 'Yes. The Portfolio module provides printable institutional statements and CSV exports covering your verified shareholdings, acquisition prices, and any authorized dividend records.',
        sort_order: 5,
      },
    ]);
  }

  // 8. Seed Corporate Announcements
  const existingAnn = await db('announcements').count('id as count').first();
  if (!existingAnn || Number(existingAnn.count) === 0) {
    await db('announcements').insert([
      {
        slug: 'q4-2026-share-issuance-calendar',
        title: 'Publication of 2026 Institutional Share Issuance & Governance Calendar',
        category: 'Corporate Governance',
        summary: 'RICHMOND-INV confirms the opening of Series A Infrastructure and European Industrial Growth share tranches for verified investors.',
        body: 'RICHMOND-INV has published its 2026 issuance schedule alongside updated investor verification guidelines. Eligible investors with approved KYC status may review offering memoranda and submit subscription requests directly through the Investor Portal.',
        is_published: true,
      },
      {
        slug: 'multi-rail-treasury-settlement-standards',
        title: 'Updated Treasury Custody & Multi-Rail Cryptocurrency Settlement Standards',
        category: 'Treasury Operations',
        summary: 'Enhanced manual verification controls and QR settlement instructions across BTC, ETH, and USDT TRC20/ERC20 rails.',
        body: 'To uphold institutional reconciliation standards, all digital asset settlements require explicit transaction hash submission and supporting transfer evidence. Wallet addresses and minimum settlement thresholds remain centrally governed by Treasury Administration.',
        is_published: true,
      },
    ]);
  }

  // 9. Seed Initial Share Offerings (Real catalog entries manageable by Admin)
  const existingOfferings = await db('share_offerings').count('id as count').first();
  if (!existingOfferings || Number(existingOfferings.count) === 0) {
    const offerings = [
      {
        reference_code: 'RINV-OFF-2026-01',
        title: 'Richmond Global Infrastructure Equity Series A',
        slug: 'richmond-global-infrastructure-series-a',
        sector: 'Core Infrastructure',
        summary: 'Direct ordinary share participation in regulated European energy transmission and logistics infrastructure assets.',
        description: 'Series A provides qualified investors with direct equity participation in long-term contracted infrastructure assets across Western Europe. Shares carry proportional voting and discretionary distribution rights subject to annual audit.',
        currency: 'USD',
        share_price: 250.0,
        roi_percent: 12.5,
        duration_unit: 'month',
        duration_value: 12,
        duration_months: 12,
        duration_days: 0,
        duration_hours: 0,
        min_amount: 2500.0,
        max_amount: 1250000.0,
        min_quantity: 10,
        max_quantity: 5000,
        total_authorized_quantity: 100000,
        available_quantity: 100000,
        opening_date: '2026-01-15',
        closing_date: '2099-12-31',
        status: 'published',
        risk_disclosures: 'Long-horizon capital commitment. Secondary liquidity is restricted. Distributions are not guaranteed and depend on underlying operating cash flows.',
        requires_kyc: true,
      },
      {
        reference_code: 'RINV-OFF-2026-02',
        title: 'Richmond Sovereign-Linked Income Participation Tranche',
        slug: 'richmond-sovereign-income-tranche',
        sector: 'Fixed-Income Participation',
        summary: 'Preference share tranche backed by diversified investment-grade institutional credit and sovereign liquidity reserves.',
        description: 'Designed for capital preservation mandates, this preference share tranche focuses on high-grade short-duration sovereign and supranational obligations administered under strict counterparty limits.',
        currency: 'USD',
        share_price: 100.0,
        roi_percent: 8.5,
        duration_unit: 'month',
        duration_value: 6,
        duration_months: 6,
        duration_days: 0,
        duration_hours: 0,
        min_amount: 2500.0,
        max_amount: 1000000.0,
        min_quantity: 25,
        max_quantity: 10000,
        total_authorized_quantity: 250000,
        available_quantity: 250000,
        opening_date: '2026-02-01',
        closing_date: '2099-12-31',
        status: 'published',
        risk_disclosures: 'Subject to interest-rate sensitivity, credit spread movements, and issuer solvency risk. No principal guarantee is provided.',
        requires_kyc: true,
      },
      {
        reference_code: 'RINV-OFF-2026-03',
        title: 'Richmond European Industrial Growth Equity II',
        slug: 'richmond-european-industrial-growth-ii',
        sector: 'Industrial Equity',
        summary: 'Minority growth equity participation in precision manufacturing and industrial automation enterprises.',
        description: 'Tranche II targets profitable mid-market European industrial businesses expanding export capacity and automation infrastructure, governed by board-level financial covenants.',
        currency: 'USD',
        share_price: 500.0,
        roi_percent: 16.0,
        duration_unit: 'month',
        duration_value: 18,
        duration_months: 18,
        duration_days: 0,
        duration_hours: 0,
        min_amount: 2500.0,
        max_amount: 1000000.0,
        min_quantity: 5,
        max_quantity: 2000,
        total_authorized_quantity: 60000,
        available_quantity: 60000,
        opening_date: '2026-03-01',
        closing_date: '2099-12-31',
        status: 'published',
        risk_disclosures: 'Higher equity volatility and illiquidity risk. Capital loss is possible if operating targets are not achieved.',
        requires_kyc: true,
      },
    ];

    for (const off of offerings) {
      const [id] = await db('share_offerings').insert(off);
      await db('offering_documents').insert({
        offering_id: id,
        title: `${off.title} — Information Memorandum & Subscription Terms`,
        document_type: 'Information Memorandum',
        summary_notes: 'Official offering terms, authorized share count, pricing basis, and capital risk disclosures.',
        is_public: true,
      });
    }
  }
}
