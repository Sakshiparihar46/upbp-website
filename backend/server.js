// Entry point: DB check karke server start karta hai
import 'dotenv/config';
import app from './app.js';
import { db } from './config/db.js';
import { CoreSchemaModel } from './models/coreSchemaModel.js';
import { FormConfigModel } from './models/formConfigModel.js';
import { DocumentModel } from './models/documentModel.js';
import { RazorpayConfigModel } from './models/razorpayConfigModel.js';
import { AdminAccountModel } from './models/adminAccountModel.js';

const PORT = process.env.PORT || 5000;

try {
  await db.query('SELECT 1');
  await CoreSchemaModel.ensureTables();
  await FormConfigModel.ensureTable();
  await DocumentModel.ensureTable();
  await RazorpayConfigModel.ensureTable();
  await AdminAccountModel.ensureTables();
  const adminSetup = await AdminAccountModel.initialize();
  if (adminSetup?.setupToken) {
    console.warn(`⚠️ Initial admin setup is required. Open /admin/login and use this one-time setup code: ${adminSetup.setupToken}`);
    console.warn('Keep this code private. Restarting the server before setup generates a new code.');
  } else if (adminSetup?.migrated) {
    console.log('✅ Existing admin credentials migrated from environment to the database');
  }
  console.log('✅ MySQL connected');
} catch (err) {
  console.error('❌ MySQL connection failed:', err.message);
  process.exit(1);
}

app.listen(PORT, () => console.log(`API running on port ${PORT}`));