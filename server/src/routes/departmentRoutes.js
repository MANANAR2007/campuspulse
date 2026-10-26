import { Router } from 'express';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  getDepartmentStaff,
} from '../controllers/departmentController.js';
import { authenticate, authenticateOptional, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public / optional auth for list of active departments (admins get inactive if ?includeInactive=true)
router.get('/', authenticateOptional, getDepartments);

// Staff list for a department requires authentication
router.get('/:id/staff', authenticate, getDepartmentStaff);

// Administration operations require admin role
router.post('/', authenticate, requireAdmin, createDepartment);
router.put('/:id', authenticate, requireAdmin, updateDepartment);
router.patch('/:id', authenticate, requireAdmin, updateDepartment);

export default router;
