import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints (prevent brute-force attacks)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per 15-minute window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: 'Too many authentication attempts from this IP address. Please try again in 15 minutes.',
  },
});
