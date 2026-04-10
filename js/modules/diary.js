/* ========================================
   Diary Module - Diario de Obra
   Incidencias, comentarios y evolución
   ======================================== */

const DiaryModule = (() => {
// Actualizado: 2026-04-10
  const ENTRY_TYPES = {
    incident: { label: 'Incidencia', class: 'badge-pending', icon: 'alert-triangle' },
    comment: { label: 'Comentario', class: 'badge-neutral', icon: 'message-square' },
    evolution: { label: 'Evolución', class: 'badge-active', icon: 'book-open' }
  };

  const STATUSES = {
    pending: { label: 'Pendiente', class: 'badge-pending' },
    'in-progress': { label: 'En proceso', class: 'badge-active' },
    resolved: { label: 'Resuelto', class: 'badge-positive' }
  };

  const DEFAULT_CATEGORIES = [
    'Estructural', 'Fontanería', 'Electricidad', 'Acabados',
    'Seguridad', 'Material', 'Comunicación', 'Plazo', 'Otros'
  ];

  let projectId = null;
  let customIncidentCategories = [];

  function getIncidentCategories() {
    return DEFAULT_CATEGORIES.concat(customIncidentCategories.map(c => c.name));
  }

  async function init(pid) {
    projectId = pid;
    customIncidentCategories = await DB.getCustomCategories(projectId, 'incidentCategory');
    setupButtons();
    loadIncidents();
  }

  function cloneAndBind(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    clone.addEventListener('click', fn);
  }

  function setupButtons() {
    cloneAndBind('btn-add-incident',       () => openIncidentForm(null, 'incident'));
    cloneAndBind('btn-add-comment',        () => openIncidentForm(null, 'comment'));
    cloneAndBind('btn-add-evolution',      () => openIncidentForm(null, 'evolution'));
    cloneAndBind('btn-add-incident-empty', () => openIncidentForm(null, 'incident'));
    cloneAndBind('btn-add-comment-empty',  () => openIncidentForm(null, 'comment'));
    cloneAndBind('btn-add-evolution-empty',() => openIncidentForm(null, 'evolution'));

    const filter = document.getElementById('diary-filter');
    const newFilter = filter.cloneNode(true);
    filter.parentNode.replaceChild(newFilter, filter);
    newFilter.addEventListener('change', loadIncidents);

    const typeFilter = document.getElementById('diary-type-filter');
    const newTypeFilter = typeFilter.cloneNode(true);
    typeFilter.parentNode.replaceChild(newTypeFilter, typeFilter);
    newTypeFilter.addEventListener('change', loadIncidents);
  }

  async function loadIncidents() {
    const filter = document.getElementById('diary-filter').value;
    const typeFilter = document.getElementById('diary-type-filter').value;
    let incidents = await DB.getAllForProject('incidents', projectId);

    incidents = incidents.map(item => ({
      ...item,
      entryType: item.entryType || 'incident'
    }));

    // Sort by date descending
    incidents.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (typeFilter !== 'all') {
      incidents = incidents.filter(i => i.entryType === typeFilter);
    }

    if (filter !== 'all') {
      incidents = incidents.filter(i => i.status === filter);
    }

    renderFeed(incidents);
  }

  async function renderFeed(incidents) {
    const feed = document.getElementById('diary-feed');
    const emptyState = document.getElementById('diary-empty');

    // Revoke any existing blob URLs to avoid memory leaks
    feed.querySelectorAll('img[src^="blob:"]').forEach(img => URL.revokeObjectURL(img.src));

    if (incidents.length === 0) {
      feed.style.display = 'none';
      emptyState.style.display = 'flex';
      feed.innerHTML = '';
      return;
    }

    feed.style.display = 'flex';
    emptyState.style.display = 'none';

    // Load photos from IndexedDB
    const mainParts = [];
    const evolutionParts = [];

    for (const incident of incidents) {
      const status = STATUSES[incident.status] || STATUSES.pending;
      const entryType = ENTRY_TYPES[incident.entryType] || ENTRY_TYPES.incident;
      const isIncident = incident.entryType === 'incident';

      // Get photo thumbnails
      let photosHTML = '';
      if (incident.photoIds && incident.photoIds.length > 0) {
        const photoElements = [];
        for (const photoId of incident.photoIds) {
          const file = await DB.getFile(photoId);
          const fileBlob = file?.blob || (file?.data ? new Blob([file.data], { type: file.type || 'image/*' }) : null);
          if (fileBlob) {
            const url = URL.createObjectURL(fileBlob);
            photoElements.push(`
              <div class="incident-photo" onclick="App.openLightbox('${url}')">
                <img src="${url}" alt="Imagen adjunta del diario" loading="lazy">
              </div>
            `);
          }
        }
        if (photoElements.length > 0) {
          photosHTML = `<div class="incident-photos">${photoElements.join('')}</div>`;
        }
      }

      // Responsible info
      let responsibleHTML = '';
      if (incident.responsiblePerson || incident.responsibleCompany) {
        const parts = [];
        if (incident.responsiblePerson) parts.push(App.escapeHTML(incident.responsiblePerson));
        if (incident.responsibleCompany) parts.push(App.escapeHTML(incident.responsibleCompany));
        responsibleHTML = `
          <div class="incident-responsible">
            <i data-lucide="user" style="width:12px;height:12px"></i>
            ${parts.join(' — ')}
          </div>
        `;
      }

      const statusHTML = isIncident
        ? `<span class="badge ${status.class} incident-status" 
                  onclick="DiaryModule.cycleStatus(${incident.id})" 
                  title="${App.t('click_to_change_status')}">
              ${status.label}
            </span>`
        : '';

      const categoryHTML = incident.category
        ? `<div class="incident-category">
              <i data-lucide="tag" style="width:12px;height:12px"></i>
              ${App.escapeHTML(incident.category)}
            </div>`
        : '';

      const cardHTML = `
        <div class="incident-card" data-id="${incident.id}">
          <div class="incident-card-header">
            <div class="incident-meta">
              <span class="badge ${entryType.class} incident-type-badge">
                <i data-lucide="${entryType.icon}" style="width:12px;height:12px"></i>
                ${entryType.label}
              </span>
              <span class="incident-date">
                <i data-lucide="calendar" style="width:14px;height:14px;vertical-align:middle"></i>
                ${App.formatDateTime(incident.date)}
              </span>
            </div>
            ${statusHTML}
          </div>
          <div class="incident-card-body">
            ${categoryHTML}
            ${responsibleHTML}
            <p class="incident-description">${App.escapeHTML(incident.description)}</p>
            ${photosHTML}
          </div>
          <div class="incident-card-footer">
            <button class="btn btn-sm btn-outline" onclick="DiaryModule.editIncident(${incident.id})">
              <i data-lucide="pencil"></i> ${App.t('edit')}
            </button>
            <button class="btn btn-sm btn-danger" onclick="DiaryModule.deleteIncident(${incident.id})">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;

      if (incident.entryType === 'evolution') {
        evolutionParts.push(`
          <div class="evolution-item" data-id="${incident.id}">
            <div class="evolution-dot"></div>
            <div class="evolution-content">${cardHTML}</div>
          </div>
        `);
      } else {
        mainParts.push(cardHTML);
      }
    }

    const sections = [];

    if (mainParts.length > 0) {
      sections.push(`
        <div class="diary-group">
          <div class="diary-group-title">${App.t('diary_entries_title')}</div>
          <div class="diary-group-list">${mainParts.join('')}</div>
        </div>
      `);
    }

    if (evolutionParts.length > 0) {
      sections.push(`
        <div class="diary-group diary-group-evolution">
          <div class="diary-group-title">${App.t('diary_evolution_timeline_title')}</div>
          <div class="evolution-timeline">${evolutionParts.join('')}</div>
        </div>
      `);
    }

    feed.innerHTML = sections.join('');
    lucide.createIcons();
  }

  // --- Incident Form ---
  async function openIncidentForm(incident = null, presetType = 'incident') {
    customIncidentCategories = await DB.getCustomCategories(projectId, 'incidentCategory');
    const isEdit = !!incident;
    const effectiveType = isEdit ? (incident.entryType || 'incident') : presetType;
    const typeTitles = {
      incident: App.t('diary_new_incident'),
      comment: App.t('diary_new_comment'),
      evolution: App.t('diary_new_evolution')
    };
    const title = isEdit ? App.t('edit_entry') : (typeTitles[effectiveType] || App.t('new_entry'));

    const now = new Date().toISOString().slice(0, 16);
    const entryType = effectiveType;

    const body = `
      <div class="form-row">
        <div class="form-group">
          <label>${App.t('entry_type')}</label>
          <select id="inc-entry-type">
            <option value="incident" ${entryType === 'incident' ? 'selected' : ''}>${App.t('diary_incident_button')}</option>
            <option value="comment" ${entryType === 'comment' ? 'selected' : ''}>${App.t('diary_comment_button')}</option>
            <option value="evolution" ${entryType === 'evolution' ? 'selected' : ''}>${App.t('diary_evolution_button')}</option>
          </select>
        </div>
        <div class="form-group incident-only-field">
          <label>${App.t('status')}</label>
          <select id="inc-status">
            <option value="pending" ${isEdit && incident.status === 'pending' ? 'selected' : ''}>${App.t('pending')}</option>
            <option value="in-progress" ${isEdit && incident.status === 'in-progress' ? 'selected' : ''}>${App.t('in_progress')}</option>
            <option value="resolved" ${isEdit && incident.status === 'resolved' ? 'selected' : ''}>${App.t('resolved')}</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>${App.t('description')} *</label>
        <textarea id="inc-description" rows="3" placeholder="${App.t('diary_description_placeholder')}">${isEdit ? App.escapeHTML(incident.description) : ''}</textarea>
      </div>
      <div class="form-row incident-only-row">
        <div class="form-group incident-only-field">
          <label>${App.t('category')}</label>
          <select id="inc-category">
            ${getIncidentCategories().map(c => `<option value="${App.escapeHTML(c)}" ${isEdit && incident.category === c ? 'selected' : ''}>${App.escapeHTML(c)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row incident-only-row">
        <div class="form-group incident-only-field">
          <label>${App.t('responsible_person')}</label>
          <input type="text" id="inc-responsible-person" placeholder="${App.t('responsible_person_placeholder')}" value="${isEdit ? App.escapeHTML(incident.responsiblePerson || '') : ''}">
        </div>
        <div class="form-group incident-only-field">
          <label>${App.t('company')}</label>
          <input type="text" id="inc-responsible-company" placeholder="${App.t('company_placeholder')}" value="${isEdit ? App.escapeHTML(incident.responsibleCompany || '') : ''}">
        </div>
      </div>
      <div class="form-group">
        <label>${App.t('date_time')}</label>
        <input type="datetime-local" id="inc-date" value="${isEdit ? incident.date.slice(0, 16) : now}">
      </div>
      <div class="form-group">
        <label>${App.t('photos')}</label>
        <div class="upload-zone" id="photo-upload-zone">
          <i data-lucide="camera"></i>
          <p>${App.t('photo_drop_help')}</p>
          <input type="file" id="photo-input" accept="image/*" multiple hidden>
        </div>
        <div class="upload-preview" id="photo-preview"></div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">${App.t('cancel')}</button>
      <button class="btn btn-primary" id="btn-save-incident">
        <i data-lucide="save"></i> ${isEdit ? App.t('save') : App.t('register')}
      </button>
    `;

    App.openModal(title, body, footer);

    // Photo upload handling
    const pendingPhotos = [];
    const existingPhotoIds = isEdit ? [...(incident.photoIds || [])] : [];

    const uploadZone = document.getElementById('photo-upload-zone');
    const photoInput = document.getElementById('photo-input');
    const preview = document.getElementById('photo-preview');
    const typeSelect = document.getElementById('inc-entry-type');

    function syncEntryTypeUI() {
      const isIncidentType = typeSelect.value === 'incident';
      document.querySelectorAll('.incident-only-field, .incident-only-row').forEach(el => {
        el.style.display = isIncidentType ? '' : 'none';
      });
      document.getElementById('diary-filter').disabled = false;
    }

    typeSelect.addEventListener('change', syncEntryTypeUI);
    syncEntryTypeUI();

    uploadZone.addEventListener('click', () => photoInput.click());

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.style.borderColor = 'var(--cyan)';
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.style.borderColor = 'var(--border)';
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.style.borderColor = 'var(--border)';
      handleFiles(e.dataTransfer.files);
    });

    photoInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
    });

    function handleFiles(files) {
      Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          pendingPhotos.push({ blob: file, dataUrl: e.target.result, name: file.name });
          renderPreview();
        };
        reader.readAsDataURL(file);
      });
    }

    function renderPreview() {
      preview.innerHTML = pendingPhotos.map((p, i) => `
        <div class="upload-preview-item">
          <img src="${p.dataUrl}" alt="${App.escapeHTML(p.name)}">
          <button class="remove-photo" onclick="event.stopPropagation(); this.closest('.upload-preview-item').remove(); window._removePendingPhoto(${i});" title="${App.t('remove_photo')}">×</button>
        </div>
      `).join('');
    }

    window._removePendingPhoto = (index) => {
      pendingPhotos.splice(index, 1);
      renderPreview();
    };

    // Save
    document.getElementById('btn-save-incident').addEventListener('click', async () => {
      const description = document.getElementById('inc-description').value.trim();
      if (!description) {
        App.toast(App.t('description_required'), 'warning');
        return;
      }

      // Save new photos to IndexedDB
      const newPhotoIds = [];
      for (const photo of pendingPhotos) {
        const id = await DB.saveFile(photo.blob, photo.name, photo.blob.type, projectId);
        newPhotoIds.push(id);
      }

      const data = {
        entryType: document.getElementById('inc-entry-type').value,
        description,
        category: document.getElementById('inc-entry-type').value === 'incident' ? document.getElementById('inc-category').value : '',
        status: document.getElementById('inc-entry-type').value === 'incident' ? document.getElementById('inc-status').value : 'resolved',
        responsiblePerson: document.getElementById('inc-entry-type').value === 'incident' ? document.getElementById('inc-responsible-person').value.trim() : '',
        responsibleCompany: document.getElementById('inc-entry-type').value === 'incident' ? document.getElementById('inc-responsible-company').value.trim() : '',
        date: document.getElementById('inc-date').value + ':00',
        photoIds: [...existingPhotoIds, ...newPhotoIds],
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = incident.id;
        data.projectId = incident.projectId;
        data.createdAt = incident.createdAt;
        await DB.put('incidents', data);
        App.toast(App.t('diary_entry_updated'), 'success');
      } else {
        data.createdAt = new Date().toISOString();
        data.projectId = projectId;
        await DB.add('incidents', data);
        App.toast(App.t('diary_entry_created'), 'success');
      }

      // Cleanup
      delete window._removePendingPhoto;
      App.closeModal();
      loadIncidents();
    });
  }

  async function editIncident(id) {
    const incident = await DB.getById('incidents', id);
    if (incident) openIncidentForm(incident);
  }

  async function deleteIncident(id) {
    if (!confirm(App.t('confirm_delete_diary_entry'))) return;
    await DB.remove('incidents', id);
    App.toast(App.t('diary_entry_deleted'), 'info');
    loadIncidents();
  }

  async function cycleStatus(id) {
    const incident = await DB.getById('incidents', id);
    if (!incident || (incident.entryType && incident.entryType !== 'incident')) return;

    const cycle = { pending: 'in-progress', 'in-progress': 'resolved', resolved: 'pending' };
    incident.status = cycle[incident.status] || 'pending';
    incident.updatedAt = new Date().toISOString();

    await DB.put('incidents', incident);
    App.toast(`Estado: ${STATUSES[incident.status].label}`, 'info');
    loadIncidents();
  }

  async function focusIncident(id) {
    document.getElementById('diary-filter').value = 'all';
    document.getElementById('diary-type-filter').value = 'all';
    await loadIncidents();

    const card = document.querySelector(`.incident-card[data-id="${id}"]`);
    if (!card) return;

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('incident-card-focus');
    setTimeout(() => card.classList.remove('incident-card-focus'), 2200);
  }

  return { init, editIncident, deleteIncident, cycleStatus, focusIncident };
})();
