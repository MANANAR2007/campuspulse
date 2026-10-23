import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import User from '../models/User.js';
import { COOKIE_NAME } from '../utils/token.js';

/**
 * Middleware: Verify user authentication via HttpOnly cookie or Bearer token
 */
export const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HttpOnly cookie
    if (req.cookies && req.cookies[COOKIE_NAME]) {
      token = req.cookies[COOKIE_NAME];
    }
    // 2. Fallback to Authorization Header (Bearer token)
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'fail',
        message: 'Authentication required. Please sign in.',
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'fail',
          message: 'Session expired. Please sign in again.',
        });
      }
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid authentication token.',
      });
    }

    // Ensure user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        status: 'fail',
        message: 'The user belonging to this token no longer exists.',
      });
    }

    // Attach user to request
    req.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Require Administrator role
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'fail',
      message: 'Authentication required. Please sign in.',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      status: 'fail',
      message: 'Access denied. Administrator privileges are required for this action.',
    });
  }

  next();
};

/**
 * Middleware: Require Student role
 */
export const requireStudent = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'fail',
      message: 'Authentication required. Please sign in.',
    });
  }

  if (req.user.role !== 'student') {
    return res.status(403).json({
      status: 'fail',
      message: 'Access denied. This action is restricted to students.',
    });
  }

  next();
};
