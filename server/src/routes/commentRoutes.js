import { Router } from 'express';
import { updateComment, deleteComment } from '../controllers/commentController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.patch('/:commentId', updateComment);
router.delete('/:commentId', deleteComment);

export default router;
