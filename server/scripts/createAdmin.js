// Creates an admin, or resets an existing admin's password.
// Usage: npm run create-admin -- --username admin --password "secret123" --name "Owner"
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1];
}

if (!args.username || !args.password) {
  console.error('Usage: npm run create-admin -- --username admin --password secret123 --name "Owner"');
  process.exit(1);
}
if (args.password.length < 6) {
  console.error('Password must be at least 6 characters');
  process.exit(1);
}

await connectDB();
const username = args.username.trim().toLowerCase();
const existing = await User.findOne({ username });
const passwordHash = await bcrypt.hash(args.password, 10);
if (existing) {
  existing.role = 'admin';
  existing.active = true;
  existing.passwordHash = passwordHash;
  existing.tokenVersion += 1;
  if (args.name) existing.name = args.name;
  await existing.save();
  console.log(`Updated ${username} as admin (password reset)`);
} else {
  await User.create({ name: args.name || 'Admin', username, passwordHash, role: 'admin' });
  console.log(`Created admin ${username}`);
}
await mongoose.disconnect();
