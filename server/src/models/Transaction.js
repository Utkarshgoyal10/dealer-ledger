import mongoose from 'mongoose';

export const TXN_TYPES = ['sale', 'return', 'payment', 'scheme'];
// Bank = any bank payment: UPI, NEFT/RTGS/IMPS, deposit, etc.
export const PAYMENT_MODES = ['cash', 'bank'];

const transactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TXN_TYPES, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    // Worker responsible for this entry (used for worker-wise reports)
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Who actually typed it in (worker or admin)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0.01 },
    // Business date (IST midnight)
    date: { type: Date, required: true },
    paymentMode: { type: String, enum: [...PAYMENT_MODES, null], default: null },
    note: { type: String, trim: true, default: '' },
    deleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

transactionSchema.index({ customer: 1, date: 1 });
transactionSchema.index({ worker: 1, date: 1 });
transactionSchema.index({ createdBy: 1, date: 1 });
transactionSchema.index({ date: 1, type: 1 });

/**
 * Effect on the dealer's balance (what the dealer owes us).
 * Sale increases it. Return, scheme and payment reduce it.
 */
export function signedAmount(t) {
  return t.type === 'sale' ? t.amount : -t.amount;
}

/** Same rule as signedAmount, as a MongoDB aggregation expression */
export const signedAmountExpr = {
  $cond: [{ $eq: ['$type', 'sale'] }, '$amount', { $multiply: ['$amount', -1] }],
};

export const Transaction = mongoose.model('Transaction', transactionSchema);

/** One-time conversion of old cheque payments (from before Cash/Bank) into bank payments */
export async function migrateChequeToBank() {
  const coll = Transaction.collection;
  const old = await coll.find({ paymentMode: 'cheque' }).project({ _id: 1 }).toArray();
  for (const t of old) {
    await coll.updateOne(
      { _id: t._id },
      {
        $set: { paymentMode: 'bank' },
        $unset: { cheque: '' },
      }
    );
  }
  if (old.length) console.log(`Converted ${old.length} cheque payment(s) to bank`);
}
