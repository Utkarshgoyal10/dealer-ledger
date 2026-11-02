import mongoose from 'mongoose';

/**
 * Every worker login needs admin approval. An approved request is the worker's
 * session for that one day (IST); next day they must log in and get approved again.
 */
const loginRequestSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dateKey: { type: String, required: true }, // YYYY-MM-DD (IST) the login is valid for
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'revoked', 'cancelled'], default: 'pending' },
    // Secret the waiting device uses to collect its token once approved
    pollKeyHash: { type: String, required: true, select: false },
    tokenIssued: { type: Boolean, default: false },
    device: { type: String, default: '' }, // browser / phone description
    ip: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true }
);

loginRequestSchema.index({ status: 1, dateKey: 1 });
loginRequestSchema.index({ worker: 1, dateKey: 1 });

export const LoginRequest = mongoose.model('LoginRequest', loginRequestSchema);
