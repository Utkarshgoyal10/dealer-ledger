import mongoose from 'mongoose';

const cashClosingSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dateKey: { type: String, required: true }, // YYYY-MM-DD (IST)
    date: { type: Date, required: true },
    systemCash: { type: Number, required: true }, // cash payments recorded in the app that day
    declaredCash: { type: Number, required: true }, // cash the worker says they are handing over
    difference: { type: Number, required: true }, // declared - system
    bankCount: { type: Number, default: 0 }, // bank payments entered that day (info only)
    bankTotal: { type: Number, default: 0 },
    note: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['submitted', 'verified', 'disputed'], default: 'submitted' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    adminNote: { type: String, trim: true, default: '' },
    // Set when the worker adds a payment after the admin verified: closing goes back to "submitted"
    reopenedAt: Date,
    reopenCount: { type: Number, default: 0 },
    needsResubmit: { type: Boolean, default: false }, // worker must submit cash again
  },
  { timestamps: true }
);

cashClosingSchema.index({ worker: 1, dateKey: 1 }, { unique: true });

export const CashClosing = mongoose.model('CashClosing', cashClosingSchema);
