import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // create, update, delete, approve, reject, ...
    entity: { type: String, required: true }, // Transaction, Customer, User, ...
    entityId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String, default: '' },
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
