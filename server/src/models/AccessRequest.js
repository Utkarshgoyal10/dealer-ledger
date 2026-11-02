import mongoose from 'mongoose';

const accessRequestSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'revoked'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    adminNote: { type: String, trim: true, default: '' },
    // Worker can view the requested range until this time
    accessExpiresAt: Date,
  },
  { timestamps: true }
);

accessRequestSchema.index({ worker: 1, status: 1, accessExpiresAt: 1 });

export const AccessRequest = mongoose.model('AccessRequest', accessRequestSchema);
