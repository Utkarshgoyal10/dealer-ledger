import 'dotenv/config';

export const env = {
  PORT: Number(process.env.PORT || 5000),
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_JWT_EXPIRES_IN: '7d', // admin stays logged in for 7 days
  // Workers: token expires at midnight IST of the day the admin approved the login
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  WORKER_VISIBLE_DAYS: Number(process.env.WORKER_VISIBLE_DAYS || 30),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Fixed admin account, created on first start if it does not exist
  ADMIN_USERNAME: (process.env.ADMIN_USERNAME || '').trim().toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  ADMIN_NAME: process.env.ADMIN_NAME || 'Admin',

  // Fingerprint (WebAuthn) login. RP_ID = your domain without https:// and port.
  RP_ID: process.env.RP_ID || 'localhost',
  RP_NAME: process.env.RP_NAME || 'itel Dealer Ledger',
  RP_ORIGIN: (process.env.RP_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
};

if (!env.MONGO_URI) throw new Error('MONGO_URI is missing in .env');
if (!env.JWT_SECRET) throw new Error('JWT_SECRET is missing in .env');
