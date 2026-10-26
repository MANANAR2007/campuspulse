import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import User from '../models/User.js';
import Issue from '../models/Issue.js';
import { COOKIE_NAME } from './token.js';

let io = null;

/**
 * Parse cookies from the raw cookie header
 * @param {string} cookieHeader 
 * @returns {Record<string, string>}
 */
const parseCookies = (cookieHeader = '') => {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;

  cookieHeader.split(';').forEach((pair) => {
    const parts = pair.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      cookies[key] = decodeURIComponent(val);
    }
  });

  return cookies;
};

/**
 * Initialize Socket.IO with HTTP server and JWT cookie authentication
 * @param {import('http').Server} httpServer 
 * @param {Object} corsOptions 
 */
export const initSocket = (httpServer, corsOptions = {}) => {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: config.clientOrigin,
      credentials: true,
      ...corsOptions,
    },
    serveClient: false,
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Authentication Middleware for Handshake
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.request.headers.cookie;
      const cookies = parseCookies(cookieHeader);
      const token = cookies[COOKIE_NAME];

      if (!token) {
        return next(
          new Error('Authentication required: No session cookie provided.')
        );
      }

      if (!config.jwtSecret) {
        return next(new Error('Server configuration error: Missing JWT_SECRET.'));
      }

      // Verify JWT signature & expiration
      let decoded;
      try {
        decoded = jwt.verify(token, config.jwtSecret);
      } catch (jwtErr) {
        return next(
          new Error(`Authentication failed: Invalid session (${jwtErr.message})`)
        );
      }

      if (!decoded?.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
        return next(new Error('Authentication failed: Malformed session payload.'));
      }

      // Verify user existence in database
      const user = await User.findById(decoded.id).select('_id name email role department isActive');
      if (!user) {
        return next(new Error('Authentication failed: User account no longer exists.'));
      }

      if (user.isActive === false) {
        return next(new Error('Authentication failed: Account has been deactivated.'));
      }

      // Attach authenticated user identity to socket
      socket.user = {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        department: user.department ? user.department.toString() : null,
      };

      next();
    } catch (err) {
      next(new Error(`Socket authentication error: ${err.message}`));
    }
  });

  // Connection Handler
  io.on('connection', (socket) => {
    const { id: userId, role, department } = socket.user;

    // 1. Join personal private user room for targeted notifications
    socket.join(`user:${userId}`);

    // 2. If administrator, join admin operations room
    if (role === 'admin') {
      socket.join('role:admin');
    }

    // 3. If staff, join staff room and department room
    if (role === 'staff') {
      socket.join('role:staff');
      if (department) {
        socket.join(`dept:${department}`);
      }
    }

    // 4. Handle room subscription for specific issue discussion threads
    socket.on('join:issue', async (issueId, callback) => {
      try {
        if (!issueId || !mongoose.Types.ObjectId.isValid(issueId)) {
          if (typeof callback === 'function') {
            callback({ error: 'Invalid issue ID format.' });
          }
          return;
        }

        const issue = await Issue.findById(issueId).select(
          '_id status createdBy visibility department assignedTo'
        );
        if (!issue) {
          if (typeof callback === 'function') {
            callback({ error: 'Issue report not found.' });
          }
          return;
        }

        const isAuthor = issue.createdBy.toString() === userId;
        const isAdmin = role === 'admin';
        const isAssignedStaff =
          role === 'staff' &&
          issue.assignedTo &&
          issue.assignedTo.toString() === userId;
        const isDeptStaff =
          role === 'staff' &&
          issue.department &&
          department &&
          issue.department.toString() === department;

        // Prevent joining rooms for rejected issues unless author or admin
        if (issue.status === 'rejected' && !isAuthor && !isAdmin) {
          if (typeof callback === 'function') {
            callback({ error: 'Issue report is inaccessible.' });
          }
          return;
        }

        // Privacy and visibility check
        if (issue.visibility === 'confidential') {
          if (!isAuthor && !isAdmin && !isAssignedStaff) {
            if (typeof callback === 'function') {
              callback({ error: 'Issue is confidential and restricted.' });
            }
            return;
          }
        }

        if (issue.visibility === 'department_only') {
          if (!isAuthor && !isAdmin && !isDeptStaff) {
            if (typeof callback === 'function') {
              callback({ error: 'Issue is restricted to department staff.' });
            }
            return;
          }
        }

        const roomName = `issue:${issueId}`;
        socket.join(roomName);

        if (typeof callback === 'function') {
          callback({ success: true, room: roomName });
        }
      } catch (err) {
        if (typeof callback === 'function') {
          callback({ error: 'Failed to join issue room.' });
        }
      }
    });

    // 4. Handle leaving issue room
    socket.on('leave:issue', (issueId) => {
      if (issueId) {
        socket.leave(`issue:${issueId}`);
      }
    });

    // Disconnect listener
    socket.on('disconnect', () => {
      // Socket.io cleanly leaves rooms on disconnect automatically
    });
  });

  return io;
};

/**
 * Access the initialized Socket.IO instance
 * @returns {Server}
 */
export const getIO = () => {
  return io;
};

// ==========================================
// REALTIME PUBLICATION HELPERS
// ==========================================

export const emitIssueCreated = (issue) => {
  if (!io) return;
  const issueId = issue.id || issue._id?.toString();
  const visibility = issue.visibility || 'public';

  if (visibility === 'public') {
    io.emit('issue:created', { issueId, issue });
  } else {
    // Restricted emission to preserve confidentiality
    io.to('role:admin').emit('issue:created', { issueId, issue });
    const creatorId = issue.createdBy?.id || issue.createdBy?._id || issue.createdBy;
    if (creatorId) {
      io.to(`user:${creatorId.toString()}`).emit('issue:created', { issueId, issue });
    }
    if (visibility === 'department_only' && issue.department) {
      const deptId = issue.department?.id || issue.department?._id || issue.department;
      io.to(`dept:${deptId.toString()}`).emit('issue:created', { issueId, issue });
    }
  }
};

export const emitIssueUpdated = (issue) => {
  if (!io) return;
  const issueId = issue.id || issue._id?.toString();
  const visibility = issue.visibility || 'public';

  if (visibility === 'public') {
    io.emit('issue:updated', { issueId, issue });
    io.to(`issue:${issueId}`).emit('issue:updated', { issueId, issue });
  } else {
    io.to('role:admin').emit('issue:updated', { issueId, issue });
    io.to(`issue:${issueId}`).emit('issue:updated', { issueId, issue });
    const creatorId = issue.createdBy?.id || issue.createdBy?._id || issue.createdBy;
    if (creatorId) {
      io.to(`user:${creatorId.toString()}`).emit('issue:updated', { issueId, issue });
    }
    if (issue.assignedTo) {
      const staffId = issue.assignedTo?.id || issue.assignedTo?._id || issue.assignedTo;
      io.to(`user:${staffId.toString()}`).emit('issue:updated', { issueId, issue });
    }
    if (visibility === 'department_only' && issue.department) {
      const deptId = issue.department?.id || issue.department?._id || issue.department;
      io.to(`dept:${deptId.toString()}`).emit('issue:updated', { issueId, issue });
    }
  }
};

export const emitIssueDeleted = (issueId) => {
  if (!io) return;
  io.emit('issue:deleted', { issueId });
  io.to(`issue:${issueId}`).emit('issue:deleted', { issueId });
};

export const emitStatusChanged = (issue) => {
  if (!io) return;
  const issueId = issue.id || issue._id?.toString();
  const visibility = issue.visibility || 'public';

  const payload = {
    issueId,
    status: issue.status,
    isCampusWideAlert: issue.isCampusWideAlert,
    issue,
  };

  if (visibility === 'public') {
    io.emit('issue:statusChanged', payload);
    io.to(`issue:${issueId}`).emit('issue:statusChanged', payload);
  } else {
    io.to('role:admin').emit('issue:statusChanged', payload);
    io.to(`issue:${issueId}`).emit('issue:statusChanged', payload);
    const creatorId = issue.createdBy?.id || issue.createdBy?._id || issue.createdBy;
    if (creatorId) {
      io.to(`user:${creatorId.toString()}`).emit('issue:statusChanged', payload);
    }
    if (issue.assignedTo) {
      const staffId = issue.assignedTo?.id || issue.assignedTo?._id || issue.assignedTo;
      io.to(`user:${staffId.toString()}`).emit('issue:statusChanged', payload);
    }
    if (visibility === 'department_only' && issue.department) {
      const deptId = issue.department?.id || issue.department?._id || issue.department;
      io.to(`dept:${deptId.toString()}`).emit('issue:statusChanged', payload);
    }
  }
};

export const emitAlertApproved = (issue) => {
  if (!io) return;
  const issueId = issue.id || issue._id?.toString();
  io.emit('alert:approved', {
    issueId,
    alert: issue,
  });
};

export const emitCommentCreated = (issueId, comment, isInternal = false) => {
  if (!io) return;
  if (isInternal) {
    // Only emit internal note to admin and staff rooms
    io.to('role:admin').emit('comment:created', { issueId, comment });
    io.to('role:staff').emit('comment:created', { issueId, comment });
  } else {
    io.to(`issue:${issueId}`).emit('comment:created', {
      issueId,
      comment,
    });
  }
};

export const emitCommentUpdated = (issueId, comment) => {
  if (!io) return;
  io.to(`issue:${issueId}`).emit('comment:updated', {
    issueId,
    comment,
  });
};

export const emitCommentDeleted = (issueId, commentId) => {
  if (!io) return;
  io.to(`issue:${issueId}`).emit('comment:deleted', {
    issueId,
    commentId,
  });
};

export const emitConfirmationUpdated = (issueId, confirmationData) => {
  if (!io) return;
  // Broadcast to issue room and global feed
  io.emit('confirmation:updated', {
    issueId,
    ...confirmationData,
  });
  io.to(`issue:${issueId}`).emit('confirmation:updated', {
    issueId,
    ...confirmationData,
  });
};

export const emitNotificationNew = (recipientId, notification) => {
  if (!io || !recipientId) return;
  // Deliver specifically to the targeted user's private room
  io.to(`user:${recipientId.toString()}`).emit('notification:new', {
    notification,
  });
};

export const emitNotificationUpdated = (recipientId, payload = {}) => {
  if (!io || !recipientId) return;
  io.to(`user:${recipientId.toString()}`).emit('notification:updated', {
    ...payload,
  });
};
