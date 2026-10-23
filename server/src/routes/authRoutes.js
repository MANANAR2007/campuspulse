import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  adminCheck,
} from '../controllers/authController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public routes
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);

// Authenticated session route
router.get('/me', authenticate, getMe);

// Admin authorization verification route
router.get('/admin-check', authenticate, requireAdmin, adminCheck);

export default router;
