import mongoose from 'mongoose';

/**
 * Dealer balance confirmation ("NOC"): the dealer checks the statement on the salesman's
 * phone and signs (confirmed) or says what is wrong (disputed). Saved as a snapshot and
 * never edited afterwards — only the admin can mark a dispute as resolved.
 */
const entrySchema = new mongoose.Schema(
  { date: Date, type: String, paymentMode: String, amount: Number, balance: Number },
  { _id: false }
);

const confirmationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['confirmed', 'disputed'], required: true },
    periodFrom: { type: Date, required: true }, // statement starts on this day (IST)
    openingBalance: { type: Number, required: true }, // balance at the start of periodFrom
    closingBalance: { type: Number, required: true }, // balance the dealer signed for
    totals: { sale: Number, return: Number, payment: Number, scheme: Number },
    entries: [entrySchema],
    signature: { type: String }, // PNG data URL (confirmed only)
    signerName: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' }, // dealer's reason when disputed
    // Admin cross-check of a signed confirmation
    approvedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Admin rejects after cross-check (unlocks the period; a fresh signature is needed)
    rejectedAt: Date,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectReason: { type: String, trim: true, default: '' },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNote: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

confirmationSchema.index({ customer: 1, createdAt: -1 });

export const Confirmation = mongoose.model('Confirmation', confirmationSchema);
