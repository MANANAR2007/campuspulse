import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import Issue from '../models/Issue.js';
import { createNotification } from '../utils/notificationHelper.js';

/**
 * GET /api/issues/:id/comments
 * Retrieve paginated comments for an issue
 */
export const getIssueComments = async (req, res, next) => {
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

    // Do not expose comments for rejected issues to non-admin users
    if (issue.status === 'rejected' && (!req.user || req.user.role !== 'admin')) {
      return res.status(404).json({
        status: 'fail',
        message: 'Issue report not accessible.',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [comments, totalCount] = await Promise.all([
      Comment.find({ issue: id })
        .sort({ createdAt: 1 }) // Chronological order for discussion
        .skip(skip)
        .limit(limit)
        .populate('author', 'name email role department'),
      Comment.countDocuments({ issue: id }),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.status(200).json({
      status: 'success',
      data: {
        comments,
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
 * POST /api/issues/:id/comments
 * Post a new persistent comment on an issue
 */
export const createComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid issue ID format.',
      });
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Comment text cannot be empty.',
      });
    }

    if (text.trim().length > 1000) {
      return res.status(400).json({
        status: 'fail',
        message: 'Comment text cannot exceed 1000 characters.',
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
        message: 'Comments cannot be added to rejected issue reports.',
      });
    }

    const newComment = await Comment.create({
      issue: id,
      author: req.user._id,
      text: text.trim(),
    });

    const populatedComment = await Comment.findById(newComment._id).populate(
      'author',
      'name email role department'
    );

    // Notify issue owner (unless the commenter is the issue author themselves)
    if (issue.createdBy && !issue.createdBy.equals(req.user._id)) {
      const excerpt =
        newComment.text.length > 60
          ? `${newComment.text.slice(0, 60)}...`
          : newComment.text;

      await createNotification({
        recipient: issue.createdBy,
        actor: req.user._id,
        issue: issue._id,
        type: 'issue_comment',
        title: 'New Comment on Your Report',
        message: `${req.user.name} commented on "${issue.title}": "${excerpt}"`,
      });
    }

    res.status(201).json({
      status: 'success',
      data: {
        comment: populatedComment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/comments/:commentId
 * Update an existing comment (author only)
 */
export const updateComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid comment ID format.',
      });
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Comment text cannot be empty.',
      });
    }

    if (text.trim().length > 1000) {
      return res.status(400).json({
        status: 'fail',
        message: 'Comment text cannot exceed 1000 characters.',
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        status: 'fail',
        message: 'Comment not found.',
      });
    }

    // Only comment author can edit
    if (!comment.author.equals(req.user._id)) {
      return res.status(403).json({
        status: 'fail',
        message: 'Forbidden: You can only edit your own comments.',
      });
    }

    comment.text = text.trim();
    await comment.save();

    const updatedComment = await Comment.findById(comment._id).populate(
      'author',
      'name email role department'
    );

    res.status(200).json({
      status: 'success',
      data: {
        comment: updatedComment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/comments/:commentId
 * Delete a comment (author only or admin moderation)
 */
export const deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid comment ID format.',
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        status: 'fail',
        message: 'Comment not found.',
      });
    }

    // Only comment author or admin can delete
    const isAuthor = comment.author.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'Forbidden: You are not authorized to delete this comment.',
      });
    }

    await Comment.findByIdAndDelete(commentId);

    res.status(200).json({
      status: 'success',
      message: 'Comment deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
