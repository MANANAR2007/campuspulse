import { Router } from 'express';
import {
  createIssue,
  getIssues,
  getMyIssues,
  getActiveAlerts,
  getIssueById,
  updateIssue,
  deleteIssue,
  confirmIssue,
  unconfirmIssue,
  checkDuplicateIssues,
  reopenIssue,
  confirmResolution,
} from '../controllers/issueController.js';
import {
  getIssueComments,
  createComment,
} from '../controllers/commentController.js';
import { authenticate, requireStudent } from '../middleware/auth.js';
import { uploadSingleImage } from '../middleware/upload.js';

const router = Router();

// All issue operations require authenticated session
router.use(authenticate);

// Feed & list endpoints
router.get('/', getIssues);
router.post('/', requireStudent, uploadSingleImage, createIssue);
router.get('/mine', requireStudent, getMyIssues);

// Alert banner query (must be registered BEFORE /:id)
router.get('/alerts', getActiveAlerts);

// Duplicate Radar: pre-submission similarity check (must be registered BEFORE /:id)
router.get('/duplicates', checkDuplicateIssues);

// Nested comments for an issue (accessible to students, staff, and admins according to visibility rules)
router.get('/:id/comments', getIssueComments);
router.post('/:id/comments', createComment);

// Verification, Reopening and Resolution feedback
router.post('/:id/reopen', reopenIssue);
router.post('/:id/confirm-resolution', confirmResolution);

// Affects Me Too confirmation endpoints (Student mode only)
router.post('/:id/confirm', requireStudent, confirmIssue);
router.delete('/:id/confirm', requireStudent, unconfirmIssue);

// Single issue item endpoints
router.get('/:id', getIssueById);
router.patch('/:id', requireStudent, uploadSingleImage, updateIssue);
router.delete('/:id', requireStudent, deleteIssue);

export default router;
