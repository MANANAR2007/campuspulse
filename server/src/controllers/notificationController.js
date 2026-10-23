import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

/**
 * GET /api/notifications
 * Retrieve paginated notifications for the authenticated user
 */
export const getNotifications = async (req, res, next) => {
  try {
    const { unreadOnly } = req.query;
    const filter = { recipient: req.user._id };

    if (unreadOnly === 'true') {
      filter.readAt = null;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [notifications, totalCount, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actor', 'name role department')
        .populate('issue', 'title status isCampusWideAlert severity category'),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, readAt: null }),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.status(200).json({
      status: 'success',
      data: {
        notifications,
        unreadCount,
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
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid notification ID format.',
      });
    }

    const notification = await Notification.findOne({
      _id: id,
      recipient: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        status: 'fail',
        message: 'Notification not found or unauthorized.',
      });
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      readAt: null,
    });

    res.status(200).json({
      status: 'success',
      data: {
        notification,
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the current user
 */
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const now = new Date();
    const result = await Notification.updateMany(
      { recipient: req.user._id, readAt: null },
      { $set: { readAt: now } }
    );

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read.',
      data: {
        modifiedCount: result.modifiedCount || 0,
        unreadCount: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};
