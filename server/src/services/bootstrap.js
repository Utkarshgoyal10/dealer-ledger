import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { seedRoutes } from '../models/Route.js';
import { migrateChequeToBank } from '../models/Transaction.js';
import { initPush } from './push.js';

/** Runs on every start: default routes + the fixed admin account from .env */
export async function bootstrap() {
  await seedRoutes();
  await migrateChequeToBank();
  await initPush(); // creates free push-notification keys on first run

  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    if (!(await User.exists({ role: 'admin' }))) {
      console.warn('No admin exists. Set ADMIN_USERNAME and ADMIN_PASSWORD in .env and restart.');
    }
    return;
  }
  const existing = await User.findOne({ username: env.ADMIN_USERNAME });
  if (!existing) {
    await User.create({
      name: env.ADMIN_NAME,
      username: env.ADMIN_USERNAME,
      passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 10),
      role: 'admin',
    });
    console.log(`Admin "${env.ADMIN_USERNAME}" created`);
  }
}
