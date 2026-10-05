const $ = selector => document.querySelector(selector);
const adminState = { currentRegistration: null, currentPayment: null, toastTimer: null };

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function notify(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('visible');
  clearTimeout(adminState.toastTimer);
  adminState.toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function cell(row, text, className = '') {
  const td = document.createElement('td');
  td.textContent = text ?? '—';
  if (className) td.className = className;
  row.appendChild(td);
  return td;
}

function statusBadge(status) {
  const badge = document.createElement('span');
  badge.className = `pill ${status === 'paid' ? 'paid' : 'pending'}`;
  badge.textContent = status === 'paid' ? 'Paid' : 'Pending';
  return badge;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

async function loadRegistrations() {
  const query = new URLSearchParams({
    search: $('#registrationSearch').value.trim(),
    role: $('#registrationRole').value,
    status: $('#registrationStatus').value
  });
  const rows = await request(`/api/admin/registrations?${query}`);
  const body = $('#registrationRows');
  body.replaceChildren();
  $('#registrationEmpty').hidden = rows.length > 0;
  for (const member of rows) {
    const tr = document.createElement('tr');
    cell(tr, member.reg_no || `#${member.id}`, 'reg-number');
    const name = cell(tr, `${member.first_name} ${member.last_name}`.trim(), 'member-name');
    const email = document.createElement('span');
    email.className = 'subtext';
    email.textContent = member.email || '';
    name.appendChild(email);
    cell(tr, member.role);
    cell(tr, member.mobile);
    const status = document.createElement('td');
    status.appendChild(statusBadge(member.status));
    tr.appendChild(status);
    cell(tr, formatDate(member.created_at));
    const actionCell = document.createElement('td');
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'button secondary small';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => openRegistration(member.id));
    actionCell.appendChild(edit);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button danger small';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => deleteRegistration(member));
    actionCell.appendChild(remove);
    actionCell.className = 'row-actions';
    tr.appendChild(actionCell);
    body.appendChild(tr);
  }
  $('#metricTotal').textContent = String(rows.length);
  $('#metricPaid').textContent = String(rows.filter(member => member.status === 'paid').length);
  $('#metricPending').textContent = String(rows.filter(member => member.status !== 'paid').length);
}

async function deleteRegistration(member) {
  const name = `${member.first_name} ${member.last_name}`.trim();
  const identifier = member.reg_no || `#${member.id}`;
  if (!window.confirm(`Delete ${name} (${identifier}) and all associated payment and document records? This cannot be undone.`)) return;
  try {
    await request(`/api/admin/registrations/${member.id}`, { method: 'DELETE' });
    notify('Registration deleted');
    await Promise.all([loadRegistrations(), loadPayments()]);
  } catch (error) {
    notify(error.message, true);
  }
}

async function loadPayments() {
  const query = new URLSearchParams({ search: $('#paymentSearch').value.trim(), status: $('#paymentStatus').value });
  const rows = await request(`/api/admin/payments?${query}`);
  const body = $('#paymentRows');
  body.replaceChildren();
  $('#paymentEmpty').hidden = rows.length > 0;
  for (const payment of rows) {
    const tr = document.createElement('tr');
    cell(tr, payment.reg_no || `#${payment.id}`, 'reg-number');
    cell(tr, payment.name, 'member-name');
    cell(tr, payment.role);
    const status = document.createElement('td');
    status.appendChild(statusBadge(payment.status));
    tr.appendChild(status);
    cell(tr, payment.amount == null ? '—' : `₹${Number(payment.amount).toLocaleString('en-IN')}`);
    cell(tr, payment.receipt_no);
    cell(tr, payment.gateway_ref);
    cell(tr, formatDateTime(payment.paid_at));
    const actionCell = document.createElement('td');
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'button secondary small';
    edit.textContent = 'Update';
    edit.addEventListener('click', () => openPaymentEditor(payment));
    actionCell.appendChild(edit);
    tr.appendChild(actionCell);
    body.appendChild(tr);
  }
}

function openPaymentEditor(payment) {
  adminState.currentPayment = payment;
  $('#paymentDialogTitle').textContent = `${payment.reg_no || `#${payment.id}`} · ${payment.name}`;
  $('#paymentEditStatus').value = payment.status;
  $('#paymentEditStatus').disabled = payment.status === 'paid';
  $('#paymentEditAmount').value = payment.amount ?? '';
  $('#paymentEditReceipt').value = payment.receipt_no || '';
  $('#paymentEditGateway').value = payment.gateway_ref || '';
  $('#paymentEditPaidAt').value = toDateTimeLocal(payment.paid_at);
  $('#paymentDialog').showModal();
}

async function savePayment() {
  const payment = adminState.currentPayment;
  if (!payment) return;
  const button = $('#savePayment');
  button.disabled = true;
  try {
    await request(`/api/admin/payments/${payment.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: $('#paymentEditStatus').value,
        amount: Number($('#paymentEditAmount').value),
        receipt_no: $('#paymentEditReceipt').value,
        gateway_ref: $('#paymentEditGateway').value,
        paid_at: $('#paymentEditPaidAt').value
      })
    });
    $('#paymentDialog').close();
    notify('Payment record updated');
    await Promise.all([loadPayments(), loadRegistrations()]);
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function addEducationRow(value = {}) {
  const row = document.createElement('div');
  row.className = 'education-row';
  for (const [key, placeholder] of [['degree', 'Degree'], ['board', 'Board / university'], ['year', 'Year']]) {
    const input = document.createElement('input');
    input.dataset.education = key;
    input.value = value[key] || '';
    input.placeholder = placeholder;
    row.appendChild(input);
  }
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-field';
  remove.textContent = '×';
  remove.setAttribute('aria-label', 'Remove education row');
  remove.addEventListener('click', () => row.remove());
  row.appendChild(remove);
  $('#educationEditor').appendChild(row);
}

function addAchievementRow(value = '') {
  const row = document.createElement('div');
  row.className = 'achievement-row';
  const input = document.createElement('input');
  input.dataset.achievement = 'true';
  input.value = value;
  input.placeholder = 'Achievement';
  row.appendChild(input);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-field';
  remove.textContent = '×';
  remove.setAttribute('aria-label', 'Remove achievement');
  remove.addEventListener('click', () => row.remove());
  row.appendChild(remove);
  $('#achievementEditor').appendChild(row);
}

function readableSize(bytes) {
  if (!bytes) return 'Size unavailable';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderDocuments(documents, memberId) {
  const container = $('#documentsEditor');
  container.replaceChildren();
  if (!documents.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No documents were submitted with this registration.';
    container.appendChild(empty);
    return;
  }

  for (const doc of documents) {
    const card = document.createElement('article');
    card.className = 'document-card';
    const details = document.createElement('div');
    details.className = 'document-details';
    const title = document.createElement('strong');
    title.textContent = doc.field_label;
    const filename = document.createElement('span');
    filename.textContent = doc.empty ? 'No file uploaded' : `${doc.original_name} · ${readableSize(doc.size_bytes)}`;
    details.append(title, filename);
    card.appendChild(details);

    if (doc.unavailable) {
      const note = document.createElement('p');
      note.className = 'document-unavailable';
      note.textContent = 'Only the filename was saved; the file itself was not uploaded.';
      card.appendChild(note);
    }

    if (doc.id && !doc.unavailable) {
      const view = document.createElement('a');
      view.className = 'button secondary small';
      view.href = `/api/admin/documents/${doc.id}/content`;
      view.target = '_blank';
      view.rel = 'noopener';
      view.textContent = 'View file';
      card.appendChild(view);
    }

    const replace = document.createElement('input');
    replace.type = 'file';
    replace.className = 'document-replace';
    replace.dataset.documentLabel = doc.field_label;
    replace.accept = '.jpg,.jpeg,.png,.pdf';
    replace.setAttribute('aria-label', `Replace ${doc.field_label}`);
    card.appendChild(replace);

    container.appendChild(card);
  }
}

async function openRegistration(id) {
  try {
    const record = await request(`/api/admin/registrations/${id}`);
    adminState.currentRegistration = record;
    $('#dialogTitle').textContent = `${record.member.reg_no || `#${record.member.id}`} · ${record.member.role}`;
    $('#dialogNotice').textContent = '';
    const formConfig = adminState.forms?.[record.member.role] || { sections: [] };
    const hasEducation = formConfig.sections.some(section => section[1] === 'edu');
    const hasAchievements = formConfig.sections.some(section => section[1] === 'ach');
    $('#educationSection').hidden = !hasEducation;
    $('#achievementSection').hidden = !hasAchievements;

    const fields = $('#registrationFields');
    fields.replaceChildren();
    for (const [label, value] of Object.entries(record.fields)) {
      const wrapper = document.createElement('div');
      wrapper.className = 'edit-field';
      if (String(value).length > 80) wrapper.classList.add('wide');
      const fieldLabel = document.createElement('label');
      fieldLabel.textContent = label;
      const input = record.fileLabels.includes(label) || String(value).length > 180
        ? document.createElement('textarea')
        : document.createElement('input');
      input.className = 'edit-value';
      input.dataset.fieldLabel = label;
      input.value = value ?? '';
      if (label === 'Date of Birth' && input instanceof HTMLInputElement) input.type = 'date';
      if (['First Name', 'Last Name', 'Mobile Number'].includes(label)) input.required = true;
      if (record.fileLabels.includes(label)) {
        input.readOnly = true;
        input.title = 'Uploaded files cannot be replaced in the admin editor.';
      }
      wrapper.append(fieldLabel, input);
      fields.appendChild(wrapper);
    }
    renderDocuments(record.documents, record.member.id);

    $('#educationEditor').replaceChildren();
    if (hasEducation) {
      (record.member.education.length ? record.member.education : [{}]).forEach(addEducationRow);
    }

    $('#achievementEditor').replaceChildren();
    if (hasAchievements) {
      (record.member.achievements.length ? record.member.achievements : ['']).forEach(addAchievementRow);
    }
    $('#registrationDialog').showModal();
  } catch (error) {
    notify(error.message, true);
  }
}

async function saveRegistration() {
  const record = adminState.currentRegistration;
  if (!record) return;
  const fields = {};
  for (const input of document.querySelectorAll('.edit-value')) {
    if (!input.reportValidity()) return;
    fields[input.dataset.fieldLabel] = input.value.trim();
  }
  const education = [...document.querySelectorAll('.education-row')].map(row => ({
    degree: row.querySelector('[data-education="degree"]').value.trim(),
    board: row.querySelector('[data-education="board"]').value.trim(),
    year: row.querySelector('[data-education="year"]').value.trim()
  }));
  const achievements = [...document.querySelectorAll('[data-achievement]')].map(input => input.value.trim()).filter(Boolean);
  const button = $('#saveRegistration');
  button.disabled = true;
  const formData = new FormData();
  formData.append('fields', JSON.stringify(fields));
  formData.append('education', JSON.stringify(education));
  formData.append('achievements', JSON.stringify(achievements));
  for (const input of document.querySelectorAll('.document-replace')) {
    if (input.files[0]) formData.append(`document:${input.dataset.documentLabel}`, input.files[0]);
  }
  try {
    await request(`/api/admin/registrations/${record.member.id}`, {
      method: 'PUT', body: formData
    });
    $('#registrationDialog').close();
    notify('Registration updated');
    await loadRegistrations();
  } catch (error) {
    $('#dialogNotice').textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function selectOptions(select, options, value) {
  select.replaceChildren();
  for (const [optionValue, label] of options) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = label;
    select.appendChild(option);
  }
  select.value = value;
}

async function loadRegistrationRoles() {
  const forms = await request('/api/admin/forms');
  const roleOptions = Object.keys(forms).map(role => [role, role]);
  selectOptions($('#registrationRole'), [['', 'All roles'], ...roleOptions], $('#registrationRole').value);
}

function setView(viewName) {
  document.querySelectorAll('.nav-tab').forEach(button => {
    const selected = button.dataset.view === viewName;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('.view').forEach(section => { section.hidden = section.id !== `view-${viewName}`; });
  if (viewName === 'payments') loadPayments().catch(error => notify(error.message, true));
}

function debounce(fn, delay = 250) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => fn().catch(error => notify(error.message, true)), delay);
  };
}

$('#registrationSearch').addEventListener('input', debounce(loadRegistrations));
$('#registrationRole').addEventListener('change', () => loadRegistrations().catch(error => notify(error.message, true)));
$('#registrationStatus').addEventListener('change', () => loadRegistrations().catch(error => notify(error.message, true)));
$('#paymentSearch').addEventListener('input', debounce(loadPayments));
$('#paymentStatus').addEventListener('change', () => loadPayments().catch(error => notify(error.message, true)));
$('#saveRegistration').addEventListener('click', saveRegistration);
$('#cancelEdit').addEventListener('click', () => $('#registrationDialog').close());
$('#cancelPaymentEdit').addEventListener('click', () => $('#paymentDialog').close());
$('#savePayment').addEventListener('click', savePayment);
$('#addEducation').addEventListener('click', () => addEducationRow());
$('#addAchievement').addEventListener('click', () => addAchievementRow());
document.querySelectorAll('.nav-tab').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));

(async function initialize() {
  try {
    await loadRegistrationRoles();
    await Promise.all([loadRegistrations(), loadPayments()]);
  } catch (error) {
    notify(error.message, true);
  }
})();
