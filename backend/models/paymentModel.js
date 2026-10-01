// Payments ka SQL
import { db } from '../config/db.js';

export const PaymentModel = {
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
