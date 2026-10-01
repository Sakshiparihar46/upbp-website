import fs from 'node:fs/promises';
import path from 'node:path';
import { MemberModel } from '../models/memberModel.js';
import { DocumentModel } from '../models/documentModel.js';
import { FormConfigModel } from '../models/formConfigModel.js';
import { ROLES as ROLE_META, CORE_COLUMNS } from '../config/constants.js';
import { ROLES as DEFAULT_FORMS } from '../config/formConfig.js';
import { uploadDirectory } from '../middleware/upload.js';
import { httpError } from '../middleware/errorHandler.js';

const FIELD_TYPES = new Set(['t', 'e', 'tel', 'd', 'n', 'sel', 'ta', 'file']);

export function loginPage(req, res) {
  res.render('admin-login', { error: null });
}

export function adminPage(req, res) {
  res.render('admin');
}

export async function listRegistrations(req, res) {
  const search = String(req.query.search || '').trim().slice(0, 120);
  const role = String(req.query.role || '');
  const status = String(req.query.status || '');
  if (role && !ROLE_META[role]) throw httpError(400, 'Invalid role filter');
  if (status && !['pending', 'paid'].includes(status)) throw httpError(400, 'Invalid payment filter');
  res.json(await MemberModel.adminList({ search, role, status }));
}

export async function listPayments(req, res) {
  const status = String(req.query.status || '');
  const search = String(req.query.search || '').trim().slice(0, 120);
  if (status && !['pending', 'paid'].includes(status)) throw httpError(400, 'Invalid payment filter');
  const rows = await MemberModel.adminList({ search, status });
  res.json(rows.map(row => ({
    id: row.id,
    reg_no: row.reg_no,
    name: `${row.first_name} ${row.last_name}`.trim(),
    role: row.role,
    status: row.status,
    amount: row.amount,
    receipt_no: row.receipt_no,
    gateway_ref: row.gateway_ref,
    paid_at: row.paid_at
  })));
}

function dateInput(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
}

export async function registrationDetails(req, res) {
  const member = await MemberModel.adminFindById(req.params.id);
  if (!member) throw httpError(404, 'Registration not found');
  const fields = { ...member.data };
  for (const [label, column] of Object.entries(CORE_COLUMNS)) {
    fields[label] = column === 'dob' ? dateInput(member[column]) : member[column] ?? '';
  }
  const config = (await FormConfigModel.getRoles())[member.role];
  const fileLabels = ['Photo', ...config.sections.flatMap(section => Array.isArray(section[1]) ? section[1] : [])
    .filter(field => field[1] === 'file').map(field => field[0])];
  const actualLabels = new Set(member.documents.map(document => document.field_label));
  const legacyDocuments = fileLabels.filter(label => member.data[label] && !actualLabels.has(label)).map(label => ({
    field_label: label,
    original_name: member.data[label],
    review_status: 'unavailable',
    unavailable: true
  }));
  const documentLabels = new Set([...actualLabels, ...legacyDocuments.map(document => document.field_label)]);
  const emptyDocuments = fileLabels.filter(label => !documentLabels.has(label)).map(field_label => ({
    field_label,
    original_name: 'No file uploaded',
    empty: true
  }));
  const { data, ...details } = member;
  res.json({ member: details, fields, fileLabels, documents: [...member.documents, ...legacyDocuments, ...emptyDocuments] });
}

export async function documentContent(req, res, next) {
  const document = await DocumentModel.findById(req.params.documentId);
  if (!document) throw httpError(404, 'Document not found');
  const filename = path.basename(document.stored_name);
  const filePath = path.resolve(uploadDirectory, filename);
  if (path.dirname(filePath) !== uploadDirectory) throw httpError(404, 'Document not found');
  try {
    await fs.access(filePath);
  } catch {
    throw httpError(404, 'Uploaded file is missing from storage');
  }
  const contentType = ({ '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' })[path.extname(filename).toLowerCase()];
  if (!contentType) throw httpError(415, 'Unsupported document type');
  const originalName = encodeURIComponent(document.original_name).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  res.set({
    'Content-Type': contentType,
    'Content-Disposition': `inline; filename*=UTF-8''${originalName}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.sendFile(filePath, error => { if (error) next(error); });
}

export async function reviewDocument(req, res) {
  const { status, note = '' } = req.body || {};
  if (!['pending', 'approved', 'rejected'].includes(status)) throw httpError(400, 'Invalid document review status');
  if (typeof note !== 'string' || note.length > 500) throw httpError(400, 'Review note must be 500 characters or fewer');
  const updated = await DocumentModel.review(req.params.id, req.params.documentId, status, note.trim());
  if (!updated) throw httpError(404, 'Document not found for this registration');
  res.json({ success: true });
}

function validateEdit(body) {
  const { fields, education, achievements } = body || {};
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw httpError(400, 'Registration fields are required');
  if (Object.keys(fields).length > 120 || Object.entries(fields).some(([key, value]) =>
    !key.trim() || key.length > 100 || typeof value !== 'string' || value.length > 5000
  )) throw httpError(400, 'Invalid registration fields');
  if (!fields['First Name']?.trim() || !fields['Last Name']?.trim()) throw httpError(400, 'First and last name are required');
  if (!/^[6-9]\d{9}$/.test(fields['Mobile Number'] || '')) throw httpError(400, 'Enter a valid 10-digit mobile number');
  if (fields['Personal Email'] && !/^\S+@\S+\.\S+$/.test(fields['Personal Email'])) throw httpError(400, 'Enter a valid email address');
  if (education !== undefined && (!Array.isArray(education) || education.length > 30 || education.some(row =>
    !row || typeof row !== 'object' || ['degree', 'board', 'year'].some(key => row[key] !== undefined && (typeof row[key] !== 'string' || row[key].length > 120))
  ))) throw httpError(400, 'Invalid education details');
  if (achievements !== undefined && (!Array.isArray(achievements) || achievements.length > 50 || achievements.some(text => typeof text !== 'string' || text.length > 255))) {
    throw httpError(400, 'Invalid achievements');
  }
  return { fields, education, achievements };
}

export async function updateRegistration(req, res) {
  let fields = req.body.fields;
  let education = req.body.education;
  let achievements = req.body.achievements;
  try {
    if (typeof fields === 'string') fields = JSON.parse(fields);
    if (typeof education === 'string') education = JSON.parse(education);
    if (typeof achievements === 'string') achievements = JSON.parse(achievements);
  } catch {
    throw httpError(400, 'Invalid registration data');
  }
  const input = validateEdit({ fields, education, achievements });
  const member = await MemberModel.adminFindById(req.params.id);
  if (!member) throw httpError(404, 'Registration not found');
  const config = (await FormConfigModel.getRoles())[member.role];
  const allowedLabels = new Set(['Photo', ...config.sections.flatMap(section => Array.isArray(section[1]) ? section[1] : [])
    .filter(field => field[1] === 'file').map(field => field[0])]);
  const documents = (req.files || []).map(file => {
    const fieldLabel = file.fieldname.startsWith('document:') ? file.fieldname.slice('document:'.length) : '';
    if (!allowedLabels.has(fieldLabel)) throw httpError(400, 'File field is not valid for this registration');
    return {
      fieldLabel,
      storedName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size
    };
  });
  if (new Set(documents.map(document => document.fieldLabel)).size !== documents.length) {
    throw httpError(400, 'Upload only one file per field');
  }
  const updated = await MemberModel.updateAdmin(req.params.id, { ...input, documents });
  if (!updated) throw httpError(404, 'Registration not found');
  res.json({ success: true });
}

export async function listForms(req, res) {
  res.json(await FormConfigModel.getRoles());
}

function allFields(sections) {
  return sections.flatMap(section => Array.isArray(section[1]) ? section[1] : []);
}

function validateForm(role, input) {
  if (!input || typeof input.title !== 'string' || input.title.trim().length < 3 || input.title.length > 100 || !Array.isArray(input.sections) || input.sections.length > 30) {
    throw httpError(400, 'Invalid form title or sections');
  }
  const baseline = DEFAULT_FORMS[role];
  const fields = [];
  const sections = input.sections.map(section => {
    if (!Array.isArray(section) || typeof section[0] !== 'string' || !section[0].trim() || section[0].length > 100) {
      throw httpError(400, 'Every section needs a title');
    }
    if (section[1] === 'edu' || section[1] === 'ach') return [section[0].trim(), section[1]];
    if (!Array.isArray(section[1]) || section[1].length > 100) throw httpError(400, 'Invalid section fields');
    const sectionFields = section[1].map(field => {
      if (!Array.isArray(field) || typeof field[0] !== 'string' || !field[0].trim() || field[0].length > 100 || !FIELD_TYPES.has(field[1])) {
        throw httpError(400, 'Invalid field definition');
      }
      const options = field[2] || [];
      if (!Array.isArray(options) || options.length > 100 || options.some(option => typeof option !== 'string' || !option.trim() || option.length > 120)) {
        throw httpError(400, `Invalid options for ${field[0]}`);
      }
      const special = field[5] || '';
      if (special && !['cat', 'wc'].includes(special)) throw httpError(400, 'Invalid dynamic field type');
      if (special && field[1] !== 'sel') throw httpError(400, 'Dynamic fields must remain dropdowns');
      if (field[1] === 'sel' && !options.length && special !== 'wc') throw httpError(400, `Add at least one option for ${field[0]}`);
      const normalized = [field[0].trim(), field[1], options.map(option => option.trim()), Boolean(field[3]), Boolean(field[4]), special];
      fields.push(normalized);
      return normalized;
    });
    return [section[0].trim(), sectionFields];
  });

  const labels = fields.map(field => field[0]);
  if (new Set(labels).size !== labels.length) throw httpError(400, 'Field labels must be unique within a form');
  const labelSet = new Set(labels);
  for (const label of Object.keys(CORE_COLUMNS)) {
    if (!labelSet.has(label)) throw httpError(400, `The required identity field "${label}" cannot be removed or renamed`);
  }
  for (const requiredBlock of baseline.sections.filter(section => typeof section[1] === 'string').map(section => section[1])) {
    if (!sections.some(section => section[1] === requiredBlock)) throw httpError(400, 'Education and achievement sections cannot be removed');
  }
  const requiredSpecials = allFields(baseline.sections).filter(field => field[5]).map(field => field[5]);
  for (const special of requiredSpecials) {
    if (!fields.some(field => field[5] === special)) throw httpError(400, 'Dynamic boxer category fields cannot be removed');
  }
  const baselineSpecials = new Map(allFields(baseline.sections).filter(field => field[5]).map(field => [field[5], field]));
  for (const field of fields.filter(item => item[5])) {
    const original = baselineSpecials.get(field[5]);
    if (!original || field[1] !== original[1] || JSON.stringify(field[2]) !== JSON.stringify(original[2])) {
      throw httpError(400, 'Dynamic boxer field options are managed by the application');
    }
  }
  return { title: input.title.trim(), sections };
}

export async function saveForm(req, res) {
  const { role } = req.params;
  if (!DEFAULT_FORMS[role]) throw httpError(404, 'Role not found');
  const config = validateForm(role, req.body);
  await FormConfigModel.save(role, config);
  res.json({ success: true });
}
