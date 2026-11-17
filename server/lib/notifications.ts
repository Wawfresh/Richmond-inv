import nodemailer from 'nodemailer';
import { getDb } from '../db/connection.ts';

export interface NotifyInput {
  userId: number;
  category: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  sendEmail?: boolean;
}

async function getSmtpConfig() {
  const db = getDb();
  const rows = await db('system_settings')
    .whereIn('setting_key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_from'])
    .select('setting_key', 'setting_value');
  const map = new Map(rows.map((r: any) => [r.setting_key, r.setting_value]));

  const host = (map.get('smtp_host') || process.env.SMTP_HOST || '').trim();
  const port = Number(map.get('smtp_port') || process.env.SMTP_PORT || 465);
  const user = (map.get('smtp_user') || process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const from = (map.get('smtp_from') || process.env.SMTP_FROM || 'noreply@richmond-inv.com').trim();

  if (!host || !user || !pass) return null;
  return { host, port, user, pass, from };
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

  if (input.sendEmail) {
    try {
      const smtp = await getSmtpConfig();
      if (!smtp) return;
      const user = await db('users').where({ id: input.userId }).select('email').first();
      if (!user?.email) return;

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: { user: smtp.user, pass: smtp.pass },
      });

      await transporter.sendMail({
        from: smtp.from,
        to: user.email,
        subject: `[RICHMOND-INV] ${input.title}`,
        text: input.message,
      });
    } catch {
      // Optional SMTP notification failure must never abort core ledger operations
    }
  }
}

export async function notifyAllAdmins(category: string, title: string, message: string, relatedEntityType?: string, relatedEntityId?: number): Promise<void> {
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
    });
  }
}
