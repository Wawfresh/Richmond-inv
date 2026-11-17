import PDFDocument from 'pdfkit';

export interface PortfolioStatementInput {
  companyName: string;
  legalName: string;
  contactEmail: string;
  hqAddress: string;
  statementReference: string;
  generatedAt: Date;
  investor: {
    fullName: string;
    email: string;
    accountNumber: string;
    country: string;
    kycStatus: string;
    accountStatus: string;
  };
  summary: {
    totalInvestedCapital: number;
    portfolioValuation: number | null;
    effectivePortfolioValue: number;
    totalDividendsDistributed: number;
    totalWithdrawn: number;
    pendingWithdrawals: number;
    availableBalance: number;
  };
  holdings: Array<{
    offering_title: string;
    offering_reference: string;
    total_shares: number;
    average_acquisition_price: number;
    total_invested_amount: number;
    current_unit_valuation: number | null;
    currency: string;
  }>;
  dividends: Array<{
    dividend_reference: string;
    offering_title: string;
    period_label: string;
    shares_eligible: number;
    rate_per_share: number;
    gross_amount: number;
    status: string;
    currency: string;
  }>;
  transactions: Array<{
    occurred_at: string | Date;
    transaction_reference: string;
    transaction_type: string;
    description: string;
    quantity: number;
    amount: number;
    currency: string;
  }>;
}

const COLORS = {
  navy: '#0B172A',
  navyDark: '#060E1C',
  gold: '#B5924C',
  goldLight: '#C9A968',
  cream: '#FCFBF8',
  stone: '#F5F2EA',
  border: '#D6DAE2',
  ink: '#1C2026',
  muted: '#4A5260',
  green: '#146348',
  red: '#991B1B',
  white: '#FFFFFF',
};

function fmtMoney(amount: number, currency = 'USD'): string {
  const num = Number(amount || 0);
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  return `${sign}${currency} ${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtNum(val: number): string {
  return Number(val || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function fmtDate(val: string | Date): string {
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val || '—');
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(val: string | Date): string {
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val || '—');
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function collectPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function applyPageFooters(doc: PDFKit.PDFDocument, footerLeft: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const pageBottom = doc.page.height - 34;
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .moveTo(45, pageBottom - 8)
      .lineTo(doc.page.width - 45, pageBottom - 8)
      .stroke();
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text(footerLeft, 45, pageBottom, { width: 360, lineBreak: false })
      .text(`Page ${i + 1} of ${range.count}`, doc.page.width - 145, pageBottom, {
        width: 100,
        align: 'right',
        lineBreak: false,
      });
  }
}

export async function generatePortfolioStatementPdf(input: PortfolioStatementInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 45,
    bufferPages: true,
    info: {
      Title: `${input.companyName} Portfolio Summary Statement - ${input.investor.accountNumber}`,
      Author: input.legalName,
      Subject: 'Investor Portfolio Performance & Transaction Summary Statement',
    },
  });

  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 90;
  const pageLimitY = doc.page.height - 65;

  const ensureSpace = (needed: number) => {
    if (doc.y + needed > pageLimitY) {
      doc.addPage();
      doc.y = 45;
    }
  };

  // Top Header Band
  doc.rect(0, 0, pageWidth, 84).fill(COLORS.navy);
  doc.rect(0, 81, pageWidth, 3).fill(COLORS.gold);

  doc
    .fillColor(COLORS.goldLight)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text(input.companyName, 45, 22, { lineBreak: false });

  doc
    .fillColor(COLORS.white)
    .font('Helvetica')
    .fontSize(9)
    .text('SHAREHOLDER PORTFOLIO PERFORMANCE & TRANSACTION STATEMENT', 45, 44, { lineBreak: false });

  doc
    .fillColor('#C8D0DC')
    .font('Helvetica')
    .fontSize(7.5)
    .text(input.legalName, 45, 59, { lineBreak: false });

  doc
    .fillColor(COLORS.goldLight)
    .font('Courier-Bold')
    .fontSize(8.5)
    .text(input.statementReference, pageWidth - 225, 24, { width: 180, align: 'right', lineBreak: false });

  doc
    .fillColor(COLORS.white)
    .font('Helvetica')
    .fontSize(7.5)
    .text(`Generated: ${fmtDateTime(input.generatedAt)}`, pageWidth - 245, 40, {
      width: 200,
      align: 'right',
      lineBreak: false,
    });

  doc
    .fillColor('#C8D0DC')
    .font('Helvetica')
    .fontSize(7.5)
    .text(`Account: ${input.investor.accountNumber}`, pageWidth - 245, 55, {
      width: 200,
      align: 'right',
      lineBreak: false,
    });

  doc.y = 104;

  // Shareholder Details Card
  doc.rect(45, doc.y, contentWidth, 64).fillAndStroke(COLORS.cream, COLORS.border);
  const metaY = doc.y + 10;

  doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7).text('SHAREHOLDER NAME', 57, metaY);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9.5).text(input.investor.fullName, 57, metaY + 10, {
    width: 165,
  });

  doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7).text('REGISTERED EMAIL', 235, metaY);
  doc.fillColor(COLORS.ink).font('Courier').fontSize(8.5).text(input.investor.email, 235, metaY + 10, {
    width: 170,
  });

  doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7).text('RESIDENCE & KYC', 415, metaY);
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica')
    .fontSize(8.5)
    .text(`${input.investor.country} · KYC: ${input.investor.kycStatus.toUpperCase()}`, 415, metaY + 10, {
      width: 125,
    });

  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(7.5)
    .text(`Account Status: ${input.investor.accountStatus.toUpperCase()}`, 57, metaY + 34)
    .text(`Headquarters: ${input.hqAddress}`, 235, metaY + 34, { width: 300 });

  doc.y += 78;

  // Performance Summary Section
  doc
    .fillColor(COLORS.navy)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Portfolio Performance Summary', 45, doc.y);
  doc.y += 18;

  const totalInvested = Number(input.summary.totalInvestedCapital || 0);
  const currentValue = Number(input.summary.effectivePortfolioValue || 0);
  const unrealizedGain = currentValue - totalInvested;
  const returnPct = totalInvested > 0 ? (unrealizedGain / totalInvested) * 100 : 0;
  const totalShares = input.holdings.reduce((sum, h) => sum + Number(h.total_shares || 0), 0);

  const boxGap = 8;
  const boxWidth = (contentWidth - boxGap * 3) / 4;
  const boxY = doc.y;
  const boxHeight = 56;

  const kpis = [
    {
      label: 'TOTAL INVESTED',
      value: fmtMoney(totalInvested),
      sub: `${fmtNum(totalShares)} total shares`,
      color: COLORS.navy,
    },
    {
      label: 'PORTFOLIO VALUATION',
      value: fmtMoney(currentValue),
      sub: input.summary.portfolioValuation !== null ? 'Authorized valuation' : 'Acquisition cost basis',
      color: COLORS.green,
    },
    {
      label: 'NET PERFORMANCE',
      value: `${unrealizedGain >= 0 ? '+' : ''}${fmtMoney(unrealizedGain)}`,
      sub: `Return: ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`,
      color: unrealizedGain >= 0 ? COLORS.green : COLORS.red,
    },
    {
      label: 'WITHDRAWABLE BALANCE',
      value: fmtMoney(input.summary.availableBalance),
      sub: `Dividends: ${fmtMoney(input.summary.totalDividendsDistributed)}`,
      color: COLORS.navy,
    },
  ];

  kpis.forEach((k, idx) => {
    const x = 45 + idx * (boxWidth + boxGap);
    doc.rect(x, boxY, boxWidth, boxHeight).fillAndStroke(COLORS.white, COLORS.border);
    doc.rect(x, boxY, boxWidth, 2).fill(idx === 0 ? COLORS.gold : COLORS.navy);
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .text(k.label, x + 8, boxY + 9, { width: boxWidth - 16, lineBreak: false });
    doc
      .fillColor(k.color)
      .font('Courier-Bold')
      .fontSize(9.5)
      .text(k.value, x + 8, boxY + 21, { width: boxWidth - 16, lineBreak: false });
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7)
      .text(k.sub, x + 8, boxY + 37, { width: boxWidth - 16, lineBreak: false });
  });

  doc.y = boxY + boxHeight + 10;

  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8)
    .text(
      `Pending Withdrawals: ${fmtMoney(input.summary.pendingWithdrawals)}   ·   Settled Withdrawals: ${fmtMoney(
        input.summary.totalWithdrawn
      )}`,
      45,
      doc.y
    );

  doc.y += 20;

  // Verified Shareholdings Table
  ensureSpace(70);
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(11).text('Verified Shareholdings', 45, doc.y);
  doc.y += 16;

  if (input.holdings.length === 0) {
    doc.rect(45, doc.y, contentWidth, 28).fillAndStroke(COLORS.cream, COLORS.border);
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(8.5)
      .text('No verified shareholdings allocated to this account yet.', 55, doc.y + 9);
    doc.y += 40;
  } else {
    const drawHoldingsHeader = () => {
      const hy = doc.y;
      doc.rect(45, hy, contentWidth, 20).fill(COLORS.navy);
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7.2);
      doc.text('OFFERING', 52, hy + 6, { width: 175 });
      doc.text('SHARES', 230, hy + 6, { width: 55, align: 'right' });
      doc.text('AVG PRICE', 290, hy + 6, { width: 68, align: 'right' });
      doc.text('INVESTED', 363, hy + 6, { width: 82, align: 'right' });
      doc.text('VALUATION', 450, hy + 6, { width: 92, align: 'right' });
      doc.y = hy + 20;
    };

    drawHoldingsHeader();
    input.holdings.forEach((h, idx) => {
      if (doc.y + 26 > pageLimitY) {
        doc.addPage();
        doc.y = 45;
        drawHoldingsHeader();
      }
      const ry = doc.y;
      const bg = idx % 2 === 0 ? COLORS.white : COLORS.cream;
      doc.rect(45, ry, contentWidth, 24).fillAndStroke(bg, COLORS.border);

      const valuation =
        h.current_unit_valuation !== null && h.current_unit_valuation !== undefined
          ? Number(h.total_shares) * Number(h.current_unit_valuation)
          : Number(h.total_invested_amount);

      doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(7.8).text(h.offering_title, 52, ry + 5, {
        width: 175,
        ellipsis: true,
        lineBreak: false,
      });
      doc.fillColor(COLORS.muted).font('Courier').fontSize(6.5).text(h.offering_reference, 52, ry + 14, {
        width: 175,
        lineBreak: false,
      });

      doc.fillColor(COLORS.ink).font('Courier').fontSize(7.8);
      doc.text(fmtNum(h.total_shares), 230, ry + 8, { width: 55, align: 'right', lineBreak: false });
      doc.text(fmtMoney(h.average_acquisition_price, h.currency), 290, ry + 8, {
        width: 68,
        align: 'right',
        lineBreak: false,
      });
      doc.text(fmtMoney(h.total_invested_amount, h.currency), 363, ry + 8, {
        width: 82,
        align: 'right',
        lineBreak: false,
      });
      doc
        .fillColor(COLORS.green)
        .font('Courier-Bold')
        .text(fmtMoney(valuation, h.currency), 450, ry + 8, { width: 92, align: 'right', lineBreak: false });

      doc.y = ry + 24;
    });
    doc.y += 16;
  }

  // Dividend Records Section (if any)
  if (input.dividends.length > 0) {
    ensureSpace(70);
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(11).text('Dividend Distributions', 45, doc.y);
    doc.y += 16;

    const drawDividendHeader = () => {
      const hy = doc.y;
      doc.rect(45, hy, contentWidth, 20).fill(COLORS.navy);
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7.2);
      doc.text('REFERENCE', 52, hy + 6, { width: 95 });
      doc.text('OFFERING & PERIOD', 150, hy + 6, { width: 170 });
      doc.text('RATE/SHARE', 325, hy + 6, { width: 65, align: 'right' });
      doc.text('GROSS AMOUNT', 395, hy + 6, { width: 85, align: 'right' });
      doc.text('STATUS', 485, hy + 6, { width: 57, align: 'right' });
      doc.y = hy + 20;
    };

    drawDividendHeader();
    input.dividends.slice(0, 15).forEach((d, idx) => {
      if (doc.y + 22 > pageLimitY) {
        doc.addPage();
        doc.y = 45;
        drawDividendHeader();
      }
      const ry = doc.y;
      doc.rect(45, ry, contentWidth, 21).fillAndStroke(idx % 2 === 0 ? COLORS.white : COLORS.cream, COLORS.border);

      doc.fillColor(COLORS.ink).font('Courier').fontSize(7.4).text(d.dividend_reference, 52, ry + 6, {
        width: 95,
        lineBreak: false,
      });
      doc
        .font('Helvetica')
        .text(`${d.offering_title} (${d.period_label})`, 150, ry + 6, { width: 170, ellipsis: true, lineBreak: false });
      doc.font('Courier').text(fmtMoney(d.rate_per_share, d.currency), 325, ry + 6, {
        width: 65,
        align: 'right',
        lineBreak: false,
      });
      doc.fillColor(COLORS.green).font('Courier-Bold').text(fmtMoney(d.gross_amount, d.currency), 395, ry + 6, {
        width: 85,
        align: 'right',
        lineBreak: false,
      });
      doc.fillColor(COLORS.muted).font('Helvetica-Bold').text(String(d.status).toUpperCase(), 485, ry + 6, {
        width: 57,
        align: 'right',
        lineBreak: false,
      });

      doc.y = ry + 21;
    });
    doc.y += 16;
  }

  // Recent Portfolio Transactions Table
  ensureSpace(70);
  doc
    .fillColor(COLORS.navy)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(`Recent Portfolio Transactions (${Math.min(input.transactions.length, 30)})`, 45, doc.y);
  doc.y += 16;

  if (input.transactions.length === 0) {
    doc.rect(45, doc.y, contentWidth, 28).fillAndStroke(COLORS.cream, COLORS.border);
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(8.5)
      .text('No recent portfolio transactions recorded for this account.', 55, doc.y + 9);
    doc.y += 40;
  } else {
    const drawTxHeader = () => {
      const hy = doc.y;
      doc.rect(45, hy, contentWidth, 20).fill(COLORS.navy);
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7.2);
      doc.text('DATE', 52, hy + 6, { width: 62 });
      doc.text('REFERENCE', 117, hy + 6, { width: 92 });
      doc.text('DESCRIPTION', 213, hy + 6, { width: 185 });
      doc.text('QTY', 402, hy + 6, { width: 48, align: 'right' });
      doc.text('AMOUNT', 454, hy + 6, { width: 88, align: 'right' });
      doc.y = hy + 20;
    };

    drawTxHeader();
    input.transactions.slice(0, 30).forEach((tx, idx) => {
      if (doc.y + 24 > pageLimitY) {
        doc.addPage();
        doc.y = 45;
        drawTxHeader();
      }
      const ry = doc.y;
      doc.rect(45, ry, contentWidth, 22).fillAndStroke(idx % 2 === 0 ? COLORS.white : COLORS.cream, COLORS.border);

      const amt = Number(tx.amount || 0);
      doc.fillColor(COLORS.muted).font('Courier').fontSize(7.4).text(fmtDate(tx.occurred_at), 52, ry + 7, {
        width: 62,
        lineBreak: false,
      });
      doc.fillColor(COLORS.ink).font('Courier').fontSize(7.2).text(tx.transaction_reference, 117, ry + 7, {
        width: 92,
        ellipsis: true,
        lineBreak: false,
      });
      doc.font('Helvetica').fontSize(7.5).text(tx.description || tx.transaction_type, 213, ry + 7, {
        width: 185,
        ellipsis: true,
        lineBreak: false,
      });
      doc.font('Courier').fontSize(7.4).text(fmtNum(tx.quantity), 402, ry + 7, {
        width: 48,
        align: 'right',
        lineBreak: false,
      });
      doc
        .fillColor(amt < 0 ? COLORS.red : COLORS.green)
        .font('Courier-Bold')
        .fontSize(7.5)
        .text(fmtMoney(amt, tx.currency), 454, ry + 7, { width: 88, align: 'right', lineBreak: false });

      doc.y = ry + 22;
    });
    doc.y += 16;
  }

  // Disclaimer Box
  ensureSpace(55);
  doc.rect(45, doc.y, contentWidth, 44).fillAndStroke(COLORS.stone, COLORS.border);
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(7.3)
    .text(
      `Institutional Audit Notice: This portfolio summary statement (${input.statementReference}) reflects verified holdings, authorized valuations, distributed dividends, and posted ledger transactions recorded in the ${input.companyName} registry as of ${fmtDateTime(
        input.generatedAt
      )}. Inquiries: ${input.contactEmail}.`,
      55,
      doc.y + 9,
      { width: contentWidth - 20, lineGap: 2 }
    );

  applyPageFooters(doc, `${input.legalName} · Confidential Shareholder Statement · ${input.statementReference}`);
  return collectPdfBuffer(doc);
}

export async function generateProjectOverviewPdf(): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 45,
    bufferPages: true,
    info: {
      Title: 'RICHMOND-INV — Institutional Investment Platform Architecture & Project Overview',
      Author: 'RICHMOND-INV Engineering',
      Subject: 'Comprehensive Project Explanation, Architecture, Security & Workflows',
    },
  });

  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 90;
  const pageLimitY = doc.page.height - 65;

  const ensureSpace = (needed: number) => {
    if (doc.y + needed > pageLimitY) {
      doc.addPage();
      doc.y = 45;
    }
  };

  const sectionHeading = (num: string, title: string) => {
    ensureSpace(48);
    doc.fillColor(COLORS.gold).font('Courier-Bold').fontSize(8.5).text(num, 45, doc.y);
    doc.y += 11;
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(13).text(title, 45, doc.y);
    doc.y += 18;
    doc.strokeColor(COLORS.gold).lineWidth(1).moveTo(45, doc.y).lineTo(120, doc.y).stroke();
    doc.y += 10;
  };

  const paragraph = (text: string) => {
    ensureSpace(36);
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9.2).text(text, 45, doc.y, {
      width: contentWidth,
      lineGap: 3,
    });
    doc.y += 8;
  };

  const bulletItem = (label: string, detail: string) => {
    ensureSpace(28);
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(8.8).text(`•  ${label}: `, 52, doc.y, {
      continued: true,
      width: contentWidth - 10,
      lineGap: 2.5,
    });
    doc.fillColor(COLORS.muted).font('Helvetica').text(detail, { lineGap: 2.5 });
    doc.y += 4;
  };

  // Cover Header Band
  doc.rect(0, 0, pageWidth, 108).fill(COLORS.navy);
  doc.rect(0, 105, pageWidth, 3).fill(COLORS.gold);

  doc
    .fillColor(COLORS.goldLight)
    .font('Courier-Bold')
    .fontSize(9)
    .text('PROJECT ARCHITECTURE & TECHNICAL DOCUMENTATION', 45, 24);
  doc
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text('RICHMOND-INV Investment Platform', 45, 42);
  doc
    .fillColor('#C8D0DC')
    .font('Helvetica')
    .fontSize(9.5)
    .text(
      'Full-Stack Institutional Private Equity, Cryptocurrency Settlement & Shareholder Governance Portal',
      45,
      72,
      { width: contentWidth }
    );

  doc.y = 128;

  // 01 Executive Overview
  sectionHeading('01 / EXECUTIVE SUMMARY', 'Platform Purpose & Core Capabilities');
  paragraph(
    'RICHMOND-INV is a full-stack web application engineered for institutional private equity administration, investor onboarding, cryptocurrency capital settlement, portfolio accounting, and withdrawal governance. Every financial figure, plan parameter, wallet address, dividend record, and audit entry is backed by a relational SQL database with atomic transaction guarantees.'
  );
  paragraph(
    'The application separates public corporate information from two distinct authenticated environments: an Investor Portal (/portal) for shareholders and an Administrator Governance Console (/admin) for compliance and treasury operations.'
  );

  // 02 Tech Stack
  sectionHeading('02 / TECHNOLOGY STACK', 'Frontend, Backend & Persistence Architecture');
  bulletItem(
    'Frontend Stack',
    'React 19 with TypeScript, Vite bundler, React Router v7 for multi-portal routing, Tailwind CSS v4 with an institutional Navy/Gold/Cream design system, and Lucide icons.'
  );
  bulletItem(
    'Backend API & Middleware',
    'Node.js + Express (server.ts) hosting Vite middlewares in development and static assets in production, secured with Helmet headers, express-rate-limit, Cookie Parser, Zod schema validation, and CSRF protection.'
  );
  bulletItem(
    'Relational Database',
    'Knex.js query builder with SQLite (better-sqlite3) for zero-config local/container deployment and MySQL2 support, managed through versioned migrations (001 through 006) and automated bootstrap seeding.'
  );
  bulletItem(
    'Document & Reporting Services',
    'Multer private file uploads (KYC and payment proof receipts), QRCode generation for crypto deposit wallets, Nodemailer SMTP notifications, CSV ledger exports, and PDFKit institutional PDF statements.'
  );

  // 03 Three Portals
  sectionHeading('03 / PORTAL ARCHITECTURE', 'Public Corporate Site, Investor Portal & Admin Console');
  bulletItem(
    'Public Corporate Website',
    'Serves institutional landing pages (/), corporate governance disclosures, investment philosophy, published share offerings (/offerings), announcements, FAQs, and an audited contact inquiry desk (/contact).'
  );
  bulletItem(
    'Investor Portal (/portal)',
    'Authenticated workspace where shareholders monitor Total Invested Capital, Shareholdings, Portfolio Valuation, and Withdrawable Balance; edit their personal profile (with registered email permanently locked); browse investment plans with Min/Max capital bounds and ROI estimators; submit crypto deposits on /portal/pay/:requestId; download CSV & PDF Portfolio Statements (/portal/portfolio); complete KYC (/portal/kyc); and submit/cancel fund withdrawals (/portal/withdraw).'
  );
  bulletItem(
    'Administrator Console (/admin)',
    'Role-protected governance workspace featuring real-time metrics overview (/admin), full investor profile editing and one-click delegated dashboard access with instant Admin return (/admin/investors), KYC document verification (/admin/kyc), flexible Investment Plan builder (/admin/offerings), Automatic & Manual Crypto Payment System (/admin/orders), Withdrawal Review & Settlement Queue (/admin/withdrawals), Portfolio Valuations & Dividends (/admin/portfolios), CMS, System Settings, and CSV Reports.'
  );

  // 04 Financial & Settlement Workflows
  sectionHeading('04 / END-TO-END WORKFLOWS', 'Capital Lifecycle from Subscription to Withdrawal');
  bulletItem(
    '1. Plan Configuration & Eligibility',
    'Administrators configure investment plans with ROI %, flexible single-selection durations (Month, Days, Hours, or Daily), Min/Max investment limits, and authorized pool capacity. Investors preview returns and submit subscription requests.'
  );
  bulletItem(
    '2. Crypto Payment Processing (Automatic & Manual)',
    'Submitting an investment request routes the investor directly to /portal/pay/:requestId displaying admin-enabled crypto wallets, QR codes, and payment instructions. Depending on global or per-coin mode, valid unique TXIDs either settle automatically (instantly approving and allocating shares) or enter Treasury Manual Review.'
  );
  bulletItem(
    '3. Atomic Share Allocation & Portfolio Ledger',
    'Upon payment approval, executeShareAllocationTx atomically decrements offering available_quantity, creates a share_allocations record, updates investor_portfolios weighted average cost, and posts a share_allocation entry in portfolio_transactions.'
  );
  bulletItem(
    '4. Dividends, Statements & Withdrawals',
    'Administrators declare and distribute dividends per holding. Investors download live PDF Portfolio Performance & Transaction Statements and submit withdrawal requests against computed withdrawable balance (portfolio value + distributed dividends - pending/settled withdrawals). Admins approve, record payout TXIDs, and settle withdrawals to the ledger.'
  );

  // 05 Database Schema & Security
  sectionHeading('05 / DATABASE & SECURITY MODEL', 'Migrations, RBAC & Audit Trail');
  bulletItem(
    'Database Migrations (001–006)',
    '001_initial_schema (users, roles, permissions, offerings, KYC, investments, payments, portfolios, dividends, CMS, audit logs), 002_offering_plan_terms (ROI & flexible plan durations), 003_seed_more_offerings, 004_offering_min_max_amounts, 005_crypto_payment_processing (auto/manual settings & verification metadata), and 006_withdrawal_requests.'
  );
  bulletItem(
    'Authentication & Auditability',
    'Passwords are hashed with bcrypt (cost 12); sessions use 256-bit opaque tokens stored as SHA-256 hashes in user_sessions with dual HttpOnly cookie and Bearer token support plus CSRF header validation. All admin and financial state transitions write structured records to admin_audit_logs.'
  );

  applyPageFooters(
    doc,
    'RICHMOND-INV Engineering Documentation · Architecture & Functional Overview'
  );
  return collectPdfBuffer(doc);
}
