import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createOrder, verifyPayment, getReceipt } from '../controllers/paymentController.js';

const router = Router();
router.post('/:memberId/order', asyncHandler(createOrder));
router.post('/:memberId/verify', asyncHandler(verifyPayment));
router.get('/:memberId/receipt', asyncHandler(getReceipt)); // GET /api/payments/12/receipt
export default router;
