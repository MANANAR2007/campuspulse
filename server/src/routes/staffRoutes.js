import { Router } from 'express';
import {
  getStaffWorkQueue,
  getStaffStats,
  updateStaffIssueStatus,
} from '../controllers/staffController.js';
import { authenticate, requireStaff } from '../middleware/auth.js';

const router = Router();

// Staff work queue and update operations require active staff role
router.use(authenticate, requireStaff);

router.get('/queue', getStaffWorkQueue);
router.get('/stats', getStaffStats);
router.patch('/issues/:id/status', updateStaffIssueStatus);

export default router;
