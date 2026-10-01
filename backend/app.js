import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webRoutes from './routes/webRoutes.js';
import memberRoutes from './routes/memberRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { adminApiRoutes, adminPageRoutes } from './routes/adminRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/', webRoutes);
app.use('/admin', adminPageRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminApiRoutes);
app.use(errorHandler);

export default app;
