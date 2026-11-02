import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    shopName: { type: String, required: true, trim: true },
    route: { type: String, trim: true, default: '' },
    // Positive = customer owes us at the start, negative = advance from customer
    openingBalance: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

customerSchema.index({ deleted: 1, shopName: 1 });
customerSchema.index({ route: 1 });

export const Customer = mongoose.model('Customer', customerSchema);
