/* ========================================
   Participants Module - Contactos de Obra
   Gestión de participantes internos y externos
   ======================================== */

const ParticipantsModule = (() => {
  const ROLES = [
    'Director de Obra', 'Jefe de Obra', 'Arquitecto', 'Aparejador',
    'Encargado', 'Capataz', 'Coordinador de Seguridad', 'Project Manager',
    'Ingeniero', 'Topógrafo', 'Promotor', 'Propietario',
    'Subcontratista', 'Proveedor', 'Instalador', 'Consultor',
    'Administrador', 'Legal', 'Otro'
  ];

  let projectId = null;

  function init(pid) {
    projectId = pid;
    setupButtons();
    loadParticipants();
  }

  function setupButtons() {
    const btnAdd = document.getElementById('btn-add-participant');
    const btnAddEmpty = document.getElementById('btn-add-participant-empty');
    const search = document.getElementById('participants-search');
    const typeFilter = document.getElementById('participants-type-filter');

    if (btnAdd) btnAdd.onclick = () => openParticipantForm();
    if (btnAddEmpty) btnAddEmpty.onclick = () => openParticipantForm();
    if (search) search.oninput = () => loadParticipants();
    if (typeFilter) typeFilter.onchange = () => loadParticipants();
  }

  async function loadParticipants() {
    const search = (document.getElementById('participants-search')?.value || '').toLowerCase();
    const typeFilter = document.getElementById('participants-type-filter')?.value || 'all';

    let items = await DB.getAllForProject('participants', projectId);

    if (typeFilter !== 'all') {
      items = items.filter(p => p.type === typeFilter);
    }

    if (search) {
      items = items.filter(p =>
        (p.name || '').toLowerCase().includes(search) ||
        (p.company || '').toLowerCase().includes(search) ||
        (p.role || '').toLowerCase().includes(search) ||
        (p.email || '').toLowerCase().includes(search) ||
        (p.phone || '').toLowerCase().includes(search)
      );
    }

    items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    renderGrid(items);
  }

  function renderGrid(items) {
    const grid = document.getElementById('participants-grid');
    const empty = document.getElementById('participants-empty');
    if (!grid) return;

    if (items.length === 0) {
      grid.style.display = 'none';
      if (empty) empty.style.display = 'flex';
      return;
    }

    grid.style.display = 'grid';
    if (empty) empty.style.display = 'none';

    grid.innerHTML = items.map(p => {
      const typeLabel = p.type === 'internal' ? 'Interno' : 'Externo';
      const typeBadge = p.type === 'internal' ? 'badge-active' : 'badge-pending';
      const initials = getInitials(p.name);
      const avatarColor = stringToColor(p.name || '');

      return `
        <div class="participant-card" data-id="${p.id}">
          <div class="participant-card-header">
            <div class="participant-avatar" style="background:${avatarColor}">${App.escapeHTML(initials)}</div>
            <div class="participant-info">
              <div class="participant-name">${App.escapeHTML(p.name || 'Sin nombre')}</div>
              <div class="participant-role">${App.escapeHTML(p.role || '')}</div>
            </div>
            <span class="badge ${typeBadge} participant-type-badge">${typeLabel}</span>
          </div>
          ${p.company ? `<div class="participant-detail"><i data-lucide="building-2"></i>${App.escapeHTML(p.company)}</div>` : ''}
          ${p.phone ? `<div class="participant-detail participant-detail-link" onclick="ParticipantsModule.callPhone('${App.escapeHTML(p.phone)}')"><i data-lucide="phone"></i>${App.escapeHTML(p.phone)}</div>` : ''}
          ${p.email ? `<div class="participant-detail participant-detail-link" onclick="ParticipantsModule.sendEmail('${App.escapeHTML(p.email)}')"><i data-lucide="mail"></i>${App.escapeHTML(p.email)}</div>` : ''}
          ${p.notes ? `<div class="participant-notes">${App.escapeHTML(p.notes)}</div>` : ''}
          <div class="participant-card-actions">
            <button class="action-btn" onclick="ParticipantsModule.edit(${p.id})" title="Editar">
              <i data-lucide="pencil"></i>
            </button>
            <button class="action-btn action-btn-danger" onclick="ParticipantsModule.remove(${p.id})" title="Eliminar">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 55%, 45%)`;
  }

  function openParticipantForm(existing) {
    const isEdit = !!existing;
    const title = isEdit ? 'Editar Participante' : 'Nuevo Participante';

    const body = `
      <div class="form-grid">
        <div class="form-group">
          <label>Nombre completo *</label>
          <input type="text" id="part-name" value="${App.escapeHTML(existing?.name || '')}" required>
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select id="part-type">
            <option value="internal" ${(existing?.type || 'internal') === 'internal' ? 'selected' : ''}>Interno</option>
            <option value="external" ${existing?.type === 'external' ? 'selected' : ''}>Externo</option>
          </select>
        </div>
        <div class="form-group">
          <label>Rol / Cargo</label>
          <select id="part-role">
            <option value="">Seleccionar...</option>
            ${ROLES.map(r => `<option value="${r}" ${existing?.role === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Empresa</label>
          <input type="text" id="part-company" value="${App.escapeHTML(existing?.company || '')}">
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input type="tel" id="part-phone" value="${App.escapeHTML(existing?.phone || '')}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="part-email" value="${App.escapeHTML(existing?.email || '')}">
        </div>
        <div class="form-group form-group-full">
          <label>Notas</label>
          <textarea id="part-notes" rows="3">${App.escapeHTML(existing?.notes || '')}</textarea>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-participant">
        <i data-lucide="save"></i> ${isEdit ? 'Guardar' : 'Crear'}
      </button>
    `;

    App.openModal(title, body, footer);

    document.getElementById('btn-save-participant').addEventListener('click', async () => {
      const name = document.getElementById('part-name').value.trim();
      if (!name) { App.toast('El nombre es obligatorio', 'warning'); return; }

      const data = {
        projectId,
        name,
        type: document.getElementById('part-type').value,
        role: document.getElementById('part-role').value,
        company: document.getElementById('part-company').value.trim(),
        phone: document.getElementById('part-phone').value.trim(),
        email: document.getElementById('part-email').value.trim(),
        notes: document.getElementById('part-notes').value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = existing.id;
        data.createdAt = existing.createdAt;
        await DB.put('participants', data);
        App.toast('Participante actualizado', 'success');
      } else {
        data.createdAt = new Date().toISOString();
        await DB.add('participants', data);
        App.toast('Participante añadido', 'success');
      }

      App.closeModal();
      loadParticipants();
    });
  }

  async function edit(id) {
    const item = await DB.getById('participants', id);
    if (item) openParticipantForm(item);
  }

  async function remove(id) {
    if (!confirm('¿Eliminar este participante?')) return;
    await DB.remove('participants', id);
    App.toast('Participante eliminado', 'success');
    loadParticipants();
  }

  function callPhone(phone) {
    window.open('tel:' + encodeURIComponent(phone));
  }

  function sendEmail(email) {
    window.open('mailto:' + encodeURIComponent(email));
  }

  return { init, loadParticipants, edit, remove, callPhone, sendEmail };
})();
