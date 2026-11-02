import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import customerRoutes from './routes/customers.js';
import transactionRoutes from './routes/transactions.js';
import accessRequestRoutes from './routes/accessRequests.js';
import cashClosingRoutes from './routes/cashClosings.js';
import reportRoutes from './routes/reports.js';
import auditRoutes from './routes/audit.js';
import loginRequestRoutes from './routes/loginRequests.js';
import pushRoutes from './routes/push.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.CLIENT_URL.split(',').map((s) => s.trim()), exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '200kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', requireAuth, userRoutes);
  app.use('/api/customers', requireAuth, customerRoutes);
  app.use('/api/transactions', requireAuth, transactionRoutes);
  app.use('/api/access-requests', requireAuth, accessRequestRoutes);
  app.use('/api/cash-closings', requireAuth, cashClosingRoutes);
  app.use('/api/reports', requireAuth, reportRoutes);
  app.use('/api/audit', requireAuth, auditRoutes);
  app.use('/api/login-requests', requireAuth, loginRequestRoutes);
  app.use('/api/push', requireAuth, pushRoutes);
  app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

  // Optional: serve the built React app from the same server (single deployment)
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('/{*splat}', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ message: err.errors[0]?.message || 'Invalid input', errors: err.errors });
    }
    if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
    if (err.code === 11000) return res.status(409).json({ message: 'Already exists' });
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ message: status >= 500 ? 'Something went wrong' : err.message });
  });

  return app;
}
