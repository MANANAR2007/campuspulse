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

// Student issue collection endpoints (Student mode only)
router.post('/', requireStudent, uploadSingleImage, createIssue);
router.get('/', requireStudent, getIssues);
router.get('/mine', requireStudent, getMyIssues);

// Alert banner query (must be registered BEFORE /:id)
router.get('/alerts', getActiveAlerts);

// Duplicate Radar: pre-submission similarity check (must be registered BEFORE /:id)
router.get('/duplicates', requireStudent, checkDuplicateIssues);

// Nested comments for an issue (Student mode only)
router.get('/:id/comments', requireStudent, getIssueComments);
router.post('/:id/comments', requireStudent, createComment);

// Affects Me Too confirmation endpoints (Student mode only)
router.post('/:id/confirm', requireStudent, confirmIssue);
router.delete('/:id/confirm', requireStudent, unconfirmIssue);

// Single issue item endpoints (Student mode only)
router.get('/:id', requireStudent, getIssueById);
router.patch('/:id', requireStudent, uploadSingleImage, updateIssue);
router.delete('/:id', requireStudent, deleteIssue);

export default router;
