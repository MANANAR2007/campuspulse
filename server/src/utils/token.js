import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export const COOKIE_NAME = 'token';

/**
 * Sign a new JWT containing user ID and role
 */
export const generateToken = (user) => {
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is not configured in server environment');
  }

  const userId = user.id || user._id.toString();

  return jwt.sign(
    {
      id: userId,
      role: user.role,
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
    }
  );
};

/**
 * Attach HttpOnly authentication cookie to Express response
 */
export const setAuthCookie = (res, token) => {
  const isProduction = config.nodeEnv === 'production';

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: config.cookieMaxAgeDays * 24 * 60 * 60 * 1000,
    path: '/',
  });
};

/**
 * Clear the authentication cookie on logout
 */
export const clearAuthCookie = (res) => {
  const isProduction = config.nodeEnv === 'production';

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
};
