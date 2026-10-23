import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import issueRoutes from './issueRoutes.js';
import adminRoutes from './adminRoutes.js';
import commentRoutes from './commentRoutes.js';
import notificationRoutes from './notificationRoutes.js';

const router = Router();

// Route modules
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/issues', issueRoutes);
router.use('/admin', adminRoutes);
router.use('/comments', commentRoutes);
router.use('/notifications', notificationRoutes);

export default router;
