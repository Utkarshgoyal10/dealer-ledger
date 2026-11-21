import mongoose from 'mongoose';

/**
 * Salesman counts itel stock at a dealer's shop. Saved as a snapshot (prices and
 * outstanding at that moment). gap > 0 means the dealer is short: he owes more than
 * the stock he still holds, so that amount should be collected.
 */
const itemSchema = new mongoose.Schema(
  { product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, name: String, price: Number, qty: Number, value: Number },
  { _id: false }
);

const stockCheckSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [itemSchema],
    totalQty: { type: Number, required: true },
    stockValue: { type: Number, required: true },
    outstanding: { type: Number, required: true },
    gap: { type: Number, required: true }, // outstanding - stockValue
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

stockCheckSchema.index({ customer: 1, createdAt: -1 });

export const StockCheck = mongoose.model('StockCheck', stockCheckSchema);
