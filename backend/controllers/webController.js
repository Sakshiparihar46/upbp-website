import { MemberModel } from '../models/memberModel.js';
import { PaymentModel } from '../models/paymentModel.js';
import { ROLES } from '../config/constants.js';
import { WEIGHTS } from '../config/formConfig.js';
import { FormConfigModel } from '../models/formConfigModel.js';
import { httpError } from '../middleware/errorHandler.js';

export async function home(req, res) {
  const roles = await FormConfigModel.getRoles();
  const role = ROLES[req.query.role] ? req.query.role : 'Boxer';
  res.render('register', { role, roles, config: roles[role], weights: WEIGHTS, error: null });
}

export async function registerWeb(req, res) {
  try {
    const role = req.body.role;
    if (!ROLES[role]) throw httpError(400, 'Invalid role');
    const fields = JSON.parse(req.body.fields || '{}');
    const edu = JSON.parse(req.body.edu || '[]').filter(r => r.degree || r.board || r.year);
    const ach = JSON.parse(req.body.ach || '[]').filter(Boolean);
    if (!fields['First Name'] || !fields['Last Name']) throw httpError(400, 'First Name and Last Name are required');
    if (!/^[6-9]\d{9}$/.test(fields['Mobile Number'] || '')) throw httpError(400, 'Enter a valid 10-digit mobile number');
    const CORE_COLUMNS = { 'Title':'title','First Name':'first_name','Last Name':'last_name','Gender':'gender','Date of Birth':'dob','Personal Email':'email','Mobile Number':'mobile','Address':'address' };
    const core = {}, extra = {};
    for (const [label, value] of Object.entries(fields)) (CORE_COLUMNS[label] ? core[CORE_COLUMNS[label]] = value : extra[label] = value);
    let photo = null;
    const documents = [];
    for (const file of req.files || []) {
      if (file.fieldname === 'photo') photo = file.filename;
      const fieldLabel = file.fieldname === 'photo' ? 'Photo' : file.fieldname;
      if (fieldLabel !== 'Photo') extra[fieldLabel] = file.originalname;
      documents.push({
        fieldLabel,
        storedName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size
      });
    }
    const created = await MemberModel.create({ role, core, extra, photo, edu, ach, documents });
    res.redirect(`/payment/${created.id}`);
  } catch (err) {
    const roles = await FormConfigModel.getRoles();
    const role = req.body?.role && roles[req.body.role] ? req.body.role : 'Boxer';
    res.status(err.status || 500).render('register', { role, roles, config: roles[role], weights: WEIGHTS, error: err.message || 'Registration failed' });
  }
}

export async function paymentPage(req, res) {
  const member = await MemberModel.findById(req.params.memberId);
  if (!member) return res.status(404).render('error', { message: 'Member not found' });
  res.render('payment', { member, fee: ROLES[member.role]?.fee || 0 });
}

export async function receiptPage(req, res) {
  const receipt = await PaymentModel.findReceipt(req.params.memberId);
  if (!receipt) return res.status(404).render('error', { message: 'No receipt yet. Payment may not be completed.' });
  res.render('receipt', { receipt });
}
