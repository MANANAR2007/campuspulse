import { Router } from 'express';
import {
  getAdminIssues,
  getAdminIssueById,
  reviewIssue,
  updateIssueStatus,
  getAdminStats,
  getCampusHotspots,
} from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Protect all admin endpoints with authentication and admin role verification
router.use(authenticate, requireAdmin);

// Admin review queue & issue management
router.get('/issues', getAdminIssues);
router.get('/issues/:id', getAdminIssueById);
router.patch('/issues/:id/review', reviewIssue);
router.patch('/issues/:id/status', updateIssueStatus);

// Admin statistics & analytics
router.get('/stats', getAdminStats);
router.get('/hotspots', getCampusHotspots);

export default router;
