import { Router, type Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/connection.ts';
import {
  generateAccountNumber,
  generateOpaqueToken,
  hashPassword,
  sha256,
  verifyPassword,
} from '../lib/crypto.ts';
import { writeAuditLog } from '../lib/audit.ts';
import { createNotification, notifyAllAdmins } from '../lib/notifications.ts';
import { requireAuth, SESSION_COOKIE_NAME } from '../middleware/auth.ts';

export const authRouter = Router();

function getCookieOptions(req: any, expiresAt?: Date) {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  const secure = process.env.COOKIE_SECURE === 'false' ? false : isHttps || process.env.NODE_ENV === 'production';
  const configuredSameSite = (process.env.COOKIE_SAMESITE || '').toLowerCase();
  const sameSite: 'lax' | 'none' | 'strict' =
    configuredSameSite === 'lax' || configuredSameSite === 'strict' || configuredSameSite === 'none'
      ? configuredSameSite
      : secure
        ? 'none'
        : 'lax';
  return {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

export function setSessionCookie(req: any, res: Response, rawToken: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE_NAME, rawToken, getCookieOptions(req, expiresAt));
}

const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required.').max(100),
    middleName: z.string().trim().max(100).optional().default(''),
    lastName: z.string().trim().min(1, 'Last name is required.').max(100),
    email: z.string().trim().email('Valid email address is required.').max(191),
    telephone: z.string().trim().min(6, 'Telephone number is required.').max(40),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD.'),
    countryOfResidence: z.string().trim().min(2, 'Country of residence is required.').max(100),
    residentialAddress: z.string().trim().min(4, 'Residential address is required.').max(255),
    city: z.string().trim().min(1, 'City is required.').max(100),
    stateRegion: z.string().trim().min(1, 'State or region is required.').max(100),
    postalCode: z.string().trim().min(2, 'Postal code is required.').max(40),
    password: z.string().min(6, 'Password must be at least 6 characters.').max(128),
    passwordConfirmation: z.string().min(6, 'Password confirmation must be at least 6 characters.').max(128),
    acceptTerms: z.literal(true, { message: 'You must accept the Terms and Conditions and Privacy Policy.' }),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Password and confirmation do not match.',
    path: ['passwordConfirmation'],
  });

authRouter.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data.' });
      return;
    }

    const dob = new Date(parsed.data.dateOfBirth);
    const minAgeDate = new Date();
    minAgeDate.setFullYear(minAgeDate.getFullYear() - 18);
    if (Number.isNaN(dob.getTime()) || dob > minAgeDate) {
      res.status(400).json({ error: 'Investors must be at least 18 years of age.' });
      return;
    }

    const db = getDb();
    const email = parsed.data.email.toLowerCase();
    const existing = await db('users').where({ email }).first();
    if (existing) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const investorRole = await db('roles').where({ slug: 'investor' }).first();
    if (!investorRole) {
      res.status(500).json({ error: 'System investor role is not initialized.' });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    let accountNumber = generateAccountNumber();
    for (let i = 0; i < 5; i++) {
      const collision = await db('investor_profiles').where({ account_number: accountNumber }).first();
      if (!collision) break;
      accountNumber = generateAccountNumber();
    }

    const now = new Date();
    let createdUserId = 0;

    await db.transaction(async (trx) => {
      const [userId] = await trx('users').insert({
        role_id: investorRole.id,
        email,
        password_hash: passwordHash,
        account_type: 'investor',
        account_status: 'active',
        last_login_at: now,
      });
      createdUserId = userId;

      await trx('investor_profiles').insert({
        user_id: userId,
        account_number: accountNumber,
        first_name: parsed.data.firstName,
        middle_name: parsed.data.middleName || null,
        last_name: parsed.data.lastName,
        telephone: parsed.data.telephone,
        date_of_birth: parsed.data.dateOfBirth,
        country_of_residence: parsed.data.countryOfResidence,
        residential_address: parsed.data.residentialAddress,
        city: parsed.data.city,
        state_region: parsed.data.stateRegion,
        postal_code: parsed.data.postalCode,
        kyc_status: 'not_submitted',
        terms_accepted_at: now,
        privacy_accepted_at: now,
      });
    });

    const rawToken = generateOpaqueToken(32);
    const csrfToken = generateOpaqueToken(24);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);

    await db('user_sessions').insert({
      user_id: createdUserId,
      token_hash: sha256(rawToken),
      csrf_token: csrfToken,
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent']?.slice(0, 250) || null,
      expires_at: expiresAt,
    });

    await createNotification({
      userId: createdUserId,
      category: 'account_registration',
      title: 'Welcome to RICHMOND-INV — Account Registration Confirmed',
      message: `Your RICHMOND-INV investor account has been successfully created and activated.\n\nYour dedicated shareholder account number is ${accountNumber}. To unlock share subscriptions and full treasury features, sign in to your Investor Portal and complete your KYC identity verification.`,
      relatedEntityType: 'investor_profile',
      relatedEntityId: createdUserId,
      sendEmail: true,
      emailSubject: `Welcome to RICHMOND-INV — Registration Confirmed (${accountNumber})`,
      emailHeadline: 'Your Investor Account Is Active',
      emailDetails: [
        { label: 'Account Number', value: accountNumber },
        { label: 'Registered Email', value: email },
        { label: 'Account Status', value: 'Active' },
        { label: 'Next Step', value: 'Submit KYC Verification Documents' },
      ],
      emailCtaLabel: 'Open Investor Dashboard',
      emailCtaPath: '/portal',
    });

    await notifyAllAdmins(
      'account_registration',
      'New Investor Registration',
      `New investor registered: ${parsed.data.firstName} ${parsed.data.lastName} (${accountNumber}).`,
      'user',
      createdUserId
    );

    await writeAuditLog({
      actorUserId: createdUserId,
      action: 'investor.register',
      entityType: 'user',
      entityId: createdUserId,
      newData: { email, accountNumber },
      req,
    });

    setSessionCookie(req, res, rawToken, expiresAt);
    res.status(201).json({
      ok: true,
      sessionToken: rawToken,
      user: {
        id: createdUserId,
        email,
        accountType: 'investor',
        accountNumber,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        kycStatus: 'not_submitted',
      },
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email address is required.'),
  password: z.string().min(1, 'Password is required.'),
});

async function handleLogin(req: any, res: Response, expectedAccountType?: 'investor' | 'admin') {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid login credentials.' });
    return;
  }

  const db = getDb();
  const email = parsed.data.email.toLowerCase();
  const user = await db('users')
    .join('roles', 'users.role_id', 'roles.id')
    .where('users.email', email)
    .select('users.*', 'roles.slug as role_slug', 'roles.name as role_name')
    .first();

  if (!user) {
    res.status(401).json({ error: 'Invalid email address or password.' });
    return;
  }

  if (expectedAccountType && user.account_type !== expectedAccountType) {
    res.status(403).json({
      error:
        expectedAccountType === 'admin'
          ? 'This portal is restricted to authorized administrators.'
          : 'This account type is not permitted here.',
    });
    return;
  }

  if (user.account_status === 'suspended') {
    res.status(403).json({ error: 'This account has been suspended. Please contact compliance administration.' });
    return;
  }

  if (user.account_status !== 'active') {
    res.status(403).json({ error: 'This account is inactive.' });
    return;
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    res.status(429).json({
      error: 'Too many failed login attempts. Account sign-in is temporarily locked.',
    });
    return;
  }

  const valid = await verifyPassword(parsed.data.password, user.password_hash);
  if (!valid) {
    const settingsRows = await db('system_settings')
      .whereIn('setting_key', ['max_login_attempts', 'lockout_minutes'])
      .select('setting_key', 'setting_value');
    const settingsMap = new Map(settingsRows.map((r: any) => [r.setting_key, r.setting_value]));
    const maxAttempts = Number(settingsMap.get('max_login_attempts') || 5);
    const lockoutMinutes = Number(settingsMap.get('lockout_minutes') || 15);

    const nextAttempts = Number(user.failed_login_attempts || 0) + 1;
    const lockedUntil = nextAttempts >= maxAttempts ? new Date(Date.now() + lockoutMinutes * 60 * 1000) : null;

    await db('users').where({ id: user.id }).update({
      failed_login_attempts: nextAttempts,
      locked_until: lockedUntil,
      updated_at: new Date(),
    });

    res.status(401).json({
      error: lockedUntil
        ? `Account temporarily locked for ${lockoutMinutes} minutes due to repeated failed attempts.`
        : 'Invalid email address or password.',
    });
    return;
  }

  await db('users').where({ id: user.id }).update({
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: new Date(),
    updated_at: new Date(),
  });

  const rawToken = generateOpaqueToken(32);
  const csrfToken = generateOpaqueToken(24);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);

  await db('user_sessions').insert({
    user_id: user.id,
    token_hash: sha256(rawToken),
    csrf_token: csrfToken,
    ip_address: req.ip || null,
    user_agent: req.headers['user-agent']?.slice(0, 250) || null,
    expires_at: expiresAt,
  });

  const permRows = await db('role_permissions')
    .join('permissions', 'role_permissions.permission_id', 'permissions.id')
    .where('role_permissions.role_id', user.role_id)
    .select('permissions.key');

  const profile =
    user.account_type === 'investor'
      ? await db('investor_profiles').where({ user_id: user.id }).first()
      : null;

  await writeAuditLog({
    actorUserId: user.id,
    action: user.account_type === 'admin' ? 'admin.login' : 'investor.login',
    entityType: 'user',
    entityId: user.id,
    req,
  });

  setSessionCookie(req, res, rawToken, expiresAt);
  res.json({
    ok: true,
    sessionToken: rawToken,
    csrfToken,
    user: {
      id: user.id,
      email: user.email,
      accountType: user.account_type,
      accountStatus: user.account_status,
      roleSlug: user.role_slug,
      roleName: user.role_name,
      permissions: permRows.map((p: any) => p.key),
      profile,
    },
  });
}

authRouter.post('/login', async (req, res, next) => {
  try {
    await handleLogin(req, res);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/admin-login', async (req, res, next) => {
  try {
    await handleLogin(req, res, 'admin');
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    if (req.authUser) {
      await db('user_sessions')
        .where({ id: req.authUser.sessionId })
        .update({ revoked_at: new Date() });
    }
    res.clearCookie(SESSION_COOKIE_NAME, getCookieOptions(req));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const restoreAdminSchema = z.object({
  adminSessionToken: z.string().trim().min(16, 'Administrator session token is required.'),
});

authRouter.post('/restore-admin', async (req, res, next) => {
  try {
    const parsed = restoreAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Valid administrator session token is required.' });
      return;
    }

    const db = getDb();
    const adminTokenHash = sha256(parsed.data.adminSessionToken);
    const adminSession = await db('user_sessions')
      .where({ token_hash: adminTokenHash })
      .whereNull('revoked_at')
      .first();

    if (!adminSession || new Date(adminSession.expires_at).getTime() < Date.now()) {
      res.status(401).json({ error: 'Administrator session has expired or been revoked. Please sign in again.' });
      return;
    }

    const adminUser = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.id', adminSession.user_id)
      .select('users.*', 'roles.slug as role_slug', 'roles.name as role_name')
      .first();

    if (!adminUser || adminUser.account_type !== 'admin' || adminUser.account_status !== 'active') {
      res.status(403).json({ error: 'Valid active administrator account required.' });
      return;
    }

    // Revoke the temporary investor dashboard session if currently active
    if (req.authUser && req.authUser.accountType === 'investor') {
      await db('user_sessions')
        .where({ id: req.authUser.sessionId })
        .update({ revoked_at: new Date() });
    }

    const permRows = await db('role_permissions')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .where('role_permissions.role_id', adminUser.role_id)
      .select('permissions.key');

    await writeAuditLog({
      actorUserId: adminUser.id,
      action: 'admin.investor_dashboard_exited',
      entityType: 'user',
      entityId: req.authUser?.id || adminUser.id,
      req,
    });

    setSessionCookie(req, res, parsed.data.adminSessionToken, new Date(adminSession.expires_at));
    res.json({
      ok: true,
      sessionToken: parsed.data.adminSessionToken,
      csrfToken: adminSession.csrf_token,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        accountType: adminUser.account_type,
        accountStatus: adminUser.account_status,
        roleSlug: adminUser.role_slug,
        roleName: adminUser.role_name,
        permissions: permRows.map((p: any) => p.key),
        profile: null,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', async (req, res, next) => {
  try {
    if (!req.authUser) {
      res.json({ authenticated: false, user: null, csrfToken: null });
      return;
    }
    const db = getDb();
    const profile =
      req.authUser.accountType === 'investor'
        ? await db('investor_profiles').where({ user_id: req.authUser.id }).first()
        : null;

    res.json({
      authenticated: true,
      csrfToken: req.authUser.csrfToken,
      user: {
        id: req.authUser.id,
        email: req.authUser.email,
        accountType: req.authUser.accountType,
        accountStatus: req.authUser.accountStatus,
        roleSlug: req.authUser.roleSlug,
        roleName: req.authUser.roleName,
        permissions: req.authUser.permissions,
        profile,
      },
    });
  } catch (err) {
    next(err);
  }
});

const forgotSchema = z.object({
  email: z.string().trim().email('Valid email address is required.'),
});

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Valid email is required.' });
      return;
    }

    const db = getDb();
    const email = parsed.data.email.toLowerCase();
    const user = await db('users').where({ email, account_status: 'active' }).first();

    let previewResetToken: string | undefined;

    if (user) {
      const rawResetToken = generateOpaqueToken(24);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
      await db('password_reset_tokens').insert({
        user_id: user.id,
        token_hash: sha256(rawResetToken),
        expires_at: expiresAt,
      });

      await createNotification({
        userId: user.id,
        category: 'security',
        title: 'Password Reset Requested',
        message: `A password reset request was initiated for your RICHMOND-INV account. Use the reset token below within 30 minutes to set a new password.\n\nIf you did not authorize this request, please ignore this message and contact Investor Relations immediately.`,
        sendEmail: true,
        emailSubject: 'RICHMOND-INV — Password Reset Instructions',
        emailHeadline: 'Password Reset Request',
        emailDetails: [
          { label: 'Reset Token', value: rawResetToken },
          { label: 'Valid For', value: '30 Minutes' },
        ],
        emailCtaLabel: 'Reset Account Password',
        emailCtaPath: `/reset-password?token=${encodeURIComponent(rawResetToken)}`,
      });

      await writeAuditLog({
        actorUserId: user.id,
        action: 'auth.forgot_password',
        entityType: 'user',
        entityId: user.id,
        req,
      });

      if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
        previewResetToken = rawResetToken;
      }
    }

    res.json({
      ok: true,
      message: 'If an active account matches that email address, password reset instructions have been issued.',
      ...(previewResetToken ? { previewResetToken } : {}),
    });
  } catch (err) {
    next(err);
  }
});

const resetSchema = z
  .object({
    token: z.string().trim().min(16, 'Valid reset token is required.'),
    password: z.string().min(10, 'Password must be at least 10 characters.').max(128),
    passwordConfirmation: z.string().min(10).max(128),
  })
  .refine((d) => d.password === d.passwordConfirmation, {
    message: 'Password and confirmation do not match.',
    path: ['passwordConfirmation'],
  });

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid password reset submission.' });
      return;
    }

    const db = getDb();
    const tokenHash = sha256(parsed.data.token);
    const resetRow = await db('password_reset_tokens')
      .where({ token_hash: tokenHash })
      .whereNull('used_at')
      .first();

    if (!resetRow || new Date(resetRow.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
      return;
    }

    const newHash = await hashPassword(parsed.data.password);
    const now = new Date();

    await db.transaction(async (trx) => {
      await trx('users').where({ id: resetRow.user_id }).update({
        password_hash: newHash,
        failed_login_attempts: 0,
        locked_until: null,
        updated_at: now,
      });
      await trx('password_reset_tokens').where({ id: resetRow.id }).update({ used_at: now });
      await trx('user_sessions').where({ user_id: resetRow.user_id }).whereNull('revoked_at').update({ revoked_at: now });
    });

    await writeAuditLog({
      actorUserId: resetRow.user_id,
      action: 'auth.reset_password',
      entityType: 'user',
      entityId: resetRow.user_id,
      req,
    });

    res.json({ ok: true, message: 'Password updated successfully. You may now sign in with your new credentials.' });
  } catch (err) {
    next(err);
  }
});
