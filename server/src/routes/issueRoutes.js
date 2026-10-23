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
} from '../controllers/issueController.js';
import {
  getIssueComments,
  createComment,
} from '../controllers/commentController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadSingleImage } from '../middleware/upload.js';

const router = Router();

// All issue operations require authenticated session
router.use(authenticate);

// Student issue collection endpoints
router.post('/', uploadSingleImage, createIssue);
router.get('/', getIssues);
router.get('/mine', getMyIssues);

// Alert banner query (must be registered BEFORE /:id)
router.get('/alerts', getActiveAlerts);

// Nested comments for an issue
router.get('/:id/comments', getIssueComments);
router.post('/:id/comments', createComment);

// Affects Me Too confirmation endpoints
router.post('/:id/confirm', confirmIssue);
router.delete('/:id/confirm', unconfirmIssue);

// Single issue item endpoints
router.get('/:id', getIssueById);
router.patch('/:id', uploadSingleImage, updateIssue);
router.delete('/:id', deleteIssue);

export default router;
