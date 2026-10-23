import { Router } from 'express';
import {
  getAdminIssues,
  reviewIssue,
  updateIssueStatus,
  getAdminStats,
} from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Protect all admin endpoints with authentication and admin role verification
router.use(authenticate, requireAdmin);

// Admin review queue & issue management
router.get('/issues', getAdminIssues);
router.patch('/issues/:id/review', reviewIssue);
router.patch('/issues/:id/status', updateIssueStatus);

// Admin statistics
router.get('/stats', getAdminStats);

export default router;
