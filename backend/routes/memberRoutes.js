import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { register, listMembers } from '../controllers/memberController.js';

const router = Router();
router.post('/', upload.any(), asyncHandler(register));   // POST /api/members
router.get('/', requireAdmin, asyncHandler(listMembers));  // GET  /api/members?role=Boxer
export default router;
