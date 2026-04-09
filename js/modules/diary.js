/* ========================================
   Diary Module - Diario de Obra
   Incidencias, comentarios y evolución
   ======================================== */

const DiaryModule = (() => {
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

  const CATEGORIES = [
    'Estructural', 'Fontanería', 'Electricidad', 'Acabados',
    'Seguridad', 'Material', 'Comunicación', 'Plazo', 'Otros'
  ];

  let projectId = null;

  function init(pid) {
    projectId = pid;
    setupButtons();
    loadIncidents();
  }

  function setupButtons() {
    document.getElementById('btn-add-incident').addEventListener('click', () => openIncidentForm(null, 'incident'));
    document.getElementById('btn-add-comment').addEventListener('click', () => openIncidentForm(null, 'comment'));
    document.getElementById('btn-add-evolution').addEventListener('click', () => openIncidentForm(null, 'evolution'));
    document.getElementById('btn-add-incident-empty').addEventListener('click', () => openIncidentForm(null, 'incident'));
    document.getElementById('btn-add-comment-empty').addEventListener('click', () => openIncidentForm(null, 'comment'));
    document.getElementById('btn-add-evolution-empty').addEventListener('click', () => openIncidentForm(null, 'evolution'));
    document.getElementById('diary-filter').addEventListener('change', loadIncidents);
    document.getElementById('diary-type-filter').addEventListener('change', loadIncidents);
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
          if (file && file.blob) {
            const url = URL.createObjectURL(file.blob);
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
                  title="Click para cambiar estado">
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
              <i data-lucide="pencil"></i> Editar
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
          <div class="diary-group-title">Entradas del diario</div>
          <div class="diary-group-list">${mainParts.join('')}</div>
        </div>
      `);
    }

    if (evolutionParts.length > 0) {
      sections.push(`
        <div class="diary-group diary-group-evolution">
          <div class="diary-group-title">Línea temporal de evolución</div>
          <div class="evolution-timeline">${evolutionParts.join('')}</div>
        </div>
      `);
    }

    feed.innerHTML = sections.join('');
    lucide.createIcons();
  }

  // --- Incident Form ---
  function openIncidentForm(incident = null, presetType = 'incident') {
    const isEdit = !!incident;
    const effectiveType = isEdit ? (incident.entryType || 'incident') : presetType;
    const typeTitles = {
      incident: 'Nueva Incidencia',
      comment: 'Nuevo Comentario',
      evolution: 'Nueva Evolución'
    };
    const title = isEdit ? 'Editar Entrada' : (typeTitles[effectiveType] || 'Nueva Entrada');

    const now = new Date().toISOString().slice(0, 16);
    const entryType = effectiveType;

    const body = `
      <div class="form-row">
        <div class="form-group">
          <label>Tipo de entrada</label>
          <select id="inc-entry-type">
            <option value="incident" ${entryType === 'incident' ? 'selected' : ''}>Incidencia</option>
            <option value="comment" ${entryType === 'comment' ? 'selected' : ''}>Comentario</option>
            <option value="evolution" ${entryType === 'evolution' ? 'selected' : ''}>Evolución</option>
          </select>
        </div>
        <div class="form-group incident-only-field">
          <label>Estado</label>
          <select id="inc-status">
            <option value="pending" ${isEdit && incident.status === 'pending' ? 'selected' : ''}>Pendiente</option>
            <option value="in-progress" ${isEdit && incident.status === 'in-progress' ? 'selected' : ''}>En proceso</option>
            <option value="resolved" ${isEdit && incident.status === 'resolved' ? 'selected' : ''}>Resuelto</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Descripción *</label>
        <textarea id="inc-description" rows="3" placeholder="Describe la entrada del diario...">${isEdit ? App.escapeHTML(incident.description) : ''}</textarea>
      </div>
      <div class="form-row incident-only-row">
        <div class="form-group incident-only-field">
          <label>Categoría</label>
          <select id="inc-category">
            ${CATEGORIES.map(c => `<option value="${c}" ${isEdit && incident.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row incident-only-row">
        <div class="form-group incident-only-field">
          <label>Persona responsable</label>
          <input type="text" id="inc-responsible-person" placeholder="Nombre del responsable" value="${isEdit ? App.escapeHTML(incident.responsiblePerson || '') : ''}">
        </div>
        <div class="form-group incident-only-field">
          <label>Empresa</label>
          <input type="text" id="inc-responsible-company" placeholder="Empresa o subcontrata" value="${isEdit ? App.escapeHTML(incident.responsibleCompany || '') : ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Fecha y Hora</label>
        <input type="datetime-local" id="inc-date" value="${isEdit ? incident.date.slice(0, 16) : now}">
      </div>
      <div class="form-group">
        <label>Fotos</label>
        <div class="upload-zone" id="photo-upload-zone">
          <i data-lucide="camera"></i>
          <p>Arrastra fotos aquí o haz click para seleccionar</p>
          <input type="file" id="photo-input" accept="image/*" multiple hidden>
        </div>
        <div class="upload-preview" id="photo-preview"></div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-incident">
        <i data-lucide="save"></i> ${isEdit ? 'Guardar' : 'Registrar'}
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
          <button class="remove-photo" onclick="event.stopPropagation(); this.closest('.upload-preview-item').remove(); window._removePendingPhoto(${i});" title="Quitar">×</button>
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
        App.toast('La descripción es obligatoria', 'warning');
        return;
      }

      // Save new photos to IndexedDB
      const newPhotoIds = [];
      for (const photo of pendingPhotos) {
        const id = await DB.saveFile(photo.blob, photo.name, photo.blob.type);
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
        App.toast('Entrada actualizada', 'success');
      } else {
        data.createdAt = new Date().toISOString();
        data.projectId = projectId;
        await DB.add('incidents', data);
        App.toast('Entrada registrada', 'success');
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
    if (!confirm('¿Eliminar esta entrada del diario?')) return;
    await DB.remove('incidents', id);
    App.toast('Entrada eliminada', 'info');
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
