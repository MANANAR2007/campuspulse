import mongoose from 'mongoose';

const issueConfirmationSchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      required: [true, 'Issue reference is required'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
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

// One account can confirm a given issue only once
issueConfirmationSchema.index({ issue: 1, user: 1 }, { unique: true });
issueConfirmationSchema.index({ user: 1, createdAt: -1 });

const IssueConfirmation = mongoose.model('IssueConfirmation', issueConfirmationSchema);

export default IssueConfirmation;
