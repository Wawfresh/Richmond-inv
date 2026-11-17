import type { Request } from 'express';
import { getDb } from '../db/connection.ts';

export interface AuditInput {
  actorUserId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  previousData?: unknown;
  newData?: unknown;
  req?: Request;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  const db = getDb();
  const ip = input.req
    ? (input.req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || input.req.ip || null)
    : null;
  const userAgent = input.req?.headers['user-agent']?.toString().slice(0, 250) || null;

  await db('admin_audit_logs').insert({
    actor_user_id: input.actorUserId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId !== undefined && input.entityId !== null ? String(input.entityId) : null,
    previous_data_json: input.previousData !== undefined ? JSON.stringify(input.previousData) : null,
    new_data_json: input.newData !== undefined ? JSON.stringify(input.newData) : null,
    ip_address: ip,
    user_agent: userAgent,
  });
}
