import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { runMigrations } from './server/db/migrate.ts';
import { runBootstrapSeed } from './server/db/seed.ts';
import { attachSessionUser, requireCsrf } from './server/middleware/auth.ts';
import { publicRouter } from './server/routes/public.ts';
import { authRouter } from './server/routes/auth.ts';
import { investorRouter } from './server/routes/investor.ts';
import { adminRouter } from './server/routes/admin.ts';

async function bootstrapServer() {
  await runMigrations();
  await runBootstrapSeed();

  const app = express();
  const isProd = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://translate.google.com',
                'https://translate.googleapis.com',
                'https://translate-pa.googleapis.com',
              ],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://fonts.googleapis.com',
                'https://www.gstatic.com',
                'https://translate.googleapis.com',
              ],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: [
                "'self'",
                'data:',
                'blob:',
                'https://www.gstatic.com',
                'https://www.google.com',
                'https://translate.googleapis.com',
                'https://translate.google.com',
              ],
              connectSrc: [
                "'self'",
                'https://translate.googleapis.com',
                'https://translate-pa.googleapis.com',
              ],
              frameSrc: ["'self'", 'blob:', 'https://translate.google.com'],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'self'"],
            },
          }
        : false,
      frameguard: isProd ? { action: 'sameorigin' } : false,
      hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    next();
  });

  // Strict CORS restriction in production when separate static frontend origin is configured
  const allowedOrigins = new Set(
    [process.env.CORS_ORIGIN, process.env.APP_URL]
      .filter(Boolean)
      .map((v) => String(v).trim().replace(/\/+$/, ''))
  );
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (!isProd || allowedOrigins.has(origin.replace(/\/+$/, '')))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '16mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(attachSessionUser);

  // Prevent browsers and proxies from caching sensitive authenticated API responses
  app.use(['/api/auth', '/api/investor', '/api/admin'], (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
  });

  const sensitiveAuthRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many account security requests. Please try again later.' },
  });

  const contactRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many inquiries submitted. Please try again later.' },
  });

  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 80,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication requests. Please try again later.' },
  });

  const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', apiRateLimiter);
  app.use('/api/auth', authRateLimiter);
  app.use('/api/auth/login', loginRateLimiter);
  app.use('/api/auth/admin-login', loginRateLimiter);
  app.use('/api/auth/register', sensitiveAuthRateLimiter);
  app.use('/api/auth/forgot-password', sensitiveAuthRateLimiter);
  app.use('/api/auth/reset-password', sensitiveAuthRateLimiter);
  app.use('/api/public/contact', contactRateLimiter);
  app.use('/api', requireCsrf);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'RICHMOND-INV' });
  });

  app.use('/api/public', publicRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/investor', investorRouter);
  app.use('/api/admin', adminRouter);

  // Unknown /api route handler
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Production error handler (never leaks stack traces in production)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (
      err?.message?.includes('Unsupported file') ||
      err?.message?.includes('does not match a permitted')
    ) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err?.code === 'LIMIT_FILE_SIZE' || err?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Uploaded documents exceed the maximum size limit. Please upload smaller images or PDFs.' });
      return;
    }
    if (err?.name === 'MulterError') {
      res.status(400).json({ error: err.message || 'File upload failed. Please check your selected files.' });
      return;
    }
    console.error('Server Error:', err);
    res.status(500).json({
      error: isProd ? 'An unexpected institutional service error occurred.' : err?.message || 'Internal server error',
    });
  });

  const httpServer = http.createServer(app);
  const distDir = path.resolve(process.cwd(), 'dist');
  const serveStatic = process.env.SERVE_STATIC !== 'false';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: { server: httpServer } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (serveStatic && fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const rawPort = process.env.PORT;
  const numericPort = rawPort ? Number(rawPort) : 3000;
  if (rawPort && Number.isNaN(numericPort)) {
    httpServer.listen(rawPort, () => {
      console.log(`RICHMOND-INV server running on socket ${rawPort} (${isProd ? 'production' : 'development'})`);
    });
  } else {
    const port = Number.isNaN(numericPort) ? 3000 : numericPort;
    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`RICHMOND-INV server running on port ${port} (${isProd ? 'production' : 'development'})`);
    });
  }
}

bootstrapServer().catch((err) => {
  console.error('Failed to start RICHMOND-INV server:', err);
  process.exit(1);
});
