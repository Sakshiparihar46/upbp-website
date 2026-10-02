// Payments ka SQL
import { db } from '../config/db.js';

export const PaymentModel = {
  async adminUpdate(memberId, { status, amount, receiptNo, gatewayRef, paidAt }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [[member]] = await conn.query('SELECT id,status FROM members WHERE id=? FOR UPDATE', [memberId]);
      if (!member) {
        await conn.rollback();
        return false;
      }
      if (member.status === 'paid' && status === 'pending') {
        const error = new Error('Paid registrations cannot be changed back to pending');
        error.code = 'PAYMENT_STATUS_CONFLICT';
        throw error;
      }

      const [[payment]] = await conn.query('SELECT id FROM payments WHERE member_id=? ORDER BY id DESC LIMIT 1 FOR UPDATE', [memberId]);
      if (status === 'paid') {
        if (payment) {
          await conn.query(
            'UPDATE payments SET amount=?,receipt_no=?,gateway_ref=?,paid_at=COALESCE(?,paid_at) WHERE id=?',
            [amount, receiptNo, gatewayRef || null, paidAt || null, payment.id]
          );
        } else {
          await conn.query(
            'INSERT INTO payments (member_id,amount,receipt_no,gateway_ref,paid_at) VALUES (?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP))',
            [memberId, amount, receiptNo, gatewayRef || null, paidAt || null]
          );
        }
      }
      await conn.query('UPDATE members SET status=? WHERE id=?', [status, memberId]);
      await conn.commit();
      return true;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  async create({ memberId, amount, receiptNo, gatewayRef }) {
    await db.query(
      'INSERT INTO payments (member_id,amount,receipt_no,gateway_ref) VALUES (?,?,?,?)',
      [memberId, amount, receiptNo, gatewayRef]
    );
  },

  async findReceipt(memberId) {
    const [[row]] = await db.query(
      `SELECT m.reg_no,m.role,m.title,m.first_name,m.last_name,p.amount,p.receipt_no,p.paid_at
       FROM members m JOIN payments p ON p.member_id=m.id WHERE m.id=?`,
      [memberId]
    );
    return row;
  }
};
