// Entry point: DB check karke server start karta hai
import 'dotenv/config';
import app from './app.js';
import { db } from './config/db.js';
import { FormConfigModel } from './models/formConfigModel.js';
import { DocumentModel } from './models/documentModel.js';

const PORT = process.env.PORT || 5000;

try {
  await db.query('SELECT 1');
  await FormConfigModel.ensureTable();
  await DocumentModel.ensureTable();
  console.log('✅ MySQL connected');
} catch (err) {
  console.error('❌ MySQL connection failed:', err.message);
}

app.listen(PORT, () => console.log(`API running on port ${PORT}`));