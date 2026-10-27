import mongoose from 'mongoose';
import Issue, {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  ISSUE_VISIBILITY,
  ISSUE_PRIORITIES,
  CAMPUS_ZONES,
} from '../models/Issue.js';
import IssueConfirmation from '../models/IssueConfirmation.js';
import Comment from '../models/Comment.js';
import Department from '../models/Department.js';
import User from '../models/User.js';
import { logAuditEvent } from '../models/AuditEvent.js';
import { normalizeCategory } from '../utils/categoryHelper.js';
import { createNotification } from '../utils/notificationHelper.js';
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  isCloudinaryConfigured,
} from '../utils/cloudinary.js';
import {
  emitIssueCreated,
  emitIssueUpdated,
  emitIssueDeleted,
  emitConfirmationUpdated,
  emitStatusChanged,
} from '../utils/socket.js';

/**
 * Access control validator for three-tier issue visibility
 */
export const canUserViewIssue = (user, issue) => {
  if (!user || !issue) return false;

  // 1. Admin can view all issues
  if (user.role === 'admin') return true;

  // 2. Creator can always view their own report
  const creatorId = issue.createdBy?._id || issue.createdBy;
  if (creatorId && creatorId.toString() === user._id.toString()) {
    return true;
  }

  // 3. Rejected issues are restricted to author and admin only
  if (issue.status === 'rejected') {
    return false;
  }

  const visibility = issue.visibility || 'public';

  // 4. Public issues
  if (visibility === 'public') {
    return true;
  }

  // 5. Department-only issues
  if (visibility === 'department_only') {
    if (user.role === 'staff' && user.isActive !== false) {
      const issueDeptId = issue.department?._id || issue.department;
      const userDeptId = user.department?._id || user.department;
      if (issueDeptId && userDeptId && issueDeptId.toString() === userDeptId.toString()) {
        return true;
      }
    }
    return false;
  }

  // 6. Confidential issues
  if (visibility === 'confidential') {
    if (user.role === 'staff' && user.isActive !== false) {
      const assignedId = issue.assignedTo?._id || issue.assignedTo;
      if (assignedId && assignedId.toString() === user._id.toString()) {
        return true;
      }
    }
    return false;
  }

  return false;
};

/**
 * Batched confirmation metadata helper for feed queries
 * Eliminates N+1 queries by aggregating counts and user affirmation in two round-trips
 */
export const attachConfirmationData = async (issues, userId = null) => {
  if (!issues || issues.length === 0) return [];

  const issueIds = issues.map((doc) => doc._id);

  const [counts, userConfirms] = await Promise.all([
    IssueConfirmation.aggregate([
      { $match: { issue: { $in: issueIds } } },
      { $group: { _id: '$issue', count: { $sum: 1 } } },
    ]),
    userId
      ? IssueConfirmation.find({
          issue: { $in: issueIds },
          user: userId,
        }).select('issue')
      : Promise.resolve([]),
  ]);

  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
  const userConfirmSet = new Set(
    userConfirms.map((uc) => uc.issue.toString())
  );

  return issues.map((doc) => {
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    const idStr = (obj.id || obj._id).toString();
    obj.confirmationCount = countMap.get(idStr) || 0;
    obj.currentUserConfirmed = userConfirmSet.has(idStr);
    obj.totalAffectedCount = (obj.confirmationCount || 0) + (obj.groupedReportsCount || 0) + 1;
    return obj;
  });
};

/**
 * POST /api/issues
 * Create a new student issue report (supports both JSON and multipart/form-data with image)
 */
export const createIssue = async (req, res, next) => {
  let uploadedImagePublicId = null;

  try {
    const {
      title,
      description,
      category,
      severity,
      location,
      campusAlertRequested,
      visibility,
      department,
    } = req.body;

    // 1. Validation: Title
    if (!title || typeof title !== 'string' || title.trim().length < 5) {
      return res.status(400).json({
        status: 'fail',
        message: 'Issue title is required and must be at least 5 characters long.',
      });
    }

    if (title.trim().length > 150) {
      return res.status(400).json({
        status: 'fail',
        message: 'Issue title cannot exceed 150 characters.',
      });
    }

    // 2. Validation: Description
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({
        status: 'fail',
        message: 'Issue description is required and must be at least 10 characters long.',
      });
    }

    if (description.trim().length > 2500) {
      return res.status(400).json({
        status: 'fail',
        message: 'Issue description cannot exceed 2500 characters.',
      });
    }

    // 3. Validation: Category
    const normalizedCategory = normalizeCategory(category);
    if (!normalizedCategory || !ISSUE_CATEGORIES.includes(normalizedCategory)) {
      return res.status(400).json({
        status: 'fail',
        message: `Invalid category. Must be one of: ${ISSUE_CATEGORIES.join(', ')}`,
      });
    }

    // 4. Validation: Severity
    const normalizedSeverity =
      severity && typeof severity === 'string' ? severity.trim().toLowerCase() : null;
    if (!normalizedSeverity || !ISSUE_SEVERITIES.includes(normalizedSeverity)) {
      return res.status(400).json({
        status: 'fail',
        message: `Invalid severity level. Must be one of: ${ISSUE_SEVERITIES.join(', ')}`,
      });
    }

    // 5. Validation: Location parsing (handling JSON strings from multipart FormData)
    let parsedLocation = location;
    if (typeof location === 'string') {
      try {
        parsedLocation = JSON.parse(location);
      } catch {
        parsedLocation = null;
      }
    }

    if (!parsedLocation || typeof parsedLocation !== 'object') {
      parsedLocation = {
        building:
          req.body['location.building'] ||
          req.body['location[building]'] ||
          req.body.building ||
          '',
        area:
          req.body['location.area'] ||
          req.body['location[area]'] ||
          req.body.area ||
          req.body.roomOrArea ||
          '',
        floor:
          req.body['location.floor'] ||
          req.body['location[floor]'] ||
          req.body.floor ||
          '',
        room:
          req.body['location.room'] ||
          req.body['location[room]'] ||
          req.body.room ||
          '',
      };
    }

    const building = parsedLocation.building ? parsedLocation.building.trim() : '';
    if (!building) {
      return res.status(400).json({
        status: 'fail',
        message: 'Campus building is required in location details.',
      });
    }

    const rawCampusZone =
      parsedLocation.campusZone ||
      req.body['location.campusZone'] ||
      req.body['location[campusZone]'] ||
      req.body.campusZone ||
      '';
    const campusZone =
      rawCampusZone && CAMPUS_ZONES.includes(rawCampusZone.toString().toLowerCase().trim())
        ? rawCampusZone.toString().toLowerCase().trim()
        : 'academic_blocks';

    const area = parsedLocation.area
      ? parsedLocation.area.trim()
      : parsedLocation.roomOrArea
      ? parsedLocation.roomOrArea.trim()
      : '';
    const floor = parsedLocation.floor ? parsedLocation.floor.trim() : '';
    const room = parsedLocation.room ? parsedLocation.room.trim() : '';

    // 6. Handle optional Cloudinary Image Upload
    let imageUrl = '';
    let imagePublicId = '';

    if (req.file) {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          status: 'fail',
          message:
            'Image upload is currently unavailable due to missing Cloudinary configuration on the server. You can still submit reports without an image.',
        });
      }

      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, {
          folder: 'campuspulse/issues',
        });
        imageUrl = uploadResult.secure_url;
        imagePublicId = uploadResult.public_id;
        uploadedImagePublicId = uploadResult.public_id;
      } catch (uploadError) {
        return res.status(500).json({
          status: 'error',
          message: `Failed to upload image to Cloudinary: ${uploadError.message}`,
        });
      }
    }

    // 7. Build sanitized issue document
    const isAlertReq =
      campusAlertRequested === true ||
      campusAlertRequested === 'true' ||
      campusAlertRequested === 1;

    const normalizedVisibility =
      visibility && ISSUE_VISIBILITY.includes(visibility.trim().toLowerCase())
        ? visibility.trim().toLowerCase()
        : 'public';

    const assignedDepartment =
      department && mongoose.Types.ObjectId.isValid(department) ? department : null;

    // Smart Issue Grouping validation
    const rawParentId = req.body.parentIssueId || req.body.parentIncidentId;
    let validParentId = null;
    let parentIncident = null;

    if (rawParentId && mongoose.Types.ObjectId.isValid(rawParentId)) {
      parentIncident = await Issue.findById(rawParentId);
      if (parentIncident && parentIncident.status !== 'rejected') {
        // Enforce privacy rule: confidential reports must never automatically join a public incident
        if (normalizedVisibility === 'confidential' && parentIncident.visibility === 'public') {
          return res.status(400).json({
            status: 'fail',
            message: 'Confidential reports cannot be grouped into a public incident.',
          });
        }
        // Link to root incident (if parent is itself a child, link to root)
        validParentId = parentIncident.parentIssueId || parentIncident._id;
      }
    }

    let newIssue;
    try {
      newIssue = await Issue.create({
        title: title.trim(),
        description: description.trim(),
        category: normalizedCategory,
        severity: normalizedSeverity,
        location: { building, campusZone, area, floor, room },
        imageUrl,
        imagePublicId,
        campusAlertRequested: Boolean(isAlertReq),
        visibility: normalizedVisibility,
        department: assignedDepartment,
        priority: 'normal',
        parentIssueId: validParentId,
        // Protected fields strictly enforced by backend
        createdBy: req.user._id,
        status: 'reported',
        statusHistory: [
          {
            status: 'reported',
            changedBy: req.user._id,
            note: validParentId
              ? 'Report contributed to existing campus incident group'
              : 'Initial report submitted by student',
            timestamp: new Date(),
          },
        ],
        isCampusWideAlert: false,
        reviewedBy: null,
        reviewedAt: null,
        resolutionNote: '',
      });
    } catch (dbError) {
      // Clean up orphaned Cloudinary upload if database write fails
      if (uploadedImagePublicId) {
        await deleteFromCloudinary(uploadedImagePublicId);
      }
      throw dbError;
    }

    // Update parent incident if grouped
    if (validParentId) {
      await Issue.findByIdAndUpdate(validParentId, {
        $set: { isIncidentGroup: true },
        $inc: { groupedReportsCount: 1 },
      });
      const rootParent = await Issue.findById(validParentId);
      if (
        rootParent &&
        rootParent.createdBy &&
        rootParent.createdBy.toString() !== req.user._id.toString()
      ) {
        await createNotification({
          recipient: rootParent.createdBy,
          actor: req.user._id,
          issue: rootParent._id,
          type: 'issue_grouped',
          title: 'Related Report Added to Incident',
          message: `${req.user.name} contributed a related report to "${rootParent.title}".`,
        });
      }
    }

    const populatedIssue = await Issue.findById(newIssue._id)
      .populate('createdBy', 'name email department role')
      .populate('department', 'name code isActive');

    // Audit log for report creation
    await logAuditEvent({
      entityType: 'issue',
      entityId: newIssue._id,
      action: 'issue_created',
      actor: req.user._id,
      details: {
        title: newIssue.title,
        category: newIssue.category,
        severity: newIssue.severity,
        visibility: newIssue.visibility,
        campusZone: newIssue.location?.campusZone,
      },
      reason: 'Initial issue filing',
    });

    const issueObject = populatedIssue.toObject();
    issueObject.confirmationCount = 0;
    issueObject.currentUserConfirmed = false;

    // Realtime broadcast (only broadcast public reports globally to prevent privacy leaks)
    if (newIssue.visibility === 'public') {
      emitIssueCreated(issueObject);
    }

    res.status(201).json({
      status: 'success',
      data: {
        issue: issueObject,
      },
    });
  } catch (error) {
    if (uploadedImagePublicId) {
      await deleteFromCloudinary(uploadedImagePublicId);
    }
    next(error);
  }
};

/**
 * GET /api/issues
 * Return public/student campus feed (excluding rejected reports) with filters, search, and pagination
 */
export const getIssues = async (req, res, next) => {
  try {
    const { category, severity, status, building, search, sort } = req.query;

    const filter = {
      // Never show rejected reports in normal student feed
      status: { $ne: 'rejected' },
    };

    // Feed de-duplication: By default only display root issues (standalone or canonical incidents)
    if (req.query.includeChildReports !== 'true' && !req.query.parentIssueId) {
      filter.parentIssueId = null;
    } else if (req.query.parentIssueId && mongoose.Types.ObjectId.isValid(req.query.parentIssueId)) {
      filter.parentIssueId = req.query.parentIssueId;
    }

    // Specific status filter (cannot filter for 'rejected' in public feed)
    if (status && typeof status === 'string') {
      const normalizedStatus = status.trim().toLowerCase();
      if (normalizedStatus !== 'rejected') {
        filter.status = normalizedStatus;
      }
    }

    // Category filter
    if (category && typeof category === 'string') {
      const normalizedCategory = normalizeCategory(category);
      if (normalizedCategory) {
        filter.category = normalizedCategory;
      }
    }

    // Severity filter
    if (severity && typeof severity === 'string') {
      filter.severity = severity.trim().toLowerCase();
    }

    // Building filter
    if (building && typeof building === 'string') {
      const safeBuilding = building.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter['location.building'] = { $regex: safeBuilding, $options: 'i' };
    }

    // Keyword search across title, description, and location
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { 'location.building': { $regex: safeSearch, $options: 'i' } },
        { 'location.area': { $regex: safeSearch, $options: 'i' } },
        { 'location.room': { $regex: safeSearch, $options: 'i' } },
      ];
    }

    // Sorting
    let sortOptions = { createdAt: -1 }; // Newest first by default
    if (sort === 'oldest') {
      sortOptions = { createdAt: 1 };
    }

    // Privacy and Visibility Enforcement:
    // Confidential reports are visible only to author, admin, and explicitly assigned staff.
    // Department-only reports are visible to author, admin, and department staff.
    // Public reports are visible to all.
    const visibilityClauses = [];
    if (req.user?.role === 'admin') {
      // Admin sees all non-rejected issues in the feed
    } else if (req.user?.role === 'staff') {
      visibilityClauses.push({ visibility: 'public' });
      if (req.user._id) visibilityClauses.push({ createdBy: req.user._id });
      if (req.user.department) {
        visibilityClauses.push({ visibility: 'department_only', department: req.user.department });
      }
      if (req.user._id) {
        visibilityClauses.push({ visibility: 'confidential', assignedTo: req.user._id });
      }
    } else {
      visibilityClauses.push({ visibility: 'public' });
      if (req.user?._id) {
        visibilityClauses.push({ createdBy: req.user._id });
      }
    }

    let finalQuery = { ...filter };
    if (visibilityClauses.length > 0) {
      if (filter.$or) {
        finalQuery = {
          $and: [
            { $or: visibilityClauses },
            filter,
          ],
        };
      } else {
        finalQuery.$or = visibilityClauses;
      }
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [rawIssues, totalCount] = await Promise.all([
      Issue.find(finalQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email department role')
        .populate('assignedTo', 'name email department departmentName')
        .populate('department', 'name code isActive'),
      Issue.countDocuments(finalQuery),
    ]);

    const issues = await attachConfirmationData(rawIssues, req.user?._id);
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
 * GET /api/issues/mine
 * Return reports submitted by the authenticated student
 */
export const getMyIssues = async (req, res, next) => {
  try {
    const { status, severity } = req.query;

    const filter = {
      createdBy: req.user._id,
    };

    if (status && typeof status === 'string') {
      filter.status = status.trim().toLowerCase();
    }

    if (severity && typeof severity === 'string') {
      filter.severity = severity.trim().toLowerCase();
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [rawIssues, totalCount] = await Promise.all([
      Issue.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email department role'),
      Issue.countDocuments(filter),
    ]);

    const issues = await attachConfirmationData(rawIssues, req.user._id);
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
 * GET /api/issues/alerts
 * Return all approved, active campus-wide alerts
 */
export const getActiveAlerts = async (req, res, next) => {
  try {
    const rawAlerts = await Issue.find({
      isCampusWideAlert: true,
      status: { $nin: ['resolved', 'rejected'] },
    })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email department role')
      .populate('reviewedBy', 'name email role');

    const alerts = await attachConfirmationData(rawAlerts, req.user?._id);

    res.status(200).json({
      status: 'success',
      data: {
        alerts,
        count: alerts.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/issues/:id
 * Return details for a single issue report
 */
export const getIssueById = async (req, res, next) => {
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

    // Three-tier visibility and privacy access check
    if (!canUserViewIssue(req.user, issue)) {
      return res.status(404).json({
        status: 'fail',
        message: 'Issue report not found or access restricted.',
      });
    }

    const [confirmationCount, userConfirm] = await Promise.all([
      IssueConfirmation.countDocuments({ issue: issue._id }),
      req.user
        ? IssueConfirmation.exists({ issue: issue._id, user: req.user._id })
        : Promise.resolve(null),
    ]);

    const issueObj = issue.toObject();
    issueObj.confirmationCount = confirmationCount;
    issueObj.currentUserConfirmed = Boolean(userConfirm);

    // Linked reports and grouping metadata
    if (!issue.parentIssueId) {
      // Find linked child reports
      const rawChildReports = await Issue.find({
        parentIssueId: issue._id,
        status: { $ne: 'rejected' },
      })
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email department role');

      // Privacy enforcement: filter child reports based on requesting user permissions
      const visibleChildReports = rawChildReports.filter((child) => canUserViewIssue(req.user, child));

      issueObj.linkedReports = visibleChildReports.map((c) => (c.toObject ? c.toObject() : c));
      issueObj.linkedReportsCount = visibleChildReports.length;
      issueObj.totalAffectedCount = (confirmationCount || 0) + visibleChildReports.length + 1;
    } else {
      // If child report, populate parent incident details
      const parent = await Issue.findById(issue.parentIssueId)
        .select('title status department category location isCampusWideAlert')
        .populate('department', 'name code');
      issueObj.parentIssue = parent ? (parent.toObject ? parent.toObject() : parent) : null;
      issueObj.linkedReports = [];
      issueObj.linkedReportsCount = 0;
      issueObj.totalAffectedCount = (confirmationCount || 0) + 1;
    }

    res.status(200).json({
      status: 'success',
      data: {
        issue: issueObj,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/issues/:id
 * Edit an issue report (allowed only for the original author and only while status is 'reported')
 */
export const updateIssue = async (req, res, next) => {
  try {
    const { id } = req.params;

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

    // Ownership check: only author may edit
    if (!issue.createdBy.equals(req.user._id)) {
      return res.status(403).json({
        status: 'fail',
        message: 'Forbidden: You are not authorized to edit this issue report.',
      });
    }

    // Lifecycle check: only 'reported' status can be modified by the student
    if (issue.status !== 'reported') {
      return res.status(409).json({
        status: 'fail',
        message:
          'This report has already been reviewed or processed by campus administration and cannot be edited.',
      });
    }

    // Explicit field allowlist
    const {
      title,
      description,
      category,
      severity,
      location,
      campusAlertRequested,
      removeImage,
    } = req.body;

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length < 5 || title.trim().length > 150) {
        return res.status(400).json({
          status: 'fail',
          message: 'Title must be between 5 and 150 characters.',
        });
      }
      issue.title = title.trim();
    }

    if (description !== undefined) {
      if (
        typeof description !== 'string' ||
        description.trim().length < 10 ||
        description.trim().length > 2500
      ) {
        return res.status(400).json({
          status: 'fail',
          message: 'Description must be between 10 and 2500 characters.',
        });
      }
      issue.description = description.trim();
    }

    if (category !== undefined) {
      const normalizedCat = normalizeCategory(category);
      if (!normalizedCat || !ISSUE_CATEGORIES.includes(normalizedCat)) {
        return res.status(400).json({
          status: 'fail',
          message: `Invalid category. Must be one of: ${ISSUE_CATEGORIES.join(', ')}`,
        });
      }
      issue.category = normalizedCat;
    }

    if (severity !== undefined) {
      const normalizedSev =
        typeof severity === 'string' ? severity.trim().toLowerCase() : null;
      if (!normalizedSev || !ISSUE_SEVERITIES.includes(normalizedSev)) {
        return res.status(400).json({
          status: 'fail',
          message: `Invalid severity level. Must be one of: ${ISSUE_SEVERITIES.join(', ')}`,
        });
      }
      issue.severity = normalizedSev;
    }

    if (location !== undefined) {
      let parsedLocation = location;
      if (typeof location === 'string') {
        try {
          parsedLocation = JSON.parse(location);
        } catch {
          parsedLocation = null;
        }
      }

      if (!parsedLocation || typeof parsedLocation !== 'object' || !parsedLocation.building?.trim()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Building name is required in location details.',
        });
      }

      const rawZone =
        parsedLocation.campusZone ||
        req.body['location.campusZone'] ||
        req.body['location[campusZone]'] ||
        req.body.campusZone;
      const zone =
        rawZone && CAMPUS_ZONES.includes(rawZone.toString().toLowerCase().trim())
          ? rawZone.toString().toLowerCase().trim()
          : issue.location?.campusZone || 'academic_blocks';

      issue.location = {
        building: parsedLocation.building.trim(),
        campusZone: zone,
        area: parsedLocation.area ? parsedLocation.area.trim() : parsedLocation.roomOrArea ? parsedLocation.roomOrArea.trim() : '',
        floor: parsedLocation.floor ? parsedLocation.floor.trim() : '',
        room: parsedLocation.room ? parsedLocation.room.trim() : '',
      };
    }

    if (campusAlertRequested !== undefined) {
      issue.campusAlertRequested =
        campusAlertRequested === true || campusAlertRequested === 'true';
    }

    // Handle image replacement or removal
    const oldPublicId = issue.imagePublicId;

    if (req.file) {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          status: 'fail',
          message:
            'Image upload is currently unavailable due to missing Cloudinary configuration on the server.',
        });
      }

      const uploadResult = await uploadToCloudinary(req.file.buffer, {
        folder: 'campuspulse/issues',
      });

      issue.imageUrl = uploadResult.secure_url;
      issue.imagePublicId = uploadResult.public_id;

      // Delete old asset after successful new upload
      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId);
      }
    } else if (removeImage === true || removeImage === 'true') {
      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId);
      }
      issue.imageUrl = '';
      issue.imagePublicId = '';
    }

    await issue.save();

    const updatedIssue = await Issue.findById(issue._id).populate(
      'createdBy',
      'name email department role'
    );

    const [confirmationCount, userConfirm] = await Promise.all([
      IssueConfirmation.countDocuments({ issue: updatedIssue._id }),
      IssueConfirmation.exists({ issue: updatedIssue._id, user: req.user._id }),
    ]);

    const issueObj = updatedIssue.toObject();
    issueObj.confirmationCount = confirmationCount;
    issueObj.currentUserConfirmed = Boolean(userConfirm);

    // Realtime broadcast for updated report
    emitIssueUpdated(issueObj);

    res.status(200).json({
      status: 'success',
      data: {
        issue: issueObj,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/issues/:id
 * Delete a student report (allowed only for the author and only while status is 'reported')
 */
export const deleteIssue = async (req, res, next) => {
  try {
    const { id } = req.params;

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

    // Ownership check
    if (!issue.createdBy.equals(req.user._id)) {
      return res.status(403).json({
        status: 'fail',
        message: 'Forbidden: You are not authorized to delete this issue report.',
      });
    }

    // Lifecycle check
    if (issue.status !== 'reported') {
      return res.status(409).json({
        status: 'fail',
        message:
          'This report has already been reviewed or processed by campus administration and cannot be deleted.',
      });
    }

    // Clean up Cloudinary asset if present
    if (issue.imagePublicId) {
      await deleteFromCloudinary(issue.imagePublicId);
    }

    // Clean up comments and confirmations
    await Promise.all([
      Issue.findByIdAndDelete(id),
      Comment.deleteMany({ issue: id }),
      IssueConfirmation.deleteMany({ issue: id }),
    ]);

    // Realtime broadcast for deleted issue
    emitIssueDeleted(id);

    res.status(200).json({
      status: 'success',
      message: 'Issue report deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/issues/:id/confirm
 * Affirm "Affects Me Too" on an issue report (atomic and idempotent)
 */
export const confirmIssue = async (req, res, next) => {
  try {
    const { id } = req.params;

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

    if (issue.status === 'rejected') {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot confirm a rejected issue report.',
      });
    }

    // Idempotent creation (handles duplicate key error cleanly)
    try {
      await IssueConfirmation.create({
        issue: id,
        user: req.user._id,
      });
    } catch (err) {
      if (err.code !== 11000) {
        throw err;
      }
      // If code 11000, already confirmed; proceed cleanly
    }

    const confirmationCount = await IssueConfirmation.countDocuments({ issue: id });

    // Realtime broadcast for updated affirmations
    emitConfirmationUpdated(id, { confirmationCount });

    res.status(200).json({
      status: 'success',
      message: 'Issue affirmed successfully.',
      data: {
        confirmationCount,
        currentUserConfirmed: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/issues/:id/confirm
 * Remove current user's "Affects Me Too" affirmation
 */
export const unconfirmIssue = async (req, res, next) => {
  try {
    const { id } = req.params;

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

    if (issue.status === 'rejected') {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot modify confirmation on a rejected issue report.',
      });
    }

    await IssueConfirmation.findOneAndDelete({
      issue: id,
      user: req.user._id,
    });

    const confirmationCount = await IssueConfirmation.countDocuments({ issue: id });

    // Realtime broadcast for updated affirmations
    emitConfirmationUpdated(id, { confirmationCount });

    res.status(200).json({
      status: 'success',
      message: 'Issue affirmation removed.',
      data: {
        confirmationCount,
        currentUserConfirmed: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Common stopwords to filter out for keyword search in Duplicate Radar
 */
const DUPLICATE_STOPWORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'in', 'and', 'or', 'of', 'for', 'to',
  'with', 'by', 'from', 'it', 'my', 'we', 'our', 'there', 'this', 'that', 'not', 'no',
  'are', 'was', 'were', 'has', 'have', 'had', 'been', 'issue', 'problem', 'broken',
  'working', 'please', 'help', 'fix', 'floor', 'room', 'block',
]);

/**
 * GET /api/issues/duplicates
 * Duplicate Radar: Pre-submission similarity detection for potential duplicate reports
 */
export const checkDuplicateIssues = async (req, res, next) => {
  try {
    const { q, category, campusZone, building } = req.query;

    const queryText = (typeof q === 'string' ? q.trim() : '');
    const normalizedCategory = category ? normalizeCategory(category) : null;
    const normalizedZone = (campusZone && CAMPUS_ZONES.includes(campusZone.trim().toLowerCase()))
      ? campusZone.trim().toLowerCase()
      : null;
    const searchBuilding = typeof building === 'string' && building.trim().length > 0
      ? building.trim().toLowerCase()
      : null;

    // If query has less than 3 chars and no category/location criteria, return empty
    if (queryText.length < 3 && !normalizedCategory && !normalizedZone && !searchBuilding) {
      return res.status(200).json({
        status: 'success',
        data: { duplicates: [] },
      });
    }

    // Extract significant keywords
    const rawTokens = queryText
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !DUPLICATE_STOPWORDS.has(token));

    // Construct broad candidate search query
    const conditions = [];

    if (rawTokens.length > 0) {
      const tokenRegexes = rawTokens.map((t) => new RegExp(t, 'i'));
      conditions.push({ title: { $in: tokenRegexes } });
      conditions.push({ description: { $in: tokenRegexes } });
    }

    if (normalizedCategory) {
      conditions.push({ category: normalizedCategory });
    }

    if (normalizedZone) {
      conditions.push({ 'location.campusZone': normalizedZone });
    }

    if (searchBuilding) {
      conditions.push({ 'location.building': { $regex: searchBuilding, $options: 'i' } });
    }

    // If no conditions formed, return empty
    if (conditions.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: { duplicates: [] },
      });
    }

    // Duplicate radar privacy enforcement:
    // Confidential and department-only reports must NEVER leak through duplicate suggestions to other users
    const duplicatePrivacyFilter = {
      $or: [
        { visibility: 'public' },
        ...(req.user?._id ? [{ createdBy: req.user._id }] : []),
      ],
    };

    // Query non-rejected reports matching privacy filter and keywords
    const candidates = await Issue.find({
      status: { $ne: 'rejected' },
      parentIssueId: null, // Suggest only root/canonical incidents
      $and: [
        duplicatePrivacyFilter,
        { $or: conditions },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('createdBy', 'name email department role')
      .populate('department', 'name code isActive')
      .populate('assignedTo', 'name email');

    // Score and rank candidates based on similarity
    const scoredCandidates = candidates.map((issue) => {
      let score = 0;
      const titleLower = (issue.title || '').toLowerCase();
      const descLower = (issue.description || '').toLowerCase();
      const issueBuildingLower = (issue.location?.building || '').toLowerCase();

      // Keyword scoring
      rawTokens.forEach((token) => {
        if (titleLower.includes(token)) score += 4;
        else if (descLower.includes(token)) score += 1.5;
      });

      // Category match scoring
      if (normalizedCategory && issue.category === normalizedCategory) {
        score += 3;
      }

      // Campus zone match scoring
      if (normalizedZone && issue.location?.campusZone === normalizedZone) {
        score += 3;
      }

      // Building match scoring
      if (searchBuilding && issueBuildingLower.includes(searchBuilding)) {
        score += 3;
      }

      // Freshness bonus: reports created within last 7 days get slight boost
      const ageInDays = (Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays <= 7) score += 1.5;
      else if (ageInDays <= 30) score += 0.5;

      // Status relevance bonus: open issues are more likely to be active duplicates
      if (issue.status === 'reported' || issue.status === 'verified' || issue.status === 'in_progress') {
        score += 2;
      }

      return {
        issue,
        score,
      };
    });

    // Filter only meaningful matches
    const threshold = rawTokens.length > 0 ? 3.5 : 5.0;
    const topMatches = scoredCandidates
      .filter((item) => item.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.issue);

    const duplicatesWithAffirmations = await attachConfirmationData(topMatches, req.user?._id);

    return res.status(200).json({
      status: 'success',
      data: {
        duplicates: duplicatesWithAffirmations,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/issues/:id/reopen
 * Reopen a resolved issue report (allowed only for author or administrator)
 */
export const reopenIssue = async (req, res, next) => {
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

    // Permission check: only author or administrator
    const isAuthor = issue.createdBy.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Access denied: Only the student who reported this issue or an administrator can reopen it.',
      });
    }

    if (issue.status !== 'resolved') {
      return res.status(400).json({
        status: 'fail',
        message: `Cannot reopen an issue with status '${issue.status}'. Only resolved issues can be reopened.`,
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return res.status(400).json({
        status: 'fail',
        message: 'A clear explanation for reopening the issue is required (minimum 10 characters).',
      });
    }

    const trimmedReason = reason.trim();
    issue.status = 'in_progress';
    issue.reopenedAt = new Date();
    issue.reopenedBy = req.user._id;
    issue.reopenReason = trimmedReason;
    issue.reopenCount = (issue.reopenCount || 0) + 1;
    issue.reporterConfirmed = false;

    issue.statusHistory.push({
      status: 'in_progress',
      changedBy: req.user._id,
      note: `Reopened by ${isAdmin ? 'administrator' : 'student reporter'}. Reason: "${trimmedReason}"`,
      timestamp: new Date(),
    });

    await issue.save();

    await logAuditEvent({
      entityType: 'issue',
      entityId: issue._id,
      action: 'issue_reopened',
      actor: req.user._id,
      details: { reopenCount: issue.reopenCount },
      reason: trimmedReason,
    });

    // Notify assigned staff
    if (issue.assignedTo) {
      await createNotification({
        recipient: issue.assignedTo,
        actor: req.user._id,
        issue: issue._id,
        type: 'issue_reopened',
        title: 'Issue Reopened by Student',
        message: `Student reporter has reopened "${issue.title}". Reason: "${trimmedReason}"`,
      });
    }

    const updatedIssue = await Issue.findById(issue._id)
      .populate('createdBy', 'name email department role')
      .populate('reviewedBy', 'name email role')
      .populate('assignedTo', 'name email department departmentName isActive')
      .populate('department', 'name code isActive')
      .populate('statusHistory.changedBy', 'name email role');

    emitStatusChanged(updatedIssue);

    res.status(200).json({
      status: 'success',
      message: 'Issue report successfully reopened for further action.',
      data: {
        issue: updatedIssue,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/issues/:id/confirm-resolution
 * Confirm that resolution has solved the reported issue
 */
export const confirmResolution = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

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

    const isAuthor = issue.createdBy.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Only the student who reported this issue can confirm resolution.',
      });
    }

    if (issue.status !== 'resolved') {
      return res.status(400).json({
        status: 'fail',
        message: 'Resolution can only be confirmed on resolved issues.',
      });
    }

    issue.reporterConfirmed = true;
    if (feedback && typeof feedback === 'string') {
      issue.reporterFeedback = feedback.trim();
    }

    await issue.save();

    await logAuditEvent({
      entityType: 'issue',
      entityId: issue._id,
      action: 'resolution_confirmed',
      actor: req.user._id,
      details: { reporterConfirmed: true, feedback: issue.reporterFeedback },
      reason: 'Reporter verified resolution',
    });

    if (issue.assignedTo) {
      await createNotification({
        recipient: issue.assignedTo,
        actor: req.user._id,
        issue: issue._id,
        type: 'status_updated',
        title: 'Resolution Confirmed by Student',
        message: `Student verified that "${issue.title}" has been successfully resolved.`,
      });
    }

    const updatedIssue = await Issue.findById(issue._id)
      .populate('createdBy', 'name email department role')
      .populate('assignedTo', 'name email department departmentName isActive')
      .populate('department', 'name code isActive');

    emitIssueUpdated(updatedIssue);

    res.status(200).json({
      status: 'success',
      message: 'Resolution confirmed successfully. Thank you for your feedback.',
      data: {
        issue: updatedIssue,
      },
    });
  } catch (error) {
    next(error);
  }
};
