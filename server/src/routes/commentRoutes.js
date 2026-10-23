import { Router } from 'express';
import { updateComment, deleteComment } from '../controllers/commentController.js';
import { authenticate, requireStudent } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireStudent);

router.patch('/:commentId', updateComment);
router.delete('/:commentId', deleteComment);

export default router;
