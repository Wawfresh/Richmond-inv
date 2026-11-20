import { getDb } from '../db/connection.ts';
import { sendInstitutionalEmail } from './email.ts';

export interface NotifyInput {
  userId: number;
  category: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  /**
   * Defaults to true for investor account notifications so users receive
   * automatic email confirmations for registration, KYC, orders, payments,
   * dividends, withdrawals, and security events whenever SMTP is configured.
   */
  sendEmail?: boolean;
  emailSubject?: string;
  emailHeadline?: string;
  emailDetails?: { label: string; value: string }[];
  emailCtaLabel?: string;
  emailCtaPath?: string;
}

function formatCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    account_registration: 'Registration Confirmation',
    account_status: 'Account Status Notice',
    kyc_submission: 'KYC Verification Received',
    kyc_approved: 'KYC Verification Approved',
    kyc_rejected: 'KYC Verification Update',
    kyc_review: 'KYC Compliance Notice',
    investment_submission: 'Investment Request Confirmation',
    investment_review: 'Investment Request Update',
    payment_submission: 'Payment Evidence Received',
    payment_approval: 'Payment Verified & Shares Allocated',
    payment_rejection: 'Payment Review Notice',
    dividend: 'Dividend Distribution Notice',
    withdrawal_request: 'Withdrawal Request Confirmation',
    withdrawal_update: 'Withdrawal Status Update',
    withdrawal_rejected: 'Withdrawal Review Notice',
    security: 'Account Security Alert',
    profile_update: 'Profile Update Confirmation',
  };
  return (
    labels[category] ||
    String(category || 'Investor Notice')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function resolvePortalCtaUrl(pathSuffix?: string): string | undefined {
  const baseUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) return undefined;
  const cleanPath = pathSuffix ? (pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`) : '/portal';
  return `${baseUrl}${cleanPath}`;
}

export async function createNotification(input: NotifyInput): Promise<void> {
  const db = getDb();
  await db('notifications').insert({
    user_id: input.userId,
    category: input.category,
    title: input.title,
    message: input.message,
    related_entity_type: input.relatedEntityType || null,
    related_entity_id: input.relatedEntityId || null,
    is_read: false,
  });

  if (input.sendEmail === false) return;

  // Dispatch branded transactional email asynchronously so SMTP latency or
  // unconfigured mail settings never slow down or interrupt core actions.
  void (async () => {
    try {
      const user = await db('users')
        .leftJoin('investor_profiles', 'users.id', 'investor_profiles.user_id')
        .where('users.id', input.userId)
        .select(
          'users.email',
          'users.account_type',
          'investor_profiles.first_name',
          'investor_profiles.last_name',
          'investor_profiles.account_number'
        )
        .first();

      if (!user?.email) return;
      // Only send automatic notification emails to investor accounts unless explicitly forced
      if (user.account_type !== 'investor' && input.sendEmail !== true) return;

      const recipientName =
        [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || undefined;

      const details = [...(input.emailDetails || [])];
      if (user.account_number && !details.some((d) => d.label.toLowerCase().includes('account number'))) {
        details.unshift({ label: 'Account Number', value: String(user.account_number) });
      }

      const ctaUrl = resolvePortalCtaUrl(input.emailCtaPath || '/portal');

      const result = await sendInstitutionalEmail({
        to: user.email,
        recipientName,
        subject: input.emailSubject || `RICHMOND-INV — ${input.title}`,
        categoryLabel: formatCategoryLabel(input.category),
        headline: input.emailHeadline || input.title,
        body: input.message,
        details: details.length > 0 ? details : undefined,
        ctaLabel: input.emailCtaLabel || (ctaUrl ? 'Access Investor Portal' : undefined),
        ctaUrl,
      });

      if (!result.ok && result.error && !result.error.includes('not configured')) {
        console.warn(`[RICHMOND-INV Mail] Delivery warning for ${user.email}: ${result.error}`);
      }
    } catch (err) {
      console.warn('[RICHMOND-INV Mail] Non-fatal notification email error:', err);
    }
  })();
}

export async function notifyAllAdmins(
  category: string,
  title: string,
  message: string,
  relatedEntityType?: string,
  relatedEntityId?: number
): Promise<void> {
  const db = getDb();
  const admins = await db('users').where({ account_type: 'admin', account_status: 'active' }).select('id');
  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      category,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      sendEmail: false,
    });
  }
}
