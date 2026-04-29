/* ========================================
   Diary Module - Diario de Obra
   Incidencias, comentarios y evolución
   ======================================== */

const DiaryModule = (() => {
// Actualizado: 2026-04-10
  const ENTRY_TYPES = {
    incident: { label: 'Incidencia', class: 'badge-pending', icon: 'alert-triangle' },
    comment: { label: 'Comentario', class: 'badge-neutral', icon: 'message-square' },
    evolution: { label: 'Evolución', class: 'badge-active', icon: 'book-open' },
    logbook: { label: 'Bitácora', class: 'badge-positive', icon: 'notebook-pen' }
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
  let projectParticipants = [];

  function getIncidentCategories() {
    return DEFAULT_CATEGORIES.concat(customIncidentCategories.map(c => c.name));
  }

  async function init(pid) {
    projectId = pid;
    customIncidentCategories = await DB.getCustomCategories(projectId, 'incidentCategory');
    projectParticipants = await DB.getAllForProject('participants', projectId);
    setupButtons();
    loadIncidents();
  }

  function setupButtons() {
    document.getElementById('btn-add-incident').addEventListener('click', () => openIncidentForm(null, 'incident'));
    document.getElementById('btn-add-comment').addEventListener('click', () => openIncidentForm(null, 'comment'));
    document.getElementById('btn-add-evolution').addEventListener('click', () => openIncidentForm(null, 'evolution'));
    document.getElementById('btn-add-logbook').addEventListener('click', () => openIncidentForm(null, 'logbook'));
    document.getElementById('btn-add-incident-empty').addEventListener('click', () => openIncidentForm(null, 'incident'));
    document.getElementById('btn-add-comment-empty').addEventListener('click', () => openIncidentForm(null, 'comment'));
    document.getElementById('btn-add-evolution-empty').addEventListener('click', () => openIncidentForm(null, 'evolution'));
    document.getElementById('btn-add-logbook-empty').addEventListener('click', () => openIncidentForm(null, 'logbook'));
    document.getElementById('diary-filter').addEventListener('change', loadIncidents);
    document.getElementById('diary-type-filter').addEventListener('change', loadIncidents);
    const dateFilter = document.getElementById('diary-date-filter');
    const clearDateBtn = document.getElementById('btn-clear-diary-date');
    if (dateFilter) {
      dateFilter.addEventListener('change', loadIncidents);
    }
    if (clearDateBtn && dateFilter) {
      clearDateBtn.addEventListener('click', () => {
        dateFilter.value = '';
        loadIncidents();
      });
    }
    const searchInput = document.getElementById('diary-search');
    if (searchInput) {
      searchInput.value = '';
      let _debounce = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(_debounce);
        _debounce = setTimeout(loadIncidents, 200);
      });
    }
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

    const dateFilter = document.getElementById('diary-date-filter')?.value || '';
    if (dateFilter) {
      incidents = incidents.filter(i => (i.date || '').slice(0, 10) === dateFilter);
    }

    const searchEl = document.getElementById('diary-search');
    const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    if (q) {
      incidents = incidents.filter(i =>
        (i.description || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q) ||
        (i.responsiblePerson || '').toLowerCase().includes(q) ||
        (i.responsibleCompany || '').toLowerCase().includes(q) ||
        (i.participants || []).join(' ').toLowerCase().includes(q)
      );
    }

    renderFeed(incidents);
  }

  async function renderFeed(incidents) {
    const feed = document.getElementById('diary-feed');
    const emptyState = document.getElementById('diary-empty');

    if (incidents.length === 0) {
      feed.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    feed.style.display = 'flex';
    emptyState.style.display = 'none';

    // Load photos from IndexedDB
    const mainParts = [];
    const evolutionParts = [];
    const logbookParts = [];

    for (const incident of incidents) {
      const status = STATUSES[incident.status] || STATUSES.pending;
      const entryType = ENTRY_TYPES[incident.entryType] || ENTRY_TYPES.incident;
      const isIncident = incident.entryType === 'incident';
      const isLogbook = incident.entryType === 'logbook';

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

      const participants = Array.isArray(incident.participants) ? incident.participants : [];
      const logbookParticipantsHTML = isLogbook && participants.length > 0
        ? `
            <div class="logbook-participants">
              <div class="logbook-participants-title">
                <i data-lucide="users" style="width:13px;height:13px"></i>
                ${App.t('diary_logbook_participants')}
              </div>
              <div class="logbook-participants-list">
                ${participants.map(name => `<span class="logbook-participant-chip">${App.escapeHTML(name)}</span>`).join('')}
              </div>
            </div>
          `
        : '';

      const descriptionText = incident.description || '';

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
            <p class="incident-description">${App.escapeHTML(descriptionText)}</p>
            ${logbookParticipantsHTML}
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
      } else if (incident.entryType === 'logbook') {
        logbookParts.push(cardHTML);
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

    if (logbookParts.length > 0) {
      sections.push(`
        <div class="diary-group diary-group-logbook">
          <div class="diary-group-title">${App.t('diary_logbook_title')}</div>
          <div class="diary-group-list">${logbookParts.join('')}</div>
        </div>
      `);
    }

    feed.innerHTML = sections.join('');
    lucide.createIcons();
  }

  // --- Incident Form ---
  async function openIncidentForm(incident = null, presetType = 'incident') {
    customIncidentCategories = await DB.getCustomCategories(projectId, 'incidentCategory');
    projectParticipants = await DB.getAllForProject('participants', projectId);
    const isEdit = !!incident;
    const effectiveType = isEdit ? (incident.entryType || 'incident') : presetType;
    const typeTitles = {
      incident: App.t('diary_new_incident'),
      comment: App.t('diary_new_comment'),
      evolution: App.t('diary_new_evolution'),
      logbook: App.t('diary_new_logbook')
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
            <option value="logbook" ${entryType === 'logbook' ? 'selected' : ''}>${App.t('diary_logbook_button')}</option>
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
      <div class="form-group logbook-only-row">
        <label>${App.t('diary_logbook_select_participants')}</label>
        <select id="logbook-participants-select">
          <option value="">${App.t('select')}</option>
          ${projectParticipants
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .map(p => `<option value="${App.escapeHTML(p.name || '')}">${App.escapeHTML(p.name || '')}${p.company ? ` — ${App.escapeHTML(p.company)}` : ''}</option>`)
            .join('')}
        </select>
      </div>
      <div class="form-row logbook-only-row">
        <div class="form-group logbook-only-field">
          <label>${App.t('diary_logbook_manual_participant')}</label>
          <input type="text" id="logbook-participant-manual" placeholder="${App.t('diary_logbook_manual_participant_placeholder')}">
        </div>
        <div class="form-group logbook-only-field" style="align-self:end">
          <button class="btn btn-outline" type="button" id="btn-add-logbook-participant">
            <i data-lucide="plus"></i> ${App.t('add')}
          </button>
        </div>
      </div>
      <div class="form-group logbook-only-row">
        <label>${App.t('diary_logbook_participants')}</label>
        <div id="logbook-selected-participants" class="logbook-selected-participants"></div>
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
    const participantSelect = document.getElementById('logbook-participants-select');
    const manualParticipantInput = document.getElementById('logbook-participant-manual');
    const addParticipantBtn = document.getElementById('btn-add-logbook-participant');
    const selectedParticipantsWrap = document.getElementById('logbook-selected-participants');
    const selectedParticipants = isEdit && Array.isArray(incident.participants)
      ? [...incident.participants]
      : [];

    function renderSelectedParticipants() {
      if (!selectedParticipantsWrap) return;
      if (selectedParticipants.length === 0) {
        selectedParticipantsWrap.innerHTML = `<span class="logbook-selected-empty">${App.t('diary_logbook_no_participants')}</span>`;
        return;
      }
      selectedParticipantsWrap.innerHTML = selectedParticipants
        .map((name, i) => `
          <span class="logbook-participant-chip">
            ${App.escapeHTML(name)}
            <button type="button" class="logbook-remove-chip" onclick="window._removeLogbookParticipant(${i})">×</button>
          </span>
        `)
        .join('');
    }

    function addParticipantName(name) {
      const cleanName = (name || '').trim();
      if (!cleanName) return;
      if (selectedParticipants.includes(cleanName)) return;
      selectedParticipants.push(cleanName);
      renderSelectedParticipants();
    }

    window._removeLogbookParticipant = (index) => {
      selectedParticipants.splice(index, 1);
      renderSelectedParticipants();
    };

    if (participantSelect) {
      participantSelect.addEventListener('change', () => {
        addParticipantName(participantSelect.value);
        participantSelect.value = '';
      });
    }

    if (addParticipantBtn && manualParticipantInput) {
      addParticipantBtn.addEventListener('click', () => {
        addParticipantName(manualParticipantInput.value);
        manualParticipantInput.value = '';
        manualParticipantInput.focus();
      });
      manualParticipantInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addParticipantBtn.click();
        }
      });
    }

    renderSelectedParticipants();

    function syncEntryTypeUI() {
      const isIncidentType = typeSelect.value === 'incident';
      const isLogbookType = typeSelect.value === 'logbook';
      document.querySelectorAll('.incident-only-field, .incident-only-row').forEach(el => {
        el.style.display = isIncidentType ? '' : 'none';
      });
      document.querySelectorAll('.logbook-only-field, .logbook-only-row').forEach(el => {
        el.style.display = isLogbookType ? '' : 'none';
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
      const entryTypeValue = document.getElementById('inc-entry-type').value;
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
        entryType: entryTypeValue,
        description,
        category: entryTypeValue === 'incident' ? document.getElementById('inc-category').value : '',
        status: entryTypeValue === 'incident' ? document.getElementById('inc-status').value : 'resolved',
        responsiblePerson: entryTypeValue === 'incident' ? document.getElementById('inc-responsible-person').value.trim() : '',
        responsibleCompany: entryTypeValue === 'incident' ? document.getElementById('inc-responsible-company').value.trim() : '',
        participants: entryTypeValue === 'logbook' ? selectedParticipants : [],
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
      delete window._removeLogbookParticipant;
      App.closeModal();
      loadIncidents();
    });
  }

  async function editIncident(id) {
    const incident = await DB.getById('incidents', id);
    if (incident) openIncidentForm(incident);
  }

  async function deleteIncident(id) {
    if (!await App.confirm(App.t('confirm_delete_diary_entry'))) return;
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
    const dateFilter = document.getElementById('diary-date-filter');
    if (dateFilter) dateFilter.value = '';
    await loadIncidents();

    const card = document.querySelector(`.incident-card[data-id="${id}"]`);
    if (!card) return;

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('incident-card-focus');
    setTimeout(() => card.classList.remove('incident-card-focus'), 2200);
  }

  return { init, editIncident, deleteIncident, cycleStatus, focusIncident };
})();
