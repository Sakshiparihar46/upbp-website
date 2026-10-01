// Request lekar validate karta hai, Model ko call karta hai, response bhejta hai
import { MemberModel } from '../models/memberModel.js';
import { ROLES, CORE_COLUMNS } from '../config/constants.js';
import { httpError } from '../middleware/errorHandler.js';

export async function register(req, res) {
  const { role } = req.body;
  if (!ROLES[role]) throw httpError(400, 'Invalid role');

  const fields = JSON.parse(req.body.fields || '{}');
  const edu = JSON.parse(req.body.edu || '[]').filter(r => r.degree);
  const ach = JSON.parse(req.body.ach || '[]').filter(Boolean);

  if (!fields['First Name'] || !fields['Last Name']) throw httpError(400, 'Name is required');
  if (!/^[6-9]\d{9}$/.test(fields['Mobile Number'] || '')) throw httpError(400, 'Enter a valid 10-digit mobile number');

  // Fields ko "core columns" aur "extra (JSON)" me baantna
  const core = {}, extra = {};
  for (const [label, value] of Object.entries(fields)) {
    if (CORE_COLUMNS[label]) core[CORE_COLUMNS[label]] = value;
    else extra[label] = value;
  }

  // Uploaded files: photo alag, baaki extra me
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
  res.status(201).json(created);
}

export async function listMembers(req, res) {
  res.json(await MemberModel.list(req.query.role));
}
