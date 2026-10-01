const $ = selector => document.querySelector(selector);
const adminState = { forms: {}, roles: [], activeRole: '', currentRegistration: null, toastTimer: null };
const coreLabels = new Set(['Title', 'First Name', 'Last Name', 'Gender', 'Date of Birth', 'Personal Email', 'Mobile Number', 'Address']);
const fieldTypes = [['t', 'Text'], ['e', 'Email'], ['tel', 'Phone'], ['d', 'Date'], ['n', 'Number'], ['sel', 'Dropdown'], ['ta', 'Long text'], ['file', 'File']];

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
    tr.appendChild(actionCell);
    body.appendChild(tr);
  }
  $('#metricTotal').textContent = String(rows.length);
  $('#metricPaid').textContent = String(rows.filter(member => member.status === 'paid').length);
  $('#metricPending').textContent = String(rows.filter(member => member.status !== 'paid').length);
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
    body.appendChild(tr);
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

function renderFormBuilder() {
  const config = adminState.forms[adminState.activeRole];
  if (!config) return;
  $('#formTitle').value = config.title;
  const container = $('#formSections');
  container.replaceChildren();
  config.sections.forEach((section, sectionIndex) => {
    const sectionNode = document.createElement('article');
    sectionNode.className = 'section-editor';
    const heading = document.createElement('div');
    heading.className = 'section-heading';
    const title = document.createElement('input');
    title.className = 'section-title';
    title.value = section[0];
    title.setAttribute('aria-label', 'Section title');
    title.addEventListener('input', () => { section[0] = title.value; });
    heading.appendChild(title);
    const isSpecialSection = typeof section[1] === 'string';
    const kind = document.createElement('span');
    kind.className = 'section-kind';
    kind.textContent = isSpecialSection ? (section[1] === 'edu' ? 'Education rows' : 'Achievement rows') : 'Form fields';
    heading.appendChild(kind);
    const actions = document.createElement('div');
    actions.className = 'section-actions';
    const removeSection = document.createElement('button');
    removeSection.type = 'button';
    removeSection.className = 'button secondary small';
    removeSection.textContent = 'Remove';
    removeSection.disabled = isSpecialSection;
    removeSection.addEventListener('click', () => {
      config.sections.splice(sectionIndex, 1);
      renderFormBuilder();
    });
    actions.appendChild(removeSection);
    heading.appendChild(actions);
    sectionNode.appendChild(heading);

    if (!isSpecialSection) {
      const fieldList = document.createElement('div');
      fieldList.className = 'field-list';
      section[1].forEach((field, fieldIndex) => fieldList.appendChild(renderField(config, sectionIndex, fieldIndex, field)));
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'button secondary small';
      add.textContent = '+ Add field';
      add.addEventListener('click', () => {
        section[1].push(['New field', 't', [], false, false, '']);
        renderFormBuilder();
      });
      fieldList.appendChild(add);
      sectionNode.appendChild(fieldList);
    } else {
      const note = document.createElement('p');
      note.className = 'special-note';
      note.textContent = 'This structured section is retained for existing applicant data.';
      sectionNode.appendChild(note);
    }
    container.appendChild(sectionNode);
  });
}

function renderField(config, sectionIndex, fieldIndex, field) {
  const row = document.createElement('div');
  row.className = 'field-editor';
  const label = document.createElement('input');
  label.className = 'label-input';
  label.value = field[0];
  label.setAttribute('aria-label', 'Field label');
  label.disabled = coreLabels.has(field[0]);
  label.addEventListener('input', () => { field[0] = label.value; });
  row.appendChild(label);

  const type = document.createElement('select');
  type.setAttribute('aria-label', 'Field type');
  selectOptions(type, fieldTypes, field[1]);
  type.disabled = Boolean(field[5]);
  type.addEventListener('change', () => {
    field[1] = type.value;
    if (field[1] !== 'sel') field[2] = [];
    renderFormBuilder();
  });
  row.appendChild(type);

  const options = document.createElement('input');
  options.className = 'options-input';
  options.placeholder = field[1] === 'sel' ? 'Option 1, Option 2' : 'No options';
  options.value = (field[2] || []).join(', ');
  options.disabled = field[1] !== 'sel' || Boolean(field[5]);
  options.setAttribute('aria-label', 'Dropdown options, comma separated');
  options.addEventListener('input', () => { field[2] = options.value.split(',').map(item => item.trim()).filter(Boolean); });
  row.appendChild(options);

  for (const [index, labelText] of [[3, 'Required'], [4, 'Wide']]) {
    const wrapper = document.createElement('label');
    wrapper.className = 'check-field';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(field[index]);
    checkbox.setAttribute('aria-label', labelText);
    checkbox.addEventListener('change', () => { field[index] = checkbox.checked; });
    wrapper.append(checkbox, document.createTextNode(labelText));
    row.appendChild(wrapper);
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-field';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `Remove ${field[0]}`);
  remove.disabled = coreLabels.has(field[0]) || Boolean(field[5]);
  remove.addEventListener('click', () => {
    config.sections[sectionIndex][1].splice(fieldIndex, 1);
    renderFormBuilder();
  });
  row.appendChild(remove);
  return row;
}

async function loadForms() {
  adminState.forms = await request('/api/admin/forms');
  adminState.roles = Object.keys(adminState.forms);
  const roleOptions = adminState.roles.map(role => [role, role]);
  selectOptions($('#registrationRole'), [['', 'All roles'], ...roleOptions], $('#registrationRole').value);
  selectOptions($('#formRole'), roleOptions, adminState.activeRole || adminState.roles[0]);
  adminState.activeRole = $('#formRole').value;
  renderFormBuilder();
}

async function saveForm() {
  const config = adminState.forms[adminState.activeRole];
  config.title = $('#formTitle').value.trim();
  const button = $('#saveForm');
  button.disabled = true;
  try {
    await request(`/api/admin/forms/${encodeURIComponent(adminState.activeRole)}`, {
      method: 'PUT', body: JSON.stringify({ title: config.title, sections: config.sections })
    });
    notify('Form saved for future registrations');
    await loadForms();
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
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
$('#formRole').addEventListener('change', () => { adminState.activeRole = $('#formRole').value; renderFormBuilder(); });
$('#formTitle').addEventListener('input', () => { adminState.forms[adminState.activeRole].title = $('#formTitle').value; });
$('#saveForm').addEventListener('click', saveForm);
$('#saveRegistration').addEventListener('click', saveRegistration);
$('#cancelEdit').addEventListener('click', () => $('#registrationDialog').close());
$('#addEducation').addEventListener('click', () => addEducationRow());
$('#addAchievement').addEventListener('click', () => addAchievementRow());
$('#addSection').addEventListener('click', () => {
  adminState.forms[adminState.activeRole].sections.push(['New section', []]);
  renderFormBuilder();
});
document.querySelectorAll('.nav-tab').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));

(async function initialize() {
  try {
    await loadForms();
    await Promise.all([loadRegistrations(), loadPayments()]);
  } catch (error) {
    notify(error.message, true);
  }
})();
