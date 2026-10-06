import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db } from '../config/db.js';

const scrypt = promisify(crypto.scrypt);
const PASSWORD_HASH_BYTES = 64;

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

async function hashPassword(password, salt = crypto.randomBytes(16)) {
  const hash = await scrypt(password, salt, PASSWORD_HASH_BYTES);
  return { salt, hash };
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function verifyPassword(password, account) {
  const { hash } = await hashPassword(password, account.password_salt);
  return secureEqual(hash, account.password_hash);
}

export const AdminAccountModel = {
  async ensureTables() {
    await db.query(`CREATE TABLE IF NOT EXISTS admin_accounts (
      id TINYINT UNSIGNED PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_salt VARBINARY(16) NOT NULL,
      password_hash VARBINARY(64) NOT NULL,
      session_version INT UNSIGNED NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await db.query(`CREATE TABLE IF NOT EXISTS admin_setup_tokens (
      id TINYINT UNSIGNED PRIMARY KEY,
      token_hash CHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  },

  async initialize() {
    const [[account]] = await db.query('SELECT id FROM admin_accounts WHERE id=1');
    if (account) return null;

    const legacyUsername = process.env.ADMIN_USERNAME;
    const legacyPassword = process.env.ADMIN_PASSWORD;
    if (legacyUsername && legacyPassword && /^[a-zA-Z0-9._-]{3,50}$/.test(legacyUsername)) {
      const username = normalizeUsername(legacyUsername);
      const { salt, hash } = await hashPassword(legacyPassword);
      await db.query(
        'INSERT INTO admin_accounts (id,username,password_salt,password_hash) VALUES (1,?,?,?)',
        [username, salt, hash]
      );
      await db.query('DELETE FROM admin_setup_tokens WHERE id=1');
      return { migrated: true };
    }

    const setupToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(setupToken).digest('hex');
    await db.query(
      `INSERT INTO admin_setup_tokens (id,token_hash) VALUES (1,?)
       ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash)`,
      [tokenHash]
    );
    return { setupToken };
  },

  async hasAccount() {
    const [[account]] = await db.query('SELECT id FROM admin_accounts WHERE id=1');
    return Boolean(account);
  },

  async getByUsername(username) {
    const [[account]] = await db.query(
      'SELECT id,username,password_salt,password_hash,session_version FROM admin_accounts WHERE id=1 AND username=?',
      [normalizeUsername(username)]
    );
    return account || null;
  },

  async getById(id) {
    const [[account]] = await db.query(
      'SELECT id,username,password_salt,password_hash,session_version FROM admin_accounts WHERE id=?',
      [id]
    );
    return account || null;
  },

  async authenticate(username, password) {
    const account = await this.getByUsername(username);
    if (!account || !await verifyPassword(password, account)) return null;
    return account;
  },

  async createFirstAdmin({ setupToken, username, password }) {
    const { salt, hash } = await hashPassword(password);
    const suppliedTokenHash = crypto.createHash('sha256').update(setupToken).digest('hex');
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [[savedToken]] = await connection.query(
        'SELECT token_hash FROM admin_setup_tokens WHERE id=1 FOR UPDATE'
      );
      const [[existingAdmin]] = await connection.query(
        'SELECT id FROM admin_accounts WHERE id=1 FOR UPDATE'
      );
      if (existingAdmin || !savedToken || !secureEqual(suppliedTokenHash, savedToken.token_hash)) {
        await connection.rollback();
        return null;
      }
      await connection.query(
        'INSERT INTO admin_accounts (id,username,password_salt,password_hash) VALUES (1,?,?,?)',
        [normalizeUsername(username), salt, hash]
      );
      await connection.query('DELETE FROM admin_setup_tokens WHERE id=1');
      await connection.commit();
      return { id: 1, username: normalizeUsername(username), session_version: 1 };
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') return null;
      throw error;
    } finally {
      connection.release();
    }
  },

  async changeCredentials({ account, currentPassword, username, password }) {
    if (!await verifyPassword(currentPassword, account)) return false;
    const { salt, hash } = await hashPassword(password);
    const [result] = await db.query(
      `UPDATE admin_accounts SET username=?,password_salt=?,password_hash=?,
       session_version=session_version+1 WHERE id=1 AND password_hash=? AND session_version=?`,
      [normalizeUsername(username), salt, hash, account.password_hash, account.session_version]
    );
    return result.affectedRows === 1;
  }
};
