import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from '../config/db.js';
import { uploadDirectory } from '../middleware/upload.js';

async function migrateStoredFile(memberId, fieldLabel, value) {
  if (typeof value !== 'string' || !fieldLabel || fieldLabel.length > 120) return;
  const storedName = path.basename(value);
  if (storedName !== value) return;
  const extension = path.extname(storedName).toLowerCase();
  const mimeType = ({ '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' })[extension];
  if (!mimeType) return;
  try {
    const stats = await fs.stat(path.join(uploadDirectory, storedName));
    if (!stats.isFile()) return;
    await db.query(
      `INSERT IGNORE INTO registration_documents
        (member_id,field_label,stored_name,original_name,mime_type,size_bytes)
       VALUES (?,?,?,?,?,?)`,
      [memberId, fieldLabel, storedName, storedName, mimeType, stats.size]
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export const DocumentModel = {
  async ensureTable() {
    await db.query(`CREATE TABLE IF NOT EXISTS registration_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      field_label VARCHAR(120) NOT NULL,
      stored_name VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes INT UNSIGNED NOT NULL DEFAULT 0,
      review_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      review_note VARCHAR(500),
      reviewed_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY member_document_label (member_id, field_label)
    )`);
    const [members] = await db.query('SELECT id,photo,data FROM members');
    for (const member of members) {
      await migrateStoredFile(member.id, 'Photo', member.photo);
      let data = member.data;
      if (typeof data === 'string') data = JSON.parse(data || '{}');
      for (const [fieldLabel, value] of Object.entries(data || {})) {
        await migrateStoredFile(member.id, fieldLabel, value);
      }
    }
  },

  async createMany(conn, memberId, documents) {
    for (const document of documents) {
      await conn.query(
        `INSERT INTO registration_documents
          (member_id,field_label,stored_name,original_name,mime_type,size_bytes)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE stored_name=VALUES(stored_name),original_name=VALUES(original_name),
           mime_type=VALUES(mime_type),size_bytes=VALUES(size_bytes),review_status='pending',review_note=NULL,reviewed_at=NULL`,
        [memberId, document.fieldLabel, document.storedName, document.originalName, document.mimeType, document.sizeBytes]
      );
    }
  },

  async listByMember(memberId) {
    const [rows] = await db.query(
      `SELECT id,member_id,field_label,stored_name,original_name,mime_type,size_bytes,
              review_status,review_note,reviewed_at,created_at
       FROM registration_documents WHERE member_id=? ORDER BY id`,
      [memberId]
    );
    return rows;
  },

  async findById(id) {
    const [[row]] = await db.query('SELECT * FROM registration_documents WHERE id=?', [id]);
    return row;
  },

  async review(memberId, documentId, status, note) {
    const [result] = await db.query(
      `UPDATE registration_documents SET review_status=?,review_note=?,reviewed_at=CURRENT_TIMESTAMP
       WHERE id=? AND member_id=?`,
      [status, note || null, documentId, memberId]
    );
    return result.affectedRows > 0;
  }
};
