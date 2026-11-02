import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Used to log in (no email needed)
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'worker'], default: 'worker' },
    active: { type: Boolean, default: true },
    // Bumped on password reset / deactivation so all existing sessions stop working
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
  return {
    _id: this._id,
    name: this.name,
    username: this.username,
    role: this.role,
    active: this.active,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
