import nodemailer from 'nodemailer';
import { getDb } from '../db/connection.ts';

export interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  source: 'database' | 'env' | 'mixed';
}

export interface SmtpPublicStatus {
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  hasPassword: boolean;
  source: 'database' | 'env' | 'mixed' | 'unconfigured';
}

export interface InstitutionalEmailPayload {
  to: string;
  recipientName?: string;
  subject: string;
  categoryLabel?: string;
  headline: string;
  body: string;
  details?: { label: string; value: string }[];
  ctaLabel?: string;
  ctaUrl?: string;
}

export interface EmailSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export async function getSmtpPublicStatus(): Promise<SmtpPublicStatus> {
  const db = getDb();
  const rows = await db('system_settings')
    .whereIn('setting_key', ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from'])
    .select('setting_key', 'setting_value');
  const map = new Map(rows.map((r: any) => [r.setting_key, String(r.setting_value ?? '').trim()]));

  const dbHost = map.get('smtp_host') || '';
  const envHost = (process.env.SMTP_HOST || '').trim();
  const host = dbHost || envHost;

  const dbPort = map.get('smtp_port') || '';
  const envPort = (process.env.SMTP_PORT || '').trim();
  const port = Number(dbPort || envPort || 465) || 465;

  const rawSecure = map.get('smtp_secure') || (process.env.SMTP_SECURE || '').trim();
  const secure = rawSecure ? rawSecure.toLowerCase() === 'true' : port === 465;

  const dbUser = map.get('smtp_user') || '';
  const envUser = (process.env.SMTP_USER || '').trim();
  const user = dbUser || envUser;

  const dbPass = map.get('smtp_pass') || '';
  const envPass = (process.env.SMTP_PASS || '').trim();
  const hasPassword = Boolean(dbPass || envPass);

  const dbFrom = map.get('smtp_from') || '';
  const envFrom = (process.env.SMTP_FROM || '').trim();
  const from = dbFrom || envFrom || (user ? `RICHMOND-INV <${user}>` : 'Investor Relations <noreply@richmond-inv.com>');

  const configured = Boolean(host && user && hasPassword);
  let source: SmtpPublicStatus['source'] = 'unconfigured';
  if (configured) {
    const usedDb = Boolean(dbHost || dbUser || dbPass);
    const usedEnv = Boolean((!dbHost && envHost) || (!dbUser && envUser) || (!dbPass && envPass));
    if (usedDb && usedEnv) source = 'mixed';
    else if (usedDb) source = 'database';
    else source = 'env';
  }

  return {
    configured,
    host,
    port,
    secure,
    user,
    from,
    hasPassword,
    source,
  };
}

export async function getSmtpConfig(): Promise<ResolvedSmtpConfig | null> {
  const db = getDb();
  const rows = await db('system_settings')
    .whereIn('setting_key', ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from'])
    .select('setting_key', 'setting_value');
  const map = new Map(rows.map((r: any) => [r.setting_key, String(r.setting_value ?? '').trim()]));

  const dbHost = map.get('smtp_host') || '';
  const envHost = (process.env.SMTP_HOST || '').trim();
  const host = dbHost || envHost;

  const dbPort = map.get('smtp_port') || '';
  const envPort = (process.env.SMTP_PORT || '').trim();
  const port = Number(dbPort || envPort || 465) || 465;

  const rawSecure = map.get('smtp_secure') || (process.env.SMTP_SECURE || '').trim();
  const secure = rawSecure ? rawSecure.toLowerCase() === 'true' : port === 465;

  const dbUser = map.get('smtp_user') || '';
  const envUser = (process.env.SMTP_USER || '').trim();
  const user = dbUser || envUser;

  const dbPass = map.get('smtp_pass') || '';
  const envPass = (process.env.SMTP_PASS || '').trim();
  const pass = dbPass || envPass;

  const dbFrom = map.get('smtp_from') || '';
  const envFrom = (process.env.SMTP_FROM || '').trim();
  const from = dbFrom || envFrom || (user ? `RICHMOND-INV <${user}>` : 'Investor Relations <noreply@richmond-inv.com>');

  if (!host || !user || !pass) return null;

  const usedDb = Boolean(dbHost || dbUser || dbPass);
  const usedEnv = Boolean((!dbHost && envHost) || (!dbUser && envUser) || (!dbPass && envPass));
  const source: ResolvedSmtpConfig['source'] = usedDb && usedEnv ? 'mixed' : usedDb ? 'database' : 'env';

  return { host, port, secure, user, pass, from, source };
}

export function createSmtpTransporter(smtp: ResolvedSmtpConfig) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    requireTLS: !smtp.secure && smtp.port === 587,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 18000,
  });
}

async function getCorporateEmailBranding() {
  const db = getDb();
  const rows = await db('system_settings')
    .whereIn('setting_key', ['company_name', 'company_legal_name', 'headquarters_address', 'contact_email'])
    .select('setting_key', 'setting_value');
  const map = new Map(rows.map((r: any) => [r.setting_key, String(r.setting_value ?? '').trim()]));

  const rawHq = map.get('headquarters_address') || '';
  const hqAddress =
    !rawHq || rawHq === '24 Bishopsgate, London EC2N 4BQ, United Kingdom'
      ? 'Saint Johns, Auckland, 1072, New Zealand'
      : rawHq;

  return {
    companyName: map.get('company_name') || 'RICHMOND-INV',
    legalName: map.get('company_legal_name') || 'Richmond Investment Holdings Ltd.',
    hqAddress,
    contactEmail: map.get('contact_email') || 'investor.relations@richmond-inv.com',
    appUrl: (process.env.APP_URL || '').trim().replace(/\/+$/, ''),
  };
}

export async function renderInstitutionalEmail(payload: InstitutionalEmailPayload): Promise<{
  html: string;
  text: string;
}> {
  const branding = await getCorporateEmailBranding();
  const safeCtaUrl = sanitizeUrl(payload.ctaUrl);
  const greetingName = payload.recipientName?.trim() || 'Valued Investor';
  const categoryLabel = (payload.categoryLabel || 'Investor Notice').toUpperCase();

  const paragraphs = payload.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const htmlParagraphs = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-size:14px;line-height:1.65;color:#1C2026;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`
    )
    .join('');

  const htmlDetails =
    payload.details && payload.details.length > 0
      ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;border:1px solid #E5E8EE;background-color:#F9F7F2;">
        ${payload.details
          .map(
            (row, idx) => `
          <tr>
            <td style="padding:10px 14px;font-size:12px;color:#4A5260;${idx > 0 ? 'border-top:1px solid #E5E8EE;' : ''}width:38%;">${escapeHtml(row.label)}</td>
            <td style="padding:10px 14px;font-size:12px;font-weight:600;color:#0B172A;font-family:'Courier New',monospace;${idx > 0 ? 'border-top:1px solid #E5E8EE;' : ''}">${escapeHtml(row.value)}</td>
          </tr>`
          )
          .join('')}
      </table>`
      : '';

  const htmlCta =
    safeCtaUrl && payload.ctaLabel
      ? `
      <div style="margin:24px 0 8px 0;">
        <a href="${escapeHtml(safeCtaUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;background-color:#0B172A;color:#FCFBF8;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;border:1px solid #0B172A;">
          ${escapeHtml(payload.ctaLabel)}
        </a>
      </div>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(payload.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F2EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1C2026;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F4F2EC;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #D6DAE2;border-collapse:collapse;">
          <tr>
            <td style="background-color:#0B172A;padding:24px 28px;border-bottom:3px solid #B5924C;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:0.04em;color:#FCFBF8;">
                ${escapeHtml(branding.companyName)}
              </div>
              <div style="margin-top:4px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#C9A968;">
                ${escapeHtml(categoryLabel)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 24px 28px;background-color:#FFFFFF;">
              <p style="margin:0 0 10px 0;font-size:13px;color:#4A5260;">Dear ${escapeHtml(greetingName)},</p>
              <h1 style="margin:0 0 18px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:600;color:#0B172A;">
                ${escapeHtml(payload.headline)}
              </h1>
              ${htmlParagraphs}
              ${htmlDetails}
              ${htmlCta}
              <p style="margin:22px 0 0 0;font-size:12px;line-height:1.6;color:#4A5260;">
                Regards,<br/>
                <strong style="color:#0B172A;">${escapeHtml(branding.companyName)} Investor Relations</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#060E1C;padding:18px 28px;border-top:1px solid #1E365C;">
              <div style="font-size:11px;line-height:1.6;color:#A8B2C1;">
                <strong style="color:#FCFBF8;">${escapeHtml(branding.legalName)}</strong><br/>
                ${escapeHtml(branding.hqAddress)}<br/>
                Investor Relations: ${escapeHtml(branding.contactEmail)}
              </div>
              <div style="margin-top:10px;font-size:10px;color:#8E99AA;">
                This is an official account communication from ${escapeHtml(branding.companyName)}. Please do not share sensitive account credentials via email.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textDetails =
    payload.details && payload.details.length > 0
      ? '\n' + payload.details.map((d) => `${d.label}: ${d.value}`).join('\n') + '\n'
      : '';

  const textCta = safeCtaUrl && payload.ctaLabel ? `\n${payload.ctaLabel}: ${safeCtaUrl}\n` : '';

  const text = [
    `${branding.companyName} — ${categoryLabel}`,
    '',
    `Dear ${greetingName},`,
    '',
    payload.headline,
    '',
    payload.body.trim(),
    textDetails.trim(),
    textCta.trim(),
    '',
    `Regards,`,
    `${branding.companyName} Investor Relations`,
    `${branding.legalName} | ${branding.hqAddress}`,
    `Contact: ${branding.contactEmail}`,
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n');

  return { html, text };
}

export async function sendInstitutionalEmail(
  payload: InstitutionalEmailPayload,
  existingTransporter?: { transporter: ReturnType<typeof nodemailer.createTransport>; from: string }
): Promise<EmailSendResult> {
  try {
    let transporter = existingTransporter?.transporter;
    let from = existingTransporter?.from;

    if (!transporter || !from) {
      const smtp = await getSmtpConfig();
      if (!smtp) {
        return { ok: false, error: 'SMTP mail server is not configured yet.' };
      }
      transporter = createSmtpTransporter(smtp);
      from = smtp.from;
    }

    const { html, text } = await renderInstitutionalEmail(payload);
    const info = await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text,
      html,
    });

    return { ok: true, messageId: info?.messageId };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unable to deliver email through SMTP.' };
  }
}

export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const smtp = await getSmtpConfig();
    if (!smtp) {
      return {
        ok: false,
        error: 'SMTP credentials are incomplete. Provide SMTP Host, Username, and Password first.',
      };
    }
    const transporter = createSmtpTransporter(smtp);
    await transporter.verify();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'SMTP connection verification failed.' };
  }
}
