import mongoose from 'mongoose';

export const ISSUE_CATEGORIES = [
  'infrastructure',
  'electrical',
  'plumbing',
  'it_wifi',
  'safety',
  'sanitation',
  'other',
];

export const ISSUE_SEVERITIES = ['low', 'moderate', 'high', 'critical'];

export const ISSUE_STATUSES = [
  'reported',
  'verified',
  'in_progress',
  'resolved',
  'rejected',
];

const locationSchema = new mongoose.Schema(
  {
    building: {
      type: String,
      required: [true, 'Campus building is required'],
      trim: true,
      maxlength: [120, 'Building name cannot exceed 120 characters'],
    },
    area: {
      type: String,
      trim: true,
      maxlength: [120, 'Area description cannot exceed 120 characters'],
      default: '',
    },
    floor: {
      type: String,
      trim: true,
      maxlength: [50, 'Floor description cannot exceed 50 characters'],
      default: '',
    },
    room: {
      type: String,
      trim: true,
      maxlength: [50, 'Room number/name cannot exceed 50 characters'],
      default: '',
    },
  },
  { _id: false }
);

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Issue title is required'],
      trim: true,
      minlength: [5, 'Issue title must be at least 5 characters'],
      maxlength: [150, 'Issue title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Issue description is required'],
      trim: true,
      minlength: [10, 'Issue description must be at least 10 characters'],
      maxlength: [2500, 'Issue description cannot exceed 2500 characters'],
    },
    category: {
      type: String,
      required: [true, 'Issue category is required'],
      enum: {
        values: ISSUE_CATEGORIES,
        message: 'Invalid issue category: {VALUE}',
      },
      lowercase: true,
      index: true,
    },
    severity: {
      type: String,
      required: [true, 'Severity level is required'],
      enum: {
        values: ISSUE_SEVERITIES,
        message: 'Invalid severity level: {VALUE}',
      },
      lowercase: true,
      index: true,
    },
    location: {
      type: locationSchema,
      required: [true, 'Location details are required'],
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    imagePublicId: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Report author is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ISSUE_STATUSES,
        message: 'Invalid issue status: {VALUE}',
      },
      default: 'reported',
      lowercase: true,
      index: true,
    },
    campusAlertRequested: {
      type: Boolean,
      default: false,
      index: true,
    },
    isCampusWideAlert: {
      type: Boolean,
      default: false,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: [1000, 'Resolution note cannot exceed 1000 characters'],
      default: '',
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

// Compound and search indexes
issueSchema.index({ status: 1, createdAt: -1 });
issueSchema.index({ category: 1, status: 1 });
issueSchema.index({ severity: 1, status: 1 });
issueSchema.index({ isCampusWideAlert: 1, status: 1 });
issueSchema.index({ createdBy: 1, createdAt: -1 });

// Text index for safe keyword search
issueSchema.index(
  {
    title: 'text',
    description: 'text',
    'location.building': 'text',
    'location.area': 'text',
  },
  {
    weights: {
      title: 5,
      'location.building': 3,
      description: 1,
      'location.area': 1,
    },
    name: 'IssueTextIndex',
  }
);

const Issue = mongoose.model('Issue', issueSchema);

export default Issue;
