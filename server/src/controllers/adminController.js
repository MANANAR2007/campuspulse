import mongoose from 'mongoose';
import Issue, {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  CAMPUS_ZONES,
} from '../models/Issue.js';
import IssueConfirmation from '../models/IssueConfirmation.js';
import Comment from '../models/Comment.js';
import { normalizeCategory } from '../utils/categoryHelper.js';
import { attachConfirmationData } from './issueController.js';
import {
  createNotification,
  fanOutCampusAlertNotification,
} from '../utils/notificationHelper.js';
import {
  emitStatusChanged,
  emitAlertApproved,
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
    } = req.query;

    const filter = {};

    if (status && typeof status === 'string') {
      filter.status = status.trim().toLowerCase();
    }

    if (severity && typeof severity === 'string') {
      filter.severity = severity.trim().toLowerCase();
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
      verified: ['in_progress', 'rejected'],
      in_progress: ['resolved', 'verified'],
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

    // If resolved, deactivate alert
    if (targetStatus === 'resolved') {
      issue.isCampusWideAlert = false;
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
      categoryAgg,
      statusAgg,
      severityAgg,
      velocityAgg,
      totalAffirmations,
      resolutionAgg,
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
    ]);

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
        totalAffirmations,
        avgResolutionTimeHours,
        categoryDistribution,
        statusDistribution,
        severityDistribution,
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
      .populate('statusHistory.changedBy', 'name email role');

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
