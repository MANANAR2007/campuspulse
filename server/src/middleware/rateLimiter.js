import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints (prevent brute-force attacks).
 * Configured specifically for single-hop cloud proxies (Render, AWS ALB, Nginx).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 authentication requests per 15-minute window
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: true,
    xForwardedForHeader: false, // Prevents ERR_ERL_UNEXPECTED_X_FORWARDED_FOR behind Render proxy
  },
  message: {
    status: 'fail',
    message: 'Too many authentication attempts from this IP address. Please try again in 15 minutes.',
  },
});

/**
 * General API rate limiter to protect endpoints from automated scraping or abuse.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // 600 requests per 15-minute window per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: true,
    xForwardedForHeader: false,
  },
  message: {
    status: 'fail',
    message: 'Too many requests received from this client. Please slow down and try again shortly.',
  },
});
