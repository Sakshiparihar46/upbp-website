// Members ka saara SQL yahin hai
import { db } from '../config/db.js';
import { ROLES, CORE_COLUMNS } from '../config/constants.js';
import { DocumentModel } from './documentModel.js';

function parseData(value) {
  if (!value) return {};
  return typeof value === 'string' ? JSON.parse(value) : value;
}

export const MemberModel = {
  // Member + education + achievements ek transaction me save karta hai
  async create({ role, core, extra, photo, edu, ach, documents = [] }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO members (role,title,first_name,last_name,gender,dob,email,mobile,address,photo,data)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [role, core.title, core.first_name, core.last_name, core.gender, core.dob || null,
         core.email, core.mobile, core.address, photo, JSON.stringify(extra)]
      );
      const id = result.insertId;
      const regNo = ROLES[role].prefix + String(id).padStart(4, '0');
      await conn.query('UPDATE members SET reg_no=? WHERE id=?', [regNo, id]);

      for (const e of edu)
        await conn.query('INSERT INTO education (member_id,degree,board,year) VALUES (?,?,?,?)', [id, e.degree, e.board, e.year]);
      for (const text of ach)
        await conn.query('INSERT INTO achievements (member_id,text) VALUES (?,?)', [id, text]);
      await DocumentModel.createMany(conn, id, documents);

      await conn.commit();
      return { id, reg_no: regNo, fee: ROLES[role].fee };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async findById(id) {
    const [[row]] = await db.query('SELECT * FROM members WHERE id=?', [id]);
    return row;
  },

  async list(role) {
    const [rows] = await db.query(
      `SELECT id,reg_no,role,first_name,last_name,mobile,status,created_at
       FROM members WHERE (? IS NULL OR role=?) ORDER BY id DESC LIMIT 200`,
      [role || null, role || null]
    );
    return rows;
  },

  async adminList({ search = '', role = '', status = '' } = {}) {
    const term = `%${search}%`;
    const [rows] = await db.query(
      `SELECT m.id,m.reg_no,m.role,m.first_name,m.last_name,m.mobile,m.email,m.status,m.created_at,
              p.amount,p.receipt_no,p.gateway_ref,p.paid_at
       FROM members m
       LEFT JOIN payments p ON p.id=(SELECT MAX(p2.id) FROM payments p2 WHERE p2.member_id=m.id)
       WHERE (?='' OR m.reg_no LIKE ? OR m.first_name LIKE ? OR m.last_name LIKE ? OR m.mobile LIKE ? OR m.email LIKE ?)
         AND (?='' OR m.role=?) AND (?='' OR m.status=?)
       ORDER BY m.id DESC LIMIT 500`,
      [search, term, term, term, term, term, role, role, status, status]
    );
    return rows;
  },

  async adminFindById(id) {
    const [[member]] = await db.query('SELECT * FROM members WHERE id=?', [id]);
    if (!member) return null;
    const [[payment]] = await db.query('SELECT * FROM payments WHERE member_id=? ORDER BY id DESC LIMIT 1', [id]);
    const [education] = await db.query('SELECT degree,board,year FROM education WHERE member_id=? ORDER BY id', [id]);
    const [achievements] = await db.query('SELECT text FROM achievements WHERE member_id=? ORDER BY id', [id]);
    const documents = await DocumentModel.listByMember(id);
    return {
      ...member,
      data: parseData(member.data),
      payment: payment || null,
      documents,
      education,
      achievements: achievements.map(row => row.text)
    };
  },

  async adminDelete(id) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [[member]] = await conn.query('SELECT id,photo FROM members WHERE id=? FOR UPDATE', [id]);
      if (!member) {
        await conn.rollback();
        return null;
      }
      const [documents] = await conn.query('SELECT stored_name FROM registration_documents WHERE member_id=? FOR UPDATE', [id]);
      const storedNames = [...new Set([member.photo, ...documents.map(document => document.stored_name)].filter(Boolean))];
      await conn.query('DELETE FROM payments WHERE member_id=?', [id]);
      await conn.query('DELETE FROM registration_documents WHERE member_id=?', [id]);
      await conn.query('DELETE FROM members WHERE id=?', [id]);

      let remainingNames = [];
      if (storedNames.length) {
        const placeholders = storedNames.map(() => '?').join(',');
        const [references] = await conn.query(
          `SELECT stored_name FROM registration_documents WHERE stored_name IN (${placeholders})
           UNION SELECT photo AS stored_name FROM members WHERE photo IN (${placeholders})`,
          [...storedNames, ...storedNames]
        );
        remainingNames = references.map(row => row.stored_name);
      }

      await conn.commit();
      return storedNames.filter(name => !remainingNames.includes(name));
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  async updateAdmin(id, { fields, education, achievements, documents = [] }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [[member]] = await conn.query('SELECT data FROM members WHERE id=? FOR UPDATE', [id]);
      if (!member) {
        await conn.rollback();
        return false;
      }

      const updates = [];
      const values = [];
      const extra = { ...parseData(member.data) };
      const photo = documents.find(document => document.fieldLabel === 'Photo');
      if (photo) {
        updates.push('photo=?');
        values.push(photo.storedName);
      }
      for (const document of documents) {
        if (document.fieldLabel !== 'Photo') extra[document.fieldLabel] = document.originalName;
      }
      for (const [label, value] of Object.entries(fields)) {
        const column = CORE_COLUMNS[label];
        if (column) {
          updates.push(`${column}=?`);
          values.push(value || null);
          delete extra[label];
        } else {
          extra[label] = value;
        }
      }
      updates.push('data=?');
      values.push(JSON.stringify(extra), id);
      await conn.query(`UPDATE members SET ${updates.join(',')} WHERE id=?`, values);
      await DocumentModel.createMany(conn, id, documents);

      if (Array.isArray(education)) {
        await conn.query('DELETE FROM education WHERE member_id=?', [id]);
        for (const row of education) {
          if (row.degree || row.board || row.year) {
            await conn.query('INSERT INTO education (member_id,degree,board,year) VALUES (?,?,?,?)', [id, row.degree || null, row.board || null, row.year || null]);
          }
        }
      }
      if (Array.isArray(achievements)) {
        await conn.query('DELETE FROM achievements WHERE member_id=?', [id]);
        for (const text of achievements.filter(Boolean)) {
          await conn.query('INSERT INTO achievements (member_id,text) VALUES (?,?)', [id, text]);
        }
      }

      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async markPaid(id) {
    await db.query("UPDATE members SET status='paid' WHERE id=?", [id]);
  }
};
