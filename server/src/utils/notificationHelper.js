import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { emitNotificationNew } from './socket.js';

/**
 * Safely create a single in-app notification without throwing unhandled errors
 * @param {Object} params - Notification parameters
 */
export const createNotification = async ({
  recipient,
  actor = null,
  issue = null,
  type,
  title,
  message,
}) => {
  try {
    if (!recipient) return null;

    // Do not notify a user about their own action
    if (actor && recipient.toString() === actor.toString()) {
      return null;
    }

    const notification = await Notification.create({
      recipient,
      actor,
      issue,
      type,
      title,
      message,
    });

    const populatedNotification = await Notification.findById(notification._id)
      .populate('actor', 'name role department')
      .populate('issue', 'title status isCampusWideAlert severity category');

    // Realtime Socket delivery to the recipient's private user room
    emitNotificationNew(recipient, populatedNotification || notification);

    return notification;
  } catch (error) {
    // Log without exposing sensitive data, ensuring primary transaction is unaffected
    console.error('⚠️  Failed to create notification:', error.message);
    return null;
  }
};

/**
 * Fan out a campus-wide alert notification to all student accounts in batches
 * Includes idempotency check to avoid duplicate fan-out if review is retried.
 * @param {Object} params
 * @param {Object} params.issue - The verified alert issue document
 * @param {string|mongoose.Types.ObjectId} params.actor - The admin who approved the alert
 */
export const fanOutCampusAlertNotification = async ({ issue, actor }) => {
  try {
    if (!issue || !issue._id) return;

    // Check if campus_alert notification for this issue was already fanned out
    const existing = await Notification.findOne({
      issue: issue._id,
      type: 'campus_alert',
    });

    if (existing) {
      // Fan-out already took place; avoid duplicate fan-out
      return;
    }

    // Find all student users to notify
    const students = await User.find({ role: 'student' }).select('_id');

    if (!students || students.length === 0) return;

    const alertNotifications = students.map((student) => ({
      recipient: student._id,
      actor,
      issue: issue._id,
      type: 'campus_alert',
      title: '🚨 Official Campus-Wide Alert Issued',
      message: `An urgent alert regarding "${issue.title}" has been issued for ${issue.location?.building || 'Campus'}. Please review safety advisories.`,
    }));

    // Batch insert notifications
    const inserted = await Notification.insertMany(alertNotifications, { ordered: false });

    // Emit realtime alert notification to each recipient
    if (inserted && Array.isArray(inserted)) {
      inserted.forEach((notif) => {
        emitNotificationNew(notif.recipient, notif);
      });
    }
  } catch (error) {
    console.error('⚠️  Failed to fan out campus alert notifications:', error.message);
  }
};
