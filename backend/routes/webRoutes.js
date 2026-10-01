import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { home, registerWeb, paymentPage, receiptPage } from '../controllers/webController.js';

const router = Router();
router.get('/', asyncHandler(home));
router.post('/register', upload.any(), asyncHandler(registerWeb));
router.get('/payment/:memberId', asyncHandler(paymentPage));
router.get('/receipt/:memberId', asyncHandler(receiptPage));
export default router;
