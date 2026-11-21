import mongoose from 'mongoose';

/** itel model with the dealer price (incl. GST) used to value stock at a shop */
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, unique: true }, // lower-case name, for duplicates
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true }, // inactive = no longer shown for new stock checks
  },
  { timestamps: true }
);

export const Product = mongoose.model('Product', productSchema);
