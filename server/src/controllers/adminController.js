import mongoose from 'mongoose';
import Issue, {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  ISSUE_PRIORITIES,
  ISSUE_VISIBILITY,
  CAMPUS_ZONES,
} from '../models/Issue.js';
import IssueConfirmation from '../models/IssueConfirmation.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import AuditEvent, { logAuditEvent } from '../models/AuditEvent.js';
import { normalizeCategory } from '../utils/categoryHelper.js';
import { attachConfirmationData } from './issueController.js';
import {
  createNotification,
  fanOutCampusAlertNotification,
} from '../utils/notificationHelper.js';
import {
  emitStatusChanged,
  emitAlertApproved,
  emitIssueUpdated,
} from '../utils/socket.js';

/**
 * GET /api/admin/issues
 * Retrieve all campus issues for administrative review with filtering and pagination
 */
export const getAdminIssues = async (req, res, next) => {
  try {
    const {
      status,
      severity,
      category,
      campusZone,
      campusAlertRequested,
      isCampusWideAlert,
      search,
      sort,
      department,
      assignedTo,
      visibility,
      priority,
      isOverdue,
      unassignedOnly,
    } = req.query;

    const filter = {};

    if (status && typeof status === 'string') {
      filter.status = status.trim().toLowerCase();
    }

    if (severity && typeof severity === 'string') {
      filter.severity = severity.trim().toLowerCase();
    }

    if (priority && typeof priority === 'string') {
      filter.priority = priority.trim().toLowerCase();
    }

    if (visibility && typeof visibility === 'string') {
      filter.visibility = visibility.trim().toLowerCase();
    }

    if (department && mongoose.Types.ObjectId.isValid(department)) {
      filter.department = department;
    }

    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
      filter.assignedTo = assignedTo;
    }

    if (unassignedOnly === 'true') {
      filter.assignedTo = null;
    }

    if (isOverdue === 'true') {
      filter.resolutionDeadline = { $lt: new Date(), $ne: null };
      filter.status = { $nin: ['resolved', 'rejected'] };
    }

    if (category && typeof category === 'string') {
      const normalizedCat = normalizeCategory(category);
      if (normalizedCat) filter.category = normalizedCat;
    }

    if (campusZone && typeof campusZone === 'string') {
      filter['location.campusZone'] = campusZone.trim().toLowerCase();
    }

    if (campusAlertRequested !== undefined) {
      filter.campusAlertRequested = campusAlertRequested === 'true';
    }

    if (isCampusWideAlert !== undefined) {
      filter.isCampusWideAlert = isCampusWideAlert === 'true';
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { 'location.building': { $regex: safeSearch, $options: 'i' } },
        { 'location.area': { $regex: safeSearch, $options: 'i' } },
      ];
    }

    let sortOptions = { createdAt: -1 };
    if (sort === 'oldest') sortOptions = { createdAt: 1 };
    if (sort === 'severity' || sort === 'urgency') sortOptions = { severity: 1, createdAt: -1 };
    if (sort === 'deadline') sortOptions = { resolutionDeadline: 1, createdAt: -1 };

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [rawIssues, totalCount] = await Promise.all([
      Issue.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email department role')
        .populate('reviewedBy', 'name email role')
        .populate('assignedTo', 'name email department departmentName')
        .populate('department', 'name code isActive')
        .populate('statusHistory.changedBy', 'name email role'),
      Issue.countDocuments(filter),
    ]);

    let issues = await attachConfirmationData(rawIssues, req.user._id);

    if (sort === 'most_affirmed') {
      issues = [...issues].sort((a, b) => (b.confirmationCount || 0) - (a.confirmationCount || 0));
    }

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.status(200).json({
      status: 'success',
      data: {
        issues,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/issues/:id/review
 * Admin review endpoint to verify or reject a report, and optionally approve an alert
 */
export const reviewIssue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision, approveCampusAlert, resolutionNote } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid issue ID format.',
      });
    }

    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        status: 'fail',
        message: 'Issue report not found.',
      });
    }

    // Prevent inappropriate re-review of issues already in progress or resolved
    if (issue.status === 'in_progress' || issue.status === 'resolved') {
      return res.status(409).json({
        status: 'fail',
        message: `Cannot review an issue that is already '${issue.status}'. Please use the status update endpoint instead.`,
      });
    }

    if (!decision || (decision !== 'verify' && decision !== 'reject')) {
      return res.status(400).json({
        status: 'fail',
        message: "Review decision must be either 'verify' or 'reject'.",
      });
    }

    if (decision === 'verify') {
      const wantsAlert = Boolean(approveCampusAlert);

      // Rule: If approveCampusAlert is true but campusAlertRequested is false, reject request with HTTP 400
      if (wantsAlert && !issue.campusAlertRequested) {
        return res.status(400).json({
          status: 'fail',
          message:
            'Cannot approve a campus-wide alert for an issue where the student did not request one.',
        });
      }

      issue.status = 'verified';
      issue.reviewedBy = req.user._id;
      issue.reviewedAt = new Date();
      issue.isCampusWideAlert = wantsAlert && issue.campusAlertRequested;

      if (resolutionNote && typeof resolutionNote === 'string') {
        issue.resolutionNote = resolutionNote.trim();
      }
    } else if (decision === 'reject') {
      issue.status = 'rejected';
      issue.isCampusWideAlert = false;
      issue.reviewedBy = req.user._id;
      issue.reviewedAt = new Date();

      if (resolutionNote && typeof resolutionNote === 'string') {
        issue.resolutionNote = resolutionNote.trim();
      }
    }

    if (!issue.statusHistory) {
      issue.statusHistory = [];
    }
    const transitionNote =
      resolutionNote && typeof resolutionNote === 'string' && resolutionNote.trim()
        ? resolutionNote.trim()
        : decision === 'verify'
        ? 'Verified by campus admin'
        : 'Rejected by campus admin';

    issue.statusHistory.push({
      status: issue.status,
      changedBy: req.user._id,
      note: transitionNote,
      timestamp: new Date(),
    });

    await issue.save();

    // 1. Trigger notification to issue reporter
    if (decision === 'verify') {
      await createNotification({
        recipient: issue.createdBy,
        actor: req.user._id,
        issue: issue._id,
        type: 'issue_verified',
        title: 'Report Verified by Administration',
        message: `Your report "${issue.title}" has been reviewed and verified by campus operations.`,
      });
    } else if (decision === 'reject') {
      await createNotification({
        recipient: issue.createdBy,
        actor: req.user._id,
        issue: issue._id,
        type: 'issue_rejected',
        title: 'Report Review: Rejected',
        message: `Your report "${issue.title}" was reviewed and marked as rejected.${
          issue.resolutionNote ? ` Note: "${issue.resolutionNote}"` : ''
        }`,
      });
    }

    // 2. If campus alert was approved, fan out notifications to student accounts
    if (approveCampusAlert && issue.isCampusWideAlert) {
      await fanOutCampusAlertNotification({ issue, actor: req.user._id });
    }

    const updatedIssue = await Issue.findById(issue._id)
      .populate('createdBy', 'name email department role')
      .populate('reviewedBy', 'name email role')
      .populate('statusHistory.changedBy', 'name email role');

    // Realtime broadcast of status update and approved alert
    emitStatusChanged(updatedIssue);
    if (issue.isCampusWideAlert) {
      emitAlertApproved(updatedIssue);
    }

    res.status(200).json({
      status: 'success',
      message: `Issue successfully marked as ${issue.status}.`,
      data: {
        issue: updatedIssue,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/issues/:id/status
 * Admin status lifecycle transition endpoint (verified -> in_progress -> resolved)
 */
export const updateIssueStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid issue ID format.',
      });
    }

    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        status: 'fail',
        message: 'Target status is required.',
      });
    }

    const targetStatus = status.trim().toLowerCase();
    if (!ISSUE_STATUSES.includes(targetStatus)) {
      return res.status(400).json({
        status: 'fail',
        message: `Invalid status. Must be one of: ${ISSUE_STATUSES.join(', ')}`,
      });
    }

    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        status: 'fail',
        message: 'Issue report not found.',
      });
    }

    const currentStatus = issue.status;

    // Define valid state transition matrix
    const validTransitions = {
      reported: [], // Cannot jump straight to in_progress or resolved without admin review
      verified: ['in_progress', 'awaiting_info', 'rejected'],
      in_progress: ['resolved', 'verified', 'awaiting_info', 'escalated'],
      awaiting_info: ['in_progress', 'resolved', 'rejected'],
      escalated: ['in_progress', 'resolved', 'verified'],
      resolved: ['in_progress'], // Reopening resolved ticket
      rejected: ['verified'], // Re-evaluating rejected ticket
    };

    const allowedNextStatuses = validTransitions[currentStatus] || [];

    if (!allowedNextStatuses.includes(targetStatus)) {
      if (currentStatus === 'reported') {
        return res.status(400).json({
          status: 'fail',
          message:
            "A newly reported issue must first be reviewed via the review endpoint before transitioning to 'in_progress' or 'resolved'.",
        });
      }
      return res.status(400).json({
        status: 'fail',
        message: `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: ${
          allowedNextStatuses.length > 0 ? allowedNextStatuses.join(', ') : 'none'
        }.`,
      });
    }

    // Apply status transition
    issue.status = targetStatus;

    if (resolutionNote && typeof resolutionNote === 'string') {
      issue.resolutionNote = resolutionNote.trim();
    }

    // If resolved, record resolution metadata and deactivate alert
    if (targetStatus === 'resolved') {
      issue.resolvedAt = new Date();
      issue.resolvedBy = req.user._id;
      issue.isCampusWideAlert = false;
    }

    // If reopening from resolved
    if (currentStatus === 'resolved' && targetStatus === 'in_progress') {
      issue.reopenedAt = new Date();
      issue.reopenedBy = req.user._id;
      issue.reopenCount = (issue.reopenCount || 0) + 1;
      issue.reopenReason = resolutionNote || 'Reopened by administrator';
    }

    if (!issue.statusHistory) {
      issue.statusHistory = [];
    }
    const noteText =
      resolutionNote && typeof resolutionNote === 'string' && resolutionNote.trim()
        ? resolutionNote.trim()
        : `Status updated to ${targetStatus.replace('_', ' ')}`;

    issue.statusHistory.push({
      status: targetStatus,
      changedBy: req.user._id,
      note: noteText,
      timestamp: new Date(),
    });

    await issue.save();

    // Trigger notification to issue reporter on status update
    await createNotification({
      recipient: issue.createdBy,
      actor: req.user._id,
      issue: issue._id,
      type: 'status_updated',
      title: `Status Updated: ${targetStatus.replace('_', ' ').toUpperCase()}`,
      message: `Your report "${issue.title}" status has been updated to "${targetStatus.replace('_', ' ')}".${
        issue.resolutionNote ? ` Note: "${issue.resolutionNote}"` : ''
      }`,
    });

    const updatedIssue = await Issue.findById(issue._id)
      .populate('createdBy', 'name email department role')
      .populate('reviewedBy', 'name email role')
      .populate('statusHistory.changedBy', 'name email role');

    // Realtime broadcast of status update and approved alert
    emitStatusChanged(updatedIssue);
    if (issue.isCampusWideAlert) {
      emitAlertApproved(updatedIssue);
    }

    res.status(200).json({
      status: 'success',
      message: `Issue status updated from '${currentStatus}' to '${targetStatus}'.`,
      data: {
        issue: updatedIssue,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/stats
 * Aggregate database-derived metrics for admin operational dashboard
 */
export const getAdminStats = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalActive,
      openReports,
      criticalActive,
      pendingReview,
      inProgress,
      resolved,
      activeAlerts,
      rejected,
      unassignedCount,
      overdueCount,
      reopenedCount,
      confidentialCount,
      categoryAgg,
      statusAgg,
      severityAgg,
      velocityAgg,
      totalAffirmations,
      resolutionAgg,
      deptAgg,
    ] = await Promise.all([
      Issue.countDocuments({ status: { $ne: 'rejected' } }),
      Issue.countDocuments({ status: 'reported' }),
      Issue.countDocuments({
        severity: 'critical',
        status: { $nin: ['resolved', 'rejected'] },
      }),
      Issue.countDocuments({ status: 'reported' }),
      Issue.countDocuments({ status: 'in_progress' }),
      Issue.countDocuments({ status: 'resolved' }),
      Issue.countDocuments({
        isCampusWideAlert: true,
        status: { $nin: ['resolved', 'rejected'] },
      }),
      Issue.countDocuments({ status: 'rejected' }),
      Issue.countDocuments({
        assignedTo: null,
        status: { $nin: ['resolved', 'rejected'] },
      }),
      Issue.countDocuments({
        resolutionDeadline: { $lt: new Date(), $ne: null },
        status: { $nin: ['resolved', 'rejected'] },
      }),
      Issue.countDocuments({ reopenCount: { $gt: 0 } }),
      Issue.countDocuments({ visibility: 'confidential' }),
      Issue.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Issue.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Issue.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      Issue.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
      ]),
      IssueConfirmation.countDocuments(),
      Issue.aggregate([
        { $match: { status: 'resolved' } },
        {
          $project: {
            diffHours: {
              $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 1000 * 60 * 60],
            },
          },
        },
        { $group: { _id: null, avgHours: { $avg: '$diffHours' } } },
      ]),
      Issue.aggregate([
        { $match: { status: { $nin: ['resolved', 'rejected'] }, department: { $ne: null } } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ]),
    ]);

    // Populate department names for department workload distribution
    const deptIds = deptAgg.map((d) => d._id);
    const depts = await Department.find({ _id: { $in: deptIds } }).select('_id name code');
    const deptNameMap = new Map(depts.map((d) => [d._id.toString(), d.name]));

    const departmentDistribution = deptAgg.map((d) => ({
      departmentId: d._id.toString(),
      name: deptNameMap.get(d._id.toString()) || 'Unknown Department',
      count: d.count,
    }));

    // Build 7-day velocity series with labels
    const velocityMap = new Map(velocityAgg.map((v) => [v._id, v.count]));
    const recentVelocity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      recentVelocity.push({
        date: dateStr,
        label: dayLabel,
        count: velocityMap.get(dateStr) || 0,
      });
    }

    const categoryDistribution = categoryAgg.map((c) => ({
      category: c._id,
      count: c.count,
    }));

    const statusDistribution = statusAgg.map((s) => ({
      status: s._id,
      count: s.count,
    }));

    const severityDistribution = severityAgg.map((s) => ({
      severity: s._id,
      count: s.count,
    }));

    const avgResolutionTimeHours = Math.round(resolutionAgg[0]?.avgHours || 0);

    res.status(200).json({
      status: 'success',
      data: {
        totalIssues: totalActive,
        openIssues: openReports,
        criticalIssues: criticalActive,
        pendingReview,
        inProgress,
        resolved,
        activeAlerts,
        rejectedIssues: rejected,
        unassignedCount,
        overdueCount,
        reopenedCount,
        confidentialCount,
        totalAffirmations,
        avgResolutionTimeHours,
        categoryDistribution,
        statusDistribution,
        severityDistribution,
        departmentDistribution,
        recentVelocity,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/issues/:id
 * Retrieve full details of an issue for administrative inspection and decision-making
 */
export const getAdminIssueById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid issue ID format.',
      });
    }

    const issue = await Issue.findById(id)
      .populate('createdBy', 'name email department role')
      .populate('reviewedBy', 'name email role')
      .populate('assignedTo', 'name email department departmentName isActive')
      .populate('department', 'name code isActive')
      .populate('resolvedBy', 'name email role')
      .populate('reopenedBy', 'name email role')
      .populate('statusHistory.changedBy', 'name email role')
      .populate('assignmentHistory.changedBy', 'name email role')
      .populate('assignmentHistory.previousDepartment', 'name code')
      .populate('assignmentHistory.newDepartment', 'name code')
      .populate('assignmentHistory.previousAssignee', 'name email')
      .populate('assignmentHistory.newAssignee', 'name email');

    if (!issue) {
      return res.status(404).json({
        status: 'fail',
        message: 'Issue report not found.',
      });
    }

    const [confirmationCount, comments] = await Promise.all([
      IssueConfirmation.countDocuments({ issue: issue._id }),
      Comment.find({ issue: issue._id })
        .sort({ createdAt: 1 })
        .populate('author', 'name email role department'),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        issue: {
          ...issue.toObject(),
          id: issue._id.toString(),
          confirmationCount,
        },
        comments,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/hotspots
 * Aggregated campus hotspot analytics across standardized campus zones
 */
export const getCampusHotspots = async (req, res, next) => {
  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const rawHotspots = await Issue.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$location.campusZone', 'academic_blocks'] },
          totalReports: { $sum: 1 },
          activeReports: {
            $sum: {
              $cond: [
                { $in: ['$status', ['reported', 'verified', 'in_progress']] },
                1,
                0,
              ],
            },
          },
          criticalReports: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$severity', 'critical'] },
                    { $in: ['$status', ['reported', 'verified', 'in_progress']] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          resolvedReports: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
          },
          recentReports: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', fourteenDaysAgo] }, 1, 0],
            },
          },
          categories: { $push: '$category' },
          buildings: { $addToSet: '$location.building' },
        },
      },
    ]);

    const hotspotMap = new Map();
    rawHotspots.forEach((h) => {
      const zoneKey = h._id || 'other';

      const categoryCounts = {};
      (h.categories || []).forEach((cat) => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      const topCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([cat, count]) => ({ category: cat, count }));

      const recurrenceScore =
        h.activeReports * 2 + h.criticalReports * 3 + Math.round(h.recentReports * 1.5);

      hotspotMap.set(zoneKey, {
        zone: zoneKey,
        totalReports: h.totalReports,
        activeReports: h.activeReports,
        criticalReports: h.criticalReports,
        resolvedReports: h.resolvedReports,
        recentReports: h.recentReports,
        topCategories,
        buildings: (h.buildings || []).filter(Boolean).slice(0, 4),
        recurrenceScore,
      });
    });

    const allHotspots = CAMPUS_ZONES.map((zone) => {
      if (hotspotMap.has(zone)) {
        return hotspotMap.get(zone);
      }
      return {
        zone,
        totalReports: 0,
        activeReports: 0,
        criticalReports: 0,
        resolvedReports: 0,
        recentReports: 0,
        topCategories: [],
        buildings: [],
        recurrenceScore: 0,
      };
    });

    allHotspots.sort((a, b) => {
      if (b.recurrenceScore !== a.recurrenceScore) {
        return b.recurrenceScore - a.recurrenceScore;
      }
      return b.activeReports - a.activeReports;
    });

    res.status(200).json({
      status: 'success',
      data: {
        hotspots: allHotspots,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/issues/:id/assign
 * Assign an issue to a department and optionally to an eligible staff member
 */
export const assignIssue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const department = req.body.department || req.body.departmentId;
    const assignedTo = req.body.assignedTo || req.body.staffId;
    const assignmentNote = req.body.assignmentNote || req.body.reason;
    const {
      priority,
      responseDeadline,
      resolutionDeadline,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid issue ID format.',
      });
    }

    const issue = await Issue.findById(id);
    if (!issue) {
      return res.status(404).json({
        status: 'fail',
        message: 'Issue report not found.',
      });
    }

    if (!department || !mongoose.Types.ObjectId.isValid(department)) {
      return res.status(400).json({
        status: 'fail',
        message: 'A valid target department is required for assignment.',
      });
    }

    // Validate target department exists and is active
    const targetDept = await Department.findById(department);
    if (!targetDept) {
      return res.status(404).json({
        status: 'fail',
        message: 'Target department not found.',
      });
    }
    if (targetDept.isActive === false) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot assign issues to an inactive department.',
      });
    }

    let targetStaff = null;
    if (assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid staff member ID format.',
        });
      }

      targetStaff = await User.findById(assignedTo);
      if (!targetStaff) {
        return res.status(404).json({
          status: 'fail',
          message: 'Target staff member not found.',
        });
      }

      if (targetStaff.role !== 'staff') {
        return res.status(400).json({
          status: 'fail',
          message: 'Assigned user must have the department staff role.',
        });
      }

      if (targetStaff.isActive === false) {
        return res.status(400).json({
          status: 'fail',
          message: 'Cannot assign issues to a deactivated staff member.',
        });
      }

      // Ensure staff belongs to the specified department
      if (!targetStaff.department || targetStaff.department.toString() !== department.toString()) {
        return res.status(400).json({
          status: 'fail',
          message: `Staff member "${targetStaff.name}" does not belong to ${targetDept.name}.`,
        });
      }
    }

    const previousDepartment = issue.department;
    const previousAssignee = issue.assignedTo;
    const isReassignment = Boolean(previousAssignee || (previousDepartment && previousDepartment.toString() !== department.toString()));

    issue.department = department;
    issue.assignedTo = targetStaff ? targetStaff._id : null;
    issue.assignedAt = new Date();
    issue.assignedBy = req.user._id;

    if (assignmentNote && typeof assignmentNote === 'string') {
      issue.assignmentNote = assignmentNote.trim();
    }

    if (priority && ISSUE_PRIORITIES.includes(priority.toLowerCase())) {
      issue.priority = priority.toLowerCase();
    }

    if (responseDeadline) {
      issue.responseDeadline = new Date(responseDeadline);
    }
    if (resolutionDeadline) {
      issue.resolutionDeadline = new Date(resolutionDeadline);
    }

    // Record in assignment history
    issue.assignmentHistory.push({
      previousDepartment,
      newDepartment: department,
      previousAssignee,
      newAssignee: targetStaff ? targetStaff._id : null,
      changedBy: req.user._id,
      reason: assignmentNote ? assignmentNote.trim() : (isReassignment ? 'Reassigned by admin' : 'Assigned by admin'),
      action: isReassignment ? 'reassigned' : 'assigned',
      timestamp: new Date(),
    });

    // Add status history entry
    issue.statusHistory.push({
      status: issue.status,
      changedBy: req.user._id,
      note: `Assigned to ${targetDept.name}${targetStaff ? ` (${targetStaff.name})` : ''}`,
      timestamp: new Date(),
    });

    await issue.save();

    // Log audit event
    await logAuditEvent({
      entityType: 'issue',
      entityId: issue._id,
      action: isReassignment ? 'issue_reassigned' : 'issue_assigned',
      actor: req.user._id,
      details: {
        department: targetDept.name,
        staff: targetStaff ? targetStaff.name : null,
        priority: issue.priority,
        resolutionDeadline: issue.resolutionDeadline,
      },
      reason: assignmentNote || 'Administrative assignment',
    });

    // Notify assigned staff
    if (targetStaff) {
      await createNotification({
        recipient: targetStaff._id,
        actor: req.user._id,
        issue: issue._id,
        type: 'issue_assigned',
        title: 'New Issue Assigned to You',
        message: `Admin assigned "${issue.title}" (${issue.priority.toUpperCase()} priority) to your work queue.`,
      });
    }

    const updatedIssue = await Issue.findById(issue._id)
      .populate('createdBy', 'name email department role')
      .populate('reviewedBy', 'name email role')
      .populate('assignedTo', 'name email department departmentName isActive')
      .populate('department', 'name code isActive')
      .populate('statusHistory.changedBy', 'name email role')
      .populate('assignmentHistory.changedBy', 'name email role')
      .populate('assignmentHistory.previousDepartment', 'name code')
      .populate('assignmentHistory.newDepartment', 'name code')
      .populate('assignmentHistory.previousAssignee', 'name email')
      .populate('assignmentHistory.newAssignee', 'name email');

    emitIssueUpdated(updatedIssue);

    res.status(200).json({
      status: 'success',
      message: 'Issue assigned successfully.',
      data: {
        issue: updatedIssue,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/issues/:id/redirect
 * Redirect an issue to a different department with a mandatory reason
 */
export const redirectIssue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const newDepartment = req.body.newDepartment || req.body.departmentId || req.body.department;
    const assignedTo = req.body.assignedTo || req.body.staffId;
    const reason = req.body.reason || req.body.redirectionReason;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid issue ID format.',
      });
    }

    if (!newDepartment || !mongoose.Types.ObjectId.isValid(newDepartment)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Valid new department ID is required for redirection.',
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({
        status: 'fail',
        message: 'A clear reason for redirection is required (minimum 5 characters).',
      });
    }

    const issue = await Issue.findById(id);
    if (!issue) {
      return res.status(404).json({
        status: 'fail',
        message: 'Issue report not found.',
      });
    }

    const targetDept = await Department.findById(newDepartment);
    if (!targetDept) {
      return res.status(404).json({
        status: 'fail',
        message: 'Target department not found.',
      });
    }
    if (targetDept.isActive === false) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot redirect issues to an inactive department.',
      });
    }

    const previousDepartment = issue.department;
    const previousAssignee = issue.assignedTo;

    let targetStaff = null;
    if (assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid staff member ID format.',
        });
      }
      targetStaff = await User.findById(assignedTo);
      if (!targetStaff || targetStaff.role !== 'staff' || targetStaff.isActive === false) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid or inactive staff member selected.',
        });
      }
      if (!targetStaff.department || targetStaff.department.toString() !== newDepartment.toString()) {
        return res.status(400).json({
          status: 'fail',
          message: `Staff member "${targetStaff.name}" does not belong to ${targetDept.name}.`,
        });
      }
    }

    // Redirection rule: Clear previous staff assignee if they belong to the old department
    issue.department = newDepartment;
    issue.assignedTo = targetStaff ? targetStaff._id : null;
    issue.assignedAt = targetStaff ? new Date() : null;
    issue.assignedBy = req.user._id;

    const trimmedReason = reason.trim();

    issue.assignmentHistory.push({
      previousDepartment,
      newDepartment,
      previousAssignee,
      newAssignee: targetStaff ? targetStaff._id : null,
      changedBy: req.user._id,
      reason: trimmedReason,
      action: 'redirected',
      timestamp: new Date(),
    });

    issue.statusHistory.push({
      status: issue.status,
      changedBy: req.user._id,
      note: `Redirected to ${targetDept.name}. Reason: ${trimmedReason}`,
      timestamp: new Date(),
    });

    await issue.save();

    await logAuditEvent({
      entityType: 'issue',
      entityId: issue._id,
      action: 'issue_redirected',
      actor: req.user._id,
      details: {
        previousDepartment,
        newDepartment,
        previousAssignee,
        newAssignee: targetStaff ? targetStaff._id : null,
      },
      reason: trimmedReason,
    });

    // Notify previous assignee of redirection
    if (previousAssignee) {
      await createNotification({
        recipient: previousAssignee,
        actor: req.user._id,
        issue: issue._id,
        type: 'issue_redirected',
        title: 'Issue Redirected to Another Department',
        message: `Issue "${issue.title}" has been redirected to ${targetDept.name}.`,
      });
    }

    // Notify new staff if assigned
    if (targetStaff) {
      await createNotification({
        recipient: targetStaff._id,
        actor: req.user._id,
        issue: issue._id,
        type: 'issue_assigned',
        title: 'Redirected Issue Assigned to You',
        message: `Issue "${issue.title}" was redirected to ${targetDept.name} and assigned to you.`,
      });
    }

    const updatedIssue = await Issue.findById(issue._id)
      .populate('createdBy', 'name email department role')
      .populate('reviewedBy', 'name email role')
      .populate('assignedTo', 'name email department departmentName isActive')
      .populate('department', 'name code isActive')
      .populate('statusHistory.changedBy', 'name email role')
      .populate('assignmentHistory.changedBy', 'name email role')
      .populate('assignmentHistory.previousDepartment', 'name code')
      .populate('assignmentHistory.newDepartment', 'name code')
      .populate('assignmentHistory.previousAssignee', 'name email')
      .populate('assignmentHistory.newAssignee', 'name email');

    emitIssueUpdated(updatedIssue);

    res.status(200).json({
      status: 'success',
      message: `Issue successfully redirected to ${targetDept.name}.`,
      data: {
        issue: updatedIssue,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/issues/:id/unassign
 * Unassign staff member and return issue to department queue
 */
export const unassignIssue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid issue ID format.',
      });
    }

    const issue = await Issue.findById(id);
    if (!issue) {
      return res.status(404).json({
        status: 'fail',
        message: 'Issue report not found.',
      });
    }

    const previousAssignee = issue.assignedTo;
    issue.assignedTo = null;
    issue.assignedAt = null;

    const trimmedReason = reason && typeof reason === 'string' ? reason.trim() : 'Returned to unassigned queue';

    issue.assignmentHistory.push({
      previousDepartment: issue.department,
      newDepartment: issue.department,
      previousAssignee,
      newAssignee: null,
      changedBy: req.user._id,
      reason: trimmedReason,
      action: 'unassigned',
      timestamp: new Date(),
    });

    await issue.save();

    await logAuditEvent({
      entityType: 'issue',
      entityId: issue._id,
      action: 'issue_unassigned',
      actor: req.user._id,
      details: { previousAssignee },
      reason: trimmedReason,
    });

    const updatedIssue = await Issue.findById(issue._id)
      .populate('createdBy', 'name email department role')
      .populate('department', 'name code isActive')
      .populate('assignmentHistory.changedBy', 'name email role');

    emitIssueUpdated(updatedIssue);

    res.status(200).json({
      status: 'success',
      message: 'Issue returned to department queue.',
      data: { issue: updatedIssue },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/issues/:id/priority-deadline
 * Update priority, response deadline, and resolution deadline with audit logging
 */
export const updateIssuePriorityAndDeadlines = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { priority, responseDeadline, resolutionDeadline, deadlineReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid issue ID format.',
      });
    }

    const issue = await Issue.findById(id);
    if (!issue) {
      return res.status(404).json({
        status: 'fail',
        message: 'Issue report not found.',
      });
    }

    const previous = {
      priority: issue.priority,
      responseDeadline: issue.responseDeadline,
      resolutionDeadline: issue.resolutionDeadline,
    };

    if (priority && ISSUE_PRIORITIES.includes(priority.toLowerCase())) {
      issue.priority = priority.toLowerCase();
    }

    if (responseDeadline !== undefined) {
      issue.responseDeadline = responseDeadline ? new Date(responseDeadline) : null;
    }

    if (resolutionDeadline !== undefined) {
      issue.resolutionDeadline = resolutionDeadline ? new Date(resolutionDeadline) : null;
    }

    if (deadlineReason && typeof deadlineReason === 'string') {
      issue.deadlineReason = deadlineReason.trim();
    }

    await issue.save();

    await logAuditEvent({
      entityType: 'issue',
      entityId: issue._id,
      action: 'priority_deadlines_updated',
      actor: req.user._id,
      details: { previous, updated: { priority: issue.priority, responseDeadline: issue.responseDeadline, resolutionDeadline: issue.resolutionDeadline } },
      reason: deadlineReason || 'SLA updated by administrator',
    });

    const updatedIssue = await Issue.findById(issue._id)
      .populate('createdBy', 'name email department role')
      .populate('assignedTo', 'name email department departmentName isActive')
      .populate('department', 'name code isActive');

    emitIssueUpdated(updatedIssue);

    res.status(200).json({
      status: 'success',
      message: 'Priority and SLA deadlines updated successfully.',
      data: { issue: updatedIssue },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/issues/:id/visibility
 * Change issue visibility (public, department_only, confidential)
 * Changing to public requires explicit confirmation.
 */
export const updateIssueVisibility = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { visibility, reason, confirmPublic } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid issue ID format.',
      });
    }

    const issue = await Issue.findById(id);
    if (!issue) {
      return res.status(404).json({
        status: 'fail',
        message: 'Issue report not found.',
      });
    }

    if (!visibility || !ISSUE_VISIBILITY.includes(visibility.toLowerCase())) {
      return res.status(400).json({
        status: 'fail',
        message: `Invalid visibility. Must be one of: ${ISSUE_VISIBILITY.join(', ')}`,
      });
    }

    const targetVisibility = visibility.toLowerCase();

    // Enforce explicit confirmation when revealing to public
    if (targetVisibility === 'public' && issue.visibility !== 'public' && confirmPublic !== true) {
      return res.status(400).json({
        status: 'fail',
        message: 'Changing visibility to Public requires explicit confirmation (confirmPublic: true).',
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({
        status: 'fail',
        message: 'A reason for changing visibility is required (minimum 5 characters).',
      });
    }

    const previousVisibility = issue.visibility;
    issue.visibility = targetVisibility;

    issue.statusHistory.push({
      status: issue.status,
      changedBy: req.user._id,
      note: `Visibility changed from '${previousVisibility}' to '${targetVisibility}'. Reason: ${reason.trim()}`,
      timestamp: new Date(),
    });

    await issue.save();

    await logAuditEvent({
      entityType: 'issue',
      entityId: issue._id,
      action: 'visibility_updated',
      actor: req.user._id,
      details: { previousVisibility, newVisibility: targetVisibility },
      reason: reason.trim(),
    });

    const updatedIssue = await Issue.findById(issue._id)
      .populate('createdBy', 'name email department role')
      .populate('assignedTo', 'name email department departmentName isActive')
      .populate('department', 'name code isActive');

    emitIssueUpdated(updatedIssue);

    res.status(200).json({
      status: 'success',
      message: `Issue visibility changed to ${targetVisibility}.`,
      data: { issue: updatedIssue },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/staff
 * List all department staff accounts with department and open issues workload
 */
export const getStaffUsers = async (req, res, next) => {
  try {
    const staffMembers = await User.find({ role: 'staff' })
      .populate('department', 'name code isActive')
      .sort({ name: 1 });

    const staffIds = staffMembers.map((s) => s._id);

    const workloads = await Issue.aggregate([
      {
        $match: {
          assignedTo: { $in: staffIds },
          status: { $nin: ['resolved', 'rejected'] },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          activeCount: { $sum: 1 },
        },
      },
    ]);

    const workloadMap = new Map(
      workloads.map((w) => [w._id.toString(), w.activeCount])
    );

    const result = staffMembers.map((s) => {
      const obj = s.toJSON ? s.toJSON() : { ...s };
      obj.activeIssuesCount = workloadMap.get(s._id.toString()) || 0;
      return obj;
    });

    res.status(200).json({
      status: 'success',
      data: {
        staff: result,
        count: result.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/staff
 * Create a new department staff account
 */
export const createStaffUser = async (req, res, next) => {
  try {
    const { name, email, password, departmentId } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        status: 'fail',
        message: 'Staff name is required (minimum 2 characters).',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({
        status: 'fail',
        message: 'A valid email address is required.',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        status: 'fail',
        message: 'Password must be at least 6 characters long.',
      });
    }

    if (!departmentId || !mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Valid department ID is required.',
      });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({
        status: 'fail',
        message: 'Department not found.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        status: 'fail',
        message: 'An account with this email address already exists.',
      });
    }

    const passwordHash = await User.hashPassword(password);

    const newStaff = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'staff',
      department: department._id,
      departmentName: department.name,
      isActive: true,
    });

    await logAuditEvent({
      entityType: 'user',
      entityId: newStaff._id,
      action: 'staff_account_created',
      actor: req.user._id,
      details: { name: newStaff.name, email: newStaff.email, department: department.name },
      reason: 'Created by administrator',
    });

    res.status(201).json({
      status: 'success',
      message: 'Department staff account created successfully.',
      data: {
        user: newStaff.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/staff/:id
 * Update staff details (department, active state, name)
 */
export const updateStaffUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, departmentId, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid staff user ID format.',
      });
    }

    const staffUser = await User.findById(id);
    if (!staffUser || staffUser.role !== 'staff') {
      return res.status(404).json({
        status: 'fail',
        message: 'Department staff member not found.',
      });
    }

    if (name && typeof name === 'string' && name.trim().length >= 2) {
      staffUser.name = name.trim();
    }

    if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
      const dept = await Department.findById(departmentId);
      if (dept) {
        staffUser.department = dept._id;
        staffUser.departmentName = dept.name;
      }
    }

    if (isActive !== undefined) {
      staffUser.isActive = Boolean(isActive);
    }

    await staffUser.save();

    await logAuditEvent({
      entityType: 'user',
      entityId: staffUser._id,
      action: 'staff_account_updated',
      actor: req.user._id,
      details: { isActive: staffUser.isActive, department: staffUser.departmentName },
      reason: 'Updated by administrator',
    });

    res.status(200).json({
      status: 'success',
      message: 'Staff account updated successfully.',
      data: {
        user: staffUser.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/audit-logs
 * Paginated query for system audit events
 */
export const getAuditLogs = async (req, res, next) => {
  try {
    const { entityType, entityId, action } = req.query;
    const filter = {};

    if (entityType) filter.entityType = entityType;
    if (entityId && mongoose.Types.ObjectId.isValid(entityId)) filter.entityId = entityId;
    if (action) filter.action = action;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [logs, totalCount] = await Promise.all([
      AuditEvent.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actor', 'name email role departmentName'),
      AuditEvent.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.status(200).json({
      status: 'success',
      data: {
        logs,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

