import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.ts';
import { sha256, safeEqual } from '../lib/crypto.ts';

export interface AuthenticatedUser {
  id: number;
  email: string;
  accountType: 'investor' | 'admin';
  accountStatus: string;
  roleId: number;
  roleSlug: string;
  roleName: string;
  permissions: string[];
  sessionId: number;
  csrfToken: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export const SESSION_COOKIE_NAME = 'richmond_session';
export const ADMIN_RETURN_COOKIE_NAME = 'richmond_admin_return';

export async function attachSessionUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;
    const rawToken =
      typeof bearerToken === 'string' && bearerToken.length > 0
        ? bearerToken
        : cookieToken;
    if (!rawToken || typeof rawToken !== 'string') {
      next();
      return;
    }

    const db = getDb();
    const tokenHash = sha256(rawToken);
    const session = await db('user_sessions')
      .where({ token_hash: tokenHash })
      .whereNull('revoked_at')
      .first();

    if (!session) {
      next();
      return;
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      next();
      return;
    }

    const user = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.id', session.user_id)
      .select(
        'users.id',
        'users.email',
        'users.account_type',
        'users.account_status',
        'users.role_id',
        'roles.slug as role_slug',
        'roles.name as role_name'
      )
      .first();

    if (!user || user.account_status !== 'active') {
      next();
      return;
    }

    const permRows = await db('role_permissions')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .where('role_permissions.role_id', user.role_id)
      .select('permissions.key');

    req.authUser = {
      id: user.id,
      email: user.email,
      accountType: user.account_type,
      accountStatus: user.account_status,
      roleId: user.role_id,
      roleSlug: user.role_slug,
      roleName: user.role_name,
      permissions: permRows.map((p: any) => p.key),
      sessionId: session.id,
      csrfToken: session.csrf_token,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  next();
}

export function requireInvestor(req: Request, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.authUser.accountType !== 'investor') {
    res.status(403).json({ error: 'Investor account access required.' });
    return;
  }
  next();
}

export function requireAdmin(permissionKey?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (req.authUser.accountType !== 'admin') {
      res.status(403).json({ error: 'Restricted to authorized administrators.' });
      return;
    }
    if (permissionKey && !req.authUser.permissions.includes(permissionKey)) {
      res.status(403).json({ error: `Missing required permission: ${permissionKey}` });
      return;
    }
    next();
  };
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }
  const reqPath = req.originalUrl.split('?')[0];
  const csrfExemptPaths = new Set([
    '/api/auth/login',
    '/api/auth/admin-login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
  ]);
  if (csrfExemptPaths.has(reqPath) || reqPath.startsWith('/api/public/')) {
    next();
    return;
  }
  if (!req.authUser) {
    next();
    return;
  }

  // Enforce Origin header validation in production for cookie-authenticated mutations
  if (process.env.NODE_ENV === 'production' && req.headers.origin) {
    const reqOrigin = String(req.headers.origin).replace(/\/+$/, '');
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
      .split(',')[0]
      .trim();
    const allowed = new Set(
      [
        process.env.CORS_ORIGIN,
        process.env.APP_URL,
        host ? `https://${host}` : '',
        host ? `http://${host}` : '',
      ]
        .filter(Boolean)
        .map((v) => String(v).trim().replace(/\/+$/, ''))
    );
    if (allowed.size > 0 && !allowed.has(reqOrigin)) {
      res.status(403).json({ error: 'Cross-origin request blocked by security policy.' });
      return;
    }
  }

  const headerToken = req.headers['x-csrf-token'];
  if (typeof headerToken !== 'string' || !safeEqual(headerToken, req.authUser.csrfToken)) {
    res.status(403).json({ error: 'Invalid or missing CSRF security token.' });
    return;
  }
  next();
}
