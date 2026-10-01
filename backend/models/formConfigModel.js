import { db } from '../config/db.js';
import { ROLES as DEFAULT_ROLES } from '../config/formConfig.js';

function parseConfig(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

export const FormConfigModel = {
  async ensureTable() {
    await db.query(`CREATE TABLE IF NOT EXISTS form_configs (
      role VARCHAR(80) PRIMARY KEY,
      config JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
  },

  async getRoles() {
    const roles = structuredClone(DEFAULT_ROLES);
    const [rows] = await db.query('SELECT role,config FROM form_configs');
    for (const row of rows) {
      if (!roles[row.role]) continue;
      const saved = parseConfig(row.config);
      roles[row.role] = { ...roles[row.role], ...saved };
    }
    return roles;
  },

  async save(role, config) {
    await db.query(
      `INSERT INTO form_configs (role,config) VALUES (?,?)
       ON DUPLICATE KEY UPDATE config=VALUES(config)`,
      [role, JSON.stringify(config)]
    );
  }
};
