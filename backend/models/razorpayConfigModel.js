import crypto from 'node:crypto';
import { db } from '../config/db.js';

function encryptionKey() {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error('Admin session secret must be configured to protect payment credentials');
  }
  return crypto.createHmac('sha256', sessionSecret).update('upba-razorpay-credentials').digest();
}

function encrypt(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

function decrypt(row) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.secret_iv, 'base64'));
    decipher.setAuthTag(Buffer.from(row.secret_auth_tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(row.secret_ciphertext, 'base64')),
      decipher.final()
    ]).toString('utf8');
  } catch {
    throw new Error('Saved Razorpay credentials could not be decrypted. Re-save them in the admin payment settings.');
  }
}

export const RazorpayConfigModel = {
  async ensureTable() {
    await db.query(`CREATE TABLE IF NOT EXISTS razorpay_config (
      id TINYINT UNSIGNED PRIMARY KEY,
      key_id VARCHAR(100) NOT NULL,
      secret_iv VARCHAR(24) NOT NULL,
      secret_auth_tag VARCHAR(24) NOT NULL,
      secret_ciphertext TEXT NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    try {
      await db.query('ALTER TABLE razorpay_config ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1');
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  },

  async getSaved() {
    const [[row]] = await db.query(
      'SELECT key_id,secret_iv,secret_auth_tag,secret_ciphertext,enabled FROM razorpay_config WHERE id=1'
    );
    if (!row) return null;
    if (!row.enabled) return { disabled: true };
    return { keyId: row.key_id, keySecret: decrypt(row) };
  },

  async getCredentials() {
    const saved = await this.getSaved();
    if (saved) return saved.disabled ? null : saved;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    return keyId && keySecret ? { keyId, keySecret } : null;
  },

  async save({ keyId, keySecret }) {
    const encrypted = encrypt(keySecret);
    await db.query(
      `INSERT INTO razorpay_config (id,key_id,secret_iv,secret_auth_tag,secret_ciphertext,enabled)
       VALUES (1,?,?,?,?,1)
       ON DUPLICATE KEY UPDATE key_id=VALUES(key_id),secret_iv=VALUES(secret_iv),
         secret_auth_tag=VALUES(secret_auth_tag),secret_ciphertext=VALUES(secret_ciphertext),enabled=1`,
      [keyId, encrypted.iv, encrypted.authTag, encrypted.ciphertext]
    );
  },

  async clear() {
    await db.query(
      `INSERT INTO razorpay_config (id,key_id,secret_iv,secret_auth_tag,secret_ciphertext,enabled)
       VALUES (1,'','','','',0)
       ON DUPLICATE KEY UPDATE key_id='',secret_iv='',secret_auth_tag='',
         secret_ciphertext='',enabled=0`
    );
  }
};
