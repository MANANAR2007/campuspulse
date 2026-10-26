import mongoose from 'mongoose';
import Issue from '../models/Issue.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import { logAuditEvent } from '../models/AuditEvent.js';
import { createNotification } from '../utils/notificationHelper.js';
import { emitStatusChanged, emitCommentCreated } from '../utils/socket.js';
import { canUserViewIssue } from './issueController.js';

/**
 * Helper to verify staff authorization on an issue
 */
export const checkStaffIssueAccess = (staffUser, issue) => {
  if (!staffUser || staffUser.role !== 'staff' || staffUser.isActive === false) {
    return false;
  }

  // If issue is confidential, staff must be explicitly assigned
  if (issue.visibility === 'confidential') {
    const assignedId = issue.assignedTo?._id || issue.assignedTo;
    return Boolean(assignedId && assignedId.toString() === staffUser._id.toString());
  }

  // If assigned to this staff member
  const assignedId = issue.assignedTo?._id || issue.assignedTo;
  if (assignedId && assignedId.toString() === staffUser._id.toString()) {
    return true;
  }

  // If belongs to staff member's department
  const issueDeptId = issue.department?._id || issue.department;
  const userDeptId = staffUser.department?._id || staffUser.department;
  if (issueDeptId && userDeptId && issueDeptId.toString() === userDeptId.toString()) {
    return true;
  }

  return false;
};

/**
 * GET /api/staff/queue
 * Retrieve categorized work queue items for the authenticated staff member
 */
export const getStaffWorkQueue = async (req, res, next) => {
  try {
    const staffId = req.user._id;
    const staffDept = req.user.department;

    if (!staffDept) {
      return res.status(200).json({
        status: 'success',
        data: {
          assignedToMe: [],
          departmentQueue: [],
          inProgress: [],
          awaitingInfo: [],
          overdue: [],
          resolvedRecent: [],
        },
      });
    }

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Common population
    const populateQuery = (query) =>
      query
        .populate('createdBy', 'name email department role')
        .populate('assignedTo', 'name email department departmentName')
        .populate('department', 'name code isActive')
        .populate('statusHistory.changedBy', 'name email role');

    // 1. Assigned directly to this staff member (non-resolved)
    const assignedToMePromise = populateQuery(
      Issue.find({
        assignedTo: staffId,
        status: { $nin: ['resolved', 'rejected'] },
      }).sort({ priority: -1, createdAt: -1 })
    );

    // 2. Unassigned department queue (excluding confidential reports)
    const departmentQueuePromise = populateQuery(
      Issue.find({
        department: staffDept,
        assignedTo: null,
        visibility: { $ne: 'confidential' },
        status: { $nin: ['resolved', 'rejected'] },
      }).sort({ priority: -1, createdAt: -1 })
    );

    // 3. In Progress issues accessible to staff
    const inProgressPromise = populateQuery(
      Issue.find({
        status: 'in_progress',
        $or: [
          { assignedTo: staffId },
          { department: staffDept, visibility: { $ne: 'confidential' } },
        ],
      }).sort({ updatedAt: -1 })
    );

    // 4. Awaiting Information issues accessible to staff
    const awaitingInfoPromise = populateQuery(
      Issue.find({
        status: 'awaiting_info',
        $or: [
          { assignedTo: staffId },
          { department: staffDept, visibility: { $ne: 'confidential' } },
        ],
      }).sort({ updatedAt: -1 })
    );

    // 5. Overdue issues (active with passed resolutionDeadline)
    const overduePromise = populateQuery(
      Issue.find({
        resolutionDeadline: { $lt: now, $ne: null },
        status: { $nin: ['resolved', 'rejected'] },
        $or: [
          { assignedTo: staffId },
          { department: staffDept, visibility: { $ne: 'confidential' } },
        ],
      }).sort({ resolutionDeadline: 1 })
    );

    // 6. Recently resolved issues
    const resolvedRecentPromise = populateQuery(
      Issue.find({
        status: 'resolved',
        resolvedAt: { $gte: sevenDaysAgo },
        $or: [
          { assignedTo: staffId },
          { department: staffDept, visibility: { $ne: 'confidential' } },
        ],
      }).sort({ resolvedAt: -1 })
    );

    const [
      assignedToMe,
      departmentQueue,
      inProgress,
      awaitingInfo,
      overdue,
      resolvedRecent,
    ] = await Promise.all([
      assignedToMePromise,
      departmentQueuePromise,
      inProgressPromise,
      awaitingInfoPromise,
      overduePromise,
      resolvedRecentPromise,
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        assignedToMe,
        departmentQueue,
        inProgress,
        awaitingInfo,
        overdue,
        resolvedRecent,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/staff/stats
 * Aggregate dashboard workload metrics for staff member
 */
export const getStaffStats = async (req, res, next) => {
  try {
    const staffId = req.user._id;
    const staffDept = req.user.department;

    if (!staffDept) {
      return res.status(200).json({
        status: 'success',
        data: {
          assignedCount: 0,
          deptUnassignedCount: 0,
          inProgressCount: 0,
          awaitingInfoCount: 0,
          overdueCount: 0,
          resolvedTotal: 0,
        },
      });
    }

    const now = new Date();

    const [
      assignedCount,
      deptUnassignedCount,
      inProgressCount,
      awaitingInfoCount,
      overdueCount,
      resolvedTotal,
    ] = await Promise.all([
      Issue.countDocuments({
        assignedTo: staffId,
        status: { $nin: ['resolved', 'rejected'] },
      }),
      Issue.countDocuments({
        department: staffDept,
        assignedTo: null,
        visibility: { $ne: 'confidential' },
        status: { $nin: ['resolved', 'rejected'] },
      }),
      Issue.countDocuments({
        status: 'in_progress',
        $or: [
          { assignedTo: staffId },
          { department: staffDept, visibility: { $ne: 'confidential' } },
        ],
      }),
      Issue.countDocuments({
        status: 'awaiting_info',
        $or: [
          { assignedTo: staffId },
          { department: staffDept, visibility: { $ne: 'confidential' } },
        ],
      }),
      Issue.countDocuments({
        resolutionDeadline: { $lt: now, $ne: null },
        status: { $nin: ['resolved', 'rejected'] },
        $or: [
          { assignedTo: staffId },
          { department: staffDept, visibility: { $ne: 'confidential' } },
        ],
      }),
      Issue.countDocuments({
        status: 'resolved',
        $or: [
          { assignedTo: staffId },
          { department: staffDept, visibility: { $ne: 'confidential' } },
        ],
      }),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        assignedCount,
        deptUnassignedCount,
        inProgressCount,
        awaitingInfoCount,
        overdueCount,
        resolvedTotal,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/staff/issues/:id/status
 * Staff transitions issue status, records notes, and provides resolution evidence
 */
export const updateStaffIssueStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote, resolutionEvidenceUrl, internalNote } = req.body;

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

    // Permission check: staff member must be assigned or belong to department (if not confidential)
    if (!checkStaffIssueAccess(req.user, issue)) {
      return res.status(403).json({
        status: 'fail',
        message: 'Access denied. You are not authorized to update this issue.',
      });
    }

    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        status: 'fail',
        message: 'Target status is required.',
      });
    }

    const targetStatus = status.trim().toLowerCase();
    const currentStatus = issue.status;

    // Allowed staff transitions
    const validStaffTransitions = {
      verified: ['in_progress'],
      in_progress: ['awaiting_info', 'resolved', 'escalated'],
      awaiting_info: ['in_progress', 'resolved'],
      escalated: ['in_progress', 'resolved'],
      resolved: [], // Only reporter or admin can reopen
      rejected: [],
      reported: [], // Needs admin review first
    };

    const allowed = validStaffTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      return res.status(400).json({
        status: 'fail',
        message: `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed: ${
          allowed.length > 0 ? allowed.join(', ') : 'none'
        }.`,
      });
    }

    // If unassigned in department, claim it automatically when moving to in_progress
    if (!issue.assignedTo && targetStatus === 'in_progress') {
      issue.assignedTo = req.user._id;
      issue.assignedAt = new Date();
      issue.assignedBy = req.user._id;
      issue.assignmentHistory.push({
        previousDepartment: issue.department,
        newDepartment: issue.department,
        previousAssignee: null,
        newAssignee: req.user._id,
        changedBy: req.user._id,
        reason: 'Self-assigned from department queue upon starting work',
        action: 'assigned',
        timestamp: new Date(),
      });
    }

    issue.status = targetStatus;

    if (resolutionNote && typeof resolutionNote === 'string') {
      issue.resolutionNote = resolutionNote.trim();
    }

    if (resolutionEvidenceUrl && typeof resolutionEvidenceUrl === 'string') {
      issue.resolutionEvidenceUrl = resolutionEvidenceUrl.trim();
    }

    if (targetStatus === 'resolved') {
      issue.resolvedAt = new Date();
      issue.resolvedBy = req.user._id;
      issue.isCampusWideAlert = false;
    }

    const statusNote =
      resolutionNote && typeof resolutionNote === 'string' && resolutionNote.trim()
        ? resolutionNote.trim()
        : `Status transitioned to ${targetStatus.replace('_', ' ')} by department staff`;

    issue.statusHistory.push({
      status: targetStatus,
      changedBy: req.user._id,
      note: statusNote,
      timestamp: new Date(),
    });

    await issue.save();

    // Create internal staff note if provided
    if (internalNote && typeof internalNote === 'string' && internalNote.trim().length > 0) {
      const comment = await Comment.create({
        issue: issue._id,
        author: req.user._id,
        text: internalNote.trim(),
        isInternal: true,
        visibility: 'internal',
      });
      const populatedComment = await Comment.findById(comment._id).populate(
        'author',
        'name email role department departmentName'
      );
      // Emit internal note only to staff and admin
      emitCommentCreated(issue._id, populatedComment, true);
    }

    // Log audit event
    await logAuditEvent({
      entityType: 'issue',
      entityId: issue._id,
      action: `status_${targetStatus}`,
      actor: req.user._id,
      details: { previousStatus: currentStatus, newStatus: targetStatus },
      reason: resolutionNote || 'Staff workflow update',
    });

    // Notify student reporter
    if (targetStatus === 'resolved') {
      await createNotification({
        recipient: issue.createdBy,
        actor: req.user._id,
        issue: issue._id,
        type: 'issue_resolved',
        title: 'Report Resolved by Department Staff',
        message: `Your report "${issue.title}" has been marked as resolved by ${req.user.name}. Please confirm resolution or provide feedback.`,
      });
    } else if (targetStatus === 'awaiting_info') {
      await createNotification({
        recipient: issue.createdBy,
        actor: req.user._id,
        issue: issue._id,
        type: 'status_updated',
        title: 'More Information Requested',
        message: `Staff handling "${issue.title}" requires additional information to proceed.${
          resolutionNote ? ` Note: "${resolutionNote}"` : ''
        }`,
      });
    } else if (targetStatus === 'escalated') {
      // Find campus administrators to notify
      const admins = await User.find({ role: 'admin' }).select('_id');
      for (const admin of admins) {
        await createNotification({
          recipient: admin._id,
          actor: req.user._id,
          issue: issue._id,
          type: 'issue_escalated',
          title: '🚨 Issue Escalated to Administration',
          message: `Staff member ${req.user.name} has escalated "${issue.title}" for administrative attention.`,
        });
      }
    } else {
      await createNotification({
        recipient: issue.createdBy,
        actor: req.user._id,
        issue: issue._id,
        type: 'status_updated',
        title: `Status Updated: ${targetStatus.replace('_', ' ').toUpperCase()}`,
        message: `Your report "${issue.title}" status is now "${targetStatus.replace('_', ' ')}".`,
      });
    }

    const updatedIssue = await Issue.findById(issue._id)
      .populate('createdBy', 'name email department role')
      .populate('assignedTo', 'name email department departmentName')
      .populate('department', 'name code isActive')
      .populate('reviewedBy', 'name email role')
      .populate('statusHistory.changedBy', 'name email role')
      .populate('assignmentHistory.changedBy', 'name email role')
      .populate('assignmentHistory.previousDepartment', 'name code')
      .populate('assignmentHistory.newDepartment', 'name code')
      .populate('assignmentHistory.previousAssignee', 'name email')
      .populate('assignmentHistory.newAssignee', 'name email');

    emitStatusChanged(updatedIssue);

    res.status(200).json({
      status: 'success',
      message: `Issue marked as ${targetStatus.replace('_', ' ')}.`,
      data: {
        issue: updatedIssue,
      },
    });
  } catch (error) {
    next(error);
  }
};
