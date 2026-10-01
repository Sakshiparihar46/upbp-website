import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { MemberModel } from '../models/memberModel.js';
import { PaymentModel } from '../models/paymentModel.js';
import { ROLES } from '../config/constants.js';
import { httpError } from '../middleware/errorHandler.js';

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw httpError(503, 'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env');
  }
  return { client: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId, keySecret };
}

export async function createOrder(req, res) {
  const { client, keyId } = getRazorpay();
  const member = await MemberModel.findById(req.params.memberId);
  if (!member) throw httpError(404, 'Member not found');
  if (member.status === 'paid') throw httpError(409, 'Already paid');

  const amount = ROLES[member.role].fee * 100;
  const order = await client.orders.create({
    amount,
    currency: 'INR',
    receipt: `UPBA_${member.id}_${Date.now()}`,
    notes: { member_id: String(member.id) }
  });

  res.json({
    key_id: keyId,
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    member_name: `${member.first_name} ${member.last_name}`,
    member_email: member.email,
    member_mobile: member.mobile
  });
}

export async function verifyPayment(req, res) {
  const { client, keySecret } = getRazorpay();
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (!orderId || !paymentId || !signature) throw httpError(400, 'Incomplete payment details');

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  if (signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw httpError(400, 'Invalid payment signature');
  }

  const member = await MemberModel.findById(req.params.memberId);
  if (!member) throw httpError(404, 'Member not found');
  if (member.status === 'paid') throw httpError(409, 'Already paid');

  const order = await client.orders.fetch(orderId);
  const expectedAmount = ROLES[member.role].fee * 100;
  if (String(order.notes?.member_id) !== String(member.id) || order.amount !== expectedAmount) {
    throw httpError(400, 'Payment does not match this registration');
  }

  const payment = await client.payments.fetch(paymentId);
  if (payment.order_id !== orderId || payment.status !== 'captured' || payment.amount !== expectedAmount) {
    throw httpError(400, 'Payment was not captured');
  }

  const receiptNo = 'UPBA' + new Date().getFullYear() + String(member.id).padStart(5, '0');
  await PaymentModel.create({
    memberId: member.id,
    amount: expectedAmount / 100,
    receiptNo,
    gatewayRef: paymentId
  });
  await MemberModel.markPaid(member.id);
  res.json({ receipt_no: receiptNo });
}

export async function getReceipt(req, res) {
  const receipt = await PaymentModel.findReceipt(req.params.memberId);
  if (!receipt) throw httpError(404, 'No receipt yet');
  res.json(receipt);
}
