import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { login, logout, requireAdmin } from '../middleware/adminAuth.js';
import { upload } from '../middleware/upload.js';
import { adminPage, loginPage, listRegistrations, deleteRegistration, listPayments, updatePayment, registrationDetails, updateRegistration, documentContent, reviewDocument, listForms, saveForm } from '../controllers/adminController.js';

export const adminPageRoutes = Router();
adminPageRoutes.get('/login', loginPage);
adminPageRoutes.post('/login', login);
adminPageRoutes.use(requireAdmin);
adminPageRoutes.get('/', adminPage);
adminPageRoutes.post('/logout', logout);

export const adminApiRoutes = Router();
adminApiRoutes.use(requireAdmin);
adminApiRoutes.get('/registrations', asyncHandler(listRegistrations));
adminApiRoutes.delete('/registrations/:id', asyncHandler(deleteRegistration));
adminApiRoutes.get('/registrations/:id', asyncHandler(registrationDetails));
adminApiRoutes.put('/registrations/:id', upload.any(), asyncHandler(updateRegistration));
adminApiRoutes.get('/documents/:documentId/content', asyncHandler(documentContent));
adminApiRoutes.patch('/registrations/:id/documents/:documentId', asyncHandler(reviewDocument));
adminApiRoutes.get('/payments', asyncHandler(listPayments));
adminApiRoutes.patch('/payments/:memberId', asyncHandler(updatePayment));
adminApiRoutes.get('/forms', asyncHandler(listForms));
adminApiRoutes.put('/forms/:role', asyncHandler(saveForm));
