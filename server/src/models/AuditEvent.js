import mongoose from 'mongoose';

const auditEventSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      required: true,
      enum: ['issue', 'department', 'user'],
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

auditEventSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export async function logAuditEvent({ entityType, entityId, action, actor, details = {}, reason = '' }) {
  try {
    return await AuditEvent.create({
      entityType,
      entityId,
      action,
      actor,
      details,
      reason,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('Failed to log audit event:', err.message);
    return null;
  }
}

const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);

export default AuditEvent;
