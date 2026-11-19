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
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // Strict CORS restriction in production when separate static frontend origin is configured
  const allowedOrigin = process.env.CORS_ORIGIN || process.env.APP_URL;
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (!isProd || (allowedOrigin && origin === allowedOrigin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
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

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(attachSessionUser);

  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
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

  app.use('/api/auth', authRateLimiter);
  app.use('/api', apiRateLimiter);
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
    if (err?.message?.includes('Unsupported file type')) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Uploaded file exceeds the 15MB size limit.' });
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
