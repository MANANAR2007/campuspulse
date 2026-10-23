import mongoose from 'mongoose';
import Issue, {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
} from '../models/Issue.js';
import IssueConfirmation from '../models/IssueConfirmation.js';
import Comment from '../models/Comment.js';
import { normalizeCategory } from '../utils/categoryHelper.js';
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
} from '../utils/socket.js';

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

    let newIssue;
    try {
      newIssue = await Issue.create({
        title: title.trim(),
        description: description.trim(),
        category: normalizedCategory,
        severity: normalizedSeverity,
        location: { building, area, floor, room },
        imageUrl,
        imagePublicId,
        campusAlertRequested: Boolean(isAlertReq),
        // Protected fields strictly enforced by backend
        createdBy: req.user._id,
        status: 'reported',
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

    const populatedIssue = await Issue.findById(newIssue._id).populate(
      'createdBy',
      'name email department role'
    );

    const issueObject = populatedIssue.toObject();
    issueObject.confirmationCount = 0;
    issueObject.currentUserConfirmed = false;

    // Realtime broadcast for new report
    emitIssueCreated(issueObject);

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

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [rawIssues, totalCount] = await Promise.all([
      Issue.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email department role'),
      Issue.countDocuments(filter),
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
      .populate('reviewedBy', 'name email role');

    if (!issue) {
      return res.status(404).json({
        status: 'fail',
        message: 'Issue report not found.',
      });
    }

    // Rejected reports are accessible only to the author or an administrator
    if (
      issue.status === 'rejected' &&
      req.user.role !== 'admin' &&
      !issue.createdBy._id.equals(req.user._id)
    ) {
      return res.status(404).json({
        status: 'fail',
        message: 'Issue report not accessible.',
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

      issue.location = {
        building: parsedLocation.building.trim(),
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
