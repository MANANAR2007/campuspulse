import { Router } from 'express';
import {
  getAdminIssues,
  getAdminIssueById,
  reviewIssue,
  updateIssueStatus,
  getAdminStats,
  getCampusHotspots,
  assignIssue,
  redirectIssue,
  unassignIssue,
  updateIssuePriorityAndDeadlines,
  updateIssueVisibility,
  getStaffUsers,
  createStaffUser,
  updateStaffUser,
  getAuditLogs,
  groupIssue,
  ungroupIssue,
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

// Smart Issue Grouping & Incident Operations
router.post('/issues/:id/group', groupIssue);
router.post('/issues/:id/ungroup', ungroupIssue);

// Assignment, redirection and routing operations
router.post('/issues/:id/assign', assignIssue);
router.post('/issues/:id/redirect', redirectIssue);
router.post('/issues/:id/unassign', unassignIssue);
router.post('/issues/:id/priority-deadline', updateIssuePriorityAndDeadlines);
router.post('/issues/:id/visibility', updateIssueVisibility);

// Staff management operations
router.get('/staff', getStaffUsers);
router.post('/staff', createStaffUser);
router.patch('/staff/:id', updateStaffUser);

// Audit logs
router.get('/audit-logs', getAuditLogs);

// Admin statistics & analytics
router.get('/stats', getAdminStats);
router.get('/hotspots', getCampusHotspots);

export default router;
