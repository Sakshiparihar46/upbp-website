(function () {
  const form = document.getElementById('registrationForm');
  if (!form) return;
  const eduBox = document.getElementById('educationRows');
  const achBox = document.getElementById('achievementRows');
  const fieldsJson = document.getElementById('fieldsJson');
  const eduJson = document.getElementById('eduJson');
  const achJson = document.getElementById('achJson');
  const msg = document.getElementById('formMessage');
  const submit = document.getElementById('submitBtn');

  function educationRow() {
    const row = document.createElement('div'); row.className = 'row edu-row';
    row.innerHTML = '<input placeholder="Examination / Degree" data-edu="degree"><input placeholder="Board / University" data-edu="board"><input placeholder="Year" data-edu="year"><button type="button" aria-label="Remove row">✕</button>';
    row.querySelector('button').onclick = () => { if (eduBox.children.length > 1) row.remove(); };
    return row;
  }
  function achievementRow() {
    const row = document.createElement('div'); row.className = 'row one ach-row';
    row.innerHTML = '<input placeholder="Sports achievement (event, year, medal)" data-ach><button type="button" aria-label="Remove row">✕</button>';
    row.querySelector('button').onclick = () => { if (achBox.children.length > 1) row.remove(); };
    return row;
  }
  eduBox?.appendChild(educationRow()); achBox?.appendChild(achievementRow());
  document.getElementById('addEducation')?.addEventListener('click', () => eduBox.appendChild(educationRow()));
  document.getElementById('addAchievement')?.addEventListener('click', () => achBox.appendChild(achievementRow()));

  const category = document.querySelector('[data-special="cat"]');
  const weight = document.querySelector('[data-special="wc"]');
  if (weight) weight.disabled = true;
  category?.addEventListener('change', () => {
    weight.innerHTML = `<option value="">${category.value ? 'Select weight class' : 'Choose a category first'}</option>`;
    weight.disabled = !category.value;
    (window.UPBA.weights[category.value] || []).forEach(w => { const o = document.createElement('option'); o.value = w + ' kg'; o.textContent = w + ' kg'; weight.appendChild(o); });
  });

  document.getElementById('photo')?.addEventListener('change', e => {
    const file = e.target.files[0], preview = document.getElementById('photoPreview');
    if (file) { preview.style.backgroundImage = `url(${URL.createObjectURL(file)})`; preview.textContent = ''; }
  });

  form.addEventListener('submit', e => {
    const values = {}; let valid = true;
    form.querySelectorAll('.data-field').forEach(el => { values[el.dataset.label] = el.value.trim(); if (el.required && !el.value.trim()) { el.classList.add('bad'); valid = false; } else el.classList.remove('bad'); });
    form.querySelectorAll('input[type="file"][data-file-label]').forEach(el => { if (el.required && !el.files.length) { el.classList.add('bad'); valid = false; } else el.classList.remove('bad'); });
    const mobile = values['Mobile Number'];
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) { document.querySelector('[data-label="Mobile Number"]')?.classList.add('bad'); valid = false; }
    const email = values['Personal Email'];
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { document.querySelector('[data-label="Personal Email"]')?.classList.add('bad'); valid = false; }
    if (!valid) { e.preventDefault(); msg.textContent = 'Please fix the highlighted fields.'; msg.classList.remove('hidden'); return; }
    form.querySelectorAll('input[type="file"][data-file-label]').forEach(el => { if (el.files[0]) values[el.dataset.fileLabel] = el.files[0].name; });
    fieldsJson.value = JSON.stringify(values);
    eduJson.value = JSON.stringify([...document.querySelectorAll('[data-edu="degree"]')].map((_, i) => { const r = eduBox.children[i]; return { degree: r.querySelector('[data-edu="degree"]').value.trim(), board: r.querySelector('[data-edu="board"]').value.trim(), year: r.querySelector('[data-edu="year"]').value.trim() }; }));
    achJson.value = JSON.stringify([...document.querySelectorAll('[data-ach]')].map(x => x.value.trim()).filter(Boolean));
    submit.disabled = true; submit.textContent = 'Saving…';
  });
})();
