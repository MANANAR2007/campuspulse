import mongoose from 'mongoose';
import Issue, {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
} from '../models/Issue.js';
import { normalizeCategory } from '../utils/categoryHelper.js';
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
    if (sort === 'severity') sortOptions = { severity: 1, createdAt: -1 };

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [issues, totalCount] = await Promise.all([
      Issue.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email department role')
        .populate('reviewedBy', 'name email role'),
      Issue.countDocuments(filter),
    ]);

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
      .populate('reviewedBy', 'name email role');

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
      rejected: [], // Cannot transition from rejected without explicit re-review
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
      .populate('reviewedBy', 'name email role');

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
    const [
      totalActive,
      openReports,
      criticalActive,
      pendingReview,
      inProgress,
      resolved,
      activeAlerts,
      rejected,
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
    ]);

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
      },
    });
  } catch (error) {
    next(error);
  }
};
