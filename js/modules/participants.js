/* ========================================
   Participants Module - Contactos de Obra
   Gestión de participantes internos y externos
   ======================================== */

const ParticipantsModule = (() => {
// Actualizado: 2026-04-10
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
    const btnImportPdf = document.getElementById('btn-import-participants-pdf');
    const inputImportPdf = document.getElementById('participants-pdf-input');
    const search = document.getElementById('participants-search');
    const typeFilter = document.getElementById('participants-type-filter');

    if (btnAdd) btnAdd.onclick = () => openParticipantForm();
    if (btnAddEmpty) btnAddEmpty.onclick = () => openParticipantForm();
    if (btnImportPdf && inputImportPdf) {
      btnImportPdf.onclick = () => inputImportPdf.click();
      inputImportPdf.onchange = (e) => handlePdfImport(e);
    }
    if (search) search.oninput = () => loadParticipants();
    if (typeFilter) typeFilter.onchange = () => loadParticipants();
  }

  async function handlePdfImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      App.toast(App.t('participants_import_pdf_error'), 'error');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Clonar el ArrayBuffer para evitar DataCloneError
      const clonedBuffer = arrayBuffer.slice(0);
      const pages = await PdfParserModule.extractText(clonedBuffer);
      const allLines = pages.flat();
      const candidates = parseParticipantsFromLines(allLines);

      if (candidates.length === 0) {
        App.toast(App.t('participants_import_pdf_no_candidates'), 'warning');
        return;
      }

      // Guardar PDF en biblioteca de documentos con categoría participantes
      // Usamos el buffer original que no ha sido consumido
      await DB.add('files', {
        projectId,
        name: file.name,
        type: file.type,
        size: file.size,
        data: arrayBuffer,
        category: 'participantes',
        uploadedAt: new Date().toISOString()
      });

      openPdfPreviewModal(candidates, file.name);
    } catch (err) {
      console.error('[Participants] PDF import error:', err);
      App.toast(App.t('participants_import_pdf_error'), 'error');
    }
  }

  function parseParticipantsFromLines(lines) {
    const HEADER_RE = /(autorizad|listado|obra|empresa|firma|fecha|dni\/nie|documento|contrata)/i;
    // Mejorada regex para detectar más formatos de DNI/NIE:
    // - 8 dígitos + letra (estándar)
    // - 7-8 dígitos + letra (formatos antiguos)
    // - XYZ + 7-8 dígitos + letra (NIE)
    // - Letra + 7-8 dígitos (formato alternativo)
    // - Con o sin espacios/guiones
    const DOC_RE = /\b(?:[XYZ]?\s*\d{7,8}\s*[-/]?\s*[A-Za-z]|[A-Za-z]\s*\d{7,8})\b/;
    const DATE_RE = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/;
    const ROLE_HINT_RE = /(jefe|encargad|capataz|operari|oficial|pe[oó]n|coordinador|seguridad|instalador|t[eé]cnico|electricista|fontanero|soldador|alba[ñn]il)/i;
    const COMPANY_HINT_RE = /(s\.l\.?|s\.a\.?|slu|sl|sa|ute|construcciones|servicios|instalaciones|contratas|reformas|ingenier[ií]a)/i;

    function cleanText(text) {
      return (text || '')
        .replace(/\s+/g, ' ')
        .replace(/^[\d\-.)\s]+/, '')
        .trim();
    }

    function isNameLine(line) {
      const text = cleanText(line);
      if (!text || text.length < 5) return false;
      // No debe contener DNI
      if (DOC_RE.test(text)) return false;
      // No debe ser solo una fecha
      if (DATE_RE.test(text) && text.split(/\s+/).length <= 2) return false;
      // No debe ser cabecera
      if (HEADER_RE.test(text)) return false;
      // No debe ser solo números o X
      if (/^[\dX\s]+$/.test(text)) return false;
      // Filtrar palabras clave que no son nombres
      const invalidKeywords = ['h 6 h', 'h 20h', 'conforme', 'mantenimiento', 'realizar', 'que toda', 'Plataformas', 'Puesto', 'Trab', 'Formación', '(mínimo', '(poner', 'Espacios', 'LOPEZ IZA CONSTRUCCIONES', 'Operador', 'Carretillas', 'Electricidad', 'Fontanería', 'climatización', 'Carpintería', 'Otros', 'Trabajos', 'altura', 'verticales', 'marcar', 'cumimentar', 'necesario', 'D./Dña.', 'Nivel', 'PRL', 'h.'];
      for (const kw of invalidKeywords) {
        if (text.toLowerCase().includes(kw.toLowerCase())) return false;
      }
      // Debe tener formato de nombre (mayúsculas o título, 2-4 palabras)
      const words = text.split(/\s+/).filter(w => w.length > 1);
      if (words.length < 2 || words.length > 5) return false;
      // Al menos la primera palabra debe empezar con mayúscula
      if (words[0] && words[0][0] !== words[0][0].toUpperCase()) return false;
      return true;
    }

    // Extraer todos los DNIs con sus índices
    const dniEntries = [];
    lines.forEach((line, idx) => {
      const clean = cleanText(line);
      const match = clean.match(DOC_RE);
      if (match && !HEADER_RE.test(clean)) {
        dniEntries.push({
          documentId: match[0].toUpperCase(),
          lineIndex: idx,
          line: clean
        });
      }
    });

    // Extraer todas las líneas que parecen nombres
    const nameEntries = [];
    lines.forEach((line, idx) => {
      if (isNameLine(line)) {
        const name = cleanText(line);
        // Eliminar palabras irrelevantes
        const cleanName = name.replace(/\b(dni|nie|doc(?:umento)?|n[ºo°]|firma|fecha|autoriz|listado|obra|empresa|representante)\b.*$/gi, '').trim();
        if (cleanName.length > 5) {
          nameEntries.push({
            name: cleanName,
            lineIndex: idx
          });
        }
      }
    });

    console.log('[Participants] DNIs encontrados:', dniEntries.length);
    console.log('[Participants] Nombres encontrados:', nameEntries.length);
    console.log('[Participants] DNIs:', dniEntries.map(e => e.documentId));
    console.log('[Participants] Nombres:', nameEntries.map(e => e.name));

    // Función para detectar si es autónomo basándose en las filas después del DNI
    function isAutonomous(lines, dniLineIndex) {
      // Según el usuario: X en la fila de después del DNI = autónomo, X en dos filas después = no autónomo
      const nextLine = dniLineIndex + 1 < lines.length ? cleanText(lines[dniLineIndex + 1]) : '';
      const nextNextLine = dniLineIndex + 2 < lines.length ? cleanText(lines[dniLineIndex + 2]) : '';
      
      // Si hay X en la línea siguiente, es autónomo
      if (nextLine.includes('X') && !nextLine.includes('X X')) {
        return true;
      }
      // Si hay X X en la línea siguiente o hay X en dos filas después, no es autónomo
      if (nextLine.includes('X X') || nextNextLine.includes('X')) {
        return false;
      }
      return null; // No se pudo determinar
    }

    // Crear participantes para todos los nombres sin mapeo automático de DNIs
    // El usuario puede editar los DNIs manualmente en el modal
    const found = [];
    const seenNames = new Set();

    nameEntries.forEach(nameEntry => {
      if (seenNames.has(nameEntry.name)) return;
      seenNames.add(nameEntry.name);

      found.push({
        name: nameEntry.name,
        type: 'external',
        role: '',
        company: '',
        phone: '',
        email: '',
        notes: '',
        documentId: '',
        sourceLine: nameEntry.lineIndex
      });
    });

    console.log('[Participants] Participantes detectados:', found.length);
    return found;
  }

  function openPdfPreviewModal(candidates, fileName) {
    const rows = candidates.map((c, i) => `
      <tr data-idx="${i}">
        <td><input type="checkbox" class="pdf-participant-check" checked></td>
        <td><input type="text" class="pdf-participant-name" value="${App.escapeHTML(c.name)}" style="width:100%;padding:4px;border:1px solid var(--border);border-radius:4px"></td>
        <td><input type="text" class="pdf-participant-dni" value="${App.escapeHTML(c.documentId || '')}" style="width:100%;padding:4px;border:1px solid var(--border);border-radius:4px"></td>
        <td><input type="text" class="pdf-participant-company" value="${App.escapeHTML(c.company || '')}" style="width:100%;padding:4px;border:1px solid var(--border);border-radius:4px"></td>
        <td><input type="text" class="pdf-participant-role" value="${App.escapeHTML(c.role || '')}" style="width:100%;padding:4px;border:1px solid var(--border);border-radius:4px"></td>
      </tr>
    `).join('');

    const body = `
      <div style="display:flex;flex-direction:column;gap:10px;max-height:65vh;overflow:auto">
        <div style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card)">
          <strong>${App.escapeHTML(fileName)}</strong><br>
          <small>${App.t('participants_import_pdf_candidates', { count: candidates.length })}</small>
        </div>
        <table class="data-table" style="font-size:12px">
          <thead>
            <tr>
              <th style="width:36px"><input type="checkbox" id="pdf-participants-check-all" checked></th>
              <th>${App.t('full_name')}</th>
              <th>DNI/NIE</th>
              <th>${App.t('company')}</th>
              <th>${App.t('role')}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">${App.t('cancel')}</button>
      <button class="btn btn-primary" id="btn-confirm-import-participants-pdf">
        <i data-lucide="user-plus"></i> ${App.t('participants_import_pdf_confirm_button')}
      </button>
    `;

    App.openModal(App.t('participants_import_pdf_modal_title'), body, footer, { width: '800px' });

    const checkAll = document.getElementById('pdf-participants-check-all');
    if (checkAll) {
      checkAll.addEventListener('change', () => {
        document.querySelectorAll('.pdf-participant-check').forEach(cb => { cb.checked = checkAll.checked; });
      });
    }

    document.getElementById('btn-confirm-import-participants-pdf').addEventListener('click', async () => {
      const selectedRows = [...document.querySelectorAll('.pdf-participant-check:checked')]
        .map(cb => cb.closest('tr'))
        .filter(tr => tr);

      if (selectedRows.length === 0) {
        App.toast(App.t('participants_import_pdf_none_selected'), 'warning');
        return;
      }

      const approved = await App.confirm(
        App.t('participants_import_pdf_final_confirm', { count: selectedRows.length }),
        { title: App.t('participants_import_pdf_modal_title'), confirmLabel: App.t('accept'), cancelLabel: App.t('cancel'), danger: false }
      );
      if (!approved) return;

      const existing = await DB.getAllForProject('participants', projectId);
      const existingKeys = new Set(existing.map(p => `${(p.name || '').trim().toLowerCase()}|${(p.company || '').trim().toLowerCase()}`));

      let created = 0;
      let skipped = 0;

      for (const row of selectedRows) {
        const name = row.querySelector('.pdf-participant-name')?.value?.trim() || '';
        const documentId = row.querySelector('.pdf-participant-dni')?.value?.trim() || '';
        const company = row.querySelector('.pdf-participant-company')?.value?.trim() || '';
        const role = row.querySelector('.pdf-participant-role')?.value?.trim() || '';

        if (!name) continue;
        const key = `${name.toLowerCase()}|${company.toLowerCase()}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        await DB.add('participants', {
          projectId,
          name,
          type: 'external',
          role,
          company,
          documentId,
          phone: '',
          email: '',
          notes: documentId ? `${App.t('participants_import_pdf_notes_prefix')} ${documentId}` : '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        existingKeys.add(key);
        created++;
      }

      App.closeModal();
      await loadParticipants();
      App.toast(App.t('participants_import_pdf_result', { created, skipped }), 'success');
    });
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
      const typeLabel = p.type === 'internal' ? App.t('participant_type_internal') : App.t('participant_type_external');
      const typeBadge = p.type === 'internal' ? 'badge-active' : 'badge-pending';
      const initials = getInitials(p.name);
      const avatarColor = stringToColor(p.name || '');

      return `
        <div class="participant-card" data-id="${p.id}">
          <div class="participant-card-header">
            <div class="participant-avatar" style="background:${avatarColor}">${App.escapeHTML(initials)}</div>
            <div class="participant-info">
              <div class="participant-name participant-editable" data-field="name" data-id="${p.id}">${App.escapeHTML(p.name || App.t('no_name'))}</div>
              <div class="participant-role participant-editable" data-field="role" data-id="${p.id}">${App.escapeHTML(p.role || '')}</div>
            </div>
            <select class="badge ${typeBadge} participant-type-badge participant-editable" data-field="type" data-id="${p.id}" style="border:none;background:transparent;cursor:pointer;padding:0;font-size:10px;font-weight:600;white-space:nowrap">
              <option value="internal" ${p.type === 'internal' ? 'selected' : ''}>${App.t('participant_type_internal')}</option>
              <option value="external" ${p.type === 'external' ? 'selected' : ''}>${App.t('participant_type_external')}</option>
            </select>
          </div>
          ${p.company ? `<div class="participant-detail"><i data-lucide="building-2"></i><span class="participant-editable" data-field="company" data-id="${p.id}">${App.escapeHTML(p.company)}</span></div>` : ''}
          ${p.phone ? `<div class="participant-detail participant-detail-link" onclick="ParticipantsModule.callPhone('${App.escapeHTML(p.phone)}')"><i data-lucide="phone"></i>${App.escapeHTML(p.phone)}</div>` : ''}
          ${p.email ? `<div class="participant-detail participant-detail-link" onclick="ParticipantsModule.sendEmail('${App.escapeHTML(p.email)}')"><i data-lucide="mail"></i>${App.escapeHTML(p.email)}</div>` : ''}
          ${p.notes ? `<div class="participant-notes">${App.escapeHTML(p.notes)}</div>` : ''}
          <div class="participant-card-actions">
            <button class="action-btn" onclick="ParticipantsModule.edit(${p.id})" title="${App.t('edit')}">
              <i data-lucide="pencil"></i>
            </button>
            <button class="action-btn action-btn-danger" onclick="ParticipantsModule.remove(${p.id})" title="${App.t('delete')}">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();

    // Setup inline editing
    grid.querySelectorAll('.participant-editable').forEach(el => {
      if (el.tagName === 'SELECT') {
        el.addEventListener('change', async (e) => {
          const field = e.target.dataset.field;
          const id = parseInt(e.target.dataset.id);
          const value = e.target.value;
          await saveInlineEdit(id, field, value, e.target);
        });
      } else {
        el.setAttribute('contenteditable', 'true');
        el.addEventListener('blur', async (e) => {
          const field = e.target.dataset.field;
          const id = parseInt(e.target.dataset.id);
          const value = e.target.textContent.trim();
          await saveInlineEdit(id, field, value, e.target);
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
          }
        });
      }
    });
  }

  async function saveInlineEdit(id, field, value, element) {
    const participant = await DB.getById('participants', id);
    if (!participant) return;

    participant[field] = value;
    participant.updatedAt = new Date().toISOString();

    // Update type badge class if type changed
    if (field === 'type' && element.tagName === 'SELECT') {
      element.classList.remove('badge-active', 'badge-pending');
      element.classList.add(value === 'internal' ? 'badge-active' : 'badge-pending');
    }

    // Update avatar if name changed
    if (field === 'name') {
      const avatar = element.closest('.participant-card').querySelector('.participant-avatar');
      if (avatar) {
        avatar.textContent = getInitials(value);
        avatar.style.background = stringToColor(value || '');
      }
    }

    await DB.put('participants', participant);
    App.toast(App.t('participant_updated'), 'success');
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
    const title = isEdit ? App.t('edit_participant') : App.t('new_participant');

    const body = `
      <div class="form-grid">
        <div class="form-group">
          <label>${App.t('full_name')} *</label>
          <input type="text" id="part-name" value="${App.escapeHTML(existing?.name || '')}" required>
        </div>
        <div class="form-group">
          <label>${App.t('type')}</label>
          <select id="part-type">
            <option value="internal" ${(existing?.type || 'internal') === 'internal' ? 'selected' : ''}>${App.t('participant_type_internal')}</option>
            <option value="external" ${existing?.type === 'external' ? 'selected' : ''}>${App.t('participant_type_external')}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${App.t('role')}</label>
          <select id="part-role">
            <option value="">${App.t('select')}</option>
            ${ROLES.map(r => `<option value="${r}" ${existing?.role === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>${App.t('company')}</label>
          <input type="text" id="part-company" value="${App.escapeHTML(existing?.company || '')}">
        </div>
        <div class="form-group">
          <label>${App.t('phone')}</label>
          <input type="tel" id="part-phone" value="${App.escapeHTML(existing?.phone || '')}">
        </div>
        <div class="form-group">
          <label>${App.t('email')}</label>
          <input type="email" id="part-email" value="${App.escapeHTML(existing?.email || '')}">
        </div>
        <div class="form-group form-group-full">
          <label>${App.t('notes')}</label>
          <textarea id="part-notes" rows="3">${App.escapeHTML(existing?.notes || '')}</textarea>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">${App.t('cancel')}</button>
      <button class="btn btn-primary" id="btn-save-participant">
        <i data-lucide="save"></i> ${isEdit ? App.t('save') : App.t('create')}
      </button>
    `;

    App.openModal(title, body, footer);

    document.getElementById('btn-save-participant').addEventListener('click', async () => {
      const name = document.getElementById('part-name').value.trim();
      if (!name) { App.toast(App.t('participant_name_required'), 'warning'); return; }

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
        App.toast(App.t('participant_updated'), 'success');
      } else {
        data.createdAt = new Date().toISOString();
        await DB.add('participants', data);
        App.toast(App.t('participant_added'), 'success');
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
    if (!await App.confirm(App.t('confirm_delete_participant'))) return;
    await DB.remove('participants', id);
    App.toast(App.t('participant_deleted'), 'success');
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
