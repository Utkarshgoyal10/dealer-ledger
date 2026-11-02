import mongoose from 'mongoose';

/** A fingerprint / face / screen-lock credential registered by an admin on one device */
const passkeySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    credId: { type: String, required: true, unique: true }, // base64url
    publicKey: { type: Buffer, required: true },
    counter: { type: Number, default: 0 },
    transports: [String],
    deviceName: { type: String, default: 'This device' },
    lastUsedAt: Date,
  },
  { timestamps: true }
);

export const Passkey = mongoose.model('Passkey', passkeySchema);

/** Short-lived WebAuthn challenges (auto-deleted by MongoDB after expiry) */
const challengeSchema = new mongoose.Schema({
  challenge: { type: String, required: true },
  purpose: { type: String, enum: ['register', 'login'], required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date, required: true },
});
challengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthChallenge = mongoose.model('AuthChallenge', challengeSchema);
