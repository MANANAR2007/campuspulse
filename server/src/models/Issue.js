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
  'awaiting_info',
  'resolved',
  'rejected',
  'escalated',
];

export const ISSUE_VISIBILITY = ['public', 'department_only', 'confidential'];

export const ISSUE_PRIORITIES = ['low', 'normal', 'high', 'critical'];

export const CAMPUS_ZONES = [
  'academic_blocks',
  'library',
  'hostels',
  'cafeteria',
  'sports_complex',
  'admin_block',
  'labs_research',
  'parking_transit',
  'auditorium',
  'campus_grounds',
  'other',
];

/**
 * Structured campus location sub-schema
 */
const locationSchema = new mongoose.Schema(
  {
    building: {
      type: String,
      required: [true, 'Campus building is required'],
      trim: true,
      maxlength: [120, 'Building name cannot exceed 120 characters'],
    },
    campusZone: {
      type: String,
      trim: true,
      enum: {
        values: CAMPUS_ZONES,
        message: 'Invalid campus zone: {VALUE}',
      },
      default: 'academic_blocks',
      lowercase: true,
      index: true,
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

/**
 * Chronological Status History Entry sub-schema
 */
const statusHistoryEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ISSUE_STATUSES,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [1000, 'Status transition note cannot exceed 1000 characters'],
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

/**
 * Assignment and Redirection History Entry sub-schema
 */
const assignmentHistoryEntrySchema = new mongoose.Schema(
  {
    previousDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    newDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    previousAssignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    newAssignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
      default: '',
    },
    action: {
      type: String,
      enum: ['assigned', 'reassigned', 'redirected', 'unassigned'],
      default: 'assigned',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
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
    statusHistory: {
      type: [statusHistoryEntrySchema],
      default: [],
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
    // Visibility: public, department_only, or confidential
    visibility: {
      type: String,
      enum: {
        values: ISSUE_VISIBILITY,
        message: 'Invalid issue visibility: {VALUE}',
      },
      default: 'public',
      lowercase: true,
      index: true,
    },
    // Priority: low, normal, high, critical
    priority: {
      type: String,
      enum: {
        values: ISSUE_PRIORITIES,
        message: 'Invalid issue priority: {VALUE}',
      },
      default: 'normal',
      lowercase: true,
      index: true,
    },
    // Assigned Department
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    // Assigned Staff Member
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignmentNote: {
      type: String,
      trim: true,
      maxlength: [1000, 'Assignment note cannot exceed 1000 characters'],
      default: '',
    },
    assignmentHistory: {
      type: [assignmentHistoryEntrySchema],
      default: [],
    },
    // Response & Resolution SLA Deadlines
    responseDeadline: {
      type: Date,
      default: null,
      index: true,
    },
    resolutionDeadline: {
      type: Date,
      default: null,
      index: true,
    },
    deadlineReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Deadline modification reason cannot exceed 500 characters'],
      default: '',
    },
    // Resolution Details
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolutionEvidenceUrl: {
      type: String,
      trim: true,
      default: '',
    },
    resolutionEvidencePublicId: {
      type: String,
      trim: true,
      default: '',
    },
    // Reporter Verification & Dispute/Reopen
    reporterConfirmed: {
      type: Boolean,
      default: false,
    },
    reporterFeedback: {
      type: String,
      trim: true,
      maxlength: [1000, 'Reporter feedback cannot exceed 1000 characters'],
      default: '',
    },
    reopenedAt: {
      type: Date,
      default: null,
    },
    reopenedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reopenReason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Reopen reason cannot exceed 1000 characters'],
      default: '',
    },
    reopenCount: {
      type: Number,
      default: 0,
    },
    // Smart Issue Grouping & Canonical Incident Relationships
    parentIssueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      default: null,
      index: true,
    },
    isIncidentGroup: {
      type: Boolean,
      default: false,
      index: true,
    },
    groupedReportsCount: {
      type: Number,
      default: 0,
      index: true,
    },
    canonicalTitle: {
      type: String,
      trim: true,
      maxlength: [150, 'Canonical title cannot exceed 150 characters'],
      default: '',
    },
    groupingReason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Grouping reason cannot exceed 1000 characters'],
      default: '',
    },
    groupedAt: {
      type: Date,
      default: null,
    },
    groupedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret._id = ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret._id = ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound and search indexes
issueSchema.index({ parentIssueId: 1, createdAt: -1 });
issueSchema.index({ isIncidentGroup: 1, status: 1 });

// Compound and search indexes
issueSchema.index({ status: 1, createdAt: -1 });
issueSchema.index({ category: 1, status: 1 });
issueSchema.index({ severity: 1, status: 1 });
issueSchema.index({ isCampusWideAlert: 1, status: 1 });
issueSchema.index({ createdBy: 1, createdAt: -1 });
issueSchema.index({ 'location.campusZone': 1, status: 1 });
issueSchema.index({ 'location.campusZone': 1, createdAt: -1 });
issueSchema.index({ visibility: 1, status: 1 });
issueSchema.index({ department: 1, status: 1 });
issueSchema.index({ assignedTo: 1, status: 1 });
issueSchema.index({ resolutionDeadline: 1, status: 1 });

// Text index for safe keyword search and duplicate detection
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
